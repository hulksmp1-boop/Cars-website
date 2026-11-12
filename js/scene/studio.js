/**
 * AETHER GT — Dark automotive studio.
 *
 *  - Environment: a procedural PMREM "light room" (near-black walls, a few
 *    emissive strip/softboxes). This is what the paint reflects, so the body
 *    lines read as long controlled highlights rather than random glare.
 *  - Lights: key + two rims + a faint hemisphere fill. No real-time shadows.
 *  - Floor: dark, faintly glossy, radial fade into the backdrop, plus a soft
 *    pool of light under the car.
 *  - Backdrop: a huge inside-out dome with a barely-there horizon haze.
 *  - Contact shadow: baked once per vehicle (see contact-shadow.js).
 *
 * Everything is created once. `dispose()` releases every GPU resource.
 */

import * as THREE from 'three';
import { createContactShadow } from './contact-shadow.js';

/** Lighting values a future vehicle preset can override and blend. */
export const DEFAULT_LIGHTING = {
  exposure: 1.0,
  envIntensity: 1.0,
  keyIntensity: 1.5,
  rimIntensity: 1.8,
  rimColor: '#4f8bff',
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

  // --- Environment ----------------------------------------------------------
  let envTarget = null;

  function buildEnvironment() {
    const env = new THREE.Scene();
    const mats = [];
    const geos = [];

    const box = new THREE.BoxGeometry(40, 18, 40);
    const wallMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.013, 0.016), side: THREE.BackSide });
    env.add(new THREE.Mesh(box, wallMat));
    geos.push(box); mats.push(wallMat);

    const panel = (w, h, pos, intensity, tint = [1, 1, 1], flat = false) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      mat.color.setRGB(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      if (flat) mesh.rotation.x = Math.PI / 2;
      else mesh.lookAt(0, pos[1], 0);
      env.add(mesh);
      geos.push(geo); mats.push(mat);
    };

    // Overhead softbox: broad highlight across hood, roof and boot.
    panel(11, 5, [0, 8.5, 0], 4.5, [1, 1, 1], true);
    // Long vertical strips either side: the crisp lines that run down the flanks.
    panel(1.1, 7, [10, 3.2, 1.5], 10);
    panel(1.1, 7, [-10, 3.2, -1.5], 10);
    // Rear strips for the shoulder / tail highlights.
    panel(0.9, 6, [-3, 3, -11], 7);
    panel(0.9, 6, [3.5, 3, 11], 6);
    // Cool accent strip, matches the site's blue.
    panel(0.8, 6, [-9, 2.6, 7], 8, [0.28, 0.5, 1.0]);
    // Faint low front fill so the lower body is never pure black.
    panel(10, 0.9, [0, 0.6, 12], 1.2);
    // Dim floor bounce.
    panel(24, 24, [0, -1.5, 0], 0.10, [1, 1, 1], true);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(env, 0.035, 0.1, 100);
    pmrem.dispose();

    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());

    if (envTarget) envTarget.dispose();
    envTarget = target;
    scene.environment = target.texture;
    floorMat.envMap = target.texture;
    floorMat.needsUpdate = true;
  }

  // --- Floor, pool of light, backdrop --------------------------------------
  const floorAlpha = track(radialTexture([[0, '#fff'], [0.32, '#fff'], [0.7, '#444'], [1, '#000']]));
  const floorMat = track(new THREE.MeshStandardMaterial({
    color: 0x0b0c0f,
    roughness: 0.58,
    metalness: 0,
    envMapIntensity: 0.22,
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
    color: 0x8f9bb5,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  }));
  const pool = new THREE.Mesh(track(new THREE.CircleGeometry(7.5, 64)), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.001;
  pool.renderOrder = -2.5;
  pool.name = 'light-pool';
  root.add(pool);

  const domeTex = track(verticalTexture([
    [0.0, '#050506'], [0.38, '#060608'], [0.5, '#0d0f14'], [0.56, '#07080b'], [1.0, '#050506'],
  ]));
  const dome = new THREE.Mesh(
    track(new THREE.SphereGeometry(120, 32, 16)),
    track(new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }))
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.name = 'backdrop';
  root.add(dome);

  // --- Lights (4 in total, none cast shadows) -------------------------------
  const key = new THREE.DirectionalLight(0xffffff, lighting.keyIntensity);
  key.position.set(3.5, 6.5, 4.5);
  const rimA = new THREE.DirectionalLight(new THREE.Color(lighting.rimColor), lighting.rimIntensity);
  rimA.position.set(-5, 2.6, -4.5);
  const rimB = new THREE.DirectionalLight(0xffffff, lighting.rimIntensity * 0.5);
  rimB.position.set(5.5, 2.2, -5);
  const fill = new THREE.HemisphereLight(0x1a1e2a, 0x050506, 0.25);
  root.add(key, rimA, rimB, fill);

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
