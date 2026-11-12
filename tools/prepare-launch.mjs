#!/usr/bin/env node
/**
 * AETHER GT — launch preparation (Node 18+, no dependencies).
 *
 * The site ships without a domain. Canonical, og:url, og:image and twitter:image are relative,
 * and sitemap.xml / robots.txt carry the placeholder YOUR-DOMAIN. Run this once you know the address:
 *
 *   node tools/prepare-launch.mjs https://example.org            fill in the domain, in place
 *   node tools/prepare-launch.mjs https://example.org --dist out  also copy the deployable files to ./out
 *   node tools/prepare-launch.mjs --check                        report anything still unresolved
 *
 * Safe to run again with a different domain.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'collection.html', 'cars/bmw-m5.html', 'cars/porsche-911.html', 'cars/nissan-gt-r.html', 'cars/toyota-supra.html', 'cars/corvette-c8.html'];
const OG_IMAGE = 'assets/og/aether-gt-og.jpg';
const args = process.argv.slice(2);
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const write = (f, s) => writeFileSync(join(ROOT, f), s);
// Public URL path of a page file: the home page is '/', car pages are clean URLs ('cars/bmw-m5.html' -> '/cars/bmw-m5').
const pagePath = (f) => (f === 'index.html' ? '' : f.startsWith('cars/') ? f.replace(/\.html$/, '') : f);

function check() {
  const problems = [];
  for (const f of PAGES) {
    const html = read(f);
    const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (!canon || !/^https:\/\//.test(canon)) problems.push(`${f}: canonical is not absolute (${canon})`);
  }
  for (const f of ['sitemap.xml', 'robots.txt']) if (/YOUR-DOMAIN/.test(read(f))) problems.push(`${f}: still has YOUR-DOMAIN`);
  return problems;
}

if (args.includes('--check')) {
  const problems = check();
  console.log(problems.length ? problems.join('\n') : 'Launch check passed: all URLs are absolute.');
  process.exit(problems.length ? 1 : 0);
}

const base = (args.find((a) => /^https?:\/\//.test(a)) || '').replace(/\/+$/, '');
if (!base || /YOUR-DOMAIN/.test(base)) {
  console.error('Usage: node tools/prepare-launch.mjs https://your-domain [--dist <folder>]');
  process.exit(1);
}
if (!base.startsWith('https://')) console.warn('Warning: use https:// for a public site.');

const setAttr = (html, selector, value) => html.replace(selector, (_, a, b) => `${a}${value}${b}`);
for (const f of PAGES) {
  let html = read(f);
  const url = `${base}/${pagePath(f)}`;
  const img = `${base}/${OG_IMAGE}`;
  html = setAttr(html, /(<link rel="canonical" href=")[^"]*(")/, url);
  html = setAttr(html, /(<meta property="og:url" content=")[^"]*(")/, url);
  html = setAttr(html, /(<meta property="og:image" content=")[^"]*(")/, img);
  html = setAttr(html, /(<meta name="twitter:image" content=")[^"]*(")/, img);
  write(f, html);
}

const urls = PAGES.map((f) => `  <url><loc>${base}/${pagePath(f)}</loc></url>\n`).join('');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.w3.org/2005/sitemap/0.9">\n${urls}</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
console.log(`Domain set to ${base} in ${PAGES.length} pages, sitemap.xml and robots.txt.`);

const dist = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : null;
if (dist) {
  const out = resolve(process.cwd(), dist);
  if (out === ROOT || ROOT.startsWith(out + '/')) { console.error('--dist must be a separate folder.'); process.exit(1); }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // _headers, _redirects, vercel.json and .htaccess are the generated host files (tools/hosting-config.mjs); deploy/nginx.conf is not site content.
  const include = [...PAGES, '404.html', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'css', 'js', 'assets', '_headers', '_redirects', 'vercel.json', '.htaccess'];
  mkdirSync(join(out, 'cars'), { recursive: true });
  for (const item of include) if (existsSync(join(ROOT, item))) cpSync(join(ROOT, item), join(out, item), { recursive: true });
  // Notes for maintainers, not for visitors.
  for (const note of ['assets/models/README.md', 'assets/fonts/README.md']) rmSync(join(out, note), { force: true });
  console.log(`Deployable site copied to ${out} (no tests, tools or screenshots).`);
}
