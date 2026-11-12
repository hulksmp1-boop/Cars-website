/**
 * AETHER GT — Loading screen controller.
 * Pass it the work the site must wait for. A task is either a plain Promise
 * (counts as 0% until it settles, then 100%) or
 *   { weight?: number, start: (report) => Promise }
 * where report(fraction, label?) gives real progress (e.g. a model download)
 * and an optional status label. Progress is the weighted average of all tasks.
 */

import { gsap, prefersReducedMotion } from './motion.js';
import { LOADER } from '../config.js';

/** Runs a GSAP tween and resolves when it completes. */
const play = (target, vars) =>
  new Promise((resolve) => {
    gsap.to(target, { ...vars, onComplete: resolve });
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {HTMLElement} root */
export function createLoader(root) {
  const bar = root.querySelector('[data-loader-bar]');
  const label = root.querySelector('[data-loader-percent]');
  const track = root.querySelector('[role="progressbar"]');
  const statusEl = root.querySelector('[data-loader-status]');
  const inner = root.querySelector('.loader__inner');

  const progress = { value: 0 };
  const setScale = gsap.quickSetter(bar, 'scaleX');

  const paint = () => {
    const percent = Math.round(progress.value * 100);
    setScale(progress.value);
    label.textContent = String(percent).padStart(3, '0');
    track.setAttribute('aria-valuenow', String(percent));
  };

  const animateTo = (value, duration) => {
    const d = prefersReducedMotion() ? 0 : duration;
    return play(progress, { value, duration: d, ease: 'power1.out', overwrite: true, onUpdate: paint })
      .then(paint);
  };

  /** Fades the loader out and releases scroll lock. */
  async function hide() {
    document.documentElement.classList.remove('is-loading');
    const d = prefersReducedMotion() ? 0 : 1;
    await Promise.all([
      play(inner, { autoAlpha: 0, y: -12, duration: 0.5 * d, ease: 'power2.in' }),
      play(root, { autoAlpha: 0, duration: 0.8 * d, delay: 0.2 * d, ease: 'power2.inOut' }),
    ]);
    root.hidden = true;
  }

  const setStatus = (text) => {
    if (statusEl && text) statusEl.textContent = text;
  };

  /**
   * @param {(Promise<unknown> | { weight?: number, start: (report: (fraction: number, label?: string) => void) => Promise<unknown> })[]} tasks
   * A failed task is logged and counted as settled so the site never hangs.
   * @param {{ beforeHide?: () => void }} [options] beforeHide runs once everything is loaded, just before the
   *   loading screen starts to fade (Phase 7: the assembly intro starts here, underneath the fade).
   * @returns {Promise<PromiseSettledResult<unknown>[]>} one result per task, in order.
   */
  async function run(tasks, { beforeHide } = {}) {
    const started = performance.now();
    const entries = tasks.map((task) => ({
      weight: (task && task.weight) || 1,
      fraction: 0,
      task,
    }));
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0) || 1;

    let lastPaint = 0;
    const update = (force = false) => {
      const now = performance.now();
      if (!force && now - lastPaint < 60) return; // throttle tween creation
      lastPaint = now;
      const value = entries.reduce((sum, e) => sum + e.weight * e.fraction, 0) / totalWeight;
      // Never let the displayed value run backwards.
      animateTo(Math.max(value, progress.value), 0.35);
    };

    const settled = await Promise.all(
      entries.map((entry) => {
        const report = (fraction, label) => {
          entry.fraction = Math.min(Math.max(fraction, entry.fraction), 1);
          setStatus(label);
          update();
        };
        const promise = entry.task && typeof entry.task.start === 'function'
          ? entry.task.start(report)
          : Promise.resolve(entry.task);
        return Promise.resolve(promise).then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => {
            console.warn('[AETHER GT] load task failed:', reason);
            return { status: 'rejected', reason };
          }
        ).then((result) => {
          entry.fraction = 1;
          update(true);
          return result;
        });
      })
    );

    setStatus('Ready');
    if (!prefersReducedMotion()) {
      await wait(Math.max(0, LOADER.minDuration - (performance.now() - started)));
    }
    await animateTo(1, 0.35);
    if (beforeHide) {
      try { beforeHide(); } catch (error) { console.warn('[AETHER GT] beforeHide failed:', error); }
    }
    await hide();
    return settled;
  }

  return { run, hide, setStatus };
}
