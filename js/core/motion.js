/**
 * AETHER GT — GSAP + ScrollTrigger setup.
 * Import gsap / ScrollTrigger from here so plugins are registered exactly once.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

gsap.defaults({ ease: 'power3.out', duration: 0.8 });
ScrollTrigger.config({ ignoreMobileResize: true });

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Live check so later phases can skip or shorten motion. */
export const prefersReducedMotion = () => reducedMotionQuery.matches;

/**
 * Drives the thin page-progress bar from scroll position.
 * @param {HTMLElement | null} bar
 */
export function initScrollProgress(bar) {
  if (!bar) return null;
  const setScale = gsap.quickSetter(bar, 'scaleX');
  return ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => setScale(self.progress),
  });
}

export { gsap, ScrollTrigger };
