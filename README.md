# AETHER GT

Cinematic 3D automotive showcase. HTML, CSS, vanilla JavaScript ES modules, Three.js, GSAP + ScrollTrigger. No build step, no backend.

**Status:** Editorial Homepage (replaces the cancelled Phase 03 cinematic intro; see "Editorial homepage" below). Redesign 02 (individual car pages redesigned; see "Redesign 02: car pages" below). Redesign 01 (visual foundation + editorial collection page). Phase 05 — BMW verification and polish (see "Phase 05 verification status" below: the live 3D render is still unverified). Phase 04 — premium collection page. Seven HTML pages share one set of CSS and JS modules. The BMW page has the full 3D experience from Phase 02; the collection page is now a designed showroom; the Porsche, Nissan, Toyota and Chevrolet pages have the same 3D experience and a dossier (Corvette: Aether GT phase 3, final car page).

## Run locally

ES modules and import maps do not work from `file://`. Serve the folder over HTTP, then open the printed address:

```bash
node tools/serve.mjs             # then visit http://localhost:8080  (--port 3000 to change it)
```

Use `tools/serve.mjs`, not `python3 -m http.server`: the car pages live at clean URLs (`/cars/bmw-m5`, no `.html`), and a plain static server answers those with 404. The reference server maps the clean URLs to the files in `cars/` and applies the old-URL redirects described in "Clean URLs" below. (`npx serve .` also serves clean URLs, but it has not been checked against this project.)

Three.js (0.170.0) and GSAP (3.12.5) load from jsDelivr through the import map in `index.html`, and the Draco decoder (needed by the compressed BMW model) loads from the same CDN (`DRACO_DECODER_PATH` in `js/config.js`), so an internet connection is required. To go fully offline, download those files and point the import map (identical on all seven pages) and `DRACO_DECODER_PATH` at local copies. If the 3D libraries cannot be loaded, the 3D page shows a notice instead of staying on the loading screen.

## Site map

| Page | File | Phase 04 state |
|---|---|---|
| Home (editorial) | `index.html` | Long editorial homepage: masthead, manifesto, the five, lead story, principles, side-by-side table, gallery, journal teasers, close. No 3D. Image slots are placeholders |
| Collection | `collection.html` | Showroom: hero, five editorial vehicle sections in fixed order, each with an Explore link to its page. No 3D, no heavy assets |
| BMW M5 F90 Competition | `cars/bmw-m5.html` | Full 3D scroll experience, plus an editorial dossier below it (Redesign 02) |
| Porsche 911 Carrera 4S | `cars/porsche-911.html` | Full 3D scroll experience plus a six-chapter editorial dossier, same architecture as the BMW page (see "Porsche 911 Carrera 4S page" below) |
| Nissan GT-R R35 | `cars/nissan-gt-r.html` | Full 3D scroll experience plus a seven-chapter editorial dossier, same architecture as the BMW and Porsche pages (see "Nissan GT-R R35 page" below) |
| Toyota GR Supra MK5 | `cars/toyota-supra.html` | 3D scroll-orbit page and seven-chapter dossier (Aether GT phase 3: Supra), `css/toyota-gr-supra.css`, `js/scene/shots/toyota-gr-supra-mk5.js` |
| Chevrolet Corvette C8 Stingray | `cars/corvette-c8.html` | 3D scroll-orbit page and seven-chapter dossier for the 2020 Stingray coupe, 6.2 L LT2 V8, 8-speed dual-clutch (Aether GT phase 3: Corvette), `css/chevrolet-corvette-c8.css`, `js/scene/shots/chevrolet-corvette-c8.js`; GLB turned -90° (nose on -Z in the file) |

Every page has its own HTML file, its own renderer (3D pages only) and its own scroll camera. Pages share CSS, header, footer and the JS modules below. The vehicle list, page names and model specs live in `js/config.js`; the header, footer and model credits are generated from it by `js/ui/site-chrome.js`.

## Structure

```
index.html, collection.html, 404.html   Site root pages
cars/                 The five car pages (bmw-m5, porsche-911, nissan-gt-r, toyota-supra, corvette-c8 .html)
                      Same import map on every page; tests enforce it. Served at /cars/<slug> (see "Clean URLs")
tools/                serve.mjs (local server + routing), url-map.mjs (clean URLs and redirects), hosting-config.mjs (generates the host files), prepare-launch.mjs
_headers, _redirects, vercel.json, .htaccess, deploy/nginx.conf
                      Generated host configuration (Phase 8B). Do not edit by hand; see "Hosting configuration"
css/
  tokens.css          Design tokens (colour, type, spacing, motion, layers)
  base.css            Reset, document defaults, accessibility
  layout.css          Stage, header, hero
  chrome.css          Shared: footer, nav, page transitions        (all pages)
  pages.css           Shared button styles
  home.css            Editorial homepage (index.html) and its image slots
  vehicle.css         Redesign 02: the five car pages (shared parts + one block per car)
  collection.css      Cover, contents, five editorial chapters, frames (collection page)
  loader.css          Loading screen                              (3D pages)
  car.css             Scroll track, HUD, atmosphere, notices      (3D pages)
js/
  boot-guard.js       Classic script: View Transition detection + load watchdog
  config.js           SITE, VEHICLES, MODELS (per-car specs), stage settings
  pages/
    home.js           Homepage entry (header/footer, transitions, reveal; no 3D, no downloads)
    collection.js     Collection entry
    car.js            Entry for all five car pages; loads the 3D bootstrap only if the car has a model
  core/
    bootstrap.js      3D car page boot: loader, stage, studio, vehicle, director, error/retry
    stage.js          Three.js renderer, scene, camera, on-demand render, resize
    quality.js        Device quality tiers
    motion.js         GSAP + ScrollTrigger registration, scroll progress
    loader.js         Loading screen controller (weighted real progress)
    asset-queue.js    Idle-gated background downloads (progressive loading)
  scene/
    studio.js         Lights, reflection room, floor, backdrop
    contact-shadow.js Baked contact shadow
    vehicle.js        GLB download/decode, normalisation, GPU warm-up, dispose
    camera-rig.js     Camera path maths (pure, no Three.js)
    sequence.js       Scroll progress -> vehicle segment / hand-off (pure)
    director.js       ScrollTrigger scrub -> camera, car spin, HUD
    shots/            One keyframe file per vehicle + index.js registry (BMW so far)
  ui/
    site-chrome.js    Shared header, nav, footer, CC BY credits
    transitions.js    Fade fallback for page navigation
    showroom.js       Collection: scroll reveal, rail tracking, pointer parallax
    hud.js            Identification, chapter captions, rail
    reveal.js         Scroll reveal for the car pages (one IntersectionObserver)
tests/                camera, model (real GLB), pages, vehicle-pages, home and asset-queue tests (node tests/run-all.mjs)
tools/                render-check.cjs: real-browser render check for the BMW page (needs internet + Playwright)
assets/models/        .glb vehicle models: bmw-m5-f90, porsche-911-carrera-4s, nissan-gt-r-r35 and toyota-gr-supra-mk5 (wired), and chevrolet-corvette-c8 (all five wired)
assets/fonts/         Self-hosted Inter and Lora (WOFF, Latin subset)
```

