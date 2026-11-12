/**
 * AETHER GT — URL map (single source of truth for the five clean car URLs).
 *
 * Used by tools/serve.mjs and tests/clean-urls.test.mjs. The hosting-config generator planned for the next
 * Phase 8 step will read this same map so every host (Netlify/Cloudflare, Vercel, Apache, nginx) agrees.
 */
export const CARS = [
  { slug: 'bmw-m5',       id: 'bmw-m5-f90' },
  { slug: 'porsche-911',  id: 'porsche-911-carrera-4s' },
  { slug: 'nissan-gt-r',  id: 'nissan-gt-r-r35' },
  { slug: 'toyota-supra', id: 'toyota-gr-supra-mk5' },
  { slug: 'corvette-c8',  id: 'chevrolet-corvette-c8' },
].map((c) => ({ ...c, url: `/cars/${c.slug}`, file: `cars/${c.slug}.html` }));

/**
 * Permanent (301) redirects for every URL that existed before Phase 8A, plus the .html and trailing-slash
 * variants of the new URLs. Query strings (?3d=off, ?intro=on) are always carried over.
 * Other pages are unchanged in Phase 8A: '/', '/collection.html', '/404.html'.
 */
export const REDIRECTS = CARS.flatMap(({ slug, url }) => [
  { from: `/${slug}.html`,       to: url, why: 'Phase 7 URL (file in the site root)' },
  { from: `/${slug}`,            to: url, why: 'extensionless variant of the Phase 7 URL' },
  { from: `/cars/${slug}.html`,  to: url, why: 'file URL of the new location' },
  { from: `/cars/${slug}/`,      to: url, why: 'trailing slash' },
]);
