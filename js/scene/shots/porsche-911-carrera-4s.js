/**
 * AETHER GT — Porsche 911 Carrera 4S shot list.
 *
 * Same contract as the BMW shot: one continuous 360° orbit that starts and ends on the SAME front
 * three-quarter hero pose (the hand-off pose for future vehicle transitions). Keyframe fields are
 * documented in camera-rig.js. Heights are metres above the floor; the 911's roof is ~1.3 m, so the
 * camera and look-at heights sit lower than the BMW's, and the rear half of the orbit lingers on the
 * engine lid and tail, because that is where the 911's engine is.
 */

export const PORSCHE_SHOT = {
  vehicleId: 'porsche-911-carrera-4s',

  keys: [
    // t     view   spin  dist  height fov  target (car frame)
    { t: 0.00, view: -38, spin: 0,  dist: 7.4, height: 0.56, fov: 32, target: [0.3, 0.46, 0] },   // hero: low front-left 3/4
    { t: 0.13, view: -8,  spin: 6,  dist: 6.9, height: 0.52, fov: 30, target: [0.3, 0.46, 0] },   // nose and headlamps
    { t: 0.26, view: 34,  spin: 14, dist: 7.4, height: 0.86, fov: 31, target: [0.1, 0.48, 0] },   // front-right 3/4
    { t: 0.40, view: 90,  spin: 22, dist: 9.2, height: 0.72, fov: 27, target: [0.0, 0.52, 0] },   // profile: the roofline
    { t: 0.52, view: 134, spin: 28, dist: 7.4, height: 0.50, fov: 31, target: [-0.4, 0.48, 0] },  // rear-right 3/4, low
    { t: 0.64, view: 180, spin: 30, dist: 7.2, height: 0.98, fov: 30, target: [-0.4, 0.52, 0] },  // tail and engine lid
    { t: 0.76, view: 228, spin: 22, dist: 7.8, height: 2.10, fov: 31, target: [-0.1, 0.50, 0] },  // high crane over rear-left
    { t: 0.88, view: 276, spin: 10, dist: 8.6, height: 0.80, fov: 28, target: [0.0, 0.52, 0] },   // left profile
    { t: 1.00, view: 322, spin: 0,  dist: 7.4, height: 0.56, fov: 32, target: [0.3, 0.46, 0] },   // back to hero pose (view -38 + 360)
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
