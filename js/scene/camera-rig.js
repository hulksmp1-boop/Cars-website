/**
 * AETHER GT — Camera path engine (pure maths, no Three.js, no DOM).
 *
 * A shot is a list of keyframes. Each keyframe describes the camera in the
 * CAR'S OWN FRAME, so the same engine works for every future vehicle:
 *
 *   t       0..1   position along the shot
 *   view    deg    where the camera sits around the car. 0 = dead ahead of the
 *                  nose, 90 = the car's right side (+Z), 180 = behind the tail.
 *                  Values are UNWRAPPED (keep counting past 360) so the camera
 *                  orbits instead of rewinding.
 *   spin    deg    controlled turntable rotation of the car itself
 *   dist    m      horizontal distance from the car's centre
 *   height  m      camera height above the floor
 *   fov     deg    vertical field of view
 *   target  [x,y,z] look-at point in the car's frame (metres)
 *
 * Every channel is interpolated with a monotone cubic (PCHIP) spline, which
 * is C1-continuous (no sudden speed changes at keyframes) and never
 * overshoots (the camera cannot swing into the car between two keys).
 * Orbits are interpolated in angle space (view / distance / height) rather than
 * in XYZ, so the camera travels on arcs around the car and never cuts through it.
 *
 * Conventions: Y is up, the car faces +X, the car's right side is +Z.
 * Rotating the car by `spin` degrees about +Y turns its nose towards -Z.
 */

export const DEG = Math.PI / 180;

const CHANNELS = ['view', 'spin', 'dist', 'height', 'fov', 'tx', 'ty', 'tz'];

/** Monotone cubic Hermite tangents (Fritsch–Carlson / PCHIP) for uneven spacing. */
function pchipTangents(ts, vs) {
  const n = ts.length;
  const h = new Array(n - 1);
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = ts[i + 1] - ts[i];
    d[i] = (vs[i + 1] - vs[i]) / h[i];
  }
  const m = new Array(n);
  if (n === 2) {
    m[0] = m[1] = d[0];
    return { h, d, m };
  }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0; // local extremum or flat: dwell, never overshoot
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  // Ends: one-sided slope so the shot starts/ends moving, not stalled.
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  return { h, d, m };
}

/**
 * @typedef {{ t:number, view:number, spin:number, dist:number, height:number, fov:number, target:[number,number,number] }} Keyframe
 * @param {Keyframe[]} keys  Must be sorted by t, strictly increasing.
 */
export function createTrack(keys) {
  if (!Array.isArray(keys) || keys.length < 2) throw new Error('A shot needs at least two keyframes.');

  const rows = keys.map((k, i) => {
    if (!Array.isArray(k.target) || k.target.length !== 3) throw new Error(`Keyframe ${i}: target must be [x,y,z].`);
    return { t: k.t, view: k.view, spin: k.spin, dist: k.dist, height: k.height, fov: k.fov, tx: k.target[0], ty: k.target[1], tz: k.target[2] };
  });

  const ts = rows.map((r) => r.t);
  for (let i = 0; i < rows.length; i++) {
    for (const ch of CHANNELS) {
      if (!Number.isFinite(rows[i][ch])) throw new Error(`Keyframe ${i}: "${ch}" must be a finite number.`);
    }
    if (i > 0 && !(ts[i] > ts[i - 1])) throw new Error('Keyframe t values must be strictly increasing.');
  }

  const curves = {};
  for (const ch of CHANNELS) {
    const vs = rows.map((r) => r[ch]);
    curves[ch] = { vs, ...pchipTangents(ts, vs) };
  }

  let cursor = 0; // scroll is mostly monotone, so remember the last segment

  /** @returns {{view:number, spin:number, dist:number, height:number, fov:number, tx:number, ty:number, tz:number}} */
  function sample(t) {
    const x = Math.min(Math.max(t, ts[0]), ts[ts.length - 1]);
    if (!(x >= ts[cursor] && x <= ts[cursor + 1])) {
      let lo = 0;
      let hi = ts.length - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ts[mid] <= x) lo = mid;
        else hi = mid - 1;
      }
      cursor = lo;
    }
    const i = cursor;
    const h = ts[i + 1] - ts[i];
    const s = (x - ts[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    const out = {};
    for (const ch of CHANNELS) {
      const c = curves[ch];
      out[ch] = h00 * c.vs[i] + h10 * h * c.m[i] + h01 * c.vs[i + 1] + h11 * h * c.m[i + 1];
    }
    return out;
  }

  return { sample, keys: rows, start: ts[0], end: ts[ts.length - 1] };
}

/**
 * Narrow (portrait) screens see far less width, so pull the camera back to keep
 * the whole car in frame. 1 at or above the reference aspect, growing below it.
 */
export function framingScale(aspect, reference = FRAMING.referenceAspect) {
  if (!(aspect > 0) || aspect >= reference) return 1;
  return Math.min(Math.pow(reference / aspect, FRAMING.exponent), FRAMING.maxScale);
}

/**
 * Vertical composition shift, as a fraction of viewport height. Positive moves
 * the car UP on screen, leaving room for captions underneath (more on phones).
 */
export function compositionShift(aspect) {
  if (!(aspect > 0)) return 0;
  if (aspect < 0.8) return FRAMING.shiftPortrait;
  if (aspect < 1.2) return FRAMING.shiftSquare;
  return FRAMING.shiftLandscape;
}

export const FRAMING = {
  referenceAspect: 1.6,
  exponent: 0.93,
  maxScale: 3.4,
  shiftLandscape: 0.045,
  shiftSquare: 0.07,
  shiftPortrait: 0.085,
};

/**
 * Turns an interpolated sample into a world-space camera pose.
 * @param {ReturnType<ReturnType<typeof createTrack>['sample']>} sample
 * @param {{ aspect: number }} options
 */
export function resolvePose(sample, { aspect }) {
  const k = framingScale(aspect);
  const yaw = sample.spin * DEG;
  // Car turned by +yaw  =>  its nose points at world azimuth -yaw.
  const azimuth = (sample.view - sample.spin) * DEG;
  const radius = sample.dist * k;

  const c = Math.cos(yaw);
  const s = Math.sin(yaw);

  return {
    position: [radius * Math.cos(azimuth), sample.height * k, radius * Math.sin(azimuth)],
    // Target is authored in the car's frame; rotate it with the car.
    target: [sample.tx * c + sample.tz * s, sample.ty, -sample.tx * s + sample.tz * c],
    fov: sample.fov,
    yaw,
  };
}
