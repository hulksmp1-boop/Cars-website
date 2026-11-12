/**
 * AETHER GT — Nissan GT-R R35 shot list.
 *
 * Same contract as the BMW and Porsche shots: one continuous 360° orbit that starts and ends on the
 * SAME front three-quarter hero pose (the hand-off pose for future vehicle transitions). Keyframe
 * fields are documented in camera-rig.js. Heights are metres above the floor. The normalised GT-R is
 * about 1.43 m tall and 2.1 m wide (mirrors included), a little taller and broader than the 911, so the
 * look-at heights sit between the Porsche's and the BMW's and the orbit is a touch wider.
 */

export const NISSAN_SHOT = {
  vehicleId: 'nissan-gt-r-r35',

  keys: [
    // t     view   spin  dist  height fov  target (car frame)
    { t: 0.00, view: -38, spin: 0,  dist: 7.8, height: 0.60, fov: 32, target: [0.3, 0.52, 0] },   // hero: low front-left 3/4
    { t: 0.13, view: -8,  spin: 6,  dist: 7.2, height: 0.58, fov: 30, target: [0.3, 0.52, 0] },   // nose and grille
    { t: 0.26, view: 34,  spin: 14, dist: 7.8, height: 0.92, fov: 31, target: [0.1, 0.54, 0] },   // front-right 3/4
    { t: 0.40, view: 90,  spin: 22, dist: 9.6, height: 0.78, fov: 27, target: [0.0, 0.58, 0] },   // profile
    { t: 0.52, view: 134, spin: 28, dist: 7.8, height: 0.54, fov: 31, target: [-0.3, 0.54, 0] },  // rear-right 3/4, low
    { t: 0.64, view: 180, spin: 30, dist: 7.6, height: 1.02, fov: 30, target: [-0.3, 0.58, 0] },  // tail
    { t: 0.76, view: 228, spin: 22, dist: 8.1, height: 2.20, fov: 31, target: [-0.1, 0.56, 0] },  // high crane over rear-left
    { t: 0.88, view: 276, spin: 10, dist: 9.0, height: 0.86, fov: 28, target: [0.0, 0.58, 0] },   // left profile
    { t: 1.00, view: 322, spin: 0,  dist: 7.8, height: 0.60, fov: 32, target: [0.3, 0.52, 0] },   // back to hero pose (view -38 + 360)
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
