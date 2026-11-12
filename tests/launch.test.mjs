/** Run:  node tests/launch.test.mjs — Phase 6 launch metadata (static checks, no browser). */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const PAGES = ['index.html', 'collection.html', 'cars/bmw-m5.html', 'cars/porsche-911.html', 'cars/nissan-gt-r.html', 'cars/toyota-supra.html', 'cars/corvette-c8.html'];
let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };
const attr = (html, re) => (html.match(re) || [])[1];

console.log('Launch metadata');

check('unique titles; descriptions unique and at most 160 characters', () => {
  const titles = new Set(), descs = new Set();
  for (const f of PAGES) {
    const h = read(f);
    const t = attr(h, /<title>(.*?)<\/title>/), d = attr(h, /<meta name="description" content="([^"]*)"/);
    assert.ok(t && d, `${f}: title/description`);
    assert.ok(d.length <= 160, `${f}: description is ${d.length} characters`);
    assert.ok(!titles.has(t) && !descs.has(d), `${f}: duplicate`);
    titles.add(t); descs.add(d);
  }
});

check('canonical, Open Graph and Twitter tags on every page; og values match title and description', () => {
  for (const f of PAGES) {
    const h = read(f);
    assert.ok(/<link rel="canonical" href="[^"]+"/.test(h), `${f}: canonical`);
    for (const p of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt']) assert.ok(h.includes(`property="${p}"`), `${f}: ${p}`);
    for (const n of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(h.includes(`name="${n}"`), `${f}: ${n}`);
    assert.equal(attr(h, /property="og:title" content="([^"]*)"/), attr(h, /<title>(.*?)<\/title>/).replace(/&/g, '&amp;'), `${f}: og:title`);
  }
});

check('favicon set, manifest, social image and launch files exist', () => {
  for (const f of ['favicon.ico', 'assets/icons/favicon.svg', 'assets/icons/icon-32.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png', 'assets/og/aether-gt-og.jpg', 'site.webmanifest', 'robots.txt', 'sitemap.xml', '404.html', 'tools/prepare-launch.mjs']) assert.ok(existsSync(join(ROOT, f)), `${f} missing`);
  JSON.parse(read('site.webmanifest'));
});

check('sitemap lists all seven pages; robots.txt points at the sitemap', () => {
  const sm = read('sitemap.xml');
  assert.equal((sm.match(/<loc>/g) || []).length, 7);
  PAGES.forEach((f) => { const loc = f === 'index.html' ? '/' : f.startsWith('cars/') ? `/${f.replace(/\.html$/, '')}` : `/${f}`; assert.ok(sm.includes(`${loc}</loc>`), `${f} in sitemap as ${loc}`); });
  assert.ok(!/cars\/[a-z0-9-]+\.html/.test(sm), 'sitemap lists clean car URLs only');
  assert.ok(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m.test(read('robots.txt')));
});

check('404 page: noindex, no JavaScript, only root-absolute asset paths', () => {
  const h = read('404.html');
  assert.ok(/name="robots" content="noindex"/.test(h) && !/<script/.test(h));
  for (const m of h.matchAll(/(?:href|src)="([^"]+)"/g)) assert.ok(m[1].startsWith('/') || m[1].startsWith('#'), `relative path in 404: ${m[1]}`);
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
