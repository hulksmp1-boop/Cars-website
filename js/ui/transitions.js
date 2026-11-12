/**
 * AETHER GT — Page transitions.
 *
 * Browsers with cross-document View Transitions (Chromium 126+) animate
 * navigation natively (`@view-transition` in css/chrome.css), so nothing is
 * needed here. Everywhere else (`html.no-vt`, set by boot-guard.js) internal
 * links fade the page out before navigating; the next page fades in via CSS.
 */

export function initPageTransitions() {
  const root = document.documentElement;

  // Coming back through the back/forward cache must not show a faded-out page.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) root.classList.remove('is-leaving');
  });

  if (!root.classList.contains('no-vt')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest && event.target.closest('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // in-page anchor
    if (/\.[a-z0-9]+$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return; // real files navigate normally; pages may be clean URLs with no extension

    event.preventDefault();
    root.classList.add('is-leaving');
    setTimeout(() => location.assign(url.href), 260);
  });
}
