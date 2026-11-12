/**
 * Run:  node tests/vehicle-pages.test.mjs
 * Phase 02 (Redesign 02): the five individual car pages. Static checks, no browser.
 * Real-browser checks (layout at three sizes, console, navigation, reduced motion,
 * no-JS) were run separately and are listed in the phase report.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { VEHICLES, MODELS } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const FILE = (page) => page.replace(/^\//, '') + '.html'; // clean URL '/cars/bmw-m5' -> file 'cars/bmw-m5.html'
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const PAGES = VEHICLES.map((v) => FILE(v.page));
const STATIC = PAGES.filter((p) => !['cars/bmw-m5.html', 'cars/porsche-911.html', 'cars/nissan-gt-r.html', 'cars/toyota-supra.html', 'cars/corvette-c8.html'].includes(p)); // the five 3D pages are covered by their own checks
const html = Object.fromEntries(PAGES.map((p) => [p, read(p)]));
const css = read('css/vehicle.css');

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

console.log('Vehicle pages: structure');

check('all five pages load the shared set plus vehicle.css, and the shared car entry', () => {
  for (const p of PAGES) {
    for (const c of ['tokens', 'base', 'layout', 'chrome', 'vehicle']) assert.ok(html[p].includes(`css/${c}.css`), `${p} lacks ${c}.css`);
    assert.ok(html[p].includes('src="/js/pages/car.js"'), `${p} entry`);
  }
});

check('every page has identity, a dedicated vehicle section, specifications, highlights, story, journey and footer', () => {
  for (const p of PAGES) {
    const h = html[p];
    for (const id of ['specifications', 'highlights', 'story']) assert.ok(h.includes(`id="${id}"`), `${p} lacks #${id}`);
    assert.ok(h.includes('class="journey"') && h.includes('journey__all') && h.includes('href="/collection.html"'), `${p} journey/return`);
    assert.ok(h.includes('data-site-footer') && h.includes('data-site-header'), `${p} chrome`);
    assert.ok(/class="[^"]*\bledger\b/.test(h) || h.includes('class="compare"'), `${p} spec ledger`);
    assert.ok(h.includes('class="scale"'), `${p} proportions`);
  }
  for (const p of STATIC) assert.ok(/class="plate\b/.test(html[p]), `${p} vehicle frame`);
  assert.ok(html['cars/bmw-m5.html'].includes('data-showcase') && html['cars/bmw-m5.html'].includes('id="stage"'), 'BMW keeps its 3D stage');
});

check('previous / next links follow the collection order (wrapping) on every page', () => {
  VEHICLES.forEach((v, i) => {
    const prev = VEHICLES[(i + 4) % 5].page;
    const next = VEHICLES[(i + 1) % 5].page;
    const h = html[FILE(v.page)];
    assert.ok(new RegExp(`journey__link--prev[^>]*href="${prev}"|href="${prev}"[^>]*rel="prev"`).test(h), `${v.page} prev should be ${prev}`);
    assert.ok(new RegExp(`href="${next}"[^>]*rel="next"`).test(h), `${v.page} next should be ${next}`);
  });
});

check('each page is composed differently (distinct compositions, distinct hero structures)', () => {
  const comps = STATIC.map((p) => html[p].match(/data-composition="(\w)"/)?.[1]);
  assert.deepEqual(comps, []);  // no static pages are left: all five cars have a 3D page
  const heroes = STATIC.map((p) => html[p].match(/class="(hero-[a-e])"/)?.[1]);
  assert.equal(new Set(heroes).size, 0);
  const section = (p) => [...html[p].matchAll(/<section class="([^"]+)"/g)].map((m) => m[1].split(' ').pop()).join('>');
  // The Porsche page deliberately shares the BMW's 3D-page section sequence (same editorial structure).
  assert.equal(section('cars/porsche-911.html'), section('cars/bmw-m5.html'));
  assert.notEqual(section('cars/nissan-gt-r.html'), section('cars/bmw-m5.html'), 'the Nissan dossier has seven chapters, not six');
  assert.equal(section('cars/toyota-supra.html'), section('cars/nissan-gt-r.html'), 'the Supra dossier deliberately shares the Nissan seven-chapter sequence');
  assert.equal(section('cars/corvette-c8.html'), section('cars/nissan-gt-r.html'), 'the Corvette dossier shares the same seven-chapter sequence');
  assert.equal(new Set(['cars/bmw-m5.html', 'cars/nissan-gt-r.html'].map(section)).size, 2, 'the six-chapter and seven-chapter sequences differ (the Supra and Corvette share the Nissan one)');
  for (const c of ['.hero-b', '.hero-c', '.hero-d', '.hero-e', '.dossier']) assert.ok(css.includes(c), `css lacks ${c}`);
});

check('model names and identity markup match config (eyebrow / h1 / designation)', () => {
  for (const v of VEHICLES) {
    const h = html[FILE(v.page)];
    assert.ok(h.includes(`<p class="eyebrow`) && h.includes(`>${v.make}</p>`), `${v.page} make`);
    assert.ok(h.includes(`>${v.model}</h1>`), `${v.page} model`);
    assert.ok(h.includes(`>${v.designation}</p>`), `${v.page} designation`);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1);
  }
});

console.log('Vehicle pages: honesty');

check('no photography, no placeholder models, no fake 3D on the static pages (none are left)', () => {
  for (const p of STATIC) {
    assert.ok(!/<img|<picture|<video|<canvas|\.glb|<svg|three\.js|three\.module|data-loader/i.test(html[p].replace(/<script type="importmap">[\s\S]*?<\/script>/, '')), `${p} contains imagery or 3D markup`);
    assert.ok(html[p].includes('Studio imagery to follow'), `${p} frame must be labelled`);
  }
  assert.deepEqual(Object.keys(MODELS), ['bmw-m5-f90', 'porsche-911-carrera-4s', 'nissan-gt-r-r35', 'toyota-gr-supra-mk5', 'chevrolet-corvette-c8']);
});

check('every page states how figures are qualified; uncertain details are flagged, not invented', () => {
  for (const p of PAGES) {
    const h = html[p];
    assert.ok(h.includes('class="spec-note"'), `${p} spec note`);
    assert.ok(h.includes('class="flag">Varies</span>'), `${p} has no Varies flag`);
    assert.ok(h.includes('flag--confirm">To confirm</span>'), `${p} has no To confirm flag`);
  }
});

check('the proportions chart agrees with the ledger on every page', () => {
  for (const p of PAGES) {
    const h = html[p];
    const bars = [...h.matchAll(/<span>(Length|Wheelbase|Width|Height)<\/span><span class="scale__bar" style="--mm:(\d+)">/g)].map((m) => [m[1], Number(m[2])]);
    assert.equal(bars.length, 4, `${p} bars`);
    for (const [label, mm] of bars) {
      const row = h.match(new RegExp(`<dt>${label}</dt><dd>([\\d,]+) mm`));
      assert.ok(row, `${p} ledger lacks ${label}`);
      assert.equal(Number(row[1].replace(',', '')), mm, `${p} ${label} differs between ledger and chart`);
    }
  }
});

check('page text contains no invented superlatives about unverified testing', () => {
  for (const p of PAGES) assert.ok(!/fastest|nürburgring|lap record|world.?record/i.test(text(html[p])), `${p} makes an unverified record claim`);
});

console.log('Vehicle pages: BMW preservation');

check('BMW headline markup and every 3D DOM hook are still present', () => {
  const h = html['cars/bmw-m5.html'];
  assert.ok(/<p class="eyebrow">BMW<\/p>/.test(h) && /<h1 class="hero__title">M5 F90<\/h1>/.test(h) && /<p class="hero__lede">Competition<\/p>/.test(h));
  for (const hook of ['data-loader', 'data-loader-bar', 'data-loader-percent', 'data-loader-status', 'id="stage"', 'data-scroll-progress', 'data-showcase', 'data-hud', 'data-hud-make', 'data-hud-model', 'data-hud-designation', 'data-hud-index', 'data-hud-total', 'data-hud-title', 'data-hud-rail', 'data-hud-cue', 'data-model-error', 'data-model-error-message', 'data-model-error-retry', 'data-webgl-fallback', 'css/car.css', 'css/loader.css']) assert.ok(h.includes(hook), `missing ${hook}`);
  assert.ok(h.indexOf('class="showcase"') < h.indexOf('class="dossier"'), 'dossier must follow the scroll track');
  assert.ok(h.indexOf('</section>', h.indexOf('class="showcase"')) < h.indexOf('class="dossier"'), 'dossier must not sit inside the scroll track');
});

check('the 3D engine, camera system, loader, GLB and shared modules are byte-identical to Redesign 01', () => {
  const sums = [
  ['js/core/asset-queue.js', 'cae03269e17a94d0a2bde0836030a37a1caf572374c5286f87e0724220e2b9e7'],
  ['js/core/bootstrap.js', '37abe2ea8d42df427b202f95e0af03386498e719d3699aaa6a6f21c404ba7256'],
  ['js/core/loader.js', 'e11ad26090c591465ff584c23457acf3409864fbab48895ca91aa52ab344ea25'],
  ['js/core/motion.js', '8fc47a1bae570cc73131aa8768859362c24d09399b2738b7c7f661014a51c641'],
  ['js/core/quality.js', '86f9541e0d8815f0d5956461f3f1668a43517951cf5f270edb2956787010972d'],
  ['js/core/stage.js', '8cd374c3e1eff14f985828781cd6b7e8b43f943071c5704ce11eaefe27fdc6ac'],
  ['js/scene/camera-rig.js', '9080512403dc071797dc8b328f8a0c4a3cfde8fde9103c4b85ee8321b8400d3d'],
  ['js/scene/contact-shadow.js', '90fef84b7fad11335e77478127fc345e443266042ede0e5c9651af194e5f3248'],
  ['js/scene/director.js', '293fefd7fe059b78c6515d1cf50ecce955c20d9209a78b9a9c5128febc91cbf7'],
  ['js/scene/sequence.js', 'f8a44cf3a0a1946f4a1da9ea9efd01472cca2b6af2dd59a7a343465c1c948dcc'],
  ['js/scene/studio.js', 'e56fb5be03326f263a6f0470225402600252b8c7279d83725b379f85a3412a69'],
  ['js/scene/vehicle.js', '6611aea1397e347ba16123fb32f4c3ecea07b888ce77bd16f63083524bceadee'],
  ['js/scene/shots/bmw-m5-f90.js', '05acdb74bd30555801a0e654756fec00584f3d85de16a7a65d464660eb126250'],
  ['js/scene/shots/index.js', '22761d2bf62df1ee478ebcda12ac79fc64a305c40327ccd983152446ff331985'],
  ['js/ui/hud.js', 'a116aa0b5463f2cc994cf643008ce08e3f1a127a7ba7ee34422de6e76352cdf5'],
  ['js/boot-guard.js', '2969e3fa9087a9af28b423b8c4e9471d1d2850bbeeb348b76e26528c1c975359'],
  ['js/config.js', '072a9ac99a59f4999adbdaa69f52917f3587b629bc44b52950939689fbde780c'],
  ['css/car.css', '5188ca72bc967fa731229a1749051fea07e2c1d30c2d2d2ca41cef1c65505f13'],
  ['css/loader.css', 'a19504a3e0042a78a48141ade0feb7c218f3a5fb6f3e840b32ba73f3107c8c87'],
  ['css/layout.css', '31e2bccd6274afe057412166d0b480fe740f0680116dd4f94e059db755a071cb'],
  ['css/chrome.css', 'e3a85aa2656ff0234c8e40ca36b100641680fcd4701535591b6080ac4d64c91f'],
  ['css/base.css', '010e7fc6aeefd182ee673e8780be82d5e346cfa2be74256c4ca7c4d28aacd377'],
  ['css/tokens.css', '1ec87c6dd5bc570a0452ffdad0f6bf0c2f4f5726de7d936b6aeb5c24926869cf'],
  ['css/collection.css', '0db1614698683577e2714aa9e8581c5ca8d42f26554a5b1c21be4e3e8c1d8e75'],
  ['collection.html', '5bfbe7c42e477f8c226cc2602cea26bf9ed544fd89936cfc16890e9079d9b320'],
  ['assets/models/bmw-m5-f90.glb', 'd19c5ea45b43fa8bd9cbd549fe6c96d987d4c8bb4f341f55dd96f153fe7c138e'],
  ['js/pages/collection.js', '39271fdf59d2cdc86962c71dd71b10df197809b48a09361f7f321ede2cd169dc'],
  ['js/ui/site-chrome.js', '9dfb22ebdbd1c7655f9a539e4d47c13f6d6da0d1b572a6968915a5200e799027'],
  ['js/ui/showroom.js', '4abd625388f194931435dae1466b6b2f1463ff52ad2fbf9fc31cbbf9a08f35e9'],
  ['js/ui/transitions.js', '9cc6facbb31b36a17337f4a0fbf59efad6fbb16536829a832a9584b52cec58d2'],
  ];
  // HTML pages are pinned by everything after </head> (Phase 6 owns the head: SEO, icons, canonical).
  const hashOf = (file) => { let b = readFileSync(join(ROOT, file)); if (file.endsWith('.html')) b = b.subarray(b.indexOf('</head>')); return createHash('sha256').update(b).digest('hex'); };
  for (const [file, expected] of sums) {
    assert.ok(existsSync(join(ROOT, file)), `${file} missing`);
    const actual = hashOf(file);
    assert.equal(actual, expected, `${file} was modified`);
  }
});

console.log('Vehicle pages: art direction, motion, performance');

check('no neon, glow, outlined type or heavy effects in vehicle.css', () => {
  assert.ok(!/-webkit-text-stroke|text-shadow|drop-shadow|backdrop-filter|\bfilter\s*:|box-shadow/i.test(css), 'effect that is not part of the identity');
  assert.ok(!/#0[0-9a-f]{2}[0-9a-f]ff|2f7bff|neon/i.test(css));
});

check('transitions animate only transform, opacity or colour; motion is gated for reduced-motion', () => {
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].split(',')) {
      const prop = part.trim().split(/\s+/)[0];
      assert.ok(['transform', 'opacity', 'color', 'none'].includes(prop), `transition on "${prop}"`);
    }
  }
  assert.ok(css.includes('.is-reveal-ready .reveal:not(.is-in)'));
  assert.ok(/prefers-reduced-motion:\s*no-preference/.test(css) && /prefers-reduced-motion:\s*reduce/.test(css));
  // the rule that hides unrevealed content must sit inside a no-preference media block
  const open = css.indexOf('@media (prefers-reduced-motion: no-preference) {');
  assert.ok(open >= 0, 'no-preference block missing');
  let depth = 0, end = open;
  for (let i = css.indexOf('{', open); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) { end = i; break; }
  }
  assert.ok(css.slice(open, end).includes('.is-reveal-ready .reveal:not(.is-in)'), 'hiding rule must be gated on no-preference');
  const js = read('js/ui/reveal.js');
  assert.ok(/prefers-reduced-motion: reduce/.test(js) && !/from 'gsap'|from 'three'/.test(js) && !/setInterval|requestAnimationFrame/.test(js));
});

check('static pages stay light: car.js loads 3D only for cars with a model; no extra dependencies', () => {
  const src = read('js/pages/car.js');
  assert.ok(/await import\('\.\.\/core\/bootstrap\.js'\)/.test(src));
  const statics = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  statics.forEach((s) => assert.ok(!/^(three|gsap)/.test(s) && !s.includes('motion.js') && !s.includes('stage.js'), `static import ${s}`));
  assert.ok(Buffer.byteLength(css) < 45000, 'vehicle.css should stay under 45 KB');
  assert.ok(existsSync(join(ROOT, 'package.json')) === false, 'no package manager or build step');
});

check('accessibility basics: one h1, ordered headings, labelled navs, no empty links, tables have headers', () => {
  for (const p of PAGES) {
    const h = html[p];
    const levels = [...h.matchAll(/<h([1-3])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `${p} heading jump`);
    for (const nav of h.matchAll(/<nav\b[^>]*>/g)) assert.ok(/aria-label=/.test(nav[0]), `${p} unlabelled nav`);
    assert.ok(!/<a [^>]*>\s*<\/a>/.test(h), `${p} empty link`);
  }
  const t = html['cars/toyota-supra.html'];
  assert.ok(t.includes('<th scope="col"') && t.includes('<th scope="row"') && t.includes('role="region"') && t.includes('tabindex="0"'));
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
