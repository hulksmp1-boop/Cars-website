/**
 * AETHER GT — Static configuration.
 * Single source of truth for the vehicle lineup and loader settings.
 */

/** Site-level pages. Every page is its own HTML file that shares css/ and js/. */
export const SITE = {
  name: 'AETHER GT',
  intro: '/',
  collection: '/collection.html',
};

/**
 * The five vehicles, in showcase order (BMW first). `page` is the car's own
 * experience page. A car has a 3D experience once it has an entry in MODELS below.
 *
 * Collection page fields:
 *   tagline  one short line under the name
 *   visual   editorial visual for the collection. `image` is null until real photography exists
 *            (the collection then shows an honest, captioned frame). When set to a path, see README
 *            "Collection imagery" for how to place it.
 */
export const VEHICLES = [
  {
    id: 'bmw-m5-f90', make: 'BMW', model: 'M5 F90', designation: 'Competition', page: '/cars/bmw-m5',
    tagline: 'Four doors. Twin-turbo V8. Uncompromising.',
    visual: { image: null },
  },
  {
    id: 'porsche-911-carrera-4s', make: 'Porsche', model: '911', designation: 'Carrera 4S', page: '/cars/porsche-911',
    tagline: 'The rear-engined icon, with all-wheel-drive grip.',
    visual: { image: null },
  },
  {
    id: 'nissan-gt-r-r35', make: 'Nissan', model: 'GT-R', designation: 'R35', page: '/cars/nissan-gt-r',
    tagline: 'The all-wheel-drive giant-killer.',
    visual: { image: null },
  },
  {
    id: 'toyota-gr-supra-mk5', make: 'Toyota', model: 'GR Supra', designation: 'MK5', page: '/cars/toyota-supra',
    tagline: 'Rear-drive precision, reborn.',
    visual: { image: null },
  },
  {
    id: 'chevrolet-corvette-c8', make: 'Chevrolet', model: 'Corvette', designation: 'C8', page: '/cars/corvette-c8',
    tagline: 'Mid-engine, at last.',
    visual: { image: null },
  },
];

export const LOADER = {
  /** Minimum time (ms) the loading screen stays visible, to avoid a flash. */
  minDuration: 900,
};

/* ---------------------------------------------------------------------------
   Phase 02 — scene, models and showcase settings
   ------------------------------------------------------------------------ */

/** Draco decoder (needed because the BMW GLB is Draco-compressed). Must match the Three.js version in index.html. To run offline, copy that folder into the project and point this at it. */
export const DRACO_DECODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/';

/**
 * Per-vehicle model spec, keyed by VEHICLES[].id. BMW (Phase 02), Porsche, Nissan, Toyota and Chevrolet (Aether GT phase 3).
 * Optional `hideMeshes`: mesh names to hide before the model is measured (non-car helper geometry).
 * Every model is normalised to the same stage footprint (fitLength) so future
 * hand-offs between cars keep scale, ground contact and centring matched.
 */
