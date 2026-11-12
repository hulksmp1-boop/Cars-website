/**
 * Run:  node tests/pages.test.mjs
 * Static checks of the multi-page structure (reads the files; no browser).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { VEHICLES, MODELS, SITE } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);

const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const FILE = (page) => page.replace(/^\//, '') + '.html'; // clean URL '/cars/bmw-m5' -> file 'cars/bmw-m5.html'
const PAGES = ['index.html', 'collection.html', 'cars/bmw-m5.html', 'cars/porsche-911.html', 'cars/nissan-gt-r.html', 'cars/toyota-supra.html', 'cars/corvette-c8.html'];
const html = Object.fromEntries(PAGES.map((p) => [p, existsSync(join(ROOT, p)) ? read(p) : '']));

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

console.log('Pages');

check('all seven pages exist', () => PAGES.forEach((p) => assert.ok(html[p].length > 0, `${p} missing`)));

check('each page has doctype, lang, viewport, unique title, description and exactly one h1', () => {
  const titles = new Set();
  for (const p of PAGES) {
    const h = html[p];
    assert.ok(/^<!doctype html>/i.test(h), `${p} doctype`);
    assert.ok(h.includes('<html lang="en"'), `${p} lang`);
    assert.ok(h.includes('name="viewport"'), `${p} viewport`);
    assert.ok(/<meta name="description" content="[^"]{20,}"/.test(h), `${p} description`);
    const title = h.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title, `${p} title`);
    assert.ok(!titles.has(title), `${p} duplicate title`);
    titles.add(title);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, `${p} h1 count`);
    assert.ok(h.includes('class="skip-link" href="#main"') && h.includes('id="main"'), `${p} skip link`);
    assert.ok(h.includes('data-site-header') && h.includes('data-site-footer'), `${p} shared header/footer hooks`);
  }
});

check('import map is identical on every page', () => {
  const maps = PAGES.map((p) => html[p].match(/<script type="importmap">[\s\S]*?<\/script>/)?.[0]);
  maps.forEach((m, i) => assert.ok(m, `${PAGES[i]} has no import map`));
  maps.forEach((m, i) => assert.equal(m, maps[0], `${PAGES[i]} import map differs`));
});

check('every local href/src/stylesheet resolves to a real file', () => {
  for (const p of PAGES) {
    for (const m of html[p].matchAll(/(?:href|src)="([^"#:]+?)(?:#[^"]*)?"/g)) {
      const target = m[1];
      if (target.startsWith('data') || target.startsWith('//')) continue;
      const file = target === '/' ? 'index.html' : /^\/cars\/[a-z0-9-]+$/.test(target) ? target + '.html' : target; // clean URLs map to the page file
      assert.ok(existsSync(join(ROOT, file)), `${p} references missing file ${target}`);
    }
  }
});

check('shared stylesheets: base set on every page, 3D set only on the 3D page', () => {
  for (const p of PAGES) for (const c of ['tokens', 'base', 'layout', 'chrome']) assert.ok(html[p].includes(`css/${c}.css`), `${p} lacks ${c}.css`);
  assert.ok(html['cars/bmw-m5.html'].includes('css/car.css') && html['cars/bmw-m5.html'].includes('css/loader.css'));
  const THREE_D = ['cars/bmw-m5.html', 'cars/porsche-911.html', 'cars/nissan-gt-r.html', 'cars/toyota-supra.html', 'cars/corvette-c8.html'];
  assert.ok(html['cars/porsche-911.html'].includes('css/car.css') && html['cars/porsche-911.html'].includes('css/loader.css'));
  for (const p of PAGES.filter((x) => !THREE_D.includes(x))) assert.ok(!html[p].includes('css/car.css') && !html[p].includes('data-loader'), `${p} should not carry 3D markup`);
});

check('every page loads boot-guard then exactly one page module', () => {
  for (const p of PAGES) {
    const guard = p.startsWith('cars/') ? '/js/boot-guard.js' : 'js/boot-guard.js'; // car pages use root-absolute asset URLs
    assert.ok(html[p].includes(`<script src="${guard}"></script>`), `${p} guard`);
    assert.equal((html[p].match(/<script type="module"/g) || []).length, 1, `${p} module count`);
  }
});

console.log('Config and sequence');

check('BMW is the first vehicle and the lineup has five vehicles', () => {
  assert.equal(VEHICLES.length, 5);
  assert.equal(VEHICLES[0].id, 'bmw-m5-f90');
});

check('every vehicle page exists and declares its own id; page list matches the seven pages', () => {
  const expected = new Set(PAGES.filter((p) => !['index.html', 'collection.html'].includes(p)));
  for (const v of VEHICLES) {
    assert.ok(expected.has(FILE(v.page)), `${v.id} page ${v.page} unknown`);
    assert.ok(html[FILE(v.page)].includes(`data-vehicle="${v.id}"`), `${v.page} data-vehicle`);
    assert.ok(html[FILE(v.page)].includes('data-page="car"'));
  }
  assert.equal(new Set(VEHICLES.map((v) => v.page)).size, 5);
  assert.equal(SITE.intro, '/');
  assert.equal(SITE.collection, '/collection.html');
});

check('BMW page headline is BMW / M5 F90 / Competition', () => {
  const h = html['cars/bmw-m5.html'];
  assert.ok(/<p class="eyebrow">BMW<\/p>/.test(h));
  assert.ok(/<h1 class="hero__title">M5 F90<\/h1>/.test(h));
  assert.ok(/<p class="hero__lede">Competition<\/p>/.test(h));
});

check('car pages show the config name (make / model / designation)', () => {
  for (const v of VEHICLES) {
    const h = html[FILE(v.page)];
    assert.ok(h.includes(`>${v.make}</p>`), `${v.page} make`);
    assert.ok(h.includes(`>${v.model}</h1>`) || h.includes(`>${v.model}<`), `${v.page} model`);
    assert.ok(h.includes(`>${v.designation}</p>`), `${v.page} designation`);
  }
});

check('all five models have a 3D experience: every GLB is wired through a MODELS entry and its own page', () => {
  assert.deepEqual(Object.keys(MODELS), ['bmw-m5-f90', 'porsche-911-carrera-4s', 'nissan-gt-r-r35', 'toyota-gr-supra-mk5', 'chevrolet-corvette-c8']);
  const glbs = readdirSync(join(ROOT, 'assets/models')).filter((f) => f.endsWith('.glb')).sort();
  assert.deepEqual(glbs, ['bmw-m5-f90.glb', 'chevrolet-corvette-c8.glb', 'nissan-gt-r-r35.glb', 'porsche-911-carrera-4s.glb', 'toyota-gr-supra-mk5.glb']);
  for (const v of VEHICLES) assert.ok(glbs.includes(`${v.id}.glb`), `${v.id}.glb should be named after its vehicle id`);
  assert.ok(existsSync(join(ROOT, MODELS['bmw-m5-f90'].url)));
  assert.ok(existsSync(join(ROOT, MODELS['porsche-911-carrera-4s'].url)));
  assert.ok(existsSync(join(ROOT, MODELS['nissan-gt-r-r35'].url)));
  assert.ok(existsSync(join(ROOT, MODELS['toyota-gr-supra-mk5'].url)));
  assert.ok(existsSync(join(ROOT, MODELS['chevrolet-corvette-c8'].url)));
  for (const p of PAGES.filter((x) => !['cars/bmw-m5.html', 'cars/porsche-911.html', 'cars/nissan-gt-r.html', 'cars/toyota-supra.html', 'cars/corvette-c8.html'].includes(x))) assert.ok(!html[p].includes('.glb'), `${p} references a model`);
});

check('the 3D page has every DOM hook the bootstrap and HUD need', () => {
  const h = html['cars/bmw-m5.html'];
  for (const hook of ['data-loader', 'data-loader-bar', 'data-loader-percent', 'data-loader-status', 'id="stage"', 'data-scroll-progress', 'data-showcase', 'data-hud', 'data-hud-make', 'data-hud-model', 'data-hud-designation', 'data-hud-index', 'data-hud-total', 'data-hud-title', 'data-hud-rail', 'data-hud-cue', 'data-model-error', 'data-model-error-message', 'data-model-error-retry', 'data-webgl-fallback']) {
    assert.ok(h.includes(hook), `missing ${hook}`);
  }
});

check('non-3D pages never statically import three.js or GSAP (no CDN cost)', () => {
  for (const f of ['js/pages/car.js', 'js/pages/collection.js', 'js/pages/home.js', 'js/ui/site-chrome.js', 'js/ui/transitions.js', 'js/core/asset-queue.js', 'js/core/quality.js']) {
    const src = read(f);
    const statics = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
    for (const s of statics) assert.ok(!/^(three|gsap)/.test(s) && !s.includes('motion.js') && !s.includes('stage.js'), `${f} statically imports ${s}`);
  }
  assert.ok(/await import\('\.\.\/core\/bootstrap\.js'\)/.test(read('js/pages/car.js')), 'car.js must load bootstrap dynamically');
});

console.log('Collection page');

const collection = html['collection.html'];
const items = [...collection.matchAll(/<article class="showroom__item"[\s\S]*?<\/article>/g)].map((m) => m[0]);
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

check('exactly five showroom items, in the required order, matching config ids', () => {
  assert.equal(items.length, 5);
  items.forEach((item, i) => assert.ok(item.includes(`data-vehicle-id="${VEHICLES[i].id}"`), `item ${i + 1} should be ${VEHICLES[i].id}`));
  assert.deepEqual(VEHICLES.map((v) => `${v.make} ${v.model} ${v.designation}`), ['BMW M5 F90 Competition', 'Porsche 911 Carrera 4S', 'Nissan GT-R R35', 'Toyota GR Supra MK5', 'Chevrolet Corvette C8']);
});

check('each item has number, correct full name, tagline and an Explore link to its own page', () => {
  items.forEach((item, i) => {
    const v = VEHICLES[i];
    assert.ok(new RegExp(`<span>0${i + 1}</span> / 05`).test(item), `${v.id} number`);
    const name = text(item.match(/<h2[\s\S]*?<\/h2>/)[0]);
    assert.equal(name, `${v.make} ${v.model} ${v.designation}`, `${v.id} full name`);
    assert.ok(item.includes(`>${v.tagline}</p>`), `${v.id} tagline matches config`);
    const hrefs = [...item.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 2 && hrefs.every((h) => h === v.page), `${v.id} links must all go to ${v.page}: ${hrefs}`);
    assert.ok(/class="explore[^"]*"[^>]*aria-label="Explore the /.test(item) && /Explore<i/.test(item), `${v.id} explore link`);
    assert.ok(/<a class="frame has-image reveal" href="[^"]+" tabindex="-1" aria-hidden="true">/.test(item), `${v.id} frame link`);
  });
});

check('only the BMW is labelled as a live 3D experience; the other frames carry a photograph label, never the old placeholder', () => {
  items.forEach((item, i) => {
    const live = item.includes('Live 3D experience');
    // collection.html is frozen until the collection phase: it still labels only the BMW as live (the Porsche page is 3D now).
    assert.equal(live, VEHICLES[i].id === 'bmw-m5-f90', `${VEHICLES[i].id} label`);
    if (!live) assert.ok(item.includes('>Photograph<') && !item.includes('Studio imagery to follow'));
  });
});

check('layouts and tones differ between items (each car looks distinct)', () => {
  const tones = items.map((i) => i.match(/data-tone="(\w+)"/)[1]);
  assert.equal(new Set(tones).size, 5);
  assert.equal(new Set(items.map((i) => i.match(/data-layout="(\w)"/)[1])).size, 5, 'five different compositions');
  const css = read('css/collection.css');
  tones.forEach((t) => assert.ok(css.includes(`data-tone="${t}"`), `css lacks tone ${t}`));
});

check('collection page is lightweight: no 3D, no model files, no fake photography, restrained animation', () => {
  assert.ok(!/<picture|<video|<canvas|\.glb/i.test(collection), 'no 3D or video on the collection page');
  const imgs = [...collection.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  assert.equal(imgs.length, 5, 'one photograph per card');
  for (const [id, file] of [['bmw-m5-f90', 'bmw-m5.jpg'], ['porsche-911-carrera-4s', 'porsche-911.jpg'], ['nissan-gt-r-r35', 'nissan-gtr.jpg'], ['toyota-gr-supra-mk5', 'toyota-supra.jpg'], ['chevrolet-corvette-c8', 'corvette-c8.jpg']]) {
    const item = items.find((i) => i.includes(`id="${id}"`));
    assert.ok(item.includes(`src="assets/images/${file}"`) && item.includes('class="frame has-image'), `${id} photo`);
    assert.ok(existsSync(join(ROOT, `assets/images/${file}`)), `${file} missing`);
  }
  assert.ok(!collection.includes('Studio imagery to follow'), 'placeholder label removed');
  const css = read('css/collection.css');
  assert.ok(!/\bfilter\s*:|backdrop-filter|box-shadow\s*:[^;]*blur/i.test(css), 'avoid costly filters/shadows');
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].split(',')) {
      const prop = part.trim().split(/\s+/)[0];
      assert.ok(['transform', 'opacity', 'color', 'none'].includes(prop), `transition on "${prop}" may trigger layout/paint`);
    }
  }
  const js = read('js/ui/showroom.js') + read('js/pages/collection.js');
  assert.ok(!/from '(three|gsap)|import\(/.test(js));
});

check('reduced motion is respected in CSS and JS; content is visible without JS', () => {
  const css = read('css/collection.css');
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(css) && /prefers-reduced-motion:\s*no-preference/.test(css));
  assert.ok(/prefers-reduced-motion: reduce/.test(read('js/ui/showroom.js')));
  assert.ok(css.includes('.is-showroom-ready .reveal:not(.is-in)'), 'hiding must be gated on the ready class');
  assert.ok(!/\.reveal:not\(\.is-in\)/.test(css.replace(/\.is-showroom-ready \.reveal:not\(\.is-in\)/g, '')), 'no ungated hiding');
});

check('hero, jump index and rail link to every car anchor', () => {
  VEHICLES.forEach((v) => assert.equal((collection.match(new RegExp(`href="#${v.id}"`, 'g')) || []).length, 2, `${v.id} anchors`));
  assert.ok(collection.includes('<h1 class="cover__title '));
});

check('art direction: no blue accent, no outlined giant codes, no neon glow, self-hosted fonts', () => {
  const css = ['tokens', 'base', 'layout', 'chrome', 'pages', 'collection', 'car', 'loader', 'vehicle'].map((f) => read(`css/${f}.css`)).join('\n');
  assert.ok(!/2f7bff|47 123 255/i.test(css), 'old blue accent still present');
  assert.ok(!/-webkit-text-stroke/.test(css), 'outlined type is not part of the new identity');
  assert.ok(!/drop-shadow|text-shadow|box-shadow\s*:[^;]*(rgb|#)[^;]*\d{2,}px/i.test(css), 'no glows');
  assert.ok(!/fonts\.(googleapis|gstatic)/.test(Object.values(html).join('')), 'fonts must be self-hosted');
  for (const f of ['inter-300', 'inter-400', 'inter-500', 'lora', 'lora-italic']) assert.ok(existsSync(join(ROOT, `assets/fonts/${f}.woff`)), `${f}.woff missing`);
});

check('collection: contents list, frame captions, and the old glyph config field are consistent', () => {
  assert.ok(VEHICLES.every((v) => v.visual && v.visual.image === null && !('glyph' in v.visual)));
  assert.equal((collection.match(/class="frame__caption"/g) || []).length, 5);
});

console.log('3D page failure states');

check('model-failed / no-webgl hide the HUD and keep the hero clear of the fixed notices', () => {
  const css = read('css/car.css');
  assert.ok(/\.model-failed \.hud\b/.test(css), 'HUD (scroll cue) must be hidden when the model failed');
  assert.ok(/\.no-webgl \.hud\b/.test(css));
  assert.ok(/\.model-failed \.hero/.test(css) && /\.no-webgl \.hero/.test(css), 'hero needs extra bottom room for the notice');
  assert.ok(/\.model-failed \.showcase/.test(css), 'no empty scroll track after a failed load');
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
