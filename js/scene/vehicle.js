/**
 * AETHER GT — Vehicle loader / rig.
 *
 * Loads one GLB and wraps it in a normalised rig so every vehicle, now and in
 * future phases, shares the same frame:
 *
 *   rig.root   Group the director rotates (turntable spin). Origin = centre of
 *              the footprint on the floor.
 *   └ pivot    Uniform scale + offset that fits the car to STAGE.fitLength,
 *              centres it on X/Z and sets its lowest point on y = 0.
 *     └ model  The GLB scene, untouched apart from `orientationY`.
 *
 * Nose points to +X. Geometry is never modified, only scaled uniformly.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DRACO_DECODER_PATH, STAGE } from '../config.js';

const TEXTURE_SLOTS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap',
  'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap',
];

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Streams a file, reporting 0..1. Aborts if nothing arrives for `stallMs`. */
async function download(url, { approxBytes = 0, stallMs, onProgress }) {
  const controller = new AbortController();
  let timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), stallMs);
  };

  try {
    arm();
    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      throw new Error(controller.signal.aborted ? 'The model download stalled.' : `Network error while loading the model (${error.message}).`);
    }
    if (!response.ok) throw new Error(`The model could not be found (HTTP ${response.status}).`);

    const total = Number(response.headers.get('content-length')) || approxBytes;

    if (!response.body || !response.body.getReader) {
      const buffer = await response.arrayBuffer();
      onProgress(1);
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        arm();
        chunks.push(value);
        received += value.byteLength;
        onProgress(total ? Math.min(received / total, 1) : 0);
      }
    } catch (error) {
      throw new Error(controller.signal.aborted ? 'The model download stalled.' : `The model download was interrupted (${error.message}).`);
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    onProgress(1);
    return bytes.buffer;
  } finally {
    clearTimeout(timer);
  }
}

function meshWorldBox(mesh) {
  const geometry = mesh.geometry;
  if (!geometry) return null;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) return null;
  return box.clone().applyMatrix4(mesh.matrixWorld);
}

/**
 * Finds meshes whose bounds reach far outside the car's main body (broken
 * geometry in the source file) so they can be hidden and ignored when measuring.
 * The BMW file has one: an instrument-cluster mesh that stretches ~6 m behind the car.
 */
function findOutliers(model, margin) {
  const entries = [];
  model.traverse((o) => {
    if (!o.isMesh || !o.visible) return;       // meshes hidden via spec.hideMeshes are ignored
    const box = meshWorldBox(o);
    if (box) entries.push({ mesh: o, box, volume: Math.max(box.getSize(new THREE.Vector3()).toArray().reduce((a, b) => a * Math.max(b, 0.01), 1), 0) });
  });
  if (!entries.length) return { outliers: [], bounds: new THREE.Box3() };

  const body = entries.reduce((a, b) => (b.volume > a.volume ? b : a));
  const allowed = body.box.clone().expandByScalar(margin);

  const outliers = [];
  const bounds = new THREE.Box3();
  for (const e of entries) {
    if (allowed.containsBox(e.box)) bounds.union(e.box);
    else outliers.push(e.mesh);
  }
  return { outliers, bounds };
}

/**
 * @param {{ renderer: THREE.WebGLRenderer, quality: { anisotropy:number } }} stage
 * @param {object} spec  entry from MODELS in config.js
 * @param {(fraction:number, label?:string) => void} report
 */
