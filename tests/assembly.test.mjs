/**
 * Run:  node tests/assembly.test.mjs — Phase 7 cinematic assembly intro (static + maths, no browser).
 * Reads the real GLB node trees (JSON chunk + accessor bounds), so each car's actual separate
 * components are fed through the assembly plan.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const FILE = (page) => page.replace(/^\//, '') + '.html'; // clean URL '/cars/bmw-m5' -> file 'cars/bmw-m5.html'
const { VEHICLES, MODELS, STAGE } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { planAssembly, partEase, smooth, SPREAD } = await import(pathToFileURL(join(ROOT, 'js/scene/assembly-plan.js')).href);

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

// --- tiny mat4 (column-major) -------------------------------------------------------------
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function trs(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** Per-mesh bounds in model space for a GLB, with the config orientation applied. */
function components(vehicle) {
  const buf = readFileSync(join(ROOT, MODELS[vehicle.id].url));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString());
  const a = ((MODELS[vehicle.id].orientationY || 0) * Math.PI) / 180;
  const orient = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
  const hide = new Set(MODELS[vehicle.id].hideMeshes || []);
  const out = [];
  const walk = (i, parent) => {
    const n = json.nodes[i];
    const m = mul(parent, trs(n));
    if (n.mesh !== undefined && !hide.has(n.name)) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const prim of json.meshes[n.mesh].primitives) {
        const acc = json.accessors[prim.attributes.POSITION];
        if (!acc.min || !acc.max) continue;
        for (let c = 0; c < 8; c++) {
          const p = apply(m, [c & 1 ? acc.max[0] : acc.min[0], c & 2 ? acc.max[1] : acc.min[1], c & 4 ? acc.max[2] : acc.min[2]]);
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
        }
      }
      if (lo[0] < Infinity) out.push({ name: n.name, lo, hi });
    }
    (n.children || []).forEach((k) => walk(k, m));
  };
  json.scenes[json.scene || 0].nodes.forEach((i) => walk(i, orient));
  return out;
}

/** Normalise to the stage footprint like vehicle.js does: length = fitLength, centred, on the floor. */
function normalise(comps) {
  const all = comps.map((c) => ({ ...c }));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  // Same idea as vehicle.js findOutliers: ignore parts that reach far outside the biggest one.
  const vol = (c) => c.hi.reduce((acc, h, k) => acc * Math.max(h - c.lo[k], 0.01), 1);
  const body = all.reduce((a, b) => (vol(b) > vol(a) ? b : a));
  const span = body.hi.map((h, k) => h - body.lo[k]);
  const keep = all.filter((c) => c.lo.every((l, k) => l >= body.lo[k] - 0.25 * span[0]) && c.hi.every((h, k) => h <= body.hi[k] + 0.25 * span[0]));
  keep.forEach((c) => c.lo.forEach((l, k) => { lo[k] = Math.min(lo[k], l); hi[k] = Math.max(hi[k], c.hi[k]); }));
  const s = STAGE.fitLength / (hi[0] - lo[0]);
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  const f = (p) => [(p[0] - cx) * s, (p[1] - lo[1]) * s, (p[2] - cz) * s];
  const dims = { length: (hi[0] - lo[0]) * s, height: (hi[1] - lo[1]) * s, width: (hi[2] - lo[2]) * s };
  const parts = keep.map((c) => { const a = f(c.lo), b = f(c.hi); return { center: a.map((v, k) => (v + b[k]) / 2), size: a.map((v, k) => Math.abs(b[k] - v)), lo: a, hi: b }; });
  return { parts, dims };
}

console.log('Assembly plan: real components of the five GLBs');
for (const vehicle of VEHICLES) {
  check(`${vehicle.make} ${vehicle.model}: separate components, bounded sane offsets, nothing below the floor`, () => {
    const { parts, dims } = normalise(components(vehicle));
    assert.ok(parts.length >= 40, `only ${parts.length} separate components`);
    const plan = planAssembly(parts, dims);
    assert.equal(plan.length, parts.length);
    let max = 0;
    plan.forEach((p, i) => {
      [...p.offset, p.delay, p.span].forEach((v) => assert.ok(Number.isFinite(v)));
      assert.ok(p.delay >= 0 && p.span > 0 && p.delay + p.span <= 1 + 1e-9, `timing ${p.delay} + ${p.span}`);
      assert.ok(parts[i].lo[1] + p.offset[1] >= 0.03 - 1e-9 || p.offset[1] === 0 || parts[i].lo[1] < 0.03, 'part would start below the floor');
      max = Math.max(max, Math.hypot(...p.offset));
    });
    assert.ok(max <= SPREAD * dims.length * 1.6 + 0.6, `largest travel ${max.toFixed(2)} m is too far`);
    assert.ok(max >= SPREAD * dims.length * 0.5, `explosion too timid (${max.toFixed(2)} m)`);
    const spread = new Set(plan.map((p) => p.delay.toFixed(2))).size;
    assert.ok(spread >= 8, 'assembly must happen in waves');
    console.log(`        ${parts.length} components, max travel ${max.toFixed(2)} m`);
  });
}

