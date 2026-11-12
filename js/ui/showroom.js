/**
 * AETHER GT — Showroom enhancements for collection.html.
 * Pure enhancement: the page is complete HTML/CSS without this file.
 *
 *  - reveal: fades items in as they scroll into view (IntersectionObserver)
 *  - rail:   keeps the fixed 01-05 index in sync with the item on screen
 *  - pointer parallax: the studio light inside each frame drifts a few pixels with the pointer
 *            (fine pointers only, never on touch, never with reduced motion)
 *
 * No timers and no per-frame loops: work happens only on observer callbacks and
 * pointer moves (throttled to one update per animation frame).
 */

export function initShowroom() {
  const root = document.documentElement;
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  // --- reveal ---------------------------------------------------------------
  const reveals = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !reduceQuery.matches) {
    root.classList.add('is-showroom-ready');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // --- rail (large screens) ---------------------------------------------------
  const items = [...document.querySelectorAll('.showroom__item')];
  const rail = document.querySelector('[data-rail-nav]');
  if (rail && 'IntersectionObserver' in window) {
    const links = new Map([...rail.querySelectorAll('[data-rail]')].map((a) => [a.dataset.rail, a]));
    const onScreen = new Set();
    const sync = () => {
      rail.classList.toggle('is-visible', onScreen.size > 0);
      links.forEach((a, id) => a.classList.toggle('is-active', onScreen.has(id)));
    };
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.dataset.vehicleId;
        if (entry.isIntersecting) onScreen.add(id); else onScreen.delete(id);
      });
      sync();
    }, { rootMargin: '-45% 0px -45% 0px' }); // the item crossing the middle of the viewport
    items.forEach((item) => ro.observe(item));
  }

  // --- pointer parallax --------------------------------------------------------
  const enabled = () => fineQuery.matches && !reduceQuery.matches;
  items.forEach((item) => {
    let frame = 0;
    let nx = 0;
    let ny = 0;

    const paint = () => {
      frame = 0;
      item.style.setProperty('--px', nx.toFixed(3));
      item.style.setProperty('--py', ny.toFixed(3));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };

    item.addEventListener('pointermove', (event) => {
      if (!enabled() || event.pointerType !== 'mouse') return;
      const rect = item.getBoundingClientRect();
      nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      schedule();
    }, { passive: true });

    item.addEventListener('pointerleave', () => {
      nx = 0; ny = 0;
      schedule();
    });
  });
}
