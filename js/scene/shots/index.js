/**
 * AETHER GT — Shot registry. One entry per vehicle id; each shot file follows
 * the keyframe format documented in scene/camera-rig.js. Add a car's shot here
 * when its page gets a 3D experience.
 */

import { BMW_SHOT } from './bmw-m5-f90.js';
import { PORSCHE_SHOT } from './porsche-911-carrera-4s.js';
import { NISSAN_SHOT } from './nissan-gt-r-r35.js';
import { SUPRA_SHOT } from './toyota-gr-supra-mk5.js';
import { CORVETTE_SHOT } from './chevrolet-corvette-c8.js';

export const SHOTS = {
  'bmw-m5-f90': BMW_SHOT,
  'porsche-911-carrera-4s': PORSCHE_SHOT,
  'nissan-gt-r-r35': NISSAN_SHOT,
  'toyota-gr-supra-mk5': SUPRA_SHOT,
  'chevrolet-corvette-c8': CORVETTE_SHOT,
};
