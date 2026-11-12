/**
 * Run:  node tests/asset-queue.test.mjs
 * Checks the background asset queue with fake streams and a fake clock-free sleep.
 */
import assert from 'node:assert/strict';
import { createAssetQueue, createActivityMonitor } from '../js/core/asset-queue.js';

let failures = 0;
const check = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.stack.split('\n').slice(0, 3).join('\n        ')); } };

const tick = () => new Promise((r) => setImmediate(r));
const sleep = () => tick();

/** Fake fetch: records order/concurrency and serves `chunks` chunks of 10 bytes. */
function fakeFetch({ chunks = 4, failUrls = [], log = [] } = {}) {
  let active = 0, maxActive = 0;
  const fn = async (url, init) => {
    log.push(['start', url, init && init.priority]);
    if (failUrls.includes(url)) return { ok: false, status: 404 };
    active++; maxActive = Math.max(maxActive, active);
    let n = 0;
    return {
      ok: true,
      body: { getReader: () => ({
        read: async () => { await tick(); log.push(['read', url]); if (n++ >= chunks) { active--; return { done: true }; } return { done: false, value: new Uint8Array(10) }; },
        cancel: async () => { active--; },
      }) },
    };
  };
  fn.stats = () => ({ maxActive });
  return fn;
}

console.log('Asset queue');

await check('downloads one at a time, lowest priority number first, and reports bytes', async () => {
  const log = [];
  const f = fakeFetch({ log });
  const q = createAssetQueue({ isBusy: () => false, canRun: () => true, fetchFn: f, sleep });
  const results = await Promise.all([q.add('c', { priority: 3 }), q.add('a', { priority: 1 }), q.add('b', { priority: 2 })]);
  assert.deepEqual(results, [40, 40, 40]);
  const order = log.filter((e) => e[0] === 'start').map((e) => e[1]);
  assert.deepEqual(order, ['a', 'b', 'c'].sort((x, y) => ({ a: 1, b: 2, c: 3 }[x] - { a: 1, b: 2, c: 3 }[y])));
  assert.equal(f.stats().maxActive, 1);
  assert.ok(log.filter((e) => e[0] === 'start').every((e) => e[2] === 'low'), 'must request low priority');
});

await check('does not start while busy, and starts once quiet', async () => {
  let busy = true; const log = [];
  const q = createAssetQueue({ isBusy: () => busy, canRun: () => true, fetchFn: fakeFetch({ log }), sleep });
  const p = q.add('a');
  for (let i = 0; i < 30; i++) await tick();
  assert.equal(log.length, 0, 'started while busy');
  busy = false;
  await p;
  assert.ok(log.length > 0);
});

await check('stops reading chunks while the user is active and resumes afterwards', async () => {
  let busy = false; const log = [];
  const q = createAssetQueue({ isBusy: () => busy, canRun: () => true, fetchFn: fakeFetch({ chunks: 6, log }), sleep });
  const p = q.add('a');
  while (log.filter((e) => e[0] === 'read').length < 2) await tick();
  busy = true;
  for (let i = 0; i < 5; i++) await tick();               // let any in-flight read finish
  const frozen = log.filter((e) => e[0] === 'read').length;
  for (let i = 0; i < 40; i++) await tick();
  assert.equal(log.filter((e) => e[0] === 'read').length, frozen, 'kept reading while busy');
  busy = false;
  assert.equal(await p, 60, 'must complete with all bytes, no restart');
});

await check('canRun() = false (data saver) blocks everything until allowed', async () => {
  let allowed = false; const log = [];
  const q = createAssetQueue({ isBusy: () => false, canRun: () => allowed, fetchFn: fakeFetch({ log }), sleep });
  const p = q.add('a');
  for (let i = 0; i < 30; i++) await tick();
  assert.equal(log.length, 0);
  allowed = true; await p;
});

await check('failed download is reported, does not block the next one', async () => {
  const q = createAssetQueue({ isBusy: () => false, canRun: () => true, fetchFn: fakeFetch({ failUrls: ['bad'] }), sleep });
  const bad = q.add('bad', { priority: 1 });
  const good = q.add('good', { priority: 2 });
  await assert.rejects(bad);
  assert.equal(await good, 40);
  assert.equal(q.stats().finished.bad.status, 'failed');
});

await check('cancel() removes a queued item; clear() stops an active one', async () => {
  let busy = true;
  const q = createAssetQueue({ isBusy: () => busy, canRun: () => true, fetchFn: fakeFetch(), sleep });
  const a = q.add('a', { priority: 1 });
  const b = q.add('b', { priority: 2 });
  await tick();
  q.cancel('b');
  await assert.rejects(b);
  q.clear();
  await assert.rejects(a);
  assert.equal(q.stats().queued, 0);
  assert.equal(q.stats().active, null);
});

await check('adding the same URL twice does not download twice', async () => {
  const log = [];
  const q = createAssetQueue({ isBusy: () => false, canRun: () => true, fetchFn: fakeFetch({ log }), sleep });
  await Promise.all([q.add('a'), q.add('a')]);
  assert.equal(log.filter((e) => e[0] === 'start').length, 1);
});

await check('queue requires an isBusy function', async () => {
  assert.throws(() => createAssetQueue({}));
});

await check('activity monitor: busy right after input, quiet after quietMs, listeners removed on dispose', async () => {
  const listeners = new Map();
  const target = {
    addEventListener: (t, fn) => listeners.set(t, fn),
    removeEventListener: (t) => listeners.delete(t),
  };
  let now = 0;
  const m = createActivityMonitor({ target, quietMs: 500, now: () => now });
  assert.equal(m.isBusy(), false);
  listeners.get('scroll')();
  assert.equal(m.isBusy(), true);
  now = 499; assert.equal(m.isBusy(), true);
  now = 501; assert.equal(m.isBusy(), false);
  for (const t of ['scroll', 'wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown']) assert.ok(listeners.has(t), `no ${t} listener`);
  m.dispose();
  assert.equal(listeners.size, 0);
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
