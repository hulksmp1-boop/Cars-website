# AETHER GT

Cinematic 3D automotive showcase. HTML, CSS, vanilla JavaScript ES modules, Three.js, GSAP + ScrollTrigger. No build step, no backend.

**Status:** Phase 05 — BMW verification and polish (see "Phase 05 verification status" below: the live 3D render is still unverified). Phase 04 — premium collection page. Seven HTML pages share one set of CSS and JS modules. The BMW page has the full 3D experience from Phase 02; the collection page is now a designed showroom; the intro page is a placeholder; the other four car pages show identification only until their phases.

## Run locally

ES modules and import maps do not work from `file://`. Serve the folder over HTTP, then open the printed address:

```bash
python3 -m http.server 8080      # then visit http://localhost:8080
# or
npx serve .
```

Three.js (0.170.0) and GSAP (3.12.5) load from jsDelivr through the import map in `index.html`, and the Draco decoder (needed by the compressed BMW model) loads from the same CDN (`DRACO_DECODER_PATH` in `js/config.js`), so an internet connection is required. To go fully offline, download those files and point the import map (identical on all seven pages) and `DRACO_DECODER_PATH` at local copies. If the 3D libraries cannot be loaded, the 3D page shows a notice instead of staying on the loading screen.

## Site map

| Page | File | Phase 04 state |
|---|---|---|
| Cinematic intro | `index.html` | Placeholder entry screen (five-car cinematic arrives in Phase 10) |
| Collection | `collection.html` | Showroom: hero, five editorial vehicle sections in fixed order, each with an Explore link to its page. No 3D, no heavy assets |
| BMW M5 F90 Competition | `bmw-m5.html` | Full 3D scroll experience |
| Porsche 911 Carrera 4S | `porsche-911.html` | Identification only, no model yet |
| Nissan GT-R R35 | `nissan-gt-r.html` | Identification only, no model yet |
| Toyota GR Supra MK5 | `toyota-supra.html` | Identification only, no model yet |
| Chevrolet Corvette C8 | `corvette-c8.html` | Identification only, no model yet |

Every page has its own HTML file, its own renderer (3D pages only) and its own scroll camera. Pages share CSS, header, footer and the JS modules below. The vehicle list, page names and model specs live in `js/config.js`; the header, footer and model credits are generated from it by `js/ui/site-chrome.js`.

## Structure

```
*.html                Seven pages (same import map on each; tests enforce it)
css/
  tokens.css          Design tokens (colour, type, spacing, motion, layers)
  base.css            Reset, document defaults, accessibility
  layout.css          Stage, header, hero
  chrome.css          Shared: footer, nav, page transitions        (all pages)
  pages.css           Intro and "in production" car pages
  collection.css      Showroom hero, plates, layouts, hover, reveal (collection page)
  loader.css          Loading screen                              (3D pages)
  car.css             Scroll track, HUD, atmosphere, notices      (3D pages)
js/
  boot-guard.js       Classic script: View Transition detection + load watchdog
  config.js           SITE, VEHICLES, MODELS (per-car specs), stage settings
  pages/
    intro.js          Intro entry (+ background asset queue)
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
tests/                camera, model (real GLB), pages and asset-queue tests (node tests/run-all.mjs)
tools/                render-check.cjs: real-browser render check for the BMW page (needs internet + Playwright)
assets/models/        .glb vehicle models (bmw-m5-f90.glb)
```

## Page transitions

Browsers with cross-document View Transitions (Chromium 126+) animate navigation natively (`@view-transition` in `css/chrome.css`); the header stays fixed while the page cross-fades. Other browsers get a fade-out on click and a fade-in on arrival (`js/ui/transitions.js`, switched on by `html.no-vt`). Both are disabled for `prefers-reduced-motion`. Modifier-clicks, new-tab links and in-page anchors are never intercepted.

## Progressive loading (prepared for the five-car intro)

`js/core/asset-queue.js` downloads files in the background without disturbing animation:

- one download at a time, in priority order, using low network priority;
- a download only starts when there has been no scroll, touch or key input for 600 ms, and the connection is not Data Saver or 2G/3G;
- it re-checks before reading every chunk and simply stops reading while the user is active, so the transfer pauses and resumes without restarting;
- it only fills the HTTP cache. Decoding and GPU upload stay in `vehicle.js`, on demand, so background work cannot cause frame drops.

Background loading is enabled only on capable desktops (`quality.backgroundLoading`): never on phones/tablets (coarse pointer), the low tier or Data Saver. In Phase 03 only the intro page uses it, 2.5 s after load, and only for vehicles that have a model (just the BMW). No other model exists or is loaded.

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

## Tests

```bash
node tests/run-all.mjs
```

Node only, no dependencies, no rendering:
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

## Collection page

`collection.html` holds its content as static HTML (no layout shift, readable without JavaScript). `js/ui/showroom.js` only adds enhancements: reveal on scroll, the side rail and pointer parallax on fine pointers. Hover/scroll motion uses transform and opacity only and is switched off under `prefers-reduced-motion`.

Each car currently has a typographic CSS "plate" (large outlined glyph, tinted light, floor line) and the tag "Studio imagery to follow". No car photography or fake model is used.

### Collection imagery (when real images exist)
Set `visual.image` for a vehicle in `js/config.js` (e.g. `'assets/images/porsche-911.webp'`) and place the file there, then add an `<img>` inside that car's `.plate` in `collection.html` (keep `width`/`height`, `loading="lazy"`, `decoding="async"`). Keep each image small (about 150 KB WebP). Real GLBs are not loaded on this page.

## Adding the next car (Phases 06 to 09)

1. Put its GLB in `assets/models/` and add a `MODELS[id]` entry in `js/config.js` (orientation, expected size, credit).
2. Add `js/scene/shots/<car>.js` (start and end on the shared hero pose) and register it in `shots/index.js`.
3. Turn its page into a 3D page by copying `bmw-m5.html` (loader, canvas, HUD, track) and changing the car id, title and headline.
4. Extend the camera tests to cover the new shot.

## Credits

3D model "Bmw M5 F90" by RES1N, licensed CC BY 4.0, via Sketchfab: https://sketchfab.com/3d-models/bmw-m5-f90-5478e978bd634337adc8e3dc413fbfa3 . The credit is shown in the page footer; keep it if you redistribute the site.

## Conventions

- Colours, type, spacing and motion values live in `css/tokens.css`. JS reads `--color-bg` from there.
- Import GSAP and ScrollTrigger only via `js/core/motion.js`.
- One renderer, one render loop (GSAP ticker, draws only when `stage.invalidate()` was called). Add to `stage.scene`; do not create more renderers.
- Anything the loading screen should wait for is passed to `loader.run([...])` in `core/bootstrap.js`: a Promise, or `{ weight, start(report) }` for real progress (the model download uses this).