## Page transitions

Browsers with cross-document View Transitions (Chromium 126+) animate navigation natively (`@view-transition` in `css/chrome.css`); the header stays fixed while the page cross-fades. Other browsers get a fade-out on click and a fade-in on arrival (`js/ui/transitions.js`, switched on by `html.no-vt`). Both are disabled for `prefers-reduced-motion`. Modifier-clicks, new-tab links and in-page anchors are never intercepted.

## Progressive loading (prepared for the five-car intro)

`js/core/asset-queue.js` downloads files in the background without disturbing animation:

- one download at a time, in priority order, using low network priority;
- a download only starts when there has been no scroll, touch or key input for 600 ms, and the connection is not Data Saver or 2G/3G;
- it re-checks before reading every chunk and simply stops reading while the user is active, so the transfer pauses and resumes without restarting;
- it only fills the HTTP cache. Decoding and GPU upload stay in `vehicle.js`, on demand, so background work cannot cause frame drops.

Background loading is enabled only on capable desktops (`quality.backgroundLoading`): never on phones/tablets (coarse pointer), the low tier or Data Saver. The homepage no longer uses it (the cinematic intro was cancelled); the module and its tests are kept for later use.

## Phase 02: how the scroll camera works

The BMW page's scroll track (`.showcase`, 820svh tall, see `css/car.css`) is a scroll track. `js/scene/director.js` creates **one GSAP timeline scrubbed by ScrollTrigger** that tweens a single `progress` value from 0 to 1 (linear ease, `scrub: 1` for a one-second inertia). On every update the camera path is *sampled* at that progress; there is no chain of separate tweens, so there are no stop-start moments at keyframes. Scrolling back scrubs the same timeline in reverse.

The path (`js/scene/shots/bmw-m5-f90.js`) is a list of keyframes in the **car's own frame**: orbit angle (`view`), distance, height, field of view, look-at target and a controlled turntable `spin` of the car. `js/scene/camera-rig.js` interpolates each channel with a monotone cubic spline (smooth speed, no overshoot) and converts the result to a world pose. Because orbit angle, distance and height are interpolated separately, the camera moves on arcs around the car and can never cut through it. The car turns slightly (up to 30°) while the camera orbits, so the reflections sweep across the paint. A full 360° orbit starts and ends on the same hero pose.

Portrait screens pull the camera back (`framingScale`) and shift the car up (`compositionShift`) so it stays fully in frame with room for captions.

Rendering is on demand: `stage.invalidate()` marks the scene dirty, the single GSAP ticker draws only dirty frames, and the page footer is opaque so it covers the fixed canvas and HUD at the end of the page.

### Tuning

- Camera moves: edit keyframes in `js/scene/shots/bmw-m5-f90.js`, then run `node tests/run-all.mjs`.
- Scroll length / inertia: `--showcase-length` in `css/car.css`, `SHOWCASE.scrubSmoothing` in `js/config.js`.
- Studio lights and reflections: `js/scene/studio.js` (`DEFAULT_LIGHTING`, the `panel(...)` calls build the reflection room).
- Quality: tiers in `js/core/quality.js`. Force one with `?quality=low|medium|high`. The renderer also lowers its resolution automatically if frames stay slow.

## Preparing for the next vehicles (not implemented yet)

Nothing here loads or fakes another car. What is in place so Phase 03+ can add them cleanly:

- **Normalised rig** (`js/scene/vehicle.js`): every GLB is oriented nose to +X, uniformly scaled to `STAGE.fitLength`, centred, and set on y = 0, so scale, ground contact and centre match between cars. Per-car fixes live in `MODELS[id]` (`orientationY`).
- **Matched hand-off pose**: each shot starts and ends on the same hero pose (checked in the tests), so the end of one car and the start of the next share camera, scale and rotation.
- **Sequence map** (`js/scene/sequence.js`): maps global scroll progress to `{ index, local, transition: { from, to, u } }`. With one vehicle it is a pass-through; with five, `transition` reports the hand-off window.
- **Lighting presets** (`studio.setLighting({...})`): exposure, environment, key, rim intensity and rim colour can be tweened per vehicle.
- **Per-vehicle baked shadow** (`studio.attachVehicle(rig)`) and `rig.dispose()` for unloading a car.

Geometry morphing between different GLBs is not practical (different topology), so the plan is a cinematic hand-off: matched camera, a lighting preset blend and a light sweep at the moment of the swap, never a plain fade or pop.

## Clean URLs (Phase 8A)

The five car pages moved from the site root into `cars/` and are published without `.html`:

| Car | File | Public URL |
|---|---|---|
| BMW M5 F90 Competition | `cars/bmw-m5.html` | `/cars/bmw-m5` |
| Porsche 911 Carrera 4S | `cars/porsche-911.html` | `/cars/porsche-911` |
| Nissan GT-R R35 | `cars/nissan-gt-r.html` | `/cars/nissan-gt-r` |
| Toyota GR Supra MK5 | `cars/toyota-supra.html` | `/cars/toyota-supra` |
| Chevrolet Corvette C8 Stingray | `cars/corvette-c8.html` | `/cars/corvette-c8` |

`index.html` (`/`), `collection.html` and `404.html` are unchanged in this phase.

