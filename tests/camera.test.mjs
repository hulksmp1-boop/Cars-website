/**
 * Run:  node tests/camera.test.mjs
 * Pure-maths checks of the camera path, framing and sequence map.
 * No dependencies. This does NOT render anything.
 */
import assert from 'node:assert/strict';
import { createTrack, resolvePose, framingScale, compositionShift, DEG } from '../js/scene/camera-rig.js';
import { BMW_SHOT } from '../js/scene/shots/bmw-m5-f90.js';
import { createSequence } from '../js/scene/sequence.js';

const track = createTrack(BMW_SHOT.keys);
const HALF = { x: 2.45, y: 1.48, z: 1.05 }; // normalised BMW box (length 4.9 m)
const ASPECTS = { '21:9': 21 / 9, '16:9': 16 / 9, '16:10': 1.6, '4:3': 4 / 3, '1:1': 1, '9:16': 9 / 16, '9:19.5': 9 / 19.5 };
const STEPS = 1200;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };

function project(pose, aspect, p) {
  const back = norm(sub(pose.position, pose.target));
  const right = norm(cross([0, 1, 0], back));
  const up = cross(back, right);
  const v = sub(p, pose.position);
  const x = dot(v, right), y = dot(v, up), z = dot(v, back);
  if (z >= -0.1) return null; // behind / inside near plane
  const t = Math.tan((pose.fov * DEG) / 2);
  return { x: x / -z / (t * aspect), y: y / -z / t, depth: -z };
}

function corners(yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const out = [];
  for (const x of [-HALF.x, HALF.x]) for (const y of [0, HALF.y]) for (const z of [-HALF.z, HALF.z]) {
    out.push([x * c + z * s, y, -x * s + z * c]);
  }
  return out;
}

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

console.log('Camera track');

check('first and last keyframe are the same world pose (hand-off match)', () => {
  const a = resolvePose(track.sample(0), { aspect: 16 / 9 });
  const b = resolvePose(track.sample(1), { aspect: 16 / 9 });
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(a.position[i] - b.position[i]) < 1e-6, `position[${i}] ${a.position[i]} vs ${b.position[i]}`);
    assert.ok(Math.abs(a.target[i] - b.target[i]) < 1e-6, `target[${i}]`);
  }
  assert.ok(Math.abs(a.yaw - b.yaw) < 1e-9 && Math.abs(a.fov - b.fov) < 1e-9);
});

check('view angle never decreases (camera only orbits forward)', () => {
  let prev = -Infinity;
  for (let i = 0; i <= STEPS; i++) { const v = track.sample(i / STEPS).view; assert.ok(v >= prev - 1e-9, `view went back at ${i / STEPS}`); prev = v; }
});

check('no jumps: per-step camera movement stays small', () => {
  let worst = 0, prev = null;
  for (let i = 0; i <= STEPS * 4; i++) {
    const p = resolvePose(track.sample(i / (STEPS * 4)), { aspect: 16 / 9 });
    if (prev) worst = Math.max(worst, Math.hypot(...sub(p.position, prev.position)));
    prev = p;
  }
  console.log(`         largest step: ${worst.toFixed(4)} m per ${(1 / (STEPS * 4)).toExponential(1)} progress`);
  assert.ok(worst < 0.02, `step ${worst}`);
});

check('speed is continuous (no velocity discontinuity at keyframes)', () => {
  const n = STEPS * 8; let prevSpeed = null, worstJump = 0;
  let prev = resolvePose(track.sample(0), { aspect: 16 / 9 });
  for (let i = 1; i <= n; i++) {
    const p = resolvePose(track.sample(i / n), { aspect: 16 / 9 });
    const speed = Math.hypot(...sub(p.position, prev.position));
    if (prevSpeed !== null) worstJump = Math.max(worstJump, Math.abs(speed - prevSpeed));
    prevSpeed = speed; prev = p;
  }
  console.log(`         largest speed change between samples: ${worstJump.toExponential(2)} m`);
  assert.ok(worstJump < 0.0015, `speed jump ${worstJump}`);
});

