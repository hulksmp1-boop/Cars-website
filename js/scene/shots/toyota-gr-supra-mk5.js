/**
 * AETHER GT — Toyota GR Supra MK5 (A90) shot list.
 *
 * Same contract as the BMW, Porsche and Nissan shots: one continuous 360° orbit that starts and ends on
 * the SAME front three-quarter hero pose (the hand-off pose for vehicle transitions). Keyframe fields are
 * documented in camera-rig.js. Heights are metres above the floor. The normalised Supra model is about
 * 4.9 m long, 2.55 m wide (the file is broad for its length) and 1.32 m tall: the lowest car on the site,
 * so look-at heights sit a little under the Nissan's and the orbit is slightly wider for the width.
 */

export const SUPRA_SHOT = {
  vehicleId: 'toyota-gr-supra-mk5',

  keys: [
    // t     view   spin  dist  height fov  target (car frame)
    { t: 0.00, view: -38, spin: 0,  dist: 8.2,  height: 0.58, fov: 32, target: [0.3, 0.48, 0] },   // hero: low front-left 3/4
    { t: 0.13, view: -8,  spin: 6,  dist: 8.0,  height: 0.56, fov: 30, target: [0.3, 0.48, 0] },   // nose and grille
    { t: 0.26, view: 34,  spin: 14, dist: 8.2,  height: 0.88, fov: 31, target: [0.1, 0.50, 0] },   // front-right 3/4
    { t: 0.40, view: 90,  spin: 22, dist: 10.0, height: 0.74, fov: 27, target: [0.0, 0.54, 0] },   // profile
    { t: 0.52, view: 134, spin: 28, dist: 8.2,  height: 0.52, fov: 31, target: [-0.3, 0.50, 0] },  // rear-right 3/4, low
    { t: 0.64, view: 180, spin: 30, dist: 8.0,  height: 0.98, fov: 30, target: [-0.3, 0.54, 0] },  // tail
    { t: 0.76, view: 228, spin: 22, dist: 8.4,  height: 2.10, fov: 31, target: [-0.1, 0.52, 0] },  // high crane over rear-left
    { t: 0.88, view: 276, spin: 10, dist: 9.4,  height: 0.82, fov: 28, target: [0.0, 0.54, 0] },   // left profile
    { t: 1.00, view: 322, spin: 0,  dist: 8.2,  height: 0.58, fov: 32, target: [0.3, 0.48, 0] },   // back to hero pose (view -38 + 360)
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
