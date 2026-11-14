/**
 * AETHER GT — Homepage entry (editorial home).
 *
 * The page is complete HTML and CSS without this file. This module only mounts the shared
 * header and footer, wires page transitions, and reveals sections as they scroll into view
 * (one IntersectionObserver, skipped for prefers-reduced-motion).
 *
 * No Three.js, no GSAP, no canvas, no model downloads, no background asset queue.
 */

import { mountChrome } from '../ui/site-chrome.js';
import { initPageTransitions } from '../ui/transitions.js';
import { initReveal } from '../ui/reveal.js';

mountChrome({ current: 'intro' });
initPageTransitions();
initReveal();
