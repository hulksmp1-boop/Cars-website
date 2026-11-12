/**
 * Run:  node tests/model.test.mjs
 * Checks the REAL bmw-m5-f90.glb file (no Three.js needed): the glTF header and JSON are read
 * directly and bounds are computed from accessor min/max and node transforms.
 * This does NOT decode Draco geometry or render anything.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, STAGE, VEHICLES } from '../js/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = MODELS['bmw-m5-f90'];
const buf = readFileSync(join(root, spec.url));

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

// --- parse -------------------------------------------------------------------
let gltf = null;
{
  let off = 12;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) gltf = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    off += 8 + len;
  }
}

/** Extensions three@0.170 GLTFLoader can load (with the DRACOLoader wired up in vehicle.js). */
const SUPPORTED = new Set(['KHR_draco_mesh_compression', 'EXT_texture_webp', 'KHR_materials_clearcoat', 'KHR_texture_transform', 'KHR_materials_emissive_strength', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_sheen', 'KHR_mesh_quantization', 'KHR_materials_unlit', 'KHR_lights_punctual']);

const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const localMatrix = (n) => {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
};
const apply = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];

const meshes = [];
{
  const world = [];
  const walk = (i, parent) => { const m = mul(parent, localMatrix(gltf.nodes[i])); world[i] = m; (gltf.nodes[i].children || []).forEach((c) => walk(c, m)); };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  gltf.scenes[gltf.scene || 0].nodes.forEach((n) => walk(n, I));
  gltf.nodes.forEach((n, i) => {
    if (n.mesh === undefined || !world[i]) return;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const prim of gltf.meshes[n.mesh].primitives) {
      const a = gltf.accessors[prim.attributes.POSITION];
      for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
        const p = apply(world[i], [cx ? a.max[0] : a.min[0], cy ? a.max[1] : a.min[1], cz ? a.max[2] : a.min[2]]);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
      }
    }
    meshes.push({ name: n.name || gltf.meshes[n.mesh].name || '', min, max });
  });
}
const vol = (m) => m.max.reduce((acc, v, k) => acc * Math.max(v - m.min[k], 0.01), 1);
// Same rule as findOutliers() in js/scene/vehicle.js
const body = meshes.reduce((a, b) => (vol(b) > vol(a) ? b : a));
const lo = body.min.map((v) => v - STAGE.outlierMargin), hi = body.max.map((v) => v + STAGE.outlierMargin);
const isOutlier = (m) => !(m.min.every((v, k) => v >= lo[k]) && m.max.every((v, k) => v <= hi[k]));
const outliers = meshes.filter(isOutlier);
const kept = meshes.filter((m) => !isOutlier(m));
const bounds = { min: [0, 1, 2].map((k) => Math.min(...kept.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...kept.map((m) => m.max[k]))) };
const size = bounds.max.map((v, k) => v - bounds.min[k]);
const centreX = (re) => { const m = meshes.filter((x) => re.test(x.name)); return m.reduce((s, x) => s + (x.min[0] + x.max[0]) / 2, 0) / m.length; };

console.log('BMW GLB');

check('valid GLB container (magic, version 2, declared length = file length)', () => {
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  assert.equal(buf.readUInt32LE(4), 2);
  assert.equal(buf.readUInt32LE(8), buf.length);
  assert.ok(Math.abs(buf.length - spec.approxBytes) < 1024, `file is ${buf.length} B, config says ${spec.approxBytes}`);
});

check('every required extension is one GLTFLoader (+ Draco) supports', () => {
  for (const ext of gltf.extensionsRequired || []) assert.ok(SUPPORTED.has(ext), `unsupported required extension ${ext}`);
  assert.ok((gltf.extensionsRequired || []).includes('KHR_draco_mesh_compression'), 'test premise: file is Draco-compressed');
});

check('every position accessor carries min/max (needed for the bounds checks)', () => {
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
    const a = gltf.accessors[p.attributes.POSITION];
    assert.ok(a.min && a.max, `mesh ${mesh.name} has no POSITION min/max`);
  }
});

check('nose points to +X: rear lamps are behind the centre, front indicators and engine ahead', () => {
  assert.equal(spec.orientationY, 0);
  assert.ok(centreX(/rear(red|tail)|reargfs/) < -1.5, `rear lamps at x=${centreX(/rear(red|tail)|reargfs/)}`);
  assert.ok(centreX(/blinkerfront/) > 1, `front indicators at x=${centreX(/blinkerfront/)}`);
  assert.ok(centreX(/M_Engine/) > 1, `engine bay at x=${centreX(/M_Engine/)}`);
});

check('model is longer along X than Z and close to the real M5 size', () => {
  assert.ok(size[0] > size[2]);
  const { length, width, height } = spec.expected;
  assert.ok(Math.abs(size[0] - length) / length < 0.05, `length ${size[0].toFixed(3)}`);
  assert.ok(Math.abs(size[2] - width) / width < 0.05, `width ${size[2].toFixed(3)}`);
  assert.ok(Math.abs(size[1] - height) / height < 0.05, `height ${size[1].toFixed(3)}`);
});

check('the one known malformed mesh (instrument cluster) is the only outlier, as vehicle.js expects', () => {
  assert.equal(outliers.length, 1, outliers.map((o) => o.name).join(', '));
  assert.match(outliers[0].name, /gauge_emissive/);
  assert.ok(outliers[0].min[0] < -8, 'it really does stretch several metres behind the car');
});

check('normalised car fits inside the box the camera tests assume, and sits on the floor', () => {
  const k = STAGE.fitLength / size[0];
  const HALF = { x: 2.45, y: 1.48, z: 1.05 }; // same box as tests/camera.test.mjs
  assert.ok(size[0] * k / 2 <= HALF.x + 1e-9);
  assert.ok(size[1] * k <= HALF.y, `height ${(size[1] * k).toFixed(3)}`);
  assert.ok(size[2] * k / 2 <= HALF.z, `half width ${(size[2] * k / 2).toFixed(3)}`);
  assert.ok(Math.abs(bounds.min[1]) < 0.05, `lowest point ${bounds.min[1]} (vehicle.js moves it to y=0)`);
  console.log(`         normalised ${ (size[0] * k).toFixed(2)} x ${(size[2] * k).toFixed(2)} x ${(size[1] * k).toFixed(2)} m (L x W x H)`);
});

check('CC BY 4.0 attribution to RES1N is preserved (config, GLB metadata, README)', () => {
  assert.equal(spec.credit.author, 'RES1N');
  assert.equal(spec.credit.license, 'CC BY 4.0');
  assert.match(spec.credit.sourceUrl, /sketchfab\.com\/3d-models\/bmw-m5-f90/);
  assert.match(gltf.asset.extras.author, /RES1N/);
  assert.match(gltf.asset.extras.license, /CC-BY-4\.0/);
  assert.ok(VEHICLES[0].id === 'bmw-m5-f90');
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.ok(readme.includes('RES1N') && readme.includes('CC BY 4.0'));
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
