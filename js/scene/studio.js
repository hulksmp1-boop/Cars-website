/**
 * AETHER GT — Automotive photo studio.
 *
 *  - Environment: a procedural PMREM "studio" (mid-tone green-grey walls, a bright
 *    ceiling, and a handful of gradient softboxes: overhead, two flank strips, a
 *    front fill and two champagne rim strips). This is what the paint reflects, so
 *    body lines read as long, soft, controlled highlights. Every value lives in look.js.
 *  - Lights: warm key, champagne rim, ivory rim, and a green/ivory hemisphere fill.
 *    No real-time shadows.
 *  - Tone mapping: Khronos PBR Neutral, so the paint keeps its true colour.
 *  - Floor: polished British Racing Green, radial fade into the backdrop, plus a
 *    soft warm pool of light under the car.
 *  - Backdrop: a huge inside-out dome in deep greens, horizon matched to --color-bg.
 *  - Contact shadow: baked once per vehicle (see contact-shadow.js).
 *
 * Everything is created once. `dispose()` releases every GPU resource.
 */

import * as THREE from 'three';
import { createContactShadow } from './contact-shadow.js';
import { LOOK } from './look.js';

function queryNumber(name, min, max) {
  try {
    const raw = new URLSearchParams(location.search).get(name);
    const value = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
  } catch { return null; }
}

/** Lighting values a future vehicle preset can override and blend. Keys are used by assembly-intro.js. */
export const DEFAULT_LIGHTING = {
  exposure: LOOK.lighting.exposure,
  envIntensity: LOOK.lighting.envIntensity,
  keyIntensity: LOOK.lighting.keyIntensity,
  rimIntensity: LOOK.lighting.rimIntensity,
  rimColor: LOOK.lighting.rimColor,
};

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function verticalTexture(stops, h = 256) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Softbox falloff: 1 across the middle, easing to ~0.25 at the edges, so a panel
 * reflects as a soft-edged gradient instead of a hard white rectangle.
 * Linear data (no colour-space conversion): it only scales the panel's colour.
 */
function softboxTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  const ease = (t) => { const x = Math.min(Math.max(t, 0), 1); return x * x * (3 - 2 * x); };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs((x + 0.5) / size - 0.5) * 2;   // 0 centre, 1 edge
      const dy = Math.abs((y + 0.5) / size - 0.5) * 2;
      const fx = 1 - 0.75 * ease((dx - 0.45) / 0.55);
      const fy = 1 - 0.75 * ease((dy - 0.45) / 0.55);
      const v = Math.round(255 * fx * fy);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, quality: object, invalidate: () => void, onRestore: Function }} stage
 */
