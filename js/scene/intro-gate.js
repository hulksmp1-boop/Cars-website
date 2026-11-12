/**
 * AETHER GT — Intro gate (no Three.js; tiny, safe to import anywhere).
 *
 * The assembly intro plays only when a visitor opens a car from the Collection page.
 * collection.js calls armIntro() on the click; the car page calls shouldPlayIntro()
 * once, which consumes the flag. A refresh, a direct link, the header menu, the
 * footer, the previous/next links and back/forward therefore never replay it.
 *
 * Overrides for testing and sharing:  ?intro=on  forces it,  ?intro=off  disables it.
 * prefers-reduced-motion always wins: no intro, no override.
 */

const KEY = 'aether:intro';
const MAX_AGE_MS = 20000;

/** Remember that the next page load is a Collection → car navigation. */
export function armIntro(vehicleId) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ id: vehicleId, at: Date.now() })); } catch { /* storage blocked: no intro */ }
}

function consume(vehicleId) {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return false;
    const flag = JSON.parse(raw);
    return flag.id === vehicleId && Date.now() - flag.at < MAX_AGE_MS;
  } catch { return false; }
}

/** @param {{ id: string }} vehicle */
export function shouldPlayIntro(vehicle) {
  let param = null;
  try { param = new URLSearchParams(location.search).get('intro'); } catch { /* ignore */ }
  const armed = consume(vehicle.id);          // always consume, so a stale flag cannot linger
  if (param === 'off') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.scrollY > 8) return false;       // reloaded mid-page: do not yank the visitor back to the top
  return param === 'on' || armed;
}
