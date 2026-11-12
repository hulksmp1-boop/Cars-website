/**
 * AETHER GT — Background asset queue (progressive loading).
 *
 * Built for the future five-car intro: the first car loads normally with the
 * loading screen, the others are fetched quietly afterwards, without ever
 * competing with an animation. Phase 03 ships the queue but loads nothing big.
 *
 * What it does (network only: no decoding, no GPU work, so it cannot cause jank):
 *  - runs ONE download at a time, lowest `priority` number first;
 *  - starts a download only when the page is idle (no scroll/touch/key input
 *    for `quietMs`) and `canRun()` allows it;
 *  - checks again before reading EVERY chunk and simply stops reading while the
 *    user is active; the browser's TCP flow control throttles the transfer, and
 *    it continues the moment things go quiet. No restart, no wasted bytes;
 *  - uses `fetch(..., { priority: 'low' })` so it never outranks page resources;
 *  - fills the HTTP cache. The real loader (vehicle.js) later gets the file from
 *    cache in milliseconds, and decode/GPU upload still happen on demand.
 */

const ACTIVITY_EVENTS = ['scroll', 'wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'];

/** Tracks recent user activity. isBusy() is true until `quietMs` of calm has passed. */
export function createActivityMonitor({ target = window, quietMs = 600, now = () => performance.now() } = {}) {
  let last = -Infinity;
  const touch = () => { last = now(); };
  ACTIVITY_EVENTS.forEach((type) => target.addEventListener(type, touch, { passive: true, capture: true }));
  return {
    touch,
    isBusy: () => now() - last < quietMs,
    dispose: () => ACTIVITY_EVENTS.forEach((type) => target.removeEventListener(type, touch, { capture: true })),
  };
}

/** Default permission check: respect Data Saver and slow connections. */
export function defaultCanRun() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (!c) return true;
  if (c.saveData) return false;
  return !/(^|-)(slow-2g|2g|3g)$/.test(c.effectiveType || '');
}

/**
 * @param {object} options
 * @param {() => boolean} options.isBusy       true while the user is interacting/animating
 * @param {() => boolean} [options.canRun]     extra gate (data saver etc.)
 * @param {typeof fetch} [options.fetchFn]
 * @param {(ms:number) => Promise<void>} [options.sleep]
 * @param {number} [options.pollMs]            how often to re-check while waiting
 */
export function createAssetQueue({
  isBusy,
  canRun = defaultCanRun,
  fetchFn = (...args) => fetch(...args),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollMs = 150,
} = {}) {
  if (typeof isBusy !== 'function') throw new Error('createAssetQueue needs an isBusy() function.');

  const pending = [];   // { url, priority, seq, resolve, reject, controller }
  const done = new Map(); // url -> { status, bytes }
  let seq = 0;
  let running = false;
  let paused = false;
  let current = null;

  const waitUntilQuiet = async (entry) => {
    while (!entry.cancelled && (paused || isBusy() || !canRun())) await sleep(pollMs);
  };

  async function download(entry) {
    entry.controller = new AbortController();
    await waitUntilQuiet(entry);
    if (entry.cancelled) throw new Error('cancelled');

    const response = await fetchFn(entry.url, { priority: 'low', signal: entry.controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (!response.body || !response.body.getReader) {
      const buffer = await response.arrayBuffer();
      return buffer.byteLength;
    }
    const reader = response.body.getReader();
    let bytes = 0;
    for (;;) {
      await waitUntilQuiet(entry);              // stop reading while the user is active
      if (entry.cancelled) { await reader.cancel().catch(() => {}); throw new Error('cancelled'); }
      const { done: finished, value } = await reader.read();
      if (finished) break;
      bytes += value.byteLength;                // chunk is discarded: only the cache matters
    }
    return bytes;
  }

  async function loop() {
    if (running) return;
    running = true;
    while (pending.length) {
      pending.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      const entry = pending.shift();
      current = entry;
      try {
        const bytes = await download(entry);
        done.set(entry.url, { status: 'done', bytes });
        entry.resolve(bytes);
      } catch (error) {
        const cancelled = entry.cancelled;
        done.set(entry.url, { status: cancelled ? 'cancelled' : 'failed', bytes: 0 });
        if (!cancelled) console.warn('[AETHER GT] background load failed:', entry.url, error);
        entry.reject(error);
      }
      current = null;
    }
    running = false;
  }

  /**
   * Queue a URL. Resolves with the byte count when cached; rejects if it fails or is cancelled.
   * Adding the same URL twice returns the first request's promise.
   */
  function add(url, { priority = 10 } = {}) {
    const existing = pending.find((e) => e.url === url) || (current && current.url === url ? current : null);
    if (existing) return existing.promise;
    const entry = { url, priority, seq: seq++, cancelled: false, controller: null };
    entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
    entry.promise.catch(() => {}); // callers may ignore the result; never an unhandled rejection
    pending.push(entry);
    queueMicrotask(loop);
    return entry.promise;
  }

  function cancel(url) {
    const entry = pending.find((e) => e.url === url) || (current && current.url === url ? current : null);
    if (!entry) return;
    entry.cancelled = true;
    entry.controller && entry.controller.abort();
    const index = pending.indexOf(entry);
    if (index >= 0) {
      pending.splice(index, 1);
      done.set(url, { status: 'cancelled', bytes: 0 });
      entry.reject(new Error('cancelled'));
    }
  }

  function clear() {
    [...pending.map((e) => e.url), ...(current ? [current.url] : [])].forEach(cancel);
  }

  return {
    add, cancel, clear,
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    stats: () => ({ queued: pending.length, active: current ? current.url : null, finished: Object.fromEntries(done) }),
  };
}
