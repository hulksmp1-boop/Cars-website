/**
 * AETHER GT — Quality tier detection.
 * Picks conservative render settings for weaker devices. Force a tier for
 * testing with ?quality=low | medium | high.
 */

const TIERS = {
  // clearcoat: real clearcoat layer on the paint (extra shader cost per fragment; off on the low tier, which uses a glossier base coat instead).
  // envSize:   edge of the PMREM reflection cube (power of two). Built once per page load.
  high:   { name: 'high',   maxPixelRatio: 2,    minPixelRatio: 1,    antialias: true,  anisotropy: 16, shadowSize: 1024, envSize: 512, clearcoat: true,  grain: true },
  medium: { name: 'medium', maxPixelRatio: 1.5,  minPixelRatio: 1,    antialias: true,  anisotropy: 8,  shadowSize: 768,  envSize: 256, clearcoat: true,  grain: true },
  low:    { name: 'low',    maxPixelRatio: 1.25, minPixelRatio: 0.85, antialias: false, anisotropy: 4,  shadowSize: 512,  envSize: 128, clearcoat: false, grain: false },
};

export function detectQuality() {
  let forced = null;
  try { forced = new URLSearchParams(location.search).get('quality'); } catch { /* ignore */ }
  if (forced && TIERS[forced]) return { ...TIERS[forced], backgroundLoading: forced === 'high' };

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = Math.min(window.screen.width, window.screen.height) < 600;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);

  let tier;
  if (saveData || memory <= 2 || (cores <= 4 && (coarse || memory <= 4))) tier = TIERS.low;
  else if (coarse || smallScreen || cores <= 6) tier = TIERS.medium;
  else tier = TIERS.high;

  // Background loading (see asset-queue.js) is for capable, unmetered desktops only.
  // Phones/tablets, low-end devices and Data Saver always load on demand.
  return { ...tier, backgroundLoading: tier.name !== 'low' && !coarse && !saveData };
}
