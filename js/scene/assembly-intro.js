/**
 * AETHER GT — Cinematic assembly intro (Phase 7).
 *
 * Plays once, after the model has loaded, when a visitor opens a car from the Collection
 * (see intro-gate.js). It reuses the SAME loaded model, renderer and scene as the page's
 * scroll experience: nothing is downloaded or built twice.
 *
 *  1. prepare()  moves every separate mesh of the real GLB to its exploded position
 *                (assembly-plan.js). Only `position` is touched: geometry, materials and
 *                textures are the originals, and every mesh ends exactly where it started.
 *  2. play()     the loading screen fades out over the exploded car; the parts fly home in
 *                waves while the camera eases in from a wider, higher, rotated angle and the
 *                studio lights come up. The page content stays hidden until the end.
 *  3. finish()   the camera lands on the exact first pose of the scroll experience, the
 *                director takes over, and the page fades in. Skip intro / Escape does the
 *                same, fast.
 *
 * Any failure restores the model and reveals the normal page.
 */

import * as THREE from 'three';
import { gsap } from '../core/motion.js';
import { createTrack, resolvePose } from './camera-rig.js';
import { planAssembly, partEase, smooth } from './assembly-plan.js';

const STYLES_URL = new URL('../../css/intro.css', import.meta.url).href;
const root = document.documentElement;

const clamp = (v, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);

/** Loads css/intro.css on demand (only visitors who get the intro pay for it). */
export function loadIntroStyles() {
  if (document.querySelector('link[data-intro-styles]')) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLES_URL;
    link.dataset.introStyles = '';
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
    setTimeout(resolve, 2500); // never hold the page for a stylesheet
  });
}

/**
 * @param {object} deps
 * @param {object} deps.stage     createStage result
 * @param {object} deps.studio    createStudio result (lighting)
 * @param {object} deps.loaded    loadVehicle result (root, model, dimensions)
 * @param {object} deps.shot      the car's shot (camera keyframes)
 * @param {object} deps.vehicle   config VEHICLES entry
 * @param {object} deps.director  createDirector result (takes over at the end)
 */