check('plan is deterministic and degrades safely (empty list, part at the core, tiny part)', () => {
  const dims = { length: 4.9, width: 1.9, height: 1.3 };
  const parts = [{ center: [0, 0.55, 0], size: [0.1, 0.1, 0.1] }, { center: [1, 0.3, 0.9], size: [0.6, 0.6, 0.2] }];
  assert.deepEqual(planAssembly(parts, dims), planAssembly(parts, dims));
  assert.deepEqual(planAssembly([], dims), []);
  planAssembly(parts, dims)[0].offset.forEach((v) => assert.ok(Number.isFinite(v)));
});

check('easing: parts always finish at their original position', () => {
  assert.equal(partEase(0), 0); assert.equal(partEase(1), 1); assert.equal(partEase(2), 1); assert.equal(partEase(-1), 0);
  assert.equal(smooth(0), 0); assert.equal(smooth(1), 1);
});

console.log('Intro wiring');
const boot = read('js/core/bootstrap.js'), intro = read('js/scene/assembly-intro.js'), gate = read('js/scene/intro-gate.js'), coll = read('js/pages/collection.js');

check('triggered only from the Collection, consumed once; reduced motion and ?intro=off respected', () => {
  assert.ok(/armIntro\(vehicle\.id\)/.test(coll) && /VEHICLES\.find/.test(coll));
  assert.ok(/removeItem\(KEY\)/.test(gate) && /prefers-reduced-motion: reduce/.test(gate) && /param === 'off'/.test(gate));
  assert.ok(!/armIntro/.test(read('js/pages/car.js')) && !/armIntro/.test(read('js/pages/home.js')));
});

check('bootstrap reuses the one loaded model (no second download) and never fails the page for the intro', () => {
  assert.equal((boot.match(/loadVehicle\(/g) || []).length, 1);
  assert.ok(!/GLTFLoader|fetch\(/.test(intro), 'intro must not load models');
  assert.ok(/shouldPlayIntro\(vehicle\)/.test(boot) && /beforeHide/.test(boot) && /catch \(error\)[\s\S]{0,120}intro skipped/.test(boot));
});

check('?3d=off and low-data mode still bypass 3D (and therefore the intro) entirely', () => {
  const car = read('js/pages/car.js');
  assert.ok(car.indexOf('shouldSkip3D()') < car.indexOf("import('../core/bootstrap.js')"));
});

check('intro changes only positions: no geometry, material or texture edits, no clones', () => {
  assert.ok(!/\.geometry\s*=|\.material\s*=|\.clone\(\)\s*;?\s*\n?.*material|new THREE\.(Mesh|BufferGeometry|Material)/.test(intro.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.ok(/e\.mesh\.position\.set/.test(intro) && /position\.copy\(e\.rest\)/.test(intro));
});

check('Skip intro, Escape, failure fallback and a stylesheet that is loaded on demand', () => {
  assert.ok(/Skip intro/.test(intro) && /event\.key === 'Escape'/.test(intro) && /function abort\(\)/.test(intro));
  assert.ok(existsSync(join(ROOT, 'css/intro.css')) && /link\[data-intro-styles\]/.test(intro));
  for (const v of VEHICLES) assert.ok(!read(FILE(v.page)).includes('intro.css'), `${v.page} must stay unchanged`);
});

check('intro.css hides content only under html.is-intro and stays opacity-only; reduced motion handled', () => {
  const css = read('css/intro.css');
  assert.ok(/html\.is-intro main/.test(css) && /prefers-reduced-motion/.test(css));
  assert.ok(!/(filter|box-shadow|text-shadow)\s*:/.test(css), 'no heavy effects');
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
