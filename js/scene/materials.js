/**
 * AETHER GT — Runtime material finishing.
 *
 * Takes the materials the GLB came with and gives them a premium automotive
 * finish, in memory only: the GLB files are never modified.
 *
 *   paint     glossy clearcoat over the file's own base colour; metalness capped so
 *             it keeps body colour; roughness kept in a showroom range
 *   glass     smooth, mostly non-metallic, reflective; opacity as authored (max 0.9)
 *   tyres     rubber: non-metallic, satin-rough
 *   chrome    bright untextured chrome becomes true mirror chrome
 *   metal     bright untextured metal (discs, aluminium) polished to a clean sheen
 *   plastic   flat-black trim gets a satin roughness so it catches light
 *   lamps     modest emissive glow on tail and head lamps; authored glow is capped
 *
 * Never changes a colour, a texture or a UV. Paint colour is whatever the file says.
 * Every material is handled inside try/catch: a failure leaves that material as authored.
 * Controlled by the quality tier (see core/quality.js: `clearcoat`) and by
 * `?materials=original` (skips everything, for side-by-side comparison).
 */

import * as THREE from 'three';
import { LOOK } from './look.js';
import { CLASS, classifyMaterial, rules } from './material-rules.js';

const M = LOOK.materials;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** `?metal=0.9` caps the paint metalness (0.3 to 1) without editing code. */
function metalOverride() {
  try {
    const v = parseFloat(new URLSearchParams(location.search).get('metal'));
    return Number.isFinite(v) ? clamp(v, 0.3, 1) : null;
  } catch { return null; }
}
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;   // c is in Three's linear working space

export function materialsEnabled() {
  try { return new URLSearchParams(location.search).get('materials') !== 'original'; } catch { return true; }
}

/**
 * A MeshPhysicalMaterial carrying every property of a MeshStandardMaterial.
 * (MeshPhysicalMaterial.copy() can't take a Standard source: it would write `undefined` into the clearcoat fields.)
 */
function toPhysical(source) {
  if (source.isMeshPhysicalMaterial) return source;
  const next = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(next, source);
  next.defines = { STANDARD: '', PHYSICAL: '' };   // Standard.copy resets these; the physical shader needs both
  next.name = source.name;
  next.userData = source.userData;
  return next;
}

function describe(m) {
  return {
    opacity: m.opacity,
    transparent: m.transparent,
    hasMap: Boolean(m.map),
    hasRoughnessMap: Boolean(m.roughnessMap),
    hasMetalnessMap: Boolean(m.metalnessMap),
    hasEmissiveMap: Boolean(m.emissiveMap),
    metalness: m.metalness,
    roughness: m.roughness,
    lum: lum(m.color),
    emissiveLum: lum(m.emissive),
  };
}

/** Gives a lamp a modest glow when the file authored none; always caps the intensity. */
function glow(m, info, { intensity, max, tint }) {
  if (info.emissiveLum < 0.01 && !info.hasEmissiveMap) {
    if (info.hasMap) {
      m.emissiveMap = m.map;           // the glow follows the texture, so reflectors and LEDs stay readable
      m.emissive.set(0xffffff);
    } else {
      m.emissive.set(tint);
    }
    m.emissiveIntensity = intensity;
  }
  m.emissiveIntensity = clamp(m.emissiveIntensity, 0, max);
}