export function createAssemblyIntro({ stage, studio, loaded, shot, vehicle, director }) {
  const { camera } = stage;
  const rig = loaded.root;
  const track = createTrack(shot.keys);
  const baseLighting = { ...studio.lighting };
  const compact = stage.quality.name === 'low' || window.matchMedia('(pointer: coarse)').matches;
  const duration = compact ? 4.6 : 6;

  /** @type {{ mesh: THREE.Mesh, rest: THREE.Vector3, delta: THREE.Vector3, delay: number, span: number }[]} */
  let entries = [];
  let shadowMaterials = [];
  let overlay = null;
  let ui = null;
  let timeline = null;
  let prepared = false;
  let finished = false;
  const state = { p: 0 };
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });

  // --- 1. Prepare: the exploded pose --------------------------------------------------
  function prepare() {
    try {
      rig.updateMatrixWorld(true);
      const inverse = rig.matrixWorld.clone().invert();
      const rotation = rig.getWorldQuaternion(new THREE.Quaternion());
      const aspect = camera.aspect || 1;

      const meshes = [];
      loaded.model.traverse((o) => { if (o.isMesh && o.visible && o.geometry && o.parent) meshes.push(o); });

      const parts = [];
      const usable = [];
      meshes.forEach((mesh) => {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const local = mesh.geometry.boundingBox;
        if (!local || local.isEmpty()) return;
        const box = local.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse); // car frame
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        if (![centre.x, centre.y, centre.z, size.x, size.y, size.z].every(Number.isFinite)) return;
        parts.push({ center: centre.toArray(), size: size.toArray() });
        usable.push(mesh);
      });
      if (!parts.length) throw new Error('no separate components found');

      // Portrait screens see little width: travel less sideways and more up.
      const plan = planAssembly(parts, loaded.dimensions, { lateral: aspect < 1 ? 0.6 : 1 });

      entries = usable.map((mesh, i) => {
        const { offset, delay, span } = plan[i];
        const worldDelta = new THREE.Vector3(...offset).applyQuaternion(rotation);
        const here = mesh.getWorldPosition(new THREE.Vector3());
        const a = mesh.parent.worldToLocal(here.clone());
        const b = mesh.parent.worldToLocal(here.clone().add(worldDelta));
        return { mesh, rest: mesh.position.clone(), delta: b.sub(a), delay, span };
      });

      // The baked contact shadow fades in as the car lands (it is baked for the assembled car).
      const shadow = rig.getObjectByName('contact-shadow');
      if (shadow) {
        shadow.traverse((o) => {
          if (o.isMesh && o.material) shadowMaterials.push({ material: o.material, base: o.material.opacity });
        });
      }

      prepared = true;
      applyParts(0);
      stage.invalidate();
    } catch (error) {
      console.warn('[AETHER GT] assembly intro unavailable:', error);
      restore();
      prepared = false;
    }
  }

  function applyParts(p) {
    let placed = 0;
    for (const e of entries) {
      const u = (p - e.delay) / e.span;
      const remaining = 1 - partEase(u);
      if (u >= 1) placed += 1;
      e.mesh.position.set(
        e.rest.x + e.delta.x * remaining,
        e.rest.y + e.delta.y * remaining,
        e.rest.z + e.delta.z * remaining
      );
    }
    const fade = smooth((p - 0.35) / 0.65);
    shadowMaterials.forEach((s) => { s.material.opacity = s.base * fade; });
    return placed;
  }

  function restore() {
    entries.forEach((e) => e.mesh.position.copy(e.rest));
    shadowMaterials.forEach((s) => { s.material.opacity = s.base; });
    studio.setLighting(baseLighting);
  }

  // --- 2. Camera and light ---------------------------------------------------------------
  const endPose = () => resolvePose(track.sample(0), { aspect: camera.aspect || 1 });
  const rotatedPosition = new THREE.Vector3();

  function frameCamera(p) {
    const end = endPose();
    const aspect = camera.aspect || 1;
    const k = 1 - smooth(clamp(p / 0.97));            // 1 at the start, 0 when landed
    const widen = (aspect < 1 ? 0.62 : 0.34) * k;     // pull back to fit the exploded car
    const turn = -0.62 * k;                           // start further round the side
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const [x, y, z] = end.position;
    rotatedPosition.set((x * c - z * s) * (1 + widen), y * (1 + 0.55 * k) + 0.2 * k, (x * s + z * c) * (1 + widen));
    camera.position.copy(rotatedPosition);
    camera.fov = end.fov + 3.5 * k;
    camera.updateProjectionMatrix();
    camera.lookAt(end.target[0], end.target[1] + 0.18 * k, end.target[2]);
  }

  function frameLight(p) {
    const e = smooth(clamp(p / 0.9));
    studio.setLighting({
      exposure: baseLighting.exposure * (0.7 + 0.3 * e),
      keyIntensity: baseLighting.keyIntensity * (0.3 + 0.7 * e),
      rimIntensity: baseLighting.rimIntensity * (1.45 - 0.45 * e),
    });
  }

  function update() {
    const placed = applyParts(state.p);
    frameCamera(state.p);
    frameLight(state.p);
    if (ui) {
      ui.bar.style.transform = `scaleX(${state.p.toFixed(4)})`;
      ui.count.textContent = String(placed).padStart(3, '0');
    }
    stage.invalidate();
  }

  // --- Overlay ---------------------------------------------------------------------------
  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'intro';
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', 'Assembly intro');
    overlay.innerHTML = `
      <div class="intro__caption">
        <p class="intro__eyebrow">Assembling</p>
        <p class="intro__name"><span data-intro-make></span> <span data-intro-model></span></p>
        <div class="intro__track" aria-hidden="true"><span class="intro__bar" data-intro-bar></span></div>
        <p class="intro__meta" aria-hidden="true">Components <span data-intro-count>000</span> / <span data-intro-total>000</span></p>
      </div>
      <button type="button" class="intro__skip" data-intro-skip>Skip intro</button>`;
    overlay.querySelector('[data-intro-make]').textContent = vehicle.make;
    overlay.querySelector('[data-intro-model]').textContent = [vehicle.model, vehicle.designation].filter(Boolean).join(' ');
    overlay.querySelector('[data-intro-total]').textContent = String(entries.length).padStart(3, '0');
    document.body.append(overlay);
    ui = {
      bar: overlay.querySelector('[data-intro-bar]'),
      count: overlay.querySelector('[data-intro-count]'),
      skip: overlay.querySelector('[data-intro-skip]'),
    };
    ui.skip.addEventListener('click', skip);
    document.addEventListener('keydown', onKey);
    ui.skip.focus({ preventScroll: true });
  }

  function onKey(event) { if (event.key === 'Escape') skip(); }

  // --- 3. Play, skip, finish -----------------------------------------------------------
  function play() {
    if (!prepared || finished) return done;
    try {
      root.classList.add('is-intro');           // hides the page content, locks scroll
      buildOverlay();
      const offResize = stage.onResize(() => update());
      done.then(offResize);
      window.addEventListener('pagehide', abort, { once: true });
      timeline = gsap.to(state, { p: 1, duration, delay: 0.55, ease: 'none', onUpdate: update, onComplete: finish });
      update();
    } catch (error) {
      console.warn('[AETHER GT] assembly intro failed:', error);
      abort();
    }
    return done;
  }

  /** Skip intro: the same assembly, but fast, then the normal hand-off. */
  function skip() {
    if (finished || !timeline) return;
    if (ui) ui.skip.disabled = true;
    timeline.kill();
    timeline = gsap.to(state, { p: 1, duration: 0.7, delay: 0, ease: 'power2.out', onUpdate: update, onComplete: finish });
  }

  /** Lands on the exact first pose of the scroll experience, then reveals the page. */
  function finish() {
    if (finished) return;
    finished = true;
    timeline?.kill();
    state.p = 1;
    applyParts(1);
    restore();
    const end = endPose();
    camera.fov = end.fov;                       // director caches the fov: put it back first
    camera.updateProjectionMatrix();
    director.apply(director.progress);
    stage.invalidate();
    reveal();
  }

  /** Failure or page hide: put everything back and show the normal page. */
  function abort() {
    if (finished) return;
    finished = true;
    timeline?.kill();
    restore();
    try {
      const end = endPose();
      camera.fov = end.fov;
      camera.updateProjectionMatrix();
      director.apply(director.progress);
    } catch { /* the director will reposition on the first scroll */ }
    stage.invalidate();
    reveal();
  }

  function reveal() {
    document.removeEventListener('keydown', onKey);
    if (ui && document.activeElement === ui.skip) ui.skip.blur();
    root.classList.remove('is-intro');
    root.classList.add('is-intro-reveal');
    if (overlay) {
      overlay.classList.add('is-out');
      setTimeout(() => overlay && overlay.remove(), 700);
    }
    setTimeout(() => root.classList.remove('is-intro-reveal'), 1200);
    entries = [];
    shadowMaterials = [];
    resolveDone();
  }

  return { prepare, play, skip, done, get ready() { return prepared; } };
}