for (const [label, aspect] of Object.entries(ASPECTS)) {
  check(`car fully in frame, never clipped, camera never inside it @ ${label}`, () => {
    const shift = 2 * compositionShift(aspect);
    let maxExt = 0, minExt = Infinity, minDist = Infinity, worstT = 0;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const pose = resolvePose(track.sample(t), { aspect });
      let ext = 0;
      for (const c of corners(pose.yaw)) {
        const q = project(pose, aspect, c);
        assert.ok(q, `corner behind camera at t=${t.toFixed(3)}`);
        ext = Math.max(ext, Math.abs(q.x), Math.abs(q.y + shift));
        minDist = Math.min(minDist, q.depth);
      }
      if (ext > maxExt) { maxExt = ext; worstT = t; }
      minExt = Math.min(minExt, ext);
    }
    console.log(`         extent min ${minExt.toFixed(2)} max ${maxExt.toFixed(2)} (at t=${worstT.toFixed(2)}), nearest corner depth ${minDist.toFixed(1)} m`);
    assert.ok(maxExt <= 0.97, `car leaves frame: ${maxExt.toFixed(3)} at t=${worstT.toFixed(3)}`);
    assert.ok(minExt >= 0.30, `car too small: ${minExt.toFixed(3)}`);
    assert.ok(minDist > 2.0, `camera too close: ${minDist}`);
  });
}

check('reverse scrolling retraces the exact same poses (sampling is a pure function of progress)', () => {
  // Scroll down in small steps, then back up in different-sized steps and from the end: every pose must match
  // a fresh track sampled in a single jump. Guards the segment cache inside sample().
  const fresh = () => createTrack(BMW_SHOT.keys);
  const pose = (tr, t, aspect) => resolvePose(tr.sample(t), { aspect });
  const down = createTrack(BMW_SHOT.keys);
  const ts = [];
  for (let i = 0; i <= 500; i++) ts.push(i / 500);
  ts.forEach((t) => down.sample(t));                       // forward pass leaves the cache at the end
  for (const aspect of [16 / 9, 9 / 19.5]) {
    for (let i = ts.length - 1; i >= 0; i -= 3) {          // backward pass
      const a = pose(down, ts[i], aspect), b = pose(fresh(), ts[i], aspect);
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(a.position[k] - b.position[k]) < 1e-12, `position differs at t=${ts[i]}`);
        assert.ok(Math.abs(a.target[k] - b.target[k]) < 1e-12, `target differs at t=${ts[i]}`);
      }
      assert.ok(Math.abs(a.yaw - b.yaw) < 1e-12 && Math.abs(a.fov - b.fov) < 1e-12);
    }
  }
  // Scrolling back to the very top lands on the hero pose again.
  const top = pose(down, 0, 16 / 9), hero = pose(fresh(), 0, 16 / 9);
  assert.deepEqual(top.position, hero.position);
});

check('framing scale: 1 on wide screens, grows on portrait, capped', () => {
  assert.equal(framingScale(16 / 9), 1);
  assert.ok(framingScale(0.46) > 2);
  assert.ok(framingScale(0.01) <= 3.4);
});

check('track rejects bad input', () => {
  assert.throws(() => createTrack([BMW_SHOT.keys[0]]));
  assert.throws(() => createTrack([BMW_SHOT.keys[0], { ...BMW_SHOT.keys[1], t: 0 }]));
  assert.throws(() => createTrack([BMW_SHOT.keys[0], { ...BMW_SHOT.keys[1], fov: NaN }]));
});

console.log('Sequence map');

check('single BMW segment: always index 0, local = progress, no transition', () => {
  const seq = createSequence([{ id: 'bmw-m5-f90' }]);
  for (const p of [0, 0.25, 0.5, 1]) {
    const r = seq.resolve(p);
    assert.equal(r.index, 0); assert.equal(r.local, p); assert.equal(r.transition, null);
  }
});

check('five-segment map (future): boundaries, local progress and hand-off windows', () => {
  const seq = createSequence(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })), { transition: 0.04 });
  assert.equal(seq.resolve(0).index, 0);
  assert.equal(seq.resolve(0.5).index, 2);
  assert.equal(seq.resolve(1).index, 4);
  assert.equal(seq.resolve(0.1).transition, null);
  const t = seq.resolve(0.19);
  assert.equal(t.transition.from, 0); assert.equal(t.transition.to, 1);
  assert.ok(t.transition.u > 0 && t.transition.u < 1);
  const t2 = seq.resolve(0.21);
  assert.equal(t2.transition.from, 0); assert.equal(t2.transition.to, 1);
  assert.ok(t2.transition.u > 0.5);
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
