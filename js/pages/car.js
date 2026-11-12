/**
 * AETHER GT — Car page entry (used by all five car pages).
 * <body data-page="car" data-vehicle="<id>">
 *
 * A car with a model in config.js MODELS gets its full 3D experience, loaded
 * on demand so the three.js/GSAP downloads only start on pages that need them.
 * A car without one shows its identification page only: no WebGL, no downloads.
 */

import { VEHICLES, MODELS } from '../config.js';
import { mountChrome } from '../ui/site-chrome.js';
import { initPageTransitions } from '../ui/transitions.js';
import { initReveal } from '../ui/reveal.js';

const vehicleId = document.body.dataset.vehicle;
const vehicle = VEHICLES.find((v) => v.id === vehicleId);

mountChrome({ current: 'car', vehicleId });
initPageTransitions();
initReveal();

/**
 * Weaker connections and devices get the editorial page without the 3D download (5 MB+ model
 * plus three.js). Data Saver, 1 GB-class memory, or ?3d=off. ?3d=on always forces it.
 */
function shouldSkip3D() {
  let flag = null;
  try { flag = new URLSearchParams(location.search).get('3d'); } catch { /* ignore */ }
  if (flag === 'on') return false;
  if (flag === 'off') return true;
  const connection = navigator.connection;
  const slow = connection && /(^|-)2g$/.test(connection.effectiveType || '');
  return Boolean((connection && connection.saveData) || slow || (navigator.deviceMemory && navigator.deviceMemory <= 1));
}

async function start() {
  if (!vehicle) throw new Error(`Unknown vehicle "${vehicleId}".`);
  if (!MODELS[vehicle.id]) {
    document.documentElement.classList.add('is-pending');
    return;
  }
  if (shouldSkip3D()) {
    window.__aetherFail('The 3D view is off to save data on this connection or device. The full dossier below is unaffected.');
    const note = document.querySelector('[data-webgl-fallback]');
    if (note) {
      const a = document.createElement('a');
      a.href = '?3d=on';
      a.textContent = ' Load the 3D view anyway';
      a.style.textDecoration = 'underline';
      note.append(a);
    }
    return;
  }
  const { startCarExperience } = await import('../core/bootstrap.js');
  await startCarExperience(vehicle);
}

start().catch((error) => {
  // Never leave the visitor stuck behind the loading screen.
  console.error('[AETHER GT] page failed to start:', error);
  if (window.__aetherFail) window.__aetherFail();
});