export async function loadVehicle(stage, spec, report = () => {}) {
  const { renderer, quality } = stage;

  // 1. Download (0 → 0.70) ---------------------------------------------------
  report(0, 'Loading model');
  const buffer = await download(spec.url, {
    approxBytes: spec.approxBytes,
    stallMs: STAGE.stallTimeout,
    onProgress: (f) => report(f * 0.7, 'Loading model'),
  });

  // 2. Decode geometry + textures (0.70 → 0.88) ------------------------------
  report(0.7, 'Decoding geometry');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  let gltf;
  try {
    gltf = await loader.parseAsync(buffer, '');
  } catch (error) {
    throw new Error(`The model file could not be decoded (${error.message || error}).`);
  } finally {
    draco.dispose(); // stops the decoder workers
  }
  report(0.88, 'Preparing materials');

  const model = gltf.scene;
  model.name = 'model';
  model.rotation.y = (spec.orientationY || 0) * (Math.PI / 180);

  const pivot = new THREE.Group();
  pivot.name = 'pivot';
  pivot.add(model);
  const root = new THREE.Group();
  root.name = spec.id || 'vehicle';
  root.add(pivot);
  root.updateMatrixWorld(true);

  // 3. Sanity-check, normalise ----------------------------------------------
  // Helper geometry that is not part of the car (e.g. the Porsche file's baked-shadow card).
  if (spec.hideMeshes && spec.hideMeshes.length) {
    const names = new Set(spec.hideMeshes);
    model.traverse((o) => {
      if (o.isMesh && (names.has(o.name) || names.has(o.userData && o.userData.name))) o.visible = false;
    });
  }
  const { outliers, bounds } = findOutliers(model, STAGE.outlierMargin);
  if (outliers.length) {
    console.warn(`[AETHER GT] Hiding ${outliers.length} malformed mesh(es) that extend far outside the body:`, outliers.map((m) => m.name));
    outliers.forEach((m) => { m.visible = false; });
  }
  if (bounds.isEmpty()) throw new Error('The model contains no visible geometry.');

  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  if (spec.expected) {
    const off = Math.abs(size.x - spec.expected.length) / spec.expected.length;
    if (off > 0.25) console.warn(`[AETHER GT] Model length ${size.x.toFixed(2)} m differs from the expected ${spec.expected.length} m: check orientationY / units.`);
    if (size.z > size.x) console.warn('[AETHER GT] Model is longer along Z than X: it may need orientationY = 90 or -90.');
  }

  const scale = STAGE.fitLength / size.x;
  pivot.scale.setScalar(scale);
  pivot.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
  root.updateMatrixWorld(true);

  const dimensions = { length: size.x * scale, width: size.z * scale, height: size.y * scale };

  // 4. Texture settings (anisotropy) + collect for GPU upload ------------------
  const textures = new Set();
  const materials = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && materials.add(m));
  });
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.anisotropy);
  materials.forEach((m) => {
    TEXTURE_SLOTS.forEach((slot) => {
      const t = m[slot];
      if (t && t.isTexture) { t.anisotropy = maxAniso; textures.add(t); }
    });
  });

  /**
   * Compiles shaders and uploads textures a few at a time, so the first
   * scroll frames don't stall. Call once the rig is in the scene.
   */
  async function warmUp(camera, onProgress = () => {}) {
    onProgress(0, 'Compiling shaders');
    try { await renderer.compileAsync(root, camera, stage.scene); } catch { /* non-fatal: first render will compile */ }
    const list = [...textures];
    const BATCH = 4;
    for (let i = 0; i < list.length; i += BATCH) {
      list.slice(i, i + BATCH).forEach((t) => renderer.initTexture(t));
      onProgress(Math.min((i + BATCH) / list.length, 1), 'Uploading textures');
      await nextFrame();
    }
  }

  /** Releases every GPU resource the model owns. */
  function dispose() {
    root.removeFromParent();
    const geometries = new Set();
    model.traverse((o) => { if (o.isMesh && o.geometry) geometries.add(o.geometry); });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => {
      if (t.image && typeof t.image.close === 'function') t.image.close(); // free ImageBitmap memory
      t.dispose();
    });
    textures.clear();
    materials.clear();
  }

  report(0.92, 'Preparing materials');
  return { id: spec.id, root, pivot, model, dimensions, textures, warmUp, dispose, outliers: outliers.map((m) => m.name) };
}