**Paths.** Because a car page now sits one folder deep, its CSS, JS, image, icon, manifest and model paths are root-absolute (`/css/car.css`, `/assets/models/...`). `js/config.js` (`VEHICLES[].page`, `MODELS[].url`, `SITE`) uses the same form. The site must therefore be served from the root of a domain.

**Hosts must serve the clean URLs.** `/cars/bmw-m5` has to return `cars/bmw-m5.html` with status 200. `tools/serve.mjs` does this for local work. For production this is a hosting setting: Phase 8B generates the configuration for Cloudflare Pages, Vercel, Apache and nginx (see "Hosting configuration" below, including what is and is not verified). None of it has been run on a real host yet.

**Redirect plan (301, query string kept).** The single source is `tools/url-map.mjs`. For every car, four URLs redirect to the clean one:

| Old or variant URL | Redirects to |
|---|---|
| `/bmw-m5.html` (the Phase 7 URL) | `/cars/bmw-m5` |
| `/bmw-m5` | `/cars/bmw-m5` |
| `/cars/bmw-m5.html` | `/cars/bmw-m5` |
| `/cars/bmw-m5/` | `/cars/bmw-m5` |

The same four apply to the other four slugs (20 rules). `?3d=off`, `?3d=on` and `?intro=on` survive the redirect. The redirect target never redirects again.

**What the Collection to car assembly relies on.** The click handler in `js/pages/collection.js` recognises a car link by its normalised path (`/cars/<slug>`, with or without `.html` or a trailing slash). The assembly animation itself, its gate and the 3D engine are untouched.

## Hosting configuration (Phase 8B)

One generator, one source. `tools/url-map.mjs` defines the clean URLs and the 20 redirects; `tools/hosting-config.mjs` turns them into every host's format, so the hosts cannot drift apart.

```bash
node tools/hosting-config.mjs            # write the five files
node tools/hosting-config.mjs --check    # exit 1 if a committed file is stale (also run by the tests)
```

| Generated file | Host | Notes |
|---|---|---|
| `_redirects`, `_headers` | Cloudflare Pages (same format on Netlify, not checked) | 20 explicit 301 rules; cache lifetimes |
| `vercel.json` | Vercel | 16 explicit 301 rules, 5 rewrites for the clean URLs, `trailingSlash: false`, cache headers |
| `.htaccess` | Apache | mod_rewrite, mod_mime, mod_headers |
| `deploy/nginx.conf` | nginx | a complete `server {}` block to include from `http {}`; set `server_name`, `root` and TLS |

`prepare-launch.mjs --dist` copies `_headers`, `_redirects`, `vercel.json` and `.htaccess` into the deployable folder (they must sit at its root). `deploy/nginx.conf` stays in the repository: it is server configuration, not site content. To change a redirect, edit `tools/url-map.mjs`, run the generator, commit the result. Hand edits are overwritten and the tests fail on a stale file.

**What the files do (Phase 8B scope only).** Serve `/cars/<slug>` from `cars/<slug>.html` with status 200; redirect the 20 old and variant URLs once, with 301, to the clean URL; keep the query string (`?3d=off`, `?intro=on`); set cache lifetimes (HTML, CSS and JS must revalidate because the files are not fingerprinted; images, fonts, GLB models and icons for 7 days); declare the MIME types the site needs on Apache and nginx. Security headers, CSP and SEO are not included: they are later phases.

**Loop prevention.**
- The data is checked before any file is written: no redirect points at itself or at another redirect source, sources are unique, every target is a clean car URL and carries no query of its own.
- Apache: the internal rewrite `/cars/x` to `cars/x.html` would be matched again by the `cars/x.html` redirect. Every redirect therefore tests `%{THE_REQUEST}` (the original request line, which an internal rewrite does not change). The test simulates the rules and shows the loop appears without that condition.
- nginx: exact-match locations only; `try_files /cars/x.html =404` serves the file in place, so the clean URL never reaches its own `.html` redirect. `absolute_redirect off` keeps redirects relative, so a proxy in front cannot produce a wrong scheme or port.
- Vercel: no `cleanUrls` (it would also redirect `/collection.html`). The four trailing-slash redirects are not written as rules, because a source ending in `/` might also match its own target; `trailingSlash: false` makes Vercel do that redirect itself, so on Vercel those four answer with Vercel's own redirect status (expected 308, not 301) instead of 301.
- Cloudflare Pages: the docs state that only the first matching rule applies and that rules do not chain. Targets never match a source anyway.

### Hosting compatibility: verified and unverified

Verified in this project (by `tests/hosting-config.test.mjs`, no host software involved): generated files are current; they contain exactly the url-map redirects; Cloudflare, Apache and nginx rules, simulated, plus `tools/serve.mjs`, give the same answer for all 20 URLs (301 to the same clean URL, query kept on Apache and nginx), serve the five clean URLs with 200, and end after one hop; the cache table and MIME table agree across the four formats and cover every file in the site; Cloudflare's published limits are respected (2,000 static redirects, 1,000 characters per line, 100 header rules).

Verified against Cloudflare's own documentation (read for Phase 8B): the `_redirects` and `_headers` format and location; explicit 301 is supported (default would be 302); limits as above; the first matching rule applies and rules do not chain; redirects are applied even when a file exists at the path; redirects run before headers; a source with a trailing slash is a separate rule (the docs' own examples use one); `404.html` is used automatically; rules do not apply to Pages Functions (this site has none).

**Not verified. Check each before relying on it:**

