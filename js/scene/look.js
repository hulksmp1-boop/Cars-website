/**
 * AETHER GT — Look: every number that decides how the cars are lit and finished.
 *
 * One place to tune the studio. Pure data (no Three.js import), so tests can read it.
 * Colours are sRGB hex strings. Palette: British Racing Green, warm ivory, champagne.
 * No blue, no pure black, no neon.
 *
 * Consumers:  studio.js (environment, lights, floor, backdrop)
 *             materials.js (paint, glass, tyres, metal, lamps)
 *
 * These values were written without being able to render the scene (see README,
 * "Premium look"). Tune here. Quick live checks without editing code:
 *   ?exposure=1.2          overall brightness (0.4 to 2.5)
 *   ?metal=0.9             paint metalness ceiling (0.3 to 1); the floor stays 0.6 or below it
 *   ?materials=original    skip the material pass, to compare against the file's own materials
 *   ?quality=low|medium|high
 */

export const LOOK = {
  /** 'neutral' = Khronos PBR Neutral: keeps the paint colour true (ACES shifts reds toward orange and crushes saturation). */
  toneMapping: 'neutral',

  lighting: {
    exposure: 1.0,
    envIntensity: 1.0,
    keyIntensity: 1.7,
    rimIntensity: 1.5,
    rimColor: '#f1d4a0',     // champagne
    keyColor: '#fff0dc',     // warm white
    rimBColor: '#fff4e4',    // ivory
    hemiSky: '#f3ebdd',      // warm ivory
    hemiGround: '#123c32',   // British Racing Green bounce from the floor
    hemiIntensity: 0.45,
  },

  /**
   * The reflection room the paint sees (PMREM, rendered once per page load).
   * `room`   vertical gradient, ceiling → floor. Mid-tone green-grey walls, never black:
   *          the lower stops are what the car's sills and lower doors reflect.
   * `panels` softboxes: [width, height, [x, y, z], intensity, tint, 'flat' for horizontal panels].
   *          The car's nose points to +X; the turntable spins the car, so the panels sweep across the body.
   */
  env: {
    blur: 0.02,
    room: [
      [0.00, '#b3ad9b'],   // ceiling bounce, warm ivory
      [0.28, '#848b7e'],
      [0.46, '#617266'],   // upper wall
      [0.50, '#55695d'],   // horizon
      [0.56, '#33493f'],
      [1.00, '#10231d'],   // floor: deep green, not black
    ],
    tints: {
      warm: [1.0, 0.96, 0.88],
      champagne: [1.0, 0.83, 0.58],
      green: [0.45, 0.8, 0.65],
    },
    panels: [
      // Overhead softbox: one broad, soft highlight over bonnet, roof and boot.
      { size: [10, 5.5], pos: [0, 8.2, 0], intensity: 3.2, tint: 'warm', flat: true },
      // Long horizontal strip on one flank: the clean shoulder line.
      { size: [12, 1.5], pos: [0, 3.6, -9.5], intensity: 10.0, tint: 'warm' },
      // Tall strip on the other flank: a vertical highlight that rolls over the doors and haunches.
      { size: [1.4, 7.5], pos: [-2.5, 3.2, 9.5], intensity: 9.5, tint: 'warm' },
      // Soft front fill so the nose and grille are never in the dark.
      { size: [7, 4.5], pos: [11.5, 3.0, 0], intensity: 1.8, tint: 'warm' },
      // Two champagne rim strips behind the car: they draw the edge of the silhouette.
      { size: [1.0, 6.5], pos: [-11, 3.0, 3.5], intensity: 7.5, tint: 'champagne' },
      { size: [1.0, 6.5], pos: [-11, 3.0, -3.5], intensity: 7.5, tint: 'champagne' },
      // Low strip: keeps the lower body and wheels readable.
      { size: [14, 0.8], pos: [0, 0.55, 11], intensity: 0.9, tint: 'warm' },
      // Floor bounce: the lower body picks up a little green, not black.
      { size: [26, 26], pos: [0, -1.6, 0], intensity: 0.22, tint: 'green', flat: true },
    ],
  },

  /** Backdrop dome (screen colour, not tone mapped). Horizon matches --color-bg (#123c32) so the floor fades into it seamlessly. */
  dome: [
    [0.00, '#0a2822'],
    [0.30, '#0e3129'],
    [0.44, '#15463a'],
    [0.50, '#1a5244'],   // soft horizon haze
    [0.56, '#123c32'],
    [1.00, '#0b2b24'],
  ],

  floor: {
    color: '#123c32',
    roughness: 0.38,
    envMapIntensity: 0.55,
    /** radial fade: [stop, grey] (alpha) */
    fade: [[0, '#fff'], [0.32, '#fff'], [0.7, '#444'], [1, '#000']],
  },

  /** Warm pool of light on the floor under the car (additive, subtle). */
  pool: { color: '#d8c3a0', opacity: 0.16, radius: 7.5 },

  /** Material finishing (see materials.js and material-rules.js). Never changes a colour or a texture. */
  materials: {
    paint: {
      /** Metallic finish: paint metalness is lifted to at least `metalnessMin` (when the file has no metalness map)
       *  and capped at `metalnessMax`, so it keeps its body colour instead of reading as chrome. */
      metalnessMin: 0.6,
      metalnessMax: 0.88,
      /** Base-coat roughness bounds (used when the file has no roughness map). Low = shiny. */
      roughnessMin: 0.12,
      roughnessMax: 0.24,
      /** Without clearcoat (low tier) the base coat itself has to look glossy. */
      roughnessMinNoCoat: 0.1,
      roughnessMaxNoCoat: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    },
    glass: { roughness: 0.04, metalnessMax: 0.12, opacityMax: 0.9 },
    tyre: { roughness: 0.82 },
    chrome: { metalness: 1, roughness: 0.06, roughnessCapTextured: 0.3 },
    metal: { roughnessMin: 0.28, roughnessMax: 0.45 },
    plastic: { roughness: 0.46, roughnessPainted: 0.3, roughnessGloss: 0.12 },
    /** Lamps stay modest: they are lit, not glowing. Intensities are emissiveIntensity values. */
    lamp: {
      tail: { intensity: 0.75, max: 1.0, tint: '#ff2a1c' },
      head: { intensity: 0.3, max: 0.85, tint: '#fff0d2' },
      amber: { max: 0.7 },
      other: { max: 1.2 },
      roughnessMax: 0.3,
    },
  },
};