const FINISH = {
  [CLASS.PAINT](m, info, quality) {
    const metalMax = metalOverride() ?? M.paint.metalnessMax;
    const metalMin = Math.min(M.paint.metalnessMin, metalMax);
    // With a metalness map the factor multiplies the texture, so only cap it; otherwise lift it into the metallic range.
    m.metalness = info.hasMetalnessMap ? Math.min(m.metalness, metalMax) : clamp(m.metalness, metalMin, metalMax);
    const coat = quality.clearcoat !== false;
    if (!info.hasRoughnessMap) {
      m.roughness = coat
        ? clamp(m.roughness, M.paint.roughnessMin, M.paint.roughnessMax)
        : clamp(m.roughness, M.paint.roughnessMinNoCoat, M.paint.roughnessMaxNoCoat);
    }
    if (!coat) return m;
    const out = toPhysical(m);
    out.clearcoat = Math.max(out.clearcoat || 0, M.paint.clearcoat);
    if (!out.clearcoatRoughnessMap) out.clearcoatRoughness = Math.min(out.clearcoatRoughness || M.paint.clearcoatRoughness, M.paint.clearcoatRoughness);
    return out;
  },

  [CLASS.GLASS](m) {
    m.metalness = Math.min(m.metalness, M.glass.metalnessMax);
    m.roughness = Math.min(m.roughness, M.glass.roughness);
    m.opacity = Math.min(m.opacity, M.glass.opacityMax);
    return m;
  },

  [CLASS.TYRE](m, info) {
    m.metalness = 0;
    if (!info.hasRoughnessMap) m.roughness = M.tyre.roughness;
    return m;
  },

  [CLASS.CHROME](m, info) {
    if (info.lum < 0.3) return m;                         // dark "chrome" is gloss black trim: leave it
    if (info.hasMap) {
      if (!info.hasRoughnessMap) m.roughness = Math.min(m.roughness, M.chrome.roughnessCapTextured);
      return m;
    }
    m.metalness = M.chrome.metalness;
    if (!info.hasRoughnessMap) m.roughness = M.chrome.roughness;
    return m;
  },

  [CLASS.METAL](m, info) {
    if (info.hasRoughnessMap) return m;
    if (info.lum >= 0.25 && !info.hasMap) {
      m.metalness = 1;
      m.roughness = clamp(m.roughness, M.metal.roughnessMin, M.metal.roughnessMax);
    } else if (m.metalness >= 0.5) {
      m.roughness = Math.min(m.roughness, M.metal.roughnessMax);
    }
    return m;
  },

  [CLASS.PLASTIC](m, info, quality, name) {
    m.roughness = rules.gloss.test(name) ? M.plastic.roughnessGloss
      : rules.painted.test(name) ? M.plastic.roughnessPainted
        : M.plastic.roughness;
    return m;
  },

  [CLASS.LAMP_TAIL](m, info) {
    glow(m, info, M.lamp.tail);
    m.roughness = Math.min(m.roughness, M.lamp.roughnessMax);
    return m;
  },

  [CLASS.LAMP_HEAD](m, info) {
    glow(m, info, M.lamp.head);
    m.roughness = Math.min(m.roughness, M.lamp.roughnessMax);
    return m;
  },

  [CLASS.LAMP_AMBER](m) {
    m.emissiveIntensity = Math.min(m.emissiveIntensity, M.lamp.amber.max);
    return m;
  },

  [CLASS.INTERIOR](m) {
    m.emissiveIntensity = Math.min(m.emissiveIntensity, M.lamp.other.max);
    return m;
  },

  [CLASS.OTHER](m) {
    m.emissiveIntensity = Math.min(m.emissiveIntensity, M.lamp.other.max);
    return m;
  },
};

/**
 * Applies the finish to every material under `model`.
 * @param {THREE.Object3D} model  the GLB scene
 * @param {{ quality: { clearcoat?: boolean } }} options
 * @returns {{ counts: Record<string, number>, replaced: number }}  how many materials fell into each class
 */
export function enhanceVehicleMaterials(model, { quality = {} } = {}) {
  const counts = {};
  const done = new Map();          // original material → finished material
  let replaced = 0;

  const finish = (m) => {
    if (!m || !m.isMeshStandardMaterial) return m;     // unlit / custom materials: leave alone
    if (done.has(m)) return done.get(m);
    let out = m;
    try {
      const info = describe(m);
      const kind = classifyMaterial(m.name, info);
      counts[kind] = (counts[kind] || 0) + 1;
      out = FINISH[kind](m, info, quality, m.name) || m;
      if (out !== m) {
        replaced += 1;
        m.dispose();
      }
      out.needsUpdate = true;
    } catch (error) {
      console.warn(`[AETHER GT] material "${m.name}" left as authored:`, error);
      out = m;
    }
    done.set(m, out);
    return out;
  };

  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
  });

  return { counts, replaced };
}