| Item | State |
|---|---|
| Cloudflare Pages redirects `/collection.html` to `/collection` | Reported by secondary sources quoting Cloudflare's "Serving Pages" page (the page itself could not be read in full). If true, every visit to `/collection.html` takes one extra 308 and the canonical URL and sitemap entry (`/collection.html`) differ from the final URL. The generated files cannot switch this off. Needs a live check and a decision in a later phase (make `/collection` the URL everywhere, or accept the hop). The car URLs are not affected: our 301 rules take priority |
| Cloudflare Pages serves `/cars/<slug>` from `cars/<slug>.html` without a rule | Expected from the same extensionless behaviour; not confirmed from the official page |
| Cloudflare keeps the query string on `_redirects` 301s | Not stated on the Cloudflare page that was read. Test: `curl -sI "https://<site>/cars/bmw-m5.html?3d=off"` must show `location: /cars/bmw-m5?3d=off` |
| Vercel (everything) | Syntax follows Vercel's documented fields, but nothing was run. Unchecked: `statusCode: 301`, query pass-through, `trailingSlash: false` behaviour and status, rewrite to the `.html` file |
| Apache `.htaccess` | Never executed (no Apache here). Run `apachectl configtest` and request all 20 URLs with a query. A wrong directive in `.htaccess` makes Apache answer 500 for the whole site |
| nginx `deploy/nginx.conf` | Never executed (no nginx here). Run `nginx -t`, then request the 20 URLs. It defines its own `types {}`, which replaces the inherited MIME list for this server |
| `.glb`, `.webmanifest` MIME type on Cloudflare and Vercel | Not set by the generated files; relies on the host's defaults |

### GitHub Pages

GitHub Pages cannot use any of the generated files. This is from general knowledge and was not re-checked against GitHub's documentation for Phase 8B.
- There are no server redirects: `_redirects`, `vercel.json` and `.htaccess` are ignored, so the 20 old URLs cannot return 301. A meta-refresh or JavaScript stub page is only a workaround: it answers 200, search engines treat it more weakly, and the query string needs extra code.
- No custom response headers: cache lifetimes cannot be set (and neither can the later security headers).
- Clean URLs depend on GitHub's own handling of `.html` files; check `/cars/bmw-m5` after deploying.
- The site needs the root of a domain. A project site at `user.github.io/repo/` breaks every root-absolute path; use a custom domain or a `user.github.io` repository.
- `404.html` in the published root is used for unknown URLs.

Recommendation: use Cloudflare Pages, Vercel, Apache or nginx for production; keep GitHub Pages for previews, accepting the limits above.

### Remaining limitations

- No generated file has run on a real host (table above). The simulators in the test mirror documented behaviour; they are not the hosts.
- Cache lifetimes are conservative because files are not fingerprinted. Renaming a replaced asset is still the way to bust the 7-day cache.
- On nginx, `add_header` in a location replaces headers set at server level. When Phase 8C adds security headers they must be repeated in each location (or written through one shared include), or they will silently disappear for those paths.
- Not covered: HTTPS and `www` redirects, compression, security headers, CSP, SEO. Later phases.

## Tests

```bash
node tests/run-all.mjs
```

Node only, no dependencies, no rendering:
- `clean-urls.test.mjs`: Phase 8A: the five pages are in `cars/`, config and links use clean URLs, car pages use root-absolute asset paths that all exist, page transitions and the Collection to car assembly trigger match clean URLs, and a real HTTP check against `tools/serve.mjs` (200 on clean URLs, 301 with query string kept for every old URL, GLBs byte-identical, 404 page for unknown paths). It does not use a browser.
- `hosting-config.test.mjs`: Phase 8B: the five generated host files are current and come from `tools/url-map.mjs`; the same 20 redirects and 5 clean URLs on every host (simulated Cloudflare, Vercel, Apache, nginx, and `tools/serve.mjs`); query string kept; no loops (including the Apache loop the `THE_REQUEST` guard prevents); cache and MIME policy identical across formats; no security headers or SEO in scope; `--dist` packaging. It runs no host software.
- `vehicle-pages.test.mjs`: Redesign 02: every page has identity, specs, highlights, story, journey and footer; previous/next follow the lineup; compositions differ; no photography or fake 3D; figures are qualified with flags; chart agrees with the ledger; BMW engine files are byte-identical to Redesign 01; no glow or heavy effects; reduced-motion gating; accessibility basics.
- `camera.test.mjs`: the camera path is continuous, the first and last poses match, the whole car stays in frame at seven aspect ratios (21:9 to 9:19.5) and the camera never enters it; the sequence map works for one and five vehicles.
- `pages.test.mjs`: all seven pages exist with unique titles and one `h1`, identical import maps, every local link resolves, shared stylesheets, the BMW headline, BMW first in the lineup, only the BMW model shipped, collection markup matches `config.js` (order, names, links, only the BMW labelled live), lightweight collection CSS, reduced-motion gating, non-3D pages never import three.js or GSAP.
- `model.test.mjs`: reads the real `bmw-m5-f90.glb` (no decoding): container valid, required extensions supported by GLTFLoader, nose at +X, real M5 size, the one malformed mesh is the only outlier, normalised car fits the camera test's box, CC BY credit kept.
- `asset-queue.test.mjs`: priority order, one download at a time, no start while busy, pause and resume mid-download, Data Saver gate, failure and cancel handling.

## Phase 05 verification status

Phase 05 ran in a sandbox that could not reach any CDN, so Three.js, GSAP and the Draco decoder could not be loaded. Consequently **the BMW has still never been rendered in a browser by this project's code.**

Verified for real (Chromium via Playwright, real files):
- the GLB itself: structure, extensions, orientation, size, the malformed mesh, attribution (`tests/model.test.mjs`);
- the page when the CDN is unreachable: loader dismissed in about 0.5 s, notice shown, no horizontal scroll, header and CC BY credit intact;
- the `model-failed` and `no-webgl` layouts, loader screen and HUD (real `hud.js` and CSS, driven by a stand-in scroll listener) at 1440x900, Pixel 5, 360 px and 320 px, including scrolling back;
- camera path maths, including reverse scrolling.

Not verified: the rendered car, lighting, reflections, baked shadow, GSAP/ScrollTrigger scrub, loader progress with a real download, the retry button end to end, frame rate.

**To close this gap**, serve the folder and run `node tools/render-check.cjs` on a machine with internet (see the header of that file), then open the PNGs it writes.

Fixed in Phase 05: contact-shadow height pass had no depth buffer (see `contact-shadow.js`); HUD "Scroll" cue showed over an empty page after a failed model load; fixed failure notices covered the hero title on short phones.

Known gaps: there is only one CDN (jsDelivr) and no local fallback copy, so a CDN outage shows the notice and the page stays without 3D (to self-host, follow "Run locally"); the 30 s load watchdog in `boot-guard.js` only covers the library imports, and a connection slower than that ends in the fallback notice even if the libraries arrive later; all 96 BMW materials are double-sided in the source file (a possible cost on weak GPUs, left unchanged because it cannot be judged without rendering).

