/**
 * AETHER GT — real-browser render check for the BMW page.
 *
 * Needs: internet (Three.js / GSAP / Draco load from jsDelivr), Playwright with Chromium,
 *        and the site served over HTTP:   python3 -m http.server 8080
 * Run:   node tools/render-check.cjs [baseUrl] [outDir]
 *        (npm i -D playwright && npx playwright install chromium, if you don't have it)
 *
 * It opens the real page at desktop, Pixel 5 and 360 px sizes, waits for the real 3D load, scrolls through
 * the camera path, scrolls back, and saves PNGs. It FAILS (exit 1) if 3D did not start, the model failed,
 * the console shows errors, the canvas is blank, the car touches the frame edge, or scrolling back does not
 * reproduce the earlier frame. The pixel checks are heuristics: ALWAYS LOOK AT THE SAVED PNGs as well.
 * Headless Chromium uses a software GL renderer, so it is slow and says nothing about phone GPU speed.
 *
 * STATUS: written in Phase 05 in a sandbox with no CDN access. There it was only run to confirm that it
 * reports "3D did not start" correctly. It has NOT yet been run against a live render.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = process.argv[3] || 'render-check-out';
fs.mkdirSync(OUT, { recursive: true });

const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  pixel5: { ...devices['Pixel 5'] },
  phone360: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const STOPS = [0, 0.13, 0.26, 0.4, 0.52, 0.64, 0.76, 0.88, 1];
const SETTLE_MS = 2200; // scrub inertia is 1 s, plus software-GL frame time

/** Pixel stats of a PNG buffer, computed in a scratch page: where is anything brighter than the backdrop? */
async function analyse(scratch, png) {
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  return scratch.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    let minX = width, minY = height, maxX = -1, maxY = -1, lit = 0, sum = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      if (l > 70) { lit++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { width, height, meanLuma: sum / (width * height), litFraction: lit / (width * height), box: lit ? { minX, minY, maxX, maxY } : null };
  }, dataUrl);
}

function meanAbsDiff(scratch, a, b) {
  const u = (p) => 'data:image/png;base64,' + p.toString('base64');
  return scratch.evaluate(async ([ua, ub]) => {
    const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const [A, B] = [await load(ua), await load(ub)]; let d = 0; for (let k = 0; k < A.length; k += 4) d += Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
    return d / (A.length / 4) / 3;
  }, [u(a), u(b)]);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const problems = [];
  const scratch = await (await browser.newContext()).newPage();
  await scratch.setContent('<canvas></canvas>');

  for (const [name, opts] of Object.entries(PROFILES)) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    const t0 = Date.now();
    await page.goto(`${BASE}/bmw-m5.html`, { waitUntil: 'load' });
    const outcome = await page.waitForFunction(() => {
      const c = document.documentElement.classList;
      if (c.contains('no-webgl')) return 'no-webgl';
      if (c.contains('model-failed')) return 'model-failed';
      const l = document.querySelector('[data-loader]');
      if (!c.contains('is-loading') && l && l.hidden) return 'ready';
      return false;
    }, null, { timeout: 90000, polling: 200 }).then((h) => h.jsonValue()).catch(() => 'timeout');
    console.log(`\n[${name}] outcome: ${outcome} after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (outcome !== 'ready') {
      problems.push(`${name}: 3D did not reach the ready state (${outcome}). Page note: ${await page.evaluate(() => (document.querySelector('[data-webgl-fallback]:not([hidden])') || document.querySelector('[data-model-error]:not([hidden])') || {}).textContent || '(none)')}`);
      await page.screenshot({ path: `${OUT}/${name}-not-ready.png` });
      problems.push(...consoleErrors.slice(0, 8).map((e) => `${name} console: ${e}`));
      await ctx.close();
      continue;
    }

    // Judge the 3D scene only: hide text, header, vignette. The canvas stays.
    await page.addStyleTag({ content: '.hud,.site-header,.hero,.scroll-progress,.atmosphere,.model-error{visibility:hidden!important}' });
    const shots = {};
    const info = await page.evaluate(() => ({ track: document.querySelector('[data-showcase]').offsetHeight, vh: innerHeight }));
    const at = async (f) => { await page.evaluate(([f, info]) => window.scrollTo({ top: f * (info.track - info.vh), behavior: 'instant' }), [f, info]); await page.waitForTimeout(SETTLE_MS); return page.screenshot({ path: `${OUT}/${name}-${String(Math.round(f * 100)).padStart(3, '0')}.png` }); };

    for (const f of STOPS) {
      shots[f] = await at(f);
      const s = await analyse(scratch, shots[f]);
      const edge = s.box && (s.box.minX <= 2 || s.box.maxX >= s.width - 3 || s.box.minY <= 2 || s.box.maxY >= s.height - 3);
      console.log(`  progress ${f.toFixed(2)}: mean luma ${s.meanLuma.toFixed(1)}, lit ${(s.litFraction * 100).toFixed(1)}%, box ${s.box ? `${s.box.minX},${s.box.minY} → ${s.box.maxX},${s.box.maxY}` : 'none'}${edge ? '  <-- touches frame edge' : ''}`);
      if (s.litFraction < 0.004) problems.push(`${name}@${f}: canvas looks blank / car not visible (lit ${(s.litFraction * 100).toFixed(2)}%)`);
      if (edge) problems.push(`${name}@${f}: lit pixels touch the frame edge (car clipped, or bright floor/backdrop). Look at the PNG.`);
    }
    // Reverse scroll: go back to earlier stops and compare with the first visit.
    for (const f of [0.64, 0.4, 0.26, 0]) {
      const again = await at(f);
      const diff = await meanAbsDiff(scratch, shots[f], again);
      console.log(`  reverse to ${f.toFixed(2)}: mean abs pixel difference vs first visit ${diff.toFixed(2)} (0-255)`);
      if (diff > 3) problems.push(`${name}: scrolling back to ${f} gave a different frame (diff ${diff.toFixed(2)})`);
    }
    const quality = await page.evaluate(() => { const c = document.getElementById('stage'); return { canvas: `${c.width}x${c.height}`, dpr: devicePixelRatio }; });
    console.log('  canvas', JSON.stringify(quality));
    consoleErrors.forEach((e) => { console.log('  console', e); if (!/Hiding \d+ malformed mesh/.test(e)) problems.push(`${name} console: ${e}`); });
    await ctx.close();
  }
  await browser.close();

  console.log(problems.length ? `\nFAILED (${problems.length}):\n - ${problems.join('\n - ')}` : `\nNo automatic problems found. Now open ${OUT}/ and LOOK at the images.`);
  process.exit(problems.length ? 1 : 0);
})();
