/**
 * AETHER GT — Collection page entry.
 * The showroom itself is static HTML/CSS (collection.html); this adds the shared
 * chrome, page transitions and the light enhancement layer. No Three.js, no models.
 */

import { mountChrome } from '../ui/site-chrome.js';
import { initPageTransitions } from '../ui/transitions.js';
import { initShowroom } from '../ui/showroom.js';
import { VEHICLES } from '../config.js';
import { armIntro } from '../scene/intro-gate.js';

mountChrome({ current: 'collection' });
initPageTransitions();
initShowroom();

// Phase 7: opening a car from here plays its assembly intro (see scene/intro-gate.js).
document.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest && event.target.closest('a[href]');
  if (!anchor || (anchor.target && anchor.target !== '_self')) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  const path = url.pathname.replace(/\.html$/, '').replace(/\/$/, ''); // '/cars/bmw-m5', '/cars/bmw-m5.html' and '/cars/bmw-m5/' all match
  const vehicle = VEHICLES.find((v) => path === v.page);
  if (vehicle) armIntro(vehicle.id);
}, true); // capture: runs before the fade-out handler in transitions.js can cancel the click
