/**
 * AETHER GT — Assembly plan (pure maths, no Three.js, no DOM).
 *
 * Phase 7. Given the real components of a car (one entry per separate mesh in the
 * GLB, measured in the car's own frame) this works out, for each component:
 *
 *   offset  where it starts, relative to its assembled position (metres)
 *   delay   when it starts moving   } as fractions of the whole assembly,
 *   span    how long it takes       } so delay + span <= 1
 *
 * Nothing here invents or alters geometry: components are only translated, and
 * always end at offset 0, their original positions.
 *
 * Car frame (same as camera-rig.js and vehicle.js): +X nose, +Y up, +Z right side,
 * origin at the centre of the footprint on the floor.
 *
 * Look of the explosion
 *  - parts fly out along the line from the car's core to the part, so wheels and
 *    sills leave sideways, bumpers forwards/backwards, roof and glass upwards;
 *  - the outer the part, the further it travels;
 *  - very large parts (the body shell) only lift and shift a little, so the car
 *    reads as one object coming together rather than a cloud;
 *  - nothing starts below the floor;
 *  - assembly order is inside-out and bottom-up: low, central parts land first,
 *    outer panels and glass land last.
 */

/** How far the outermost parts start from home, as a fraction of the car's length. */
export const SPREAD = 0.34;

const clamp = (v, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);

/** Deterministic 0..1 hash so the order is stable between visits (no Math.random). */
const hash = (i) => {
  const s = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Landing curve for one component: quick departure, long soft settle. */
export const partEase = (u) => 1 - Math.pow(1 - clamp(u), 3.2);

/** Gentle S-curve for camera and lighting. */
export const smooth = (u) => { const t = clamp(u); return t * t * t * (t * (t * 6 - 15) + 10); };

/**
 * @param {{ center:[number,number,number], size:[number,number,number] }[]} parts  car frame, metres
 * @param {{ length:number, width:number, height:number }} dims  normalised car dimensions
 * @param {{ lateral?: number }} [options]  lateral < 1 narrows sideways travel (portrait screens)
 * @returns {{ offset:[number,number,number], delay:number, span:number }[]}
 */
export function planAssembly(parts, dims, { lateral = 1 } = {}) {
  const L = dims.length;
  const W = dims.width;
  const H = dims.height;
  const core = [0, H * 0.42, 0];
  const spread = SPREAD * L;
  const floor = 0.03;

  return parts.map((part, index) => {
    const [cx, cy, cz] = part.center;
    const [sx, sy, sz] = part.size;

    // Normalised position about the core: roughly -1..1 across the car.
    const nx = clamp((cx - core[0]) / (L / 2), -1.6, 1.6);
    const ny = clamp((cy - core[1]) / (H * 0.55), -1.6, 1.6);
    const nz = clamp((cz - core[2]) / (W / 2), -1.6, 1.6);
    const r = clamp(Math.hypot(nx * 0.8, ny * 0.9, nz) / 1.25);

    // Direction of travel: out from the core, with a lift so parts drift up as they leave.
    let dx = nx * 0.8;
    let dy = ny + 0.35;
    let dz = nz * 1.25;
    const shell = Math.max(sx / L, sz / W, sy / H) > 0.62;   // body shell, floor pan, big glass
    if (shell) { dx *= 0.3; dz *= 0.3; dy = Math.abs(dy) + 0.8; }
    let len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) { dx = 0; dy = 1; dz = 0; len = 1; }
    dx /= len; dy /= len; dz /= len;

    // Distance: the further out, the further it travels. Shells travel least.
    let dist = spread * (0.35 + 0.65 * r);
    if (shell) dist = spread * 0.42;
    const travelX = dx * dist;
    const travelY = dy * dist;
    const travelZ = dz * dist * lateral * 1.1;

    // Never start below the floor.
    const bottom = cy - sy / 2;
    const offY = Math.max(travelY, floor - bottom);

    // Order: inside-out and bottom-up. A small stable jitter stops waves looking mechanical.
    const order = clamp(0.5 * r + 0.5 * clamp(cy / H) + (hash(index) - 0.5) * 0.1);
    const span = 0.42 + 0.08 * r;
    const delay = order * (1 - span);

    return { offset: [travelX, offY, travelZ], delay, span };
  });
}
