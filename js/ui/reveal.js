/**
 * AETHER GT — Scroll reveal for the car pages.
 * Pure enhancement: the pages are complete HTML/CSS without this file. Items marked
 * .reveal fade in once as they enter the viewport. One IntersectionObserver, no timers,
 * no per-frame work; nothing is hidden unless this ran (html.is-reveal-ready), and
 * nothing is hidden for visitors who prefer reduced motion.
 */

export function initReveal() {
  const items = [...document.querySelectorAll('.reveal')];
  if (!items.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('is-reveal-ready');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((item) => io.observe(item));
}
