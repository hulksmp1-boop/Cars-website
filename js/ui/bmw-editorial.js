/**
 * AETHER GT — BMW M5 F90 Competition: editorial enhancements.
 * Loaded by bmw-m5.html only, as a classic deferred script (no imports, so the page keeps exactly one
 * module entry). Pure enhancement: the dossier is complete HTML/CSS without
 * this file, and nothing here touches the 3D scene, the scroll track or the HUD.
 *
 *   1. [data-bx]      one-shot reveal (masked headlines, figures, design details)
 *   2. [data-count]   key figures count up once, ending on the exact printed value
 *   3. .bx-items      the design detail nearest the middle of the screen is "current"
 *   4. [data-parallax] the ghost numeral drifts slowly while its section is on screen
 *
 * No libraries, no timers. requestAnimationFrame runs only while something is animating
 * or while the parallax section is visible. Everything is skipped for visitors who
 * prefer reduced motion, who simply see the final state.
 */

(function () {
'use strict';

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canObserve = 'IntersectionObserver' in window;

if (!reduce && canObserve) {
  root.classList.add('is-bx-ready');

  initReveal();
  initCounters();
  initCurrentItem();
  initParallax();
}

/** 1. One-shot reveal. */
function initReveal() {
  const targets = [...document.querySelectorAll('[data-bx]')];
  if (!targets.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  targets.forEach((target) => io.observe(target));
}

/** 2. Count-up. The text already holds the final value; we only animate toward it. */
function initCounters() {
  const nodes = [...document.querySelectorAll('[data-count]')];
  if (!nodes.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      run(entry.target);
    });
  }, { threshold: 0.6 });
  nodes.forEach((node) => io.observe(node));

  function run(node) {
    const end = parseFloat(node.dataset.count);
    const decimals = Number(node.dataset.decimals || 0);
    const final = node.textContent;
    if (!Number.isFinite(end)) return;
    const duration = 1400;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);

    node.setAttribute('aria-label', final);
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      node.textContent = t < 1 ? (end * ease(t)).toFixed(decimals) : final;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
}

/** 3. Current design detail: the item whose centre is nearest the middle of the viewport. */
function initCurrentItem() {
  const list = document.querySelector('.bx-items');
  if (!list) return;
  const items = [...list.querySelectorAll('.bx-item')];
  const links = new Map([...document.querySelectorAll('.bx-index a')].map((a) => [a.dataset.index, a]));
  const visible = new Set();
  let current = null;

  function pick() {
    const mid = window.innerHeight / 2;
    let best = null;
    let bestDistance = Infinity;
    visible.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - mid);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    });
    if (!best || best === current) return;
    current = best;
    items.forEach((item) => item.classList.toggle('is-current', item === best));
    links.forEach((a, id) => a.classList.toggle('is-current', id === best.id));
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    list.classList.toggle('is-tracking', visible.size > 0);
    pick();
  }, { rootMargin: '-15% 0px -15% 0px' });
  items.forEach((item) => io.observe(item));

  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued || !visible.size) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; pick(); });
  }, { passive: true });
}

/** 4. Ghost numeral parallax: one passive scroll listener, active only while on screen. */
function initParallax() {
  const nodes = [...document.querySelectorAll('[data-parallax]')];
  nodes.forEach((node) => {
    const section = node.closest('section') || node.parentElement;
    let on = false;
    let queued = false;

    function update() {
      queued = false;
      const rect = section.getBoundingClientRect();
      const progress = (window.innerHeight / 2 - (rect.top + rect.height / 2)) / (rect.height / 2 + window.innerHeight / 2);
      node.style.setProperty('--py', `${(progress * 14).toFixed(2)}vh`);
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }

    new IntersectionObserver((entries) => {
      const now = entries[0].isIntersecting;
      if (now === on) return;
      on = now;
      if (on) {
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    }).observe(section);
  });
}
})();
