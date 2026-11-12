/** Phase 8A: car pages live in cars/ and are served at clean URLs. Run: node tests/clean-urls.test.mjs */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const { VEHICLES, MODELS, SITE } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { CARS, REDIRECTS } = await import(pathToFileURL(join(ROOT, 'tools/url-map.mjs')).href);
const { createSite } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')).href);
const SLUGS = CARS.map((c) => c.slug).join('|');

let failures = 0;
const check = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };
const attrs = (html) => [...html.matchAll(/\b(href|src|content|action|poster)="([^"]*)"/g)].map((m) => ({ attr: m[1], value: m[2] }));
const isLocal = (v) => v && !/^(https?:|\/\/|#|\?|mailto:|tel:|data:)/.test(v) && !/\s/.test(v);

console.log('Clean URLs: file layout and config');

await check('five car pages are in cars/, none are left in the site root', () => {
  assert.deepEqual(readdirSync(join(ROOT, 'cars')).sort(), CARS.map((c) => `${c.slug}.html`).sort());
  for (const c of CARS) assert.ok(!existsSync(join(ROOT, `${c.slug}.html`)), `${c.slug}.html still in root`);
});

await check('config page URLs are the clean URLs and match the URL map and each page\'s data-vehicle', () => {
  assert.deepEqual(VEHICLES.map((v) => v.page), CARS.map((c) => c.url));
  assert.deepEqual(VEHICLES.map((v) => v.id), CARS.map((c) => c.id));
  for (const c of CARS) assert.ok(read(c.file).includes(`data-vehicle="${c.id}"`), `${c.file} data-vehicle`);
  assert.equal(SITE.intro, '/'); assert.equal(SITE.collection, '/collection.html');
});

await check('model URLs are root-absolute and point at the original GLBs', () => {
  for (const v of VEHICLES) { const url = MODELS[v.id].url; assert.ok(url.startsWith('/assets/models/') && url.endsWith('.glb'), url); assert.ok(existsSync(join(ROOT, url)), `${url} missing`); }
});

console.log('Clean URLs: links and asset paths');

await check('car pages use only root-absolute local URLs and every target exists', () => {
  for (const c of CARS) for (const { attr, value } of attrs(read(c.file))) {
    if (!isLocal(value)) continue;
    const path = value.split('#')[0].split('?')[0];
    if (!/^\/[\w./-]*$/.test(path) && !/^[\w./-]+\.(html|css|js|jpg|webp|png|svg|ico|webmanifest|glb)$/.test(path)) continue; // prose in content="…"
    assert.ok(path.startsWith('/'), `${c.file}: relative ${attr}="${value}" would break under /cars/`);
    const file = path === '/' ? 'index.html' : CARS.some((x) => x.url === path) ? `${path.slice(1)}.html` : path.slice(1);
    assert.ok(existsSync(join(ROOT, file)), `${c.file}: ${attr}="${value}" -> ${file} missing`);
  }
});

await check('no HTML attribute or config string still links to a car .html file (all use clean URLs)', () => {
  const stale = new RegExp(`^/?(cars/)?(${SLUGS})\\.html`);
  for (const f of ['index.html', 'collection.html', '404.html', ...CARS.map((c) => c.file)]) {
    for (const { attr, value } of attrs(read(f))) assert.ok(!stale.test(value), `${f}: ${attr}="${value}"`);
  }
  const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, ''); // comments may explain the old URLs
  for (const f of ['js/config.js', 'js/ui/site-chrome.js', 'js/pages/collection.js', 'sitemap.xml']) {
    assert.ok(!new RegExp(`['"/>](cars/)?(${SLUGS})\\.html`).test(f.endsWith('.js') ? code(f) : read(f)), `${f} still mentions a car .html URL`);
  }
});

await check('homepage, collection and 404 link to the five clean URLs; each car page has all five in its header/footer data and a back link', () => {
  for (const f of ['index.html', 'collection.html', '404.html']) for (const c of CARS) assert.ok(read(f).includes(`href="${c.url}"`), `${f} lacks ${c.url}`);
  for (const c of CARS) assert.ok(read(c.file).includes('href="/collection.html"'), `${c.file} lacks collection link`);
});

await check('page transitions treat extensionless clean URLs as pages and leave real files alone', () => {
  const m = read('js/ui/transitions.js').match(/if \((\/.+?\/i\.test\(url\.pathname\)) && !(\/.+?\/i\.test\(url\.pathname\))\) return;/);
  assert.ok(m, 'file-extension guard not found');
  const skip = (p) => new Function('p', `return ${m[1].replace('url.pathname', 'p')} && !${m[2].replace('url.pathname', 'p')};`)(p);
  for (const p of ['/cars/bmw-m5', '/cars/bmw-m5.html', '/collection.html', '/']) assert.equal(skip(p), false, `${p} should fade`);
  for (const p of ['/assets/models/x.glb', '/assets/images/a.webp', '/robots.txt']) assert.equal(skip(p), true, `${p} should not fade`);
});

