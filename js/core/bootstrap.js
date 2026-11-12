/**
 * AETHER GT — 3D car page bootstrap (shared by every car page).
 *
 * Boots the loading screen, stage, studio, the page's vehicle and the
 * scroll-driven camera. Each page runs its own renderer and its own scene, so
 * car pages are fully independent. Logic is the Phase 02 boot sequence, now
 * parameterised by vehicle instead of hard-wired to the BMW.
 */

import { MODELS } from '../config.js';
import { createLoader } from './loader.js';
import { createStage } from './stage.js';
import { detectQuality } from './quality.js';
import { gsap, ScrollTrigger, initScrollProgress } from './motion.js';
import { createHud } from '../ui/hud.js';
import { createStudio } from '../scene/studio.js';
import { loadVehicle } from '../scene/vehicle.js';
import { createDirector } from '../scene/director.js';
import { SHOTS } from '../scene/shots/index.js';
import { shouldPlayIntro } from '../scene/intro-gate.js';

window.__aetherBooted = true; // all 3D imports resolved: tells boot-guard.js the modules started

const root = document.documentElement;
const $ = (selector) => document.querySelector(selector);

const windowLoaded = () =>
  document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));

/**
 * @param {{ id:string, make:string, model:string, designation:string }} vehicle
 */
export async function startCarExperience(vehicle) {
  const spec = MODELS[vehicle.id];
  const shot = SHOTS[vehicle.id];
  if (!spec || !shot) throw new Error(`No 3D experience is configured for "${vehicle.id}".`);

  const loader = createLoader($('[data-loader]'));

  // Phase 7: the assembly intro (Collection → car only). Its module and stylesheet load in
  // parallel with the model and only for visitors who will see it. It reuses the model loaded
  // below, so the GLB is never fetched twice.
  const introModule = shouldPlayIntro(vehicle)
    ? import('../scene/assembly-intro.js').then(async (m) => { await m.loadIntroStyles(); return m; }).catch((error) => {
      console.warn('[AETHER GT] assembly intro not loaded:', error);
      return null;
    })
    : null;
  let intro = null;
  let introAttempted = false;
  const quality = detectQuality();

  initScrollProgress($('[data-scroll-progress]'));

  const stage = createStage($('#stage'), { quality });
  if (!stage) {
    window.__aetherFail('WebGL is unavailable in this browser, so the 3D experience cannot run. Try a current version of Chrome, Edge, Firefox or Safari.');
    return;
  }

  // One render loop for the whole site, driven by GSAP's ticker. It only
  // draws when something has changed (stage.invalidate()).
  gsap.ticker.add(stage.tick);

  const studio = createStudio(stage);
  let rig = null;
  let director = null;
  let hud = null;

  /** Loads the vehicle, bakes its shadow, warms the GPU and binds scroll. */
  async function mountShowcase(report) {
    let loaded = null;
    try {
      loaded = await loadVehicle(stage, { ...spec, id: vehicle.id }, (f, label) => report(f * 0.85, label));
      stage.scene.add(loaded.root);
      studio.attachVehicle(loaded);
      await loaded.warmUp(stage.camera, (f, label) => report(0.85 + f * 0.15, label));

      hud = createHud($('[data-hud]'), vehicle, shot);
      director = createDirector({
        stage,
        segments: [{ id: vehicle.id, shot, rig: loaded }],
        track: $('[data-showcase]'),
        hud,
      });
      rig = loaded;

      // First mount only (a retry after an error just shows the page).
      if (introModule && !introAttempted) {
        introAttempted = true;
        try {
          const api = await introModule;
          if (api) {
            const candidate = api.createAssemblyIntro({ stage, studio, loaded, shot, vehicle, director });
            candidate.prepare();                 // exploded pose, before the first visible frame
            if (candidate.ready) intro = candidate;
          }
        } catch (error) {
          console.warn('[AETHER GT] assembly intro skipped:', error);  // never fails the page
        }
      }
      report(1, 'Ready');
    } catch (error) {
      loaded?.dispose();
      throw error;
    }
  }

  const modelTask = { weight: 12, start: (report) => mountShowcase(report) };

  const results = await loader.run([
    document.fonts.ready,
    windowLoaded(),
    stage.ready,
    modelTask,
  ], { beforeHide: () => intro && intro.play() });

  ScrollTrigger.refresh();

  const modelResult = results[3];
  if (modelResult.status === 'rejected') showModelError(modelResult.reason, mountShowcase);

  // Release GPU memory if the page is torn down (bfcache / SPA embeds).
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    director?.dispose();
    rig?.dispose();
    studio.dispose();
    stage.dispose();
  }, { once: true });
}

/** Non-blocking notice with a retry button; the rest of the page stays usable. */
function showModelError(error, retry) {
  const box = $('[data-model-error]');
  if (!box) return;
  const message = box.querySelector('[data-model-error-message]');
  const button = box.querySelector('[data-model-error-retry]');
  root.classList.add('model-failed');
  message.textContent = (error && error.message) || 'The 3D model could not be loaded.';
  box.hidden = false;

  button.onclick = async () => {
    button.disabled = true;
    message.textContent = 'Loading… 0%';
    try {
      await retry((fraction, label) => {
        message.textContent = `${label || 'Loading'}… ${Math.round(fraction * 100)}%`;
      });
      box.hidden = true;
      root.classList.remove('model-failed');
      ScrollTrigger.refresh();
    } catch (err) {
      console.error('[AETHER GT] retry failed:', err);
      message.textContent = (err && err.message) || 'The 3D model could not be loaded.';
    } finally {
      button.disabled = false;
    }
  };
}