export const MODELS = {
  'bmw-m5-f90': {
    url: '/assets/models/bmw-m5-f90.glb',
    approxBytes: 5069832,
    /** Degrees about Y applied so the car's nose points to +X. The BMW GLB already faces +X. */
    orientationY: 0,
    /** Nominal real-world size (m), used only to sanity-check the file. */
    expected: { length: 4.95, width: 2.1, height: 1.48 },
    credit: {
      title: 'Bmw M5 F90',
      author: 'RES1N',
      license: 'CC BY 4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
      authorUrl: 'https://sketchfab.com/Resinnnn',
      sourceUrl: 'https://sketchfab.com/3d-models/bmw-m5-f90-5478e978bd634337adc8e3dc413fbfa3',
    },
  },
  'porsche-911-carrera-4s': {
    url: '/assets/models/porsche-911-carrera-4s.glb',
    approxBytes: 2441780,
    /** The Porsche GLB faces +Z (nose) in its own frame, so it is turned 90° to put the nose on +X. */
    orientationY: 90,
    /**
     * Meshes hidden before measuring. `Plane_0` is a flat, zero-thickness baked-shadow card under the
     * car (2.75 m x 5.1 m, black alpha texture). Left in, it would stretch the measured size and show
     * as a hard-edged rectangle next to the site's own contact shadow. The body is untouched.
     */
    hideMeshes: ['Plane_0'],
    /** Nominal real-world size (m), used only to sanity-check the file (the model's rear panels reach a little past the real 4.52 m). */
    expected: { length: 4.52, width: 2.02, height: 1.3 },
    credit: {
      title: '(FREE) Porsche 911 Carrera 4S',
      author: 'Karol Miklas',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by-sa/4.0/',
      authorUrl: 'https://sketchfab.com/karolmiklas',
      sourceUrl: 'https://sketchfab.com/3d-models/free-porsche-911-carrera-4s-d01b254483794de3819786d93e0e1ebf',
    },
  },
  'nissan-gt-r-r35': {
    url: '/assets/models/nissan-gt-r-r35.glb',
    approxBytes: 2035976,
    /** The Nissan GLB has its nose towards -X (front bumper and grille at about -2.1 m, tail lamps at +2.2 m), so it is turned 180° to put the nose on +X. */
    orientationY: 180,
    /** Nominal real-world size (m), used only to sanity-check the file. The file is about 3% over the real length and height (and includes the mirrors in its width). No helper geometry: nothing needs hiding. */
    expected: { length: 4.71, width: 1.9, height: 1.37 },
    credit: {
      title: 'Nissan GTR R35',
      author: 'Ciasny',
      license: 'CC BY 4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
      authorUrl: 'https://sketchfab.com/Ciasny',
      sourceUrl: 'https://sketchfab.com/3d-models/nissan-gtr-r35-51c912a8310c4e00a82ad7673d84228a',
    },
  },
  'toyota-gr-supra-mk5': {
    url: '/assets/models/toyota-gr-supra-mk5.glb',
    approxBytes: 2604732,
    /** The Supra GLB has its nose towards +Z (headlamps at about +1.7 to +2.1 m, tail and reverse lamps at about -1.9 to -2.4 m), so it is turned 90° to put the nose on +X, as for the Porsche. */
    orientationY: 90,
    /** Nominal real-world size (m) of the published car, used only to sanity-check the file. The model is a stand-in: about 15% longer and much broader than the real car, so it is not a to-scale likeness. No helper geometry: nothing needs hiding. */
    expected: { length: 4.38, width: 1.85, height: 1.29 },
    credit: {
      title: 'Toyota Supra MK5 A90',
      author: 'pryanex',
      license: 'CC BY 4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
      authorUrl: 'https://sketchfab.com/pryanex',
      sourceUrl: 'https://sketchfab.com/3d-models/toyota-supra-mk5-a90-30528ef37af844919074498f979b9515',
    },
  },
  'chevrolet-corvette-c8': {
    url: '/assets/models/chevrolet-corvette-c8.glb',
    approxBytes: 1462224,
    /** The Corvette GLB has its nose towards -Z (headlamps at about -1.7 to -2.3 m, tail and reverse lamps at about +2.3 to +2.5 m), so it is turned -90° to put the nose on +X. */
    orientationY: -90,
    /** Nominal real-world size (m) of the published 2020 Stingray, used only to sanity-check the file. The model is a stand-in: about 13% longer and 9% taller than the real car, and its width includes the mirrors. No helper geometry: nothing needs hiding. */
    expected: { length: 4.63, width: 1.93, height: 1.23 },
    credit: {
      title: '2019 Chevrolet Corvette C8 Stingray',
      author: 'Hari',
      license: 'CC BY 4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
      authorUrl: 'https://sketchfab.com/Hari31',
      sourceUrl: 'https://sketchfab.com/3d-models/2019-chevrolet-corvette-c8-stingray-790c40ccff6843eab0b7b4bd18421ff8',
    },
  },
};

export const STAGE = {
  /** Every vehicle is scaled uniformly so its length equals this (metres). */
  fitLength: 4.9,
  /** Meshes reaching further than this beyond the main body are treated as broken and hidden. */
  outlierMargin: 0.75,
  /** Give up on a download that makes no progress for this long (ms). */
  stallTimeout: 30000,
};

/** Showcase scroll track. Height lives in css/showcase.css (--showcase-length). */
export const SHOWCASE = {
  /** Seconds the camera takes to catch up with the scroll position (inertia). 0 = locked to scroll. */
  scrubSmoothing: 1,
};
