/**
 * AETHER GT — Three.js stage.
 * One persistent renderer, scene and camera for the whole site.
 *
 * Rendering is ON DEMAND: nothing is drawn until something calls
 * `invalidate()` (scroll updates, resize, loading). The GSAP ticker calls
 * `tick()` every frame, which is a no-op while the scene is clean.
 */

import * as THREE from 'three';

const FALLBACK_BG = '#050506';

function readCssToken(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ quality?: { maxPixelRatio:number, minPixelRatio:number, antialias:boolean } }} [options]
 * @returns {null | object} null when WebGL is unavailable.
 */
export function createStage(canvas, { quality } = {}) {
  const q = quality || { maxPixelRatio: 2, minPixelRatio: 1, antialias: true, name: 'high' };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: q.antialias,
      alpha: false,
      stencil: false,
      powerPreference: q.name === 'low' ? 'default' : 'high-performance',
    });
  } catch (error) {
    console.warn('[AETHER GT] WebGL unavailable:', error);
    return null;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const background = new THREE.Color(readCssToken('--color-bg', FALLBACK_BG));
  const scene = new THREE.Scene();
  scene.background = background;
  // Far enough that the car never fogs, even when pulled back on a phone.
  scene.fog = new THREE.Fog(background, 34, 100);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 220);
  camera.position.set(0, 1.2, 7);
  camera.lookAt(0, 0.5, 0);

  // --- state --------------------------------------------------------------
  let dirty = true;
  let active = true;
  let contextLost = false;
  let disposed = false;
  let width = 0;
  let height = 0;
  let yShift = 0; // fraction of viewport height; + moves the car up on screen
  let pixelScale = 1; // reduced automatically if the device struggles
  const resizeListeners = new Set();
  const restoreListeners = new Set();

  const basePixelRatio = () => Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);

  const applyView = () => {
    if (!width || !height) return;
    if (yShift) camera.setViewOffset(width, height, 0, Math.round(yShift * height), width, height);
    else camera.clearViewOffset();
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.max(basePixelRatio() * pixelScale, q.minPixelRatio * 0.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyView();
    camera.updateProjectionMatrix();
    resizeListeners.forEach((fn) => fn({ width: w, height: h, aspect: camera.aspect }));
    dirty = true;
  };

  /** Moves the subject up/down on screen without changing the camera orbit. */
  const setComposition = (shift) => {
    if (shift === yShift) return;
    yShift = shift;
    applyView();
    camera.updateProjectionMatrix();
    dirty = true;
  };

  // --- adaptive resolution -------------------------------------------------
  // Samples only back-to-back rendered frames (scrolling). If the device keeps
  // missing ~30 fps, step the pixel ratio down. It never steps back up, so it
  // cannot oscillate.
  let lastFrameAt = 0;
  let slowFrames = 0;
  let sampled = 0;
  const adapt = (now) => {
    const dt = now - lastFrameAt;
    lastFrameAt = now;
    if (dt > 120 || dt <= 0) { slowFrames = 0; sampled = 0; return; }
    sampled += 1;
    if (sampled < 20) return; // let shaders/textures settle
    slowFrames = dt > 34 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 25 && basePixelRatio() * pixelScale > q.minPixelRatio) {
      pixelScale = Math.max(pixelScale * 0.8, 0.5);
      slowFrames = 0;
      sampled = 0;
      resize();
    }
  };

  // --- rendering -----------------------------------------------------------
  const render = () => {
    if (contextLost || disposed) return;
    renderer.render(scene, camera);
    dirty = false;
  };

  const invalidate = () => { dirty = true; };

  const tick = () => {
    if (!dirty || !active || contextLost || disposed) return;
    adapt(performance.now());
    render();
  };

  /** Pause/resume drawing (e.g. when the canvas is faded out). */
  const setActive = (value) => {
    if (active === value) return;
    active = value;
    if (value) dirty = true;
  };

  // --- lifecycle -----------------------------------------------------------
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const onLost = (event) => { event.preventDefault(); contextLost = true; };
  const onRestored = () => {
    contextLost = false;
    // Render targets (environment map, baked shadows) lose their contents.
    restoreListeners.forEach((fn) => fn());
    dirty = true;
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // Resolves once the first frame has been drawn.
  const ready = new Promise((resolve) => {
    requestAnimationFrame(() => {
      render();
      resolve();
    });
  });

  const onResize = (fn) => { resizeListeners.add(fn); return () => resizeListeners.delete(fn); };
  const onRestore = (fn) => { restoreListeners.add(fn); return () => restoreListeners.delete(fn); };

  const dispose = () => {
    disposed = true;
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    resizeListeners.clear();
    restoreListeners.clear();
    renderer.dispose();
  };

  return {
    renderer, scene, camera, quality: q,
    render, tick, invalidate, resize, setComposition, setActive,
    onResize, onRestore,
    get aspect() { return camera.aspect; },
    ready, dispose,
  };
}
