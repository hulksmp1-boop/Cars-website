/**
 * Run:  node tests/nissan-page.test.mjs
 * Nissan GT-R R35 page: checks the REAL nissan-gt-r-r35.glb header/JSON (no Draco decoding,
 * no rendering), its MODELS entry, its camera shot and its page hooks. Kept small on purpose.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, STAGE, VEHICLES } from '../js/config.js';
import { createTrack, resolvePose, compositionShift, DEG } from '../js/scene/camera-rig.js';
import { NISSAN_SHOT } from '../js/scene/shots/nissan-gt-r-r35.js';
import { SHOTS } from '../js/scene/shots/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'nissan-gt-r-r35';
const spec = MODELS[ID];
const buf = readFileSync(join(root, spec.url));
const html = readFileSync(join(root, 'cars/nissan-gt-r.html'), 'utf8');

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

// --- GLB JSON + world-space mesh bounds (accessor min/max through node transforms) ---------------------------
let gltf = null;
for (let off = 12; off < buf.length;) { const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4); if (type === 0x4e4f534a) gltf = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len)); off += 8 + len; }
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const local = (n) => { if (n.matrix) return n.matrix; const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1]; return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; };
const apply = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
const world = []; const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const walk = (i, p) => { const m = mul(p, local(gltf.nodes[i])); world[i] = m; (gltf.nodes[i].children || []).forEach((c) => walk(c, m)); };
gltf.scenes[gltf.scene || 0].nodes.forEach((n) => walk(n, I));
const meshes = [];
gltf.nodes.forEach((n, i) => {
  if (n.mesh === undefined) return;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const prim of gltf.meshes[n.mesh].primitives) {
    const a = gltf.accessors[prim.attributes.POSITION];
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
      const p = apply(world[i], [cx ? a.max[0] : a.min[0], cy ? a.max[1] : a.min[1], cz ? a.max[2] : a.min[2]]);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    }
  }
  meshes.push({ name: n.name, min, max });
});
const zCentre = (re) => { const m = meshes.filter((x) => re.test(x.name)); return m.reduce((s, x) => s + (x.min[2] + x.max[2]) / 2, 0) / m.length; };

console.log('Nissan GLB and MODELS entry');

check('valid GLB, size matches config, only extensions GLTFLoader + Draco support', () => {
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  assert.equal(buf.readUInt32LE(8), buf.length);
  assert.ok(Math.abs(buf.length - spec.approxBytes) < 1024);
  const ok = new Set(['KHR_draco_mesh_compression', 'EXT_texture_webp']);
  for (const e of gltf.extensionsRequired || []) assert.ok(ok.has(e), `unsupported required extension ${e}`);
});

const xCentre = (re) => { const m = meshes.filter((x) => re.test(x.name)); return m.reduce((s, x) => s + (x.min[0] + x.max[0]) / 2, 0) / m.length; };

check('nose is on -X in the file, so orientationY 180 puts it on +X (grille and headlamps ahead, tail lamps and plate behind)', () => {
  assert.equal(spec.orientationY, 180);
  assert.ok(xCentre(/^(Headlights|GTR logo_|Cooler_)/) < -1.5, 'front details at -X');
  assert.ok(xCentre(/^(Taillights|License Plate)/) > 1.5, 'rear details at +X');
});

check('no helper geometry: nothing to hide, no flat card, and no mesh reaches far outside the body (so the loader hides nothing)', () => {
  assert.equal(spec.hideMeshes, undefined);
  const flat = meshes.filter((m) => { const s = [0, 1, 2].map((k) => m.max[k] - m.min[k]); return Math.min(...s) < 0.005 && Math.max(...s) > 1.5; });
  assert.deepEqual(flat.map((m) => m.name), []);
  const all = { min: [0, 1, 2].map((k) => Math.min(...meshes.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...meshes.map((m) => m.max[k]))) };
  assert.ok(all.max[0] - all.min[0] < 5.0 && all.max[2] - all.min[2] < 2.3, 'whole file is car-sized');
});

const kept = meshes;
const b = { min: [0, 1, 2].map((k) => Math.min(...kept.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...kept.map((m) => m.max[k]))) };
const size = b.max.map((v, k) => v - b.min[k]);
const length = size[0], width = size[2], height = size[1];   // file frame: nose on -X, width on Z

check('normalised car is real-sized and sits inside the camera box (length 4.9 m, same as the BMW)', () => {
  const k = STAGE.fitLength / length;
  assert.ok(Math.abs(length - spec.expected.length) / spec.expected.length < 0.08, `length ${length.toFixed(2)}`);
  assert.ok(Math.abs(height - spec.expected.height) / spec.expected.height < 0.05, `height ${height.toFixed(2)}`);
  assert.ok(width * k <= 2.15 && height * k <= 1.45, `${(width * k).toFixed(2)} x ${(height * k).toFixed(2)} m`);
  assert.ok(Math.abs(b.min[1]) < 0.7, 'lowest point is the tyres');
  console.log(`         normalised ${(length * k).toFixed(2)} x ${(width * k).toFixed(2)} x ${(height * k).toFixed(2)} m (L x W x H)`);
});

check('CC BY 4.0 attribution to Ciasny is in config, the GLB metadata and the README', () => {
  assert.equal(spec.credit.author, 'Ciasny');
  assert.equal(spec.credit.license, 'CC BY 4.0');
  assert.match(spec.credit.sourceUrl, /sketchfab\.com\/3d-models\/nissan-gtr-r35/);
  assert.match(gltf.asset.extras.author, /Ciasny/);
  assert.match(gltf.asset.extras.license, /CC-BY-4\.0/);
  assert.ok(readFileSync(join(root, 'assets/models/README.md'), 'utf8').includes('Ciasny'));
});

console.log('Nissan shot');

const track = createTrack(NISSAN_SHOT.keys);
check('registered, first and last keyframe are the same pose (hand-off match), chapters ordered', () => {
  assert.equal(SHOTS[ID], NISSAN_SHOT);
  const a = resolvePose(track.sample(0), { aspect: 16 / 9 }), z = resolvePose(track.sample(1), { aspect: 16 / 9 });
  for (let i = 0; i < 3; i++) { assert.ok(Math.abs(a.position[i] - z.position[i]) < 1e-6); assert.ok(Math.abs(a.target[i] - z.target[i]) < 1e-6); }
  const t = NISSAN_SHOT.chapters.map((c) => c.t);
  assert.deepEqual(t, [...t].sort((x, y) => x - y));
});

const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const HALF = { x: 2.45, y: 1.45, z: 1.08 };   // normalised Nissan box (about 4.9 x 2.13 x 1.43 m)
for (const [label, aspect] of Object.entries({ '21:9': 21 / 9, '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '9:16': 9 / 16, '9:19.5': 9 / 19.5 })) {
  check(`car fully in frame, camera never inside it @ ${label}`, () => {
    const shift = 2 * compositionShift(aspect);
    let maxExt = 0, minDist = Infinity;
    for (let i = 0; i <= 1200; i++) {
      const pose = resolvePose(track.sample(i / 1200), { aspect });
      const back = norm(sub(pose.position, pose.target)), right = norm(cross([0, 1, 0], back)), up = cross(back, right);
      const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw), tn = Math.tan((pose.fov * DEG) / 2);
      for (const x of [-HALF.x, HALF.x]) for (const y of [0, HALF.y]) for (const zz of [-HALF.z, HALF.z]) {
        const v = sub([x * c + zz * s, y, -x * s + zz * c], pose.position);
        const d = -dot(v, back);
        assert.ok(d > 0.1, 'corner behind camera');
        maxExt = Math.max(maxExt, Math.abs(dot(v, right) / d / (tn * aspect)), Math.abs(dot(v, up) / d / tn + shift));
        minDist = Math.min(minDist, d);
      }
    }
    assert.ok(maxExt <= 0.97, `car leaves frame: ${maxExt.toFixed(3)}`);
    assert.ok(minDist > 2.0, `camera too close: ${minDist.toFixed(2)}`);
  });
}

console.log('Nissan page');

check('page has every 3D hook, the Nissan identity, the vehicle id and the seven dossier chapters', () => {
  for (const hook of ['data-loader', 'id="stage"', 'data-scroll-progress', 'data-showcase', 'data-hud', 'data-hud-rail', 'data-model-error', 'data-webgl-fallback', 'css/car.css', 'css/loader.css', 'css/bmw-m5.css', 'css/nissan-gt-r.css', 'js/ui/bmw-editorial.js']) assert.ok(html.includes(hook), `missing ${hook}`);
  assert.ok(html.includes(`data-vehicle="${ID}"`) && !html.includes('bmw-m5-f90') && !html.includes('porsche-911-carrera-4s'));
  for (const id of ['the-car', 'engine', 'specifications', 'highlights', 'story', 'sheet', 'close']) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  const order = ['the-car', 'engine', 'specifications', 'highlights', 'story', 'sheet', 'close'].map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'chapters out of order');
  assert.ok(html.indexOf('class="showcase"') < html.indexOf('class="dossier"'));
  const v = VEHICLES.find((x) => x.id === ID);
  assert.ok(html.includes(`>${v.model}</h1>`) && html.includes(`>${v.designation}</p>`));
});

check('headline figures agree across the page and match the verified 2017-onward Europe GT-R Premium', () => {
  for (const s of ['419 kW (570 PS)', '637 Nm', '6,800 rpm', '3,300–5,800 rpm', '315 km/h', '2.7 s', '4,710 mm', '2,780 mm', '1,895 mm', '1,370 mm', '3,799 cc', '95.5 × 88.4 mm', '9.0 : 1', '1,752 kg', '315 L', '74 L', '353 kW (480 PS)', '441 kW (600 PS)']) assert.ok(html.includes(s), `page lacks ${s}`);
  // no figure from another car or an unverified source
  assert.ok(!/\b(450 PS|625|S63|V8|331 kW|3\.6 s|306 km\/h|2,981)\b/.test(html.replace(/Four doors\. Twin-turbo V8\. Uncompromising\.|BMW M5 F90|Carrera 4S|911/g, '')), 'leftover figures from another page');
  assert.ok(!/nürburgring|lap record|fastest|world.?record|most powerful|\bbest\b/i.test(html.replace(/<[^>]+>/g, ' ')), 'unverified record or superlative claim');
});

check('the GLB requires only the two extensions the loader supports (Draco geometry, WebP textures)', () => {
  assert.deepEqual([...(gltf.extensionsRequired || [])].sort(), ['EXT_texture_webp', 'KHR_draco_mesh_compression']);
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
