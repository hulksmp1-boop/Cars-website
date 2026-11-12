/**
 * Run:  node tests/supra-page.test.mjs
 * Chevrolet Corvette C8 Stingray page: checks the REAL chevrolet-corvette-c8.glb header/JSON (no Draco decoding,
 * no rendering), its MODELS entry, its camera shot and its page hooks. Kept small on purpose.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, STAGE, VEHICLES } from '../js/config.js';
import { createTrack, resolvePose, compositionShift, DEG } from '../js/scene/camera-rig.js';
import { CORVETTE_SHOT } from '../js/scene/shots/chevrolet-corvette-c8.js';
import { SHOTS } from '../js/scene/shots/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'chevrolet-corvette-c8';
const spec = MODELS[ID];
const buf = readFileSync(join(root, spec.url));
const html = readFileSync(join(root, 'cars/corvette-c8.html'), 'utf8');

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

console.log('Corvette GLB and MODELS entry');

check('valid GLB, size matches config, only extensions GLTFLoader + Draco support', () => {
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  assert.equal(buf.readUInt32LE(8), buf.length);
  assert.ok(Math.abs(buf.length - spec.approxBytes) < 1024);
  const ok = new Set(['KHR_draco_mesh_compression', 'EXT_texture_webp']);
  for (const e of gltf.extensionsRequired || []) assert.ok(ok.has(e), `unsupported required extension ${e}`);
});

const zMean = (re) => { const m = meshes.filter((x) => re.test(x.name)); return m.reduce((s, x) => s + (x.min[2] + x.max[2]) / 2, 0) / m.length; };
const matOf = (i) => gltf.materials[gltf.meshes[gltf.nodes.find((n) => n.name === meshes[i].name).mesh].primitives[0].material].name;
const zOfMaterial = (name) => { const m = meshes.map((x, i) => ({ x, mat: matOf(i) })).filter((o) => o.mat === name); return m.reduce((s, o) => s + (o.x.min[2] + o.x.max[2]) / 2, 0) / m.length; };

check('nose is on -Z in the file, so orientationY -90 puts it on +X (headlamps ahead, tail and reverse lamps behind)', () => {
  assert.equal(spec.orientationY, -90);
  assert.ok(zOfMaterial('Headlights') < -1.5 && zOfMaterial('Day_Lights') < -1.5, 'headlamps at -Z');
  assert.ok(zOfMaterial('Taillights') > 1.5 && zOfMaterial('Reverse_Lights') > 1.5, 'tail and reverse lamps at +Z');
});

check('no helper geometry: nothing to hide, no flat card, and the whole file is car-sized (so the loader hides nothing)', () => {
  assert.equal(spec.hideMeshes, undefined);
  const flat = meshes.filter((m) => { const s = [0, 1, 2].map((k) => m.max[k] - m.min[k]); return Math.min(...s) < 0.005 && Math.max(...s) > 0.8; });
  assert.deepEqual(flat.map((m) => m.name), []);
  const all = { min: [0, 1, 2].map((k) => Math.min(...meshes.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...meshes.map((m) => m.max[k]))) };
  assert.ok(all.max[2] - all.min[2] < 5.4 && all.max[0] - all.min[0] < 2.6, 'whole file is car-sized');
});

const b = { min: [0, 1, 2].map((k) => Math.min(...meshes.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...meshes.map((m) => m.max[k]))) };
const length = b.max[2] - b.min[2], width = b.max[0] - b.min[0], height = b.max[1] - b.min[1];   // file frame: nose on +Z, width on X

check('normalised car sits inside the camera box (length 4.9 m, same as the BMW); file is within 25% of the published length (the loader warns beyond that)', () => {
  const k = STAGE.fitLength / length;
  assert.ok(Math.abs(length - spec.expected.length) / spec.expected.length < 0.25, `length ${length.toFixed(2)}`);
  assert.ok(width * k <= 2.6 && height * k <= 1.4, `${(width * k).toFixed(2)} x ${(height * k).toFixed(2)} m`);
  assert.ok(Math.abs(b.min[1]) < 0.7, 'lowest point is the tyres');
  console.log(`         normalised ${(length * k).toFixed(2)} x ${(width * k).toFixed(2)} x ${(height * k).toFixed(2)} m (L x W x H)`);
});

check('CC BY 4.0 attribution to Hari is in config, the GLB metadata and the README', () => {
  assert.equal(spec.credit.author, 'Hari');
  assert.equal(spec.credit.license, 'CC BY 4.0');
  assert.match(spec.credit.sourceUrl, /sketchfab\.com\/3d-models\/2019-chevrolet-corvette-c8-stingray/);
  assert.match(gltf.asset.extras.author, /Hari/);
  assert.match(gltf.asset.extras.license, /CC-BY-4\.0/);
  assert.ok(readFileSync(join(root, 'assets/models/README.md'), 'utf8').includes('Hari'));
});

console.log('Corvette shot');

const track = createTrack(CORVETTE_SHOT.keys);
check('registered, first and last keyframe are the same pose (hand-off match), chapters ordered', () => {
  assert.equal(SHOTS[ID], CORVETTE_SHOT);
  const a = resolvePose(track.sample(0), { aspect: 16 / 9 }), z = resolvePose(track.sample(1), { aspect: 16 / 9 });
  for (let i = 0; i < 3; i++) { assert.ok(Math.abs(a.position[i] - z.position[i]) < 1e-6); assert.ok(Math.abs(a.target[i] - z.target[i]) < 1e-6); }
  const t = CORVETTE_SHOT.chapters.map((c) => c.t);
  assert.deepEqual(t, [...t].sort((x, y) => x - y));
});

const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const HALF = { x: 2.45, y: 1.34, z: 1.3 };   // normalised Corvette box (about 4.9 x 2.3 x 1.3 m)
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

console.log('Corvette page');

check('page has every 3D hook, the Corvette identity, the vehicle id and the seven dossier chapters', () => {
  for (const hook of ['data-loader', 'id="stage"', 'data-scroll-progress', 'data-showcase', 'data-hud', 'data-hud-rail', 'data-model-error', 'data-webgl-fallback', 'css/car.css', 'css/loader.css', 'css/bmw-m5.css', 'css/chevrolet-corvette-c8.css', 'js/ui/bmw-editorial.js']) assert.ok(html.includes(hook), `missing ${hook}`);
  assert.ok(html.includes(`data-vehicle="${ID}"`) && !html.includes('bmw-m5-f90') && !html.includes('toyota-gr-supra-mk5') && !html.includes('css/toyota-gr-supra.css'));
  for (const id of ['the-car', 'engine', 'specifications', 'highlights', 'story', 'sheet', 'close']) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  const order = ['the-car', 'engine', 'specifications', 'highlights', 'story', 'sheet', 'close'].map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'chapters out of order');
  assert.ok(html.indexOf('class="showcase"') < html.indexOf('class="dossier"'));
  const v = VEHICLES.find((x) => x.id === ID);
  assert.ok(html.includes(`>${v.model}</h1>`) && html.includes(`>${v.designation}</p>`));
});

check('the variant is named (2020 Stingray, LT2, 8-speed dual-clutch) and headline figures agree with Chevrolet’s published 2020 values', () => {
  for (const s of ['2020 Stingray', '2020 model year', 'LT2', '495 hp', '369 kW', '470 lb-ft', '637 Nm', '490 hp', '465 lb-ft', '6,450 rpm', '5,150 rpm', '103.25 × 92 mm', '11.5 : 1', '2.9 s', '194 mph', '312 km/h', '4,630 mm', '2,722 mm', '1,934 mm', '1,234 mm', '1,648 mm', '1,586 mm', '357 L', '70 L', '245/35 ZR19', '305/30 ZR20', '40 : 60', 'dual-clutch']) assert.ok(html.includes(s), `page lacks ${s}`);
  assert.ok(!/\b(Z06|E-Ray|ZR1)\b/.test(html.replace(/later C8 models, the Z06, E-Ray and ZR1, are different cars and are not described here/i, '')), 'other C8 variants must not be described');
  assert.ok(!/manual (gearbox|transmission) (is|are) (available|offered)|six-speed|seven-speed/i.test(html), 'wrong gearbox claim');
  assert.ok(!/\b(570 PS|VR38|Skyline|inline-six|B58|turbo(charged)? (V|inline))\b/.test(html.replace(/no turbo/g, '')), 'leftover figures from another page');
  assert.ok(!/nürburgring|lap record|fastest|world.?record|most powerful|\bbest\b/i.test(html.replace(/<[^>]+>/g, ' ')), 'unverified record or superlative claim');
});

check('derived figures are right: 4,630 mm length scale, 2,722 mm wheelbase bar, 1,934 mm width, unit conversions', () => {
  const px = 360 / 4630;
  assert.ok(Math.abs(1934 * px - 150.4) < 0.1 && html.includes('height="150.4"'), 'footprint height');
  const wb = 2722 * px;
  assert.ok(Math.abs(94.2 + wb - 305.8) < 0.1 && Math.abs((94.2 + 305.8) / 2 - 200) < 0.01, 'wheelbase bar centred');
  assert.ok(Math.abs(495 * 0.7457 - 369) < 1 && Math.abs(470 * 1.3558 - 637) < 1 && Math.abs(490 * 0.7457 - 365) < 1 && Math.abs(465 * 1.3558 - 630) < 1);
  assert.ok(Math.abs(18.5 * 3.785 - 70) < 0.1 && Math.abs(12.6 * 28.317 - 357) < 0.5 && 2019 - 1953 === 66);
  assert.ok(Math.abs(5.25 / 4.63 - 1.13) < 0.01, 'model about 13% longer than the real car');
});

check('the GLB requires only the two extensions the loader supports (Draco geometry, WebP textures)', () => {
  assert.deepEqual([...(gltf.extensionsRequired || [])].sort(), ['EXT_texture_webp', 'KHR_draco_mesh_compression']);
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