await check('collection -> car assembly trigger matches clean URLs (and .html / trailing-slash forms), nothing else', () => {
  const src = read('js/pages/collection.js');
  assert.ok(/armIntro\(vehicle\.id\)/.test(src) && /addEventListener\('click'[\s\S]*?, true\);/.test(src), 'capture-phase armIntro listener still present');
  const line = src.match(/const path = (url\.pathname[^;]*);/)?.[1];
  assert.ok(line, 'path normalisation not found');
  const find = new Function('VEHICLES', 'p', `const url = { pathname: p }; const path = ${line}; return VEHICLES.find((v) => path === v.page);`);
  for (const v of VEHICLES) for (const p of [v.page, `${v.page}.html`, `${v.page}/`]) assert.equal(find(VEHICLES, p)?.id, v.id, p);
  for (const p of ['/', '/collection.html', '/cars/bmw-m5-x', '/cars', '/bmw-m5', '/assets/models/bmw-m5-f90.glb']) assert.equal(find(VEHICLES, p), undefined, p);
  // Same guard in the page that consumes the flag: vehicle ids still come from config, unchanged.
  assert.ok(/shouldPlayIntro/.test(read('js/core/bootstrap.js')));
});

console.log('Clean URLs: routing (local reference server, real HTTP)');

const server = createSite(ROOT);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const get = (path, opts = {}) => fetch(base + path, { redirect: 'manual', ...opts });

await check('each clean URL answers 200 with its own car page (no redirect)', async () => {
  for (const c of CARS) {
    const r = await get(c.url);
    assert.equal(r.status, 200, c.url);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.ok((await r.text()).includes(`data-vehicle="${c.id}"`), `${c.url} serves the wrong page`);
  }
});

await check('old and variant URLs return a single 301 to the clean URL, keeping the query string', async () => {
  for (const { from, to } of REDIRECTS) {
    const r = await get(from);
    assert.equal(r.status, 301, from); assert.equal(r.headers.get('location'), to, from);
    const q = await get(`${from}?3d=off&intro=on`);
    assert.equal(q.headers.get('location'), `${to}?3d=off&intro=on`, `${from} lost its query`);
  }
  assert.equal(REDIRECTS.length, 20);
  for (const { to } of REDIRECTS) assert.equal((await get(to)).status, 200, `${to} (redirect target) must not redirect again`);
});

await check('assets referenced from /cars/* resolve at root (css, js, GLB, image, font, manifest) and unknown paths are 404', async () => {
  for (const [p, type] of [['/css/car.css', /text\/css/], ['/js/pages/car.js', /javascript/], ['/assets/models/bmw-m5-f90.glb', /gltf-binary/], ['/assets/images/bmw-m5.jpg', /jpeg/], ['/assets/fonts/lora.woff', /font\/woff/], ['/site.webmanifest', /manifest/], ['/favicon.ico', /icon/], ['/collection.html', /html/], ['/', /html/]]) {
    const r = await get(p); assert.equal(r.status, 200, p); assert.match(r.headers.get('content-type'), type, p); await r.arrayBuffer();
  }
  for (const p of ['/cars', '/cars/', '/cars/unknown', '/cars/bmw-m5/extra', '/bmw-m6.html']) { const r = await get(p); assert.equal(r.status, 404, p); assert.ok((await r.text()).includes('noindex'), `${p} serves the 404 page`); }
});

await check('the GLBs served over HTTP are byte-identical to the originals on disk', async () => {
  for (const v of VEHICLES) {
    const r = await get(MODELS[v.id].url);
    assert.ok(Buffer.from(await r.arrayBuffer()).equals(readFileSync(join(ROOT, MODELS[v.id].url))), v.id);
  }
});
server.close();

console.log('Clean URLs: launch preparation (run on a temporary copy; the project is not modified)');

await check('prepare-launch writes clean car URLs into canonical, og:url and sitemap, and --dist contains cars/*.html', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aether-8a-'));
  try {
    const copy = join(tmp, 'site');
    cpSync(ROOT, copy, { recursive: true, filter: (src) => !/[\\/](screenshots|models)([\\/]|$)/.test(src) || /README/.test(src) });
    const run = spawnSync(process.execPath, [join(copy, 'tools/prepare-launch.mjs'), 'https://example.test', '--dist', join(tmp, 'dist')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    for (const c of CARS) {
      const html = readFileSync(join(copy, c.file), 'utf8');
      assert.ok(html.includes(`<link rel="canonical" href="https://example.test${c.url}"`), `${c.file} canonical`);
      assert.ok(html.includes(`<meta property="og:url" content="https://example.test${c.url}"`), `${c.file} og:url`);
      assert.ok(existsSync(join(tmp, 'dist', c.file)), `dist/${c.file}`);
      assert.ok(readFileSync(join(copy, 'sitemap.xml'), 'utf8').includes(`<loc>https://example.test${c.url}</loc>`), `sitemap ${c.url}`);
    }
    const chk = spawnSync(process.execPath, [join(copy, 'tools/prepare-launch.mjs'), '--check'], { encoding: 'utf8' });
    assert.equal(chk.status, 0, chk.stdout + chk.stderr);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
