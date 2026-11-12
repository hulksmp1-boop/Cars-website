/**
 * Run:  node tests/home.test.mjs
 * Editorial homepage (index.html): static checks, no browser.
 * The hashes below lock the collection page and the five car pages (and their styles and
 * scripts) to the Redesign 02 versions, so the homepage work cannot change them.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { VEHICLES } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const FILE = (page) => page.replace(/^\//, '') + '.html'; // clean URL '/cars/bmw-m5' -> file 'cars/bmw-m5.html'
const html = read('index.html');
const css = read('css/home.css');
const js = read('js/pages/home.js');
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

console.log('Homepage: structure');

check('one h1, ordered sections, each with a labelled heading', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const ids = ['manifesto', 'issue', 'road', 'lead', 'principles', 'side-by-side', 'gallery', 'journal'];
  let last = -1;
  for (const id of ids) { const at = html.indexOf(`id="${id}"`); assert.ok(at > last, `#${id} missing or out of order`); last = at; }
  assert.ok(html.indexOf('class="masthead"') < html.indexOf('id="manifesto"') && html.indexOf('class="section closing"') > html.indexOf('id="journal"'));
  assert.equal((html.match(/<section /g) || []).length, (html.match(/aria-labelledby="/g) || []).length, 'every section is labelled');
});

check('no 3D, canvas, models, HUD or cinematic sequence', () => {
  assert.ok(!/<canvas|id="stage"|data-hud|data-showcase|data-loader|\.glb|css\/(car|loader)\.css/.test(html));
  const statics = [...js.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  statics.forEach((s) => assert.ok(!/three|gsap|motion\.js|stage\.js|asset-queue|quality/.test(s), `home.js imports ${s}`));
  assert.ok(!/import\(/.test(js));
  assert.ok(!/(hud|cinematic|scrub|ScrollTrigger|webgl)/i.test(css + js.replace(/^\s*\*.*$/gm, '')), 'no HUD/cinematic code');
});

check('navigation: Home, Collection and the Cars menu in the header (Phase 5); wordmark stays Aether GT', () => {
  const chrome = read('js/ui/site-chrome.js');
  assert.ok(/nav\.append\(home, collection, menu\)/.test(chrome));
  assert.ok(/'Aether '/.test(chrome));
});

check('all five cars are linked, in collection order, from the issue list and the table', () => {
  const issue = html.slice(html.indexOf('id="issue"'), html.indexOf('id="lead"'));
  const hrefs = [...issue.matchAll(/class="card" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, VEHICLES.map((v) => v.page));
  VEHICLES.forEach((v, i) => {
    assert.ok(issue.includes(`>${v.tagline}<`), `${v.id} tagline matches config`);
    assert.ok(issue.includes(`<span class="card__no">0${i + 1}</span>`));
    assert.ok(html.slice(html.indexOf('id="side-by-side"'), html.indexOf('id="gallery"')).includes(`href="${v.page}"`), `${v.id} in table`);
  });
});

check('journal teasers stay on the homepage and link into existing car-page stories', () => {
  const journal = html.slice(html.indexOf('id="journal"'), html.indexOf('class="section closing"'));
  const links = [...journal.matchAll(/href="([^"#]+)#story"/g)].map((m) => m[1]);
  assert.equal(links.length, 3);
  links.forEach((l) => { assert.ok(VEHICLES.some((v) => v.page === l)); assert.ok(read(FILE(l)).includes('id="story"'), `${l} lacks #story`); });
  assert.ok(!/href="journal/.test(html), 'no separate journal page');
});

check('numbers table repeats the car pages and the lengths agree with them', () => {
  const lens = { 'cars/bmw-m5.html': '4,966', 'cars/porsche-911.html': '4,519', 'cars/nissan-gt-r.html': '4,710', 'cars/toyota-supra.html': '4,379', 'cars/corvette-c8.html': '4,630' };
  for (const [page, len] of Object.entries(lens)) {
    assert.ok(read(page).includes(`<dd>${len} mm`), `${page} length ${len}`);
    assert.ok(html.includes(`${len} mm`) && html.includes(`--mm:${len.replace(',', '')}`), `home ${len}`);
  }
  assert.ok(html.includes('<th scope="col"') && html.includes('<th scope="row"') && html.includes('role="region"') && html.includes('tabindex="0"'));
});

console.log('Homepage: image slots');

const slots = [...html.matchAll(/<div class="slot[^"]*" data-slot="(\w+)"[^>]*style="([^"]+)">/g)];

check('every image slot has a unique id, an aspect ratio, a small-screen ratio and a focal point', () => {
  assert.equal(slots.length, 15);
  assert.equal(new Set(slots.map((m) => m[1])).size, 15);
  slots.forEach((m) => { for (const v of ['--ratio:', '--ratio-sm:', '--focus:']) assert.ok(m[2].includes(v), `${m[1]} lacks ${v}`); });
  assert.equal((html.match(/class="slot__spec"/g) || []).length, 15);
});

check('slot CSS: fixed ratio, cover crop, has-image swap; no photography or <img> shipped yet', () => {
  assert.ok(/\.slot\s*\{[^}]*aspect-ratio:\s*var\(--ratio/.test(css));
  assert.ok(/\.slot > img\s*\{[^}]*object-fit:\s*cover[^}]*object-position:\s*var\(--focus/.test(css));
  assert.ok(/\.slot\.has-image \.slot__surface/.test(css) && /\.slot\.has-image \.slot__spec/.test(css));
  const noRoad = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<section class="section road"[\s\S]*?<\/section>/, '');
  assert.ok(!/<img|<picture|<video|\.(png|jpe?g|webp|avif)/i.test(noRoad), 'frames stay honest placeholders (the road section carries the only images)');
});

check('placeholder decoration is hidden from assistive technology', () => {
  assert.ok(!/<span class="slot__(surface|marks|spec)"(?![^>]*aria-hidden="true")/.test(html));
});

console.log('Homepage: road journey');

check('road sits between "In this issue" and "Lead story"; five cars in order, all assets present', () => {
  const at = (id) => html.indexOf(`id="${id}"`);
  assert.ok(at('issue') < at('road') && at('road') < at('lead'));
  const road = html.slice(at('road'), at('lead'));
  const files = [...road.matchAll(/src="(assets\/road\/[^"]+\.webp)"/g)].map((m) => m[1]);
  assert.deepEqual(files.map((f) => f.split('/').pop()), ['bmw-m5.webp', 'porsche-911.webp', 'nissan-gt-r.webp', 'toyota-supra.webp', 'chevrolet-corvette.webp']);
  files.forEach((f) => assert.ok(existsSync(join(ROOT, f)), `${f} missing`));
  assert.equal((road.match(/<img [^>]*alt=""/g) || []).length, 5, 'decorative cars have empty alt (captions name them)');
  assert.equal((road.match(/<img [^>]*width="\d+" height="\d+"/g) || []).length, 5, 'explicit sizes avoid layout shift');
  assert.ok(html.includes('href="css/road.css"') && existsSync(join(ROOT, 'css/road.css')) && existsSync(join(ROOT, 'js/ui/road-journey.js')));
  assert.ok(/initRoadJourney/.test(js));
});

check('road code: native scroll, no libraries, transform-only motion, reduced motion, header guard', () => {
  const rc = read('css/road.css'), rj = read('js/ui/road-journey.js');
  assert.ok(!/^import /m.test(rj) && !/gsap|three|ScrollTrigger|position:\s*sticky|position:\s*fixed/i.test(rj + rc.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.ok(/prefers-reduced-motion: reduce/.test(rj) && /prefers-reduced-motion: reduce/.test(rc));
  assert.ok(/passive: true/.test(rj) && /requestAnimationFrame/.test(rj));
  for (const m of rc.matchAll(/transition:\s*([^;]+);/g)) assert.ok(m[1].trim() === 'none' || m[1].trim().startsWith('opacity'), `road transition ${m[1]}`);
  assert.ok(/scroll-margin-top/.test(rc) && /is-over-road/.test(rc) && /is-over-road/.test(rj));
});

console.log('Homepage: art direction, motion, accessibility');

check('no blue, glow, outlined type or filters; transitions only on transform, opacity or colour', () => {
  assert.ok(!/-webkit-text-stroke|text-shadow|drop-shadow|backdrop-filter|\bfilter\s*:|box-shadow|2f7bff/i.test(css));
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) for (const part of m[1].split(',')) assert.ok(['transform', 'opacity', 'color'].includes(part.trim().split(/\s+/)[0]), `transition on ${part}`);
});

check('reveal hiding is gated on JS and on reduced motion; reduced motion is respected', () => {
  assert.ok(/prefers-reduced-motion:\s*no-preference/.test(css));
  assert.ok(css.includes('.is-reveal-ready .reveal:not(.is-in)'));
  assert.ok(!/\.reveal:not\(\.is-in\)/.test(css.replace(/\.is-reveal-ready \.reveal:not\(\.is-in\)/g, '')), 'no ungated hiding');
  const reveal = read('js/ui/reveal.js');
  assert.ok(/prefers-reduced-motion: reduce/.test(reveal) && /initReveal/.test(js));
});

check('identity: tokens only, self-hosted fonts, no external font CDN, no hard-coded brand blue', () => {
  assert.ok(!/fonts\.(googleapis|gstatic)/.test(html));
  assert.ok(/var\(--color-accent\)/.test(css) && /var\(--font-serif\)/.test(css));
});

check('copy: written, not placeholder; no lorem; no unqualified superlatives', () => {
  const t = text(html);
  assert.ok(!/lorem|ipsum|coming soon|tbd/i.test(t));
  assert.ok(t.split(' ').length > 700, `expected a long editorial page, got ${t.split(' ').length} words`);
  assert.ok(!/\b(fastest|best|greatest|most powerful)\b/i.test(t));
});

console.log('Homepage: other pages preserved');

check('collection, five car pages, their styles and the 3D page script are byte-identical to Redesign 02 (porsche-911.html, nissan-gt-r.html, toyota-supra.html and corvette-c8.html are intentionally excluded: rebuilt in the Porsche, Nissan, Supra and Corvette phases; the config.js hash covers the Porsche, Nissan, Supra and Corvette MODELS entries)', () => {
  const sums = [
  ['collection.html', '5bfbe7c42e477f8c226cc2602cea26bf9ed544fd89936cfc16890e9079d9b320'],
  ['cars/bmw-m5.html', '542fc2bcbb3ff8b68aac56fdb4dbe87c1160014798f50cda272f149a7af74d3c'],
  ['css/vehicle.css', 'ceada022f5ba56619d8f2a82dd965063d99e44d1c628d12d5f402b3325b9ce6d'],
  ['css/collection.css', '0db1614698683577e2714aa9e8581c5ca8d42f26554a5b1c21be4e3e8c1d8e75'],
  ['css/car.css', '5188ca72bc967fa731229a1749051fea07e2c1d30c2d2d2ca41cef1c65505f13'],
  ['js/ui/site-chrome.js', '9dfb22ebdbd1c7655f9a539e4d47c13f6d6da0d1b572a6968915a5200e799027'],
  ['js/config.js', '072a9ac99a59f4999adbdaa69f52917f3587b629bc44b52950939689fbde780c'],
  ['js/pages/car.js', '49dc97d202ba047c5210a7e35f5ec297b5635e950a7c89a8a19b4f3a1a7f9b7d'],
  ['js/pages/collection.js', '39271fdf59d2cdc86962c71dd71b10df197809b48a09361f7f321ede2cd169dc']
  ];
  // HTML pages are pinned by everything after </head> (Phase 6 owns the head: SEO, icons, canonical).
  const hashOf = (file) => { let b = readFileSync(join(ROOT, file)); if (file.endsWith('.html')) b = b.subarray(b.indexOf('</head>')); return createHash('sha256').update(b).digest('hex'); };
  for (const [file, expected] of sums) {
    assert.ok(existsSync(join(ROOT, file)), `${file} missing`);
    assert.equal(hashOf(file), expected, `${file} was modified`);
  }
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
