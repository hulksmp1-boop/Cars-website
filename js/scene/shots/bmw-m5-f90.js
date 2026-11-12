/**
 * AETHER GT — BMW M5 F90 shot list.
 *
 * One continuous camera move: a full 360° orbit that starts and ends on the
 * SAME front three-quarter hero pose. That matched start/end pose is the
 * hand-off contract for future vehicle transitions (see sequence.js).
 *
 * Keyframe fields are documented in camera-rig.js.
 * Heights are metres above the floor; the roof is ~1.48 m.
 */

export const BMW_SHOT = {
  vehicleId: 'bmw-m5-f90',

  keys: [
    // t     view   spin  dist  height fov  target (car frame)
    { t: 0.00, view: -38, spin: 0,  dist: 7.6, height: 0.62, fov: 32, target: [0.3, 0.55, 0] },   // hero: low front-left 3/4
    { t: 0.13, view: -8,  spin: 6,  dist: 7.0, height: 0.60, fov: 30, target: [0.3, 0.55, 0] },   // nose
    { t: 0.26, view: 34,  spin: 14, dist: 7.6, height: 0.95, fov: 31, target: [0.1, 0.58, 0] },   // front-right 3/4
    { t: 0.40, view: 90,  spin: 22, dist: 9.4, height: 0.80, fov: 27, target: [0.0, 0.62, 0] },   // profile, longer lens
    { t: 0.52, view: 134, spin: 28, dist: 7.6, height: 0.55, fov: 31, target: [-0.3, 0.56, 0] },  // rear-right 3/4, low
    { t: 0.64, view: 180, spin: 30, dist: 7.6, height: 1.05, fov: 30, target: [-0.3, 0.62, 0] },  // tail
    { t: 0.76, view: 228, spin: 22, dist: 8.0, height: 2.30, fov: 31, target: [-0.1, 0.60, 0] },  // high crane over rear-left
    { t: 0.88, view: 276, spin: 10, dist: 8.8, height: 0.90, fov: 28, target: [0.0, 0.62, 0] },   // left profile
    { t: 1.00, view: 322, spin: 0,  dist: 7.6, height: 0.62, fov: 32, target: [0.3, 0.55, 0] },   // back to hero pose (view -38 + 360)
  ],

  /** Captions for the HUD. `t` is where each chapter begins. */
  chapters: [
    { t: 0.00, title: 'Front three-quarter' },
    { t: 0.08, title: 'Nose' },
    { t: 0.20, title: 'Front quarter' },
    { t: 0.33, title: 'Profile' },
    { t: 0.46, title: 'Rear quarter' },
    { t: 0.58, title: 'Tail' },
    { t: 0.70, title: 'Overhead sweep' },
    { t: 0.82, title: 'Opposite profile' },
    { t: 0.94, title: 'Return' },
  ],
};