## Redesign 02: car pages

Five pages, one identity, five compositions (`css/vehicle.css`, one block per car):

| Car | Composition |
|---|---|
| 01 BMW M5 F90 | Untouched 3D scroll showcase (hero gains a quiet facts line and a jump line), then an opaque **dossier**: statement and key figures, sticky-chart specification ledger, numbered highlights, pull-quote story |
| 02 Porsche 911 | Giant `911` overlapping a frame bleeding off the right edge; statement; figures strip; sticky portrait frame beside staggered highlights; two-column ledger; drop-cap, three-column story |
| 03 Nissan GT-R | Full-bleed cinematic frame with the title over it; sticky specification heading beside a long ledger; three hairline-divided highlight columns; a timeline |
| 04 Toyota GR Supra | Title across the full width; asymmetric margin-note story; 3.0 vs 2.0 comparison table; `<details>` disclosure list for highlights |
| 05 Chevrolet Corvette | Centred spread; "Where everything sits" component order (not to scale); figures grid; C8 family variants table; stacked highlights |

Shared on every page: folio, `.eyebrow`, serif statements, `.ledger` specification rows, `.scale` proportions chart, `.figures`, `.plate` vehicle frame, `.journey` (previous / next in collection order, wrapping, plus return to the collection), the generated header and footer.

**BMW integration.** No engine file changed (the tests compare SHA-256 hashes against Redesign 01). `cars/bmw-m5.html` only gained `css/vehicle.css`, a facts line and a jump line inside the hero, and the dossier after the scroll track. The dossier is opaque and sits above the fixed HUD (`body[data-vehicle="bmw-m5-f90"] main { z-index: auto }`, `.dossier { z-index: 3 }`), exactly like the footer, so the canvas and HUD are covered when the track ends. Remove the `.dossier` block and the `vehicle.css` link to return to the Redesign 01 page.

**Specifications are qualified, not invented.** Every page has a `.spec-note`. `Varies` marks a figure that changes with market, model year or option; `To confirm` marks a detail that is not established and must be checked against the manufacturer's current documentation. The figures were compiled from general knowledge of manufacturer data and were **not** checked against live sources while building (no network). Treat every figure as unverified until reviewed. The proportions chart uses one shared scale (5,000 mm = full bar) on all five pages and is a dimension chart, not a drawing of a car; the tests check it matches the ledger.

### Car page imagery (Phase 4: the five photographs are in place)
Each of the four static pages has `<figure class="plate ...">` frames (the hero frame, plus one more on the Porsche page). Add `has-image` to the class list and an `<img src alt width height loading="lazy" decoding="async">` as the first child; the placeholder surface, marks and caption hide automatically. Then relax the "no photography" check in `tests/vehicle-pages.test.mjs`.

## Porsche 911 Carrera 4S page

`cars/porsche-911.html` is a copy of the BMW page's structure with Porsche content: the same loader, canvas, HUD and scroll track (`js/pages/car.js` -> `core/bootstrap.js`), then a six-chapter dossier (opening and car story, engine and performance, technical specification, exterior and engineering, driving character, closing). No engine file was rewritten; what the Porsche needed is data:

- `js/config.js` `MODELS['porsche-911-carrera-4s']`: `orientationY: 90` (the GLB's nose is on +Z), `hideMeshes: ['Plane_0']`, expected size, CC BY-SA credit (shown in the footer automatically).
- `js/scene/vehicle.js`: one small addition. `spec.hideMeshes` hides named helper meshes before the car is measured (BMW has none, so it is unaffected). `Plane_0` is a flat baked-shadow card under the Porsche (2.75 x 5.1 m, zero thickness); left in, it would distort the measured size and show as a hard-edged rectangle beside the site's own contact shadow. The car's own meshes are untouched.
- `js/scene/shots/porsche-911-carrera-4s.js`, registered in `shots/index.js`: a 360 degree orbit with the same hero pose at both ends, lower camera heights for the 911's lower roof and a longer look at the tail and engine lid.
- Styling: `css/bmw-m5.css` (the shared `.bx-*` editorial layer, linked unchanged) plus `css/porsche-911.css` (the stacking rule the BMW gets from `vehicle.css`, a 7,500 rpm torque chart, the flat-six figure label, a four-option rung). Enhancements: `js/ui/bmw-editorial.js`, unchanged.
- Figures are Porsche press and Porsche Finder data for the first series of the Type 992 Carrera 4S (2018-2024). The 2025 update has 480 PS; the page says so. `Varies` and `To confirm` flags follow the BMW page's convention.
- Tests: `node tests/porsche-page.test.mjs` (GLB header and bounds, orientation, camera framing, page hooks). The older freeze tests were updated where the Porsche page intentionally changed them (new hashes for `config.js`, `vehicle.js`, `shots/index.js`; `cars/porsche-911.html` no longer frozen).

Not verified (no network, no browser in the build sandbox): the model has not been rendered. The GLB is Draco-compressed and could not be decoded here, so mesh bounds come from the file's accessor data. The model has 653k triangles (BMW 260k) and a transmissive headlamp material, so check frame rate on a phone first. If the tail looks wrong, look at `Plane.002_0`: it is a paint-coloured rear panel that reaches 0.43 m behind the main body shell.

## Visual identity (Redesign 01)

Luxury automotive editorial x minimalist performance luxury. Deep black, graphite, warm ivory, one metallic champagne accent. Lora (serif) for names and statements, Inter for labels and body, both self-hosted in `assets/fonts/` (OFL, no font CDN). No blue, no glow, no outlined type.

- **Tokens** (`css/tokens.css`): colour ramps (`--color-bg`, graphite, ivory text ramp, `--color-accent`, `--metal-rule`, `--metal-hairline`), type scale (`--text-display` for editorial statements), 8 px spacing, `--space-section`, `--column-gap`, motion durations. `--color-bg` is unchanged (`#050506`) because the BMW scene reads it.
- **Shared components**: header (wordmark + one link), `.explore` link, `.button`, `.eyebrow`, footer (wordmark, the five cars in order, site links, CC BY credits; built in `js/ui/site-chrome.js`), all inherited by the seven pages.
- **Responsive rules**: phone (<48rem) one column, frames full-bleed; tablet (48-64rem) image then two-column copy; desktop (>=64rem) 12-column compositions. Rail index only >= 100rem.
- **Motion**: slow ease-out reveals, hover light shift on fine pointers; transform/opacity only; all off for `prefers-reduced-motion`.

## Collection page

`collection.html` is static HTML (readable without JavaScript). A cover with a contents list, then five chapters in fixed order, each composed differently (layouts a-e in `css/collection.css`). `js/ui/showroom.js` only adds reveal on scroll, the side rail and a small pointer light shift.

No car photography exists in the project yet, so each chapter shows a **frame**: a graphite studio surface with crop marks and a caption (`Studio imagery to follow`, or `Live 3D experience` for the BMW). It is a labelled placeholder, not a picture of a car.

### Collection imagery (Phase 4: the five photographs are in place)
The five collection photographs live in `assets/images/` (`bmw-m5.jpg`, `porsche-911.jpg`, `nissan-gtr.jpg`, `toyota-supra.jpg`, `corvette-c8.jpg`), each in its card's `<a class="frame has-image">`; crop focal points are the `--focus` values in `css/collection.css`. To add or replace one: put the file in `assets/images/` (about 150-250 KB WebP, 16:11 or the chapter's ratio), then in that car's `<a class="frame ...">` add `has-image` to the class list and an `<img src="..." alt="..." width height loading="lazy" decoding="async">` as first child; the placeholder surface, marks and caption hide automatically. Set `visual.image` in `js/config.js` to the same path. The collection test currently asserts that no images are shipped; relax that check at the same time. Real GLBs are not loaded on this page.

