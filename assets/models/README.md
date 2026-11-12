# Vehicle models

Place one optimised `.glb` per vehicle here, named after its `id` in `js/config.js` and described in `MODELS`:

- `bmw-m5-f90.glb`  (present)
- `porsche-911-carrera-4s.glb`  (present, wired: `MODELS` entry, 3D page `cars/porsche-911.html`)
- `nissan-gt-r-r35.glb`  (present, wired: `MODELS` entry, 3D page `cars/nissan-gt-r.html`)
- `toyota-gr-supra-mk5.glb`  (present, wired: `MODELS` entry, 3D page `cars/toyota-supra.html`)
- `chevrolet-corvette-c8.glb`  (present, wired: `MODELS` entry with `orientationY: -90`, 3D page `cars/corvette-c8.html`)

Only use models you are licensed to use. Keep each file as small as practical (Draco or Meshopt compression recommended; Draco is wired up, Meshopt is not).

## bmw-m5-f90.glb

"Bmw M5 F90" by RES1N, CC BY 4.0, https://sketchfab.com/3d-models/bmw-m5-f90-5478e978bd634337adc8e3dc413fbfa3
5.1 MB, Draco geometry + WebP textures, about 260k triangles, 130 meshes, 96 materials. Real-world scale in metres, nose towards +X. Used unmodified; one malformed instrument-cluster mesh is hidden at runtime (see `vehicle.js`).

## Models added, not yet wired (no `MODELS` entry, no page uses them)

All four are Draco + WebP glTF with no scale or orientation normalisation yet; raw units differ (the Nissan and Porsche files are in unscaled units), so each needs an `orientationY` and size check in `MODELS` when wired. Triangle counts are high (Corvette 264k, Nissan 566k, Porsche 653k, Supra 855k) compared with the BMW (260k); budget for mobile when wiring.

- `porsche-911-carrera-4s.glb`: "(FREE) Porsche 911 Carrera 4S" by Karol Miklas, CC BY-SA 4.0 (ShareAlike), https://sketchfab.com/3d-models/free-porsche-911-carrera-4s-d01b254483794de3819786d93e0e1ebf
- `nissan-gt-r-r35.glb`: "Nissan GTR R35" by Ciasny, CC BY 4.0, https://sketchfab.com/3d-models/nissan-gtr-r35-51c912a8310c4e00a82ad7673d84228a
- `toyota-gr-supra-mk5.glb`: "Toyota Supra MK5 A90" by pryanex, CC BY 4.0, https://sketchfab.com/3d-models/toyota-supra-mk5-a90-30528ef37af844919074498f979b9515
- `chevrolet-corvette-c8.glb`: "2019 Chevrolet Corvette C8 Stingray" by Hari, CC BY 4.0, https://sketchfab.com/3d-models/2019-chevrolet-corvette-c8-stingray-790c40ccff6843eab0b7b4bd18421ff8
