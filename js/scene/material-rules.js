/**
 * AETHER GT — Material classification (pure logic, no Three.js import).
 *
 * Decides what kind of surface a glTF material is, from its name and a few
 * properties the loader already read. The runtime pass (materials.js) applies a
 * finish per class; tests run this file in Node against the real GLB files.
 *
 * The five source models name their materials very differently ("Carpaint",
 * "paint", "CarPaint", "Supra_body_paint", "Body_Color"; "Glass", "window",
 * "Other_Glasses_than_Windshield" ...), so classification uses the name AND
 * what the material is (blended / dark / textured / metallic).
 * Rules of thumb that keep this safe:
 *   - A material is only ever matched by name to a class that changes gloss,
 *     metalness or emissive glow. Colours and textures are never touched.
 *   - Anything uncertain falls through to 'other' and is left exactly as authored.
 *
 * @typedef {{ opacity:number, transparent:boolean, hasMap:boolean, hasRoughnessMap:boolean,
 *             hasEmissiveMap:boolean, metalness:number, roughness:number, lum:number, emissiveLum:number }} MaterialInfo
 */

export const CLASS = Object.freeze({
  PAINT: 'paint',
  GLASS: 'glass',
  INTERIOR: 'interior',
  TYRE: 'tyre',
  LAMP_TAIL: 'lamp-tail',
  LAMP_HEAD: 'lamp-head',
  LAMP_AMBER: 'lamp-amber',
  CHROME: 'chrome',
  METAL: 'metal',
  PLASTIC: 'plastic',
  OTHER: 'other',
});

const RE = {
  paint: /(car|body)[ _.-]?paint|body[ _.-]?colou?r|^paint$/i,
  // Cabin, engine bay and anything that is not part of the exterior read. Left as authored (apart from glow limits).
  interior: /^int[ _.-]|^int[a-z]|interior|leather|seat|carpet|alcantara|stitch|dash|steer|speaker|gauge|display|monitor|screen|button|headliner|cabin|engine|^badges?$|decal/i,
  tyre: /tyre|tire|rubber|tread|sidewall/i,
  tail: /tail[ _.-]?light|brake[ _.-]?light|rear[ _.-]?ligh|reartail|red[ _.-]?light/i,
  head: /head[ _.-]?(light|lamp)|day[ _.-]?light|running[ _.-]?light|light[ _.-]?emissive|^lights?(\.\d+)?$|ledstr/i,
  amber: /indicator|blinker|signal|yellow[ _.-]?glass|turn[ _.-]?light/i,
  chrome: /chrom|mirror|polish/i,
  metal: /alumin|metallic$|^metal(\.\d+)?$|steel|brake[ _.-]?dis[ck]|(^|[ _.-])dis[ck]/i,
  gloss: /shin|gloss|piano/i,
  painted: /painted/i,
  matte: /matt/i,
  carbon: /carbon/i,
  notGlass: /logo|badge|plate|decal|sticker/i,
};

/**
 * @param {string} name
 * @param {MaterialInfo} p
 * @returns {string} one of CLASS
 */
export function classifyMaterial(name = '', p) {
  const n = String(name);

  if (RE.paint.test(n)) return CLASS.PAINT;

  // Blended, see-through, not a decal or badge: glass (windows, lamp lenses).
  if ((p.transparent || p.opacity < 0.97) && p.opacity < 0.97 && !p.hasMap && !RE.notGlass.test(n)) return CLASS.GLASS;

  if (RE.tyre.test(n)) return CLASS.TYRE;
  if (RE.tail.test(n)) return CLASS.LAMP_TAIL;
  if (RE.amber.test(n)) return CLASS.LAMP_AMBER;
  if (RE.head.test(n)) return CLASS.LAMP_HEAD;
  if (RE.interior.test(n)) return CLASS.INTERIOR;
  if (RE.chrome.test(n)) return CLASS.CHROME;
  if (RE.metal.test(n)) return CLASS.METAL;

  // Dark, opaque, untextured and nearly fully rough: trim and plastics that read as flat black holes.
  if (p.opacity >= 0.97 && !p.hasMap && p.lum < 0.1 && p.metalness < 0.2 && p.roughness > 0.85 && !RE.matte.test(n) && !RE.carbon.test(n)) return CLASS.PLASTIC;

  return CLASS.OTHER;
}

export const rules = RE;