export function createStudio(stage) {
  const { renderer, scene, quality } = stage;
  const root = new THREE.Group();
  root.name = 'studio';
  scene.add(root);

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const lighting = { ...DEFAULT_LIGHTING };
  const exposureOverride = queryNumber('exposure', 0.4, 2.5);
  if (exposureOverride !== null) lighting.exposure = exposureOverride;

  // Neutral tone mapping keeps paint colours true; fall back to ACES on a Three.js build without it.
  renderer.toneMapping = (LOOK.toneMapping === 'neutral' && THREE.NeutralToneMapping !== undefined)
    ? THREE.NeutralToneMapping
    : THREE.ACESFilmicToneMapping;

  // --- Environment ----------------------------------------------------------
  let envTarget = null;

  function buildEnvironment() {
    const env = new THREE.Scene();
    const mats = [];
    const geos = [];
    const texs = [];

    // Room: a sphere with a vertical gradient (ceiling → horizon → floor).
    const roomTex = verticalTexture(LOOK.env.room);
    const roomGeo = new THREE.SphereGeometry(40, 32, 16);
    const roomMat = new THREE.MeshBasicMaterial({ map: roomTex, side: THREE.BackSide });
    env.add(new THREE.Mesh(roomGeo, roomMat));
    texs.push(roomTex); geos.push(roomGeo); mats.push(roomMat);

    // Softboxes.
    const softTex = softboxTexture();
    texs.push(softTex);
    for (const p of LOOK.env.panels) {
      const tint = LOOK.env.tints[p.tint] || [1, 1, 1];
      const geo = new THREE.PlaneGeometry(p.size[0], p.size[1]);
      const mat = new THREE.MeshBasicMaterial({ map: softTex, side: THREE.DoubleSide });
      mat.color.setRGB(tint[0] * p.intensity, tint[1] * p.intensity, tint[2] * p.intensity);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.pos);
      if (p.flat) mesh.rotation.x = Math.PI / 2;
      else mesh.lookAt(0, p.pos[1], 0);
      env.add(mesh);
      geos.push(geo); mats.push(mat);
    }

    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(env, LOOK.env.blur, 0.1, 100, { size: quality.envSize || 256 });
    pmrem.dispose();

    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());

    if (envTarget) envTarget.dispose();
    envTarget = target;
    scene.environment = target.texture;
    floorMat.envMap = target.texture;
    floorMat.needsUpdate = true;
  }

  // --- Floor, pool of light, backdrop --------------------------------------
  const floorAlpha = track(radialTexture(LOOK.floor.fade));
  const floorMat = track(new THREE.MeshStandardMaterial({
    color: new THREE.Color(LOOK.floor.color),
    roughness: LOOK.floor.roughness,
    metalness: 0,
    envMapIntensity: LOOK.floor.envMapIntensity,
    alphaMap: floorAlpha,
    transparent: true,
    depthWrite: false,
  }));
  const floorGeo = track(new THREE.CircleGeometry(46, 64));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.renderOrder = -3;
  floor.name = 'floor';
  root.add(floor);

  const poolTex = track(radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]));
  const poolMat = track(new THREE.MeshBasicMaterial({
    map: poolTex,
    color: new THREE.Color(LOOK.pool.color),
    transparent: true,
    opacity: LOOK.pool.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  }));
  const pool = new THREE.Mesh(track(new THREE.CircleGeometry(LOOK.pool.radius, 64)), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.001;
  pool.renderOrder = -2.5;
  pool.name = 'light-pool';
  root.add(pool);

  const domeTex = track(verticalTexture(LOOK.dome));
  const dome = new THREE.Mesh(
    track(new THREE.SphereGeometry(120, 32, 16)),
    track(new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }))
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.name = 'backdrop';
  root.add(dome);

  // --- Lights (4 in total, 3 on the low tier; none cast shadows) --------------
  const L = LOOK.lighting;
  const key = new THREE.DirectionalLight(new THREE.Color(L.keyColor), lighting.keyIntensity);
  key.position.set(3.5, 6.5, 4.5);
  const rimA = new THREE.DirectionalLight(new THREE.Color(lighting.rimColor), lighting.rimIntensity);
  rimA.position.set(-5, 2.6, -4.5);
  const rimB = new THREE.DirectionalLight(new THREE.Color(L.rimBColor), lighting.rimIntensity * 0.5);
  rimB.position.set(5.5, 2.2, -5);
  const fill = new THREE.HemisphereLight(new THREE.Color(L.hemiSky), new THREE.Color(L.hemiGround), L.hemiIntensity);
  root.add(key, rimA, fill);
  const useRimB = quality.name !== 'low';
  if (useRimB) root.add(rimB);

  /** Apply (a partial set of) lighting values. Future vehicle presets use this. */
  function setLighting(values = {}) {
    Object.assign(lighting, values);
    renderer.toneMappingExposure = lighting.exposure;
    scene.environmentIntensity = lighting.envIntensity;
    key.intensity = lighting.keyIntensity;
    rimA.intensity = lighting.rimIntensity;
    rimA.color.set(lighting.rimColor);
    rimB.intensity = lighting.rimIntensity * 0.5;
    stage.invalidate();
  }

  // --- Contact shadow ---------------------------------------------------------
  const contact = createContactShadow(renderer, scene, { size: quality.shadowSize });
  let attached = null; // { rig, half }

  /**
   * Bakes the contact shadow for a vehicle rig and parents it to the rig.
   * @param {{ root: THREE.Object3D, dimensions: { length:number, width:number } }} rig
   */
  function attachVehicle(rig) {
    attached = { rig, half: { x: rig.dimensions.length / 2, z: rig.dimensions.width / 2 } };
    const group = contact.bake(rig.root, attached.half, [root]);
    rig.root.add(group);
    stage.invalidate();
  }

  const unsubscribeRestore = stage.onRestore(() => {
    buildEnvironment();
    if (attached) {
      const group = contact.bake(attached.rig.root, attached.half, [root]);
      attached.rig.root.add(group);
    }
  });

  buildEnvironment();
  setLighting();

  function dispose() {
    unsubscribeRestore();
    contact.dispose();
    if (envTarget) envTarget.dispose();
    envTarget = null;
    scene.environment = null;
    disposables.forEach((d) => d.dispose && d.dispose());
    key.dispose?.(); rimA.dispose?.(); rimB.dispose?.(); fill.dispose?.();
    root.removeFromParent();
  }

  return { root, lighting, setLighting, attachVehicle, dispose };
}
