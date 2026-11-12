/**
 * AETHER GT — Boot guard (classic script, loaded before the modules).
 *
 * 1. Flags browsers without cross-document View Transitions (`no-vt`) so CSS and
 *    js/ui/transitions.js can use the fade fallback instead.
 * 2. Watchdog for pages with a loading screen: if the 3D modules never start
 *    (CDN blocked / offline) the visitor is not left behind the loader.
 *    bootstrap.js sets window.__aetherBooted as soon as its imports resolved.
 * 3. window.__aetherFail(message) lets page scripts do the same on a known error.
 */
(function () {
  var root = document.documentElement;
  if (!('CSSViewTransitionRule' in window)) root.classList.add('no-vt');

  function fail(message) {
    var loader = document.querySelector('[data-loader]');
    if (loader) loader.hidden = true;
    root.classList.remove('is-loading');
    root.classList.add('no-webgl');
    var note = document.querySelector('[data-webgl-fallback]');
    if (note) {
      note.textContent = message || 'The 3D experience could not start. Check your connection and reload the page.';
      note.hidden = false;
    }
  }
  window.__aetherFail = fail;

  setTimeout(function () {
    if (window.__aetherBooted) return;
    if (!document.querySelector('[data-loader]')) return; // not a 3D page
    fail();
  }, 30000);
})();