## Adding the next car (Phases 06 to 09)

1. Put its GLB in `assets/models/` and add a `MODELS[id]` entry in `js/config.js` (orientation, expected size, credit).
2. Add `js/scene/shots/<car>.js` (start and end on the shared hero pose) and register it in `shots/index.js`.
3. Turn its page into a 3D page by copying `cars/bmw-m5.html` (loader, canvas, HUD, track) and changing the car id, title and headline.
4. Extend the camera tests to cover the new shot.

## Editorial homepage

`index.html` is a long automotive editorial page (deep black, graphite, warm ivory; Lora + Inter; restrained reveals). It loads no Three.js, GSAP, canvas, model or background download. Everything is static HTML and CSS; `js/pages/home.js` only mounts the shared header and footer, page transitions and scroll reveal (skipped for `prefers-reduced-motion`; nothing is hidden without JS).

Sections: Masthead, Manifesto, In this issue (the five), Lead story (BMW M5), Three principles, Side by side (engine and length table, one scale), Portfolio (gallery), Journal (three teasers that link to the existing `#story` sections of car pages; there is no separate journal page), Closing. Figures are repeated from the car pages; the tests check the lengths agree.

### Homepage image slots

Every picture is a `.slot` (see the top of `css/home.css`): a frame with a fixed aspect ratio, so a real photograph or a rendered GLB still can replace the placeholder without changing the layout. To fill one: add `has-image` to the `.slot` and put `<img src alt width height loading="lazy" decoding="async">` as its first child. The placeholder surface, marks and label hide automatically. Each slot has `--ratio` (tablet and desktop), `--ratio-sm` (under 48rem) and `--focus` (crop focal point, e.g. `70% 55%`). Then relax the "no `<img>` shipped yet" check in `tests/home.test.mjs`.

| Slot | Where | Ratio (small screens) | Recommended size |
|---|---|---|---|
| H1 | Masthead, full-bleed cover crop (keep the subject in the right half; the lower third sits under a dark scrim) | cover (3:4) | 2400 x 1350 or larger |
| C1-C5 | "In this issue" cards, BMW, Porsche, Nissan, Toyota, Corvette | 3:4 (4:3) | 1200 x 1600 |
| F1 | Lead story, main image | 3:2 (4:3) | 2400 x 1600 |
| F2 | Lead story, detail | 4:5 | 1200 x 1500 |
| G1, G4 | Gallery, wide and landscape | 3:2 (4:3), 16:9 (4:3) | 2400 x 1600, 2400 x 1350 |
| G2, G3 | Gallery, portrait | 4:5 | 1200 x 1500 |
| J1-J3 | Journal teasers | 3:2 (4:3) | 1600 x 1067 |

Keep each file around 150 to 300 KB (WebP or AVIF). Rendered stills from the GLBs are fine; they are static images, not 3D on the page. Credit any model used (see Credits).

## Credits

3D model "Bmw M5 F90" by RES1N, licensed CC BY 4.0, via Sketchfab: https://sketchfab.com/3d-models/bmw-m5-f90-5478e978bd634337adc8e3dc413fbfa3 . The credit is shown in the page footer; keep it if you redistribute the site.

