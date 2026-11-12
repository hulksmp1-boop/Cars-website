/**
 * AETHER GT — Sequence map (pure logic, no Three.js).
 *
 * Maps the page's global scroll progress (0..1) onto an ordered list of
 * vehicle segments. Phase 02 has ONE segment (the BMW), so every progress value
 * resolves to { index: 0, local: progress, transition: null }.
 *
 * Hand-off contract for later phases (BMW → Porsche → GT-R → Supra → Corvette):
 *  - every shot starts and ends on the same hero pose (BMW_SHOT does: first and
 *    last keyframes are the same camera position, verified in tests);
 *  - all cars are normalised to the same length, ground contact and centre
 *    (see vehicle.js `fitLength`), so scale and framing match across a cut;
 *  - near a boundary, `resolve()` reports { from, to, u } with u 0..1. The
 *    director will use that window to run a cinematic hand-off (matched camera,
 *    lighting preset blend, light sweep) instead of a fade or a pop.
 */

/**
 * @param {{ id: string, weight?: number }[]} segments
 * @param {{ transition?: number }} [options] transition = total width of each
 *   hand-off window as a fraction of global progress (centred on the boundary).
 */
export function createSequence(segments, { transition = 0 } = {}) {
  if (!segments.length) throw new Error('Sequence needs at least one segment.');
  const weights = segments.map((s) => s.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);

  const bounds = [0];
  weights.forEach((w, i) => bounds.push(bounds[i] + w / total));
  bounds[bounds.length - 1] = 1;

  const half = segments.length > 1 ? transition / 2 : 0;

  function resolve(progress) {
    const p = Math.min(Math.max(progress, 0), 1);

    let index = segments.length - 1;
    for (let i = 0; i < segments.length; i++) {
      if (p < bounds[i + 1]) { index = i; break; }
    }

    const local = bounds[index + 1] === bounds[index] ? 0 : (p - bounds[index]) / (bounds[index + 1] - bounds[index]);

    let transitionState = null;
    if (half > 0) {
      const next = index + 1;
      if (next < segments.length && p > bounds[next] - half) {
        transitionState = { from: index, to: next, u: (p - (bounds[next] - half)) / (2 * half) };
      }
      const prev = index - 1;
      if (!transitionState && prev >= 0 && p < bounds[index] + half) {
        transitionState = { from: prev, to: index, u: (p - (bounds[index] - half)) / (2 * half) };
      }
    }
    return { index, id: segments[index].id, local: Math.min(Math.max(local, 0), 1), transition: transitionState };
  }

  return { resolve, bounds, count: segments.length };
}
