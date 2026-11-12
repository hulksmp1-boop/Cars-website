/**
 * Run:  node tests/porsche-page.test.mjs
 * Porsche 911 Carrera 4S page: checks the REAL porsche-911-carrera-4s.glb header/JSON (no Draco decoding,
 * no rendering), its MODELS entry, its camera shot and its page hooks. Kept small on purpose.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, STAGE, VEHICLES } from '../js/config.js';
import { createTrack, resolvePose, compositionShift, DEG } from '../js/scene/camera-rig.js';
import { PORSCHE_SHOT } from '../js/scene/shots/porsche-911-carrera-4s.js';
import { SHOTS } from '../js/scene/shots/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'porsche-911-carrera-4s';
const spec = MODELS[ID];
const buf = readFileSync(join(root, spec.url));
const html = readFileSync(join(root, 'cars/porsche-911.html'), 'utf8');

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

console.log('Porsche GLB and MODELS entry');

check('valid GLB, size matches config, only extensions GLTFLoader + Draco support', () => {
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  assert.equal(buf.readUInt32LE(8), buf.length);
  assert.ok(Math.abs(buf.length - spec.approxBytes) < 1024);
  const ok = new Set(['KHR_draco_mesh_compression', 'EXT_texture_webp']);
  for (const e of gltf.extensionsRequired || []) assert.ok(ok.has(e), `unsupported required extension ${e}`);
});

check('nose is on +Z in the file, so orientationY 90 puts it on +X (front bumper meshes ahead of the rear lamps\' plane)', () => {
  assert.equal(spec.orientationY, 90);
  assert.ok(zCentre(/^bumper_front/) > 1.4, 'front bumper at +Z');
  assert.ok(zCentre(/^Plane\.00[345]_0$/) < -1.5, 'rear details at -Z');
});

check('the hidden mesh is the flat baked-shadow card, and it is the only thing wider than the body', () => {
  assert.deepEqual(spec.hideMeshes, ['Plane_0']);
  const card = meshes.find((m) => m.name === 'Plane_0');
  assert.ok(card && Math.abs(card.max[1] - card.min[1]) < 1e-6, 'Plane_0 is zero-thickness');
  const rest = meshes.filter((m) => m.name !== 'Plane_0');
  const bodyW = Math.max(...rest.map((m) => m.max[0])) - Math.min(...rest.map((m) => m.min[0]));
  assert.ok(card.max[0] - card.min[0] > bodyW + 0.5, 'the card is much wider than the car');
});

const kept = meshes.filter((m) => !spec.hideMeshes.includes(m.name));
const b = { min: [0, 1, 2].map((k) => Math.min(...kept.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...kept.map((m) => m.max[k]))) };
const size = b.max.map((v, k) => v - b.min[k]);
const length = size[2], width = size[0], height = size[1];   // file frame: nose on Z

check('normalised car is real-sized and sits inside the camera box (length 4.9 m, same as the BMW)', () => {
  const k = STAGE.fitLength / length;
  assert.ok(Math.abs(length - spec.expected.length) / spec.expected.length < 0.08, `length ${length.toFixed(2)}`);
  assert.ok(Math.abs(height - spec.expected.height) / spec.expected.height < 0.05, `height ${height.toFixed(2)}`);
  assert.ok(width * k <= 2.1 && height * k <= 1.32, `${(width * k).toFixed(2)} x ${(height * k).toFixed(2)} m`);
  assert.ok(Math.abs(b.min[1]) < 0.7, 'lowest point is the tyres');
  console.log(`         normalised ${(length * k).toFixed(2)} x ${(width * k).toFixed(2)} x ${(height * k).toFixed(2)} m (L x W x H)`);
});

check('CC BY-SA 4.0 attribution to Karol Miklas is in config, the GLB metadata and the README', () => {
  assert.equal(spec.credit.author, 'Karol Miklas');
  assert.equal(spec.credit.license, 'CC BY-SA 4.0');
  assert.match(spec.credit.sourceUrl, /sketchfab\.com\/3d-models\/free-porsche-911-carrera-4s/);
  assert.match(gltf.asset.extras.author, /Karol Miklas/);
  assert.match(gltf.asset.extras.license, /CC-BY-SA-4\.0/);
  assert.ok(readFileSync(join(root, 'README.md'), 'utf8').includes('Karol Miklas'));
});

console.log('Porsche shot');

const track = createTrack(PORSCHE_SHOT.keys);
check('registered, first and last keyframe are the same pose (hand-off match), chapters ordered', () => {
  assert.equal(SHOTS[ID], PORSCHE_SHOT);
  const a = resolvePose(track.sample(0), { aspect: 16 / 9 }), z = resolvePose(track.sample(1), { aspect: 16 / 9 });
  for (let i = 0; i < 3; i++) { assert.ok(Math.abs(a.position[i] - z.position[i]) < 1e-6); assert.ok(Math.abs(a.target[i] - z.target[i]) < 1e-6); }
  const t = PORSCHE_SHOT.chapters.map((c) => c.t);
  assert.deepEqual(t, [...t].sort((x, y) => x - y));
});

const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const HALF = { x: 2.45, y: 1.32, z: 1.05 };   // normalised Porsche box (BMW test uses y 1.48)
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

console.log('Porsche page');

check('page has every 3D hook, the Porsche identity, the vehicle id and the six dossier chapters', () => {
  for (const hook of ['data-loader', 'id="stage"', 'data-scroll-progress', 'data-showcase', 'data-hud', 'data-hud-rail', 'data-model-error', 'data-webgl-fallback', 'css/car.css', 'css/loader.css', 'css/bmw-m5.css', 'css/porsche-911.css', 'js/ui/bmw-editorial.js']) assert.ok(html.includes(hook), `missing ${hook}`);
  assert.ok(html.includes(`data-vehicle="${ID}"`) && !html.includes('bmw-m5-f90'));
  for (const id of ['the-car', 'engine', 'specifications', 'highlights', 'story', 'close']) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  assert.ok(html.indexOf('class="showcase"') < html.indexOf('class="dossier"'));
  const v = VEHICLES.find((x) => x.id === ID);
  assert.ok(html.includes(`>${v.model}</h1>`) && html.includes(`>${v.designation}</p>`));
});

check('headline figures agree across the page (450 PS / 331 kW, 530 Nm, 3.6 s, 306 km/h, 4,519 mm)', () => {
  for (const s of ['331 kW (450 PS)', '530 Nm', '3.6 s', '306 km/h', '4,519 mm', '2,981 cc', '91.0 × 76.4 mm', '10.2 : 1']) assert.ok(html.includes(s), `page lacks ${s}`);
  assert.ok(!/625|M5|V8|S63/.test(html.replace(/BMW M5 F90|Four doors\. Twin-turbo V8\. Uncompromising\.|M5 F90|\bBMW\b/g, '')), 'leftover BMW content');
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