The Porsche 911 Carrera 4S model ("(FREE) Porsche 911 Carrera 4S" by Karol Miklas, **CC BY-SA 4.0**, https://sketchfab.com/3d-models/free-porsche-911-carrera-4s-d01b254483794de3819786d93e0e1ebf) is now shown on `cars/porsche-911.html` and credited in that page's footer. ShareAlike applies to adaptations of the model: the site loads the file unmodified (one helper mesh is hidden at runtime), but check the terms before redistributing a modified copy. The Corvette model (2019 Chevrolet Corvette C8 Stingray by Hari, CC BY 4.0) is now shown on `cars/corvette-c8.html` and credited in its footer. The other models are also in use. Their licences, to be credited when they are used: Nissan GTR R35 by Ciasny, CC BY 4.0; Toyota Supra MK5 A90 by pryanex, CC BY 4.0; 2019 Chevrolet Corvette C8 Stingray by Hari, CC BY 4.0. All four are on Sketchfab (source URLs are in each file's glTF `asset.extras`).

## Conventions

- Colours, type, spacing and motion values live in `css/tokens.css`. JS reads `--color-bg` from there.
- Import GSAP and ScrollTrigger only via `js/core/motion.js`.
- One renderer, one render loop (GSAP ticker, draws only when `stage.invalidate()` was called). Add to `stage.scene`; do not create more renderers.
- Anything the loading screen should wait for is passed to `loader.run([...])` in `core/bootstrap.js`: a Promise, or `{ weight, start(report) }` for real progress (the model download uses this).


## Road journey (homepage)

A countryside lane between "In this issue" and "Lead story" on `index.html`. `css/road.css` styles it; `js/ui/road-journey.js` (started from `js/pages/home.js`) draws the lane as inline SVG, sizes the stage by width (desktop / tablet / mobile / compact presets), places the five captions clear of the lane, and slides each car along the lane as the page scrolls (pure function of scrollY, transform only, native scrolling). Cars are transparent WebPs in `assets/road/`, cut from the approved top-down sprite sheets (nose down, soft ambient shadow baked in). `prefers-reduced-motion`: cars stay at their stations, no scroll work. Without JavaScript the section is a stacked car + caption list. While the section is under the fixed header the script sets `html.is-over-road` and the header scrim firms up.

This section was rebuilt from screenshots and sprite sheets; it is a reconstruction of the earlier Phase 2 version, not the same code.

## BMW editorial dossier

`cars/bmw-m5.html` carries a six-chapter editorial dossier below the 3D scroll track (opening, engine and performance, specification, design, driving character, closing). It is styled by `css/bmw-m5.css` and enhanced by `js/ui/bmw-editorial.js` (a classic deferred script: reveals, count-up, current-item tracking, ghost-numeral parallax). Both load on the BMW page only; the page is complete without the script. Figures were checked against BMW Group press material; items not verified are flagged "To confirm" in the page.

## Nissan GT-R R35 page

`cars/nissan-gt-r.html` follows the Porsche page's architecture exactly: one persistent canvas, the shared `js/pages/car.js` entry and `core/bootstrap.js`, a scroll-scrubbed 360° orbit, then an opaque dossier. Nothing in the engine was changed.

- **Model:** `assets/models/nissan-gt-r-r35.glb` (unchanged file). "Nissan GTR R35" by Ciasny, CC BY 4.0. Its nose points to -X, so the `MODELS` entry sets `orientationY: 180`. It has no helper geometry, so nothing is hidden. Normalised to 4.9 m it measures about 2.13 m wide and 1.43 m tall (about 3% over the real car, mirrors included in the width). It is a stand-in and is not matched to a model year.
- **Shot:** `js/scene/shots/nissan-gt-r-r35.js`, registered in `shots/index.js`. Same start/end hero pose contract as the other shots.
- **Dossier (seven chapters):** 01 introduction and history, 02 VR38DETT engine and performance, 03 technical specification, 04 exterior and engineering, 05 driving character and ATTESA E-TS, 06 specification sheet (at-a-glance grid, dimension plan, proportions), 07 closing.
- **Styles:** `css/bmw-m5.css` (shared editorial layer, unchanged) plus `css/nissan-gt-r.css` (torque chart scale, V6 figure label, timeline, specification sheet).
- **Variant:** every figure is for the GT-R Premium from the 2017 model year, European specification (419 kW / 570 PS at 6,800 rpm, 637 Nm at 3,300-5,800 rpm). The launch (2007) and NISMO outputs appear only in the engine table. Figures that differ between sources are flagged "Varies"; the one quoted figure not confirmed against Nissan's own documentation (0-100 km/h, 2.7 s, with 2.8 s in some listings) is flagged "To confirm". Figures that could not be confirmed (front tyre size, drag coefficient) are left out rather than estimated.
- **Tests:** `tests/nissan-page.test.mjs` (real GLB, MODELS entry, camera framing at six aspect ratios, page hooks, headline figures). The hash locks in `home.test.mjs` and `vehicle-pages.test.mjs` were refreshed for `config.js`, `shots/index.js` and the Nissan page only.

## Aether GT phase 3: Toyota GR Supra MK5 (A90)

`cars/toyota-supra.html` now has the same 3D experience as the BMW, Porsche and Nissan pages (shared `js/pages/car.js` and `js/core/bootstrap.js`; no new 3D code) and a seven-chapter dossier: heritage, engine and performance, specification, exterior and engineering, driving character, specification sheet, closing. It reuses the shared editorial layer (`css/bmw-m5.css`, `js/ui/bmw-editorial.js`, both unchanged) plus `css/toyota-gr-supra.css`.

- **Variant:** GR Supra 3.0, European specification (250 kW / 340 PS, 500 Nm), from Toyota Europe's technical sheet. The earlier placeholder page gave 285 kW (387 PS) for the 3.0; that is the later updated Japan-specification car, which now appears only as a labelled column in Fig. 3. The 2.0 is shown in Fig. 3 for comparison only.
- **Model:** `MODELS['toyota-gr-supra-mk5']`, `orientationY: 90` (nose on +Z in the file). The GLB is unmodified. It is a stand-in, about 15% longer and much broader than the published car, and the page says so. Credit (pryanex, CC BY 4.0) appears in the footer.
- **Shot:** `js/scene/shots/toyota-gr-supra-mk5.js`, registered in `shots/index.js`.
- **Tests:** `node tests/supra-page.test.mjs` (GLB orientation and bounds, shot framing at six aspect ratios, page hooks, figures).
- **Not verified:** live WebGL rendering of the Supra (no browser or network in the build environment); the camera framing is checked by geometry only.

## Phase 5: final polish

- Header on all seven pages: wordmark (home), Home, Collection and a native `<details>` "Cars" menu listing the five cars in order (Home is hidden under 30rem, where the wordmark serves). Built in `js/ui/site-chrome.js`, styled in `css/chrome.css`.
- Car pages skip the 3D download on Data Saver, 2G or 1 GB-class memory, showing the dossier with a "Load the 3D view anyway" link. `?3d=on` forces 3D, `?3d=off` skips it (`js/pages/car.js`).
- Pinned-hash tests updated for the changed `chrome.css`, `site-chrome.js` and `car.js`.

## Phase 7: cinematic assembly intro

Opening a car from the **Collection** plays a short intro on that car's page: the loading screen fades out over the car's real GLB parts in an exploded layout, the parts fly home in waves (low and central parts first, outer panels and glass last) while the camera eases in and the studio lights come up, then the page fades in on the normal scroll experience. About 6 s on desktop, 4.6 s on phones and low-quality devices. All five cars use it.

| File | Role |
|---|---|
| `js/scene/intro-gate.js` | Decides whether to play: armed by a click on a car link in `collection.html` (`collection.js`), consumed once via `sessionStorage`. Refresh, direct links, header/footer links, previous/next and back/forward do not replay it |
| `js/scene/assembly-plan.js` | Pure maths: per-component start offset, delay and duration from each mesh's position in the car |
| `js/scene/assembly-intro.js` | Moves the existing meshes (`position` only), drives camera, lights and overlay, hands over to the director |
| `css/intro.css` | Overlay, content hiding and page fade-in. Loaded on demand, only when the intro plays |
| `js/core/bootstrap.js`, `js/core/loader.js` | Small hooks: prepare the exploded pose after the model loads; `beforeHide` option starts the intro under the loader fade |

Behaviour
- **One model load.** The intro reuses the model the page already loads; it never fetches or parses a GLB. Geometry, materials and textures are untouched, no parts are added, scaled or rotated, and each ends exactly at its original position.
- **Skip intro** button (and Escape) runs the same assembly in 0.7 s and then hands over. The page can never get stuck: any error restores the model and shows the normal page.
- **No intro** with `prefers-reduced-motion`, `?3d=off`, low-data mode (these never start 3D), `?intro=off`, or when the page is reloaded scrolled down. `?intro=on` forces it (handy for testing or sharing a link).
- **Components** are the separate meshes in each GLB (BMW 129, Porsche 44, Nissan 82, Supra 65, Corvette 119 at the time of writing). Meshes that are hidden because they are not part of the car (the Porsche baked-shadow card, malformed BMW cluster mesh) do not take part. The Porsche has the fewest and coarsest parts, so its assembly is the least detailed.
- **Tuning** lives in `assembly-plan.js` (`SPREAD`, direction and ordering) and the `duration` and camera values at the top of `assembly-intro.js`.
- `tests/assembly.test.mjs` feeds each car's real GLB components through the plan and checks the wiring.

## Deployment

AETHER GT is a static site: no build step, no server code. Any static host works (Netlify, Cloudflare Pages, GitHub Pages with a custom domain, Vercel, S3 + CDN, nginx, Apache).

**Deploy at the root of a domain or subdomain** (`https://example.org/`, not `https://example.org/aether/`). Since Phase 8A the car pages (`cars/`) and `404.html` use root-absolute paths, and the car pages need the clean-URL setup described in "Clean URLs". `404.html` uses root-absolute paths (`/css/...`) because a host serves it for any missing URL at any depth.

### 1. Set your domain

The source ships without a domain: canonical, `og:url`, `og:image` and `twitter:image` are relative, and `sitemap.xml` / `robots.txt` contain the placeholder `YOUR-DOMAIN`. Social networks and search engines need absolute URLs, so once you know the address run (Node 18+):

```bash
node tools/prepare-launch.mjs https://your-domain.com --dist dist
node tools/prepare-launch.mjs --check        # optional: reports anything still unresolved
```

This rewrites those tags, `sitemap.xml` and `robots.txt` in place, and with `--dist` copies only the deployable files (pages, `404.html`, `css/`, `js/`, `assets/`, icons, manifest, robots, sitemap) into `dist/`, leaving out `tests/`, `tools/` and `screenshots/`. Upload `dist/` (or point the host's publish directory at it). Running it again with another domain simply replaces the old one. Without Node, edit the seven `canonical` / `og:url` / `og:image` / `twitter:image` values and the two files by hand.

### 2. Host settings

- **Generated host files:** see "Hosting configuration" above. They cover clean URLs, the 20 redirects, cache lifetimes and MIME types (404 handling is included for Apache and nginx).
- **404:** Netlify, Cloudflare Pages, GitHub Pages and Vercel serve `404.html` automatically. nginx: `error_page 404 /404.html;`. Apache: `ErrorDocument 404 /404.html`.
- **HTTPS** and a single hostname (redirect `www` to the bare domain, or the reverse) so the canonical URLs match what visitors see.
- **MIME types:** `.glb` as `model/gltf-binary`, `.webmanifest` as `application/manifest+json`, `.woff` as `font/woff`, `.webp` as `image/webp`. Most hosts already do this.
- **Compression and caching:** enable gzip/brotli for HTML, CSS and JS (the `.glb` and `.jpg`/`.webp` files are already compressed). Long cache lifetimes on `assets/` are safe if you rename a file when you replace it (the generated files use 7 days).
- **Third-party requests:** Three.js, GSAP and the Draco decoder load from jsDelivr (see "Run locally"). If you set a Content-Security-Policy, allow `cdn.jsdelivr.net` for `script-src` and `connect-src`.

### 3. After going live

- Submit `https://your-domain.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Check a link preview with the platform's debugger (Facebook Sharing Debugger, LinkedIn Post Inspector); the card image is `assets/og/aether-gt-og.jpg` (1200 x 630) for every page.
- Open a made-up URL such as `/nope` to confirm the 404 page appears with its styles.

### Launch files

| File | Purpose |
|---|---|
| `favicon.ico`, `assets/icons/` | Favicon set from the existing identity (champagne chevron on ink): SVG, 32 px PNG, ICO (16/32/48), Apple touch icon, 192/512 and maskable 512 |
| `site.webmanifest` | Name, theme colour and icons |
| `assets/og/aether-gt-og.jpg` | Social sharing card, 1200 x 630 |
| `robots.txt`, `sitemap.xml` | Crawl rules and the seven public pages (domain filled in by `prepare-launch.mjs`) |
| `404.html` | Static error page, no JavaScript, `noindex` |
| `tools/prepare-launch.mjs` | Domain, sitemap, robots and `dist/` helper |
| `tools/hosting-config.mjs` | Generates `_headers`, `_redirects`, `vercel.json`, `.htaccess`, `deploy/nginx.conf` from `tools/url-map.mjs` |
| `tests/hosting-config.test.mjs` | Checks the generated host files agree and are current |
| `tests/launch.test.mjs` | Checks titles, descriptions, social tags and launch files |
