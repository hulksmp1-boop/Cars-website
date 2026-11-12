/**
 * AETHER GT — Baked contact shadow.
 *
 * A top-down "height above the floor" map of the car is rendered ONCE from
 * below the floor with an orthographic camera (darker = closer to the floor),
 * blurred twice (tight contact + wide ambient), and shown on two flat planes
 * parented to the car. Zero shadow-map cost at runtime, and because the planes
 * are children of the car they turn with it.
 *
 * Plane/camera orientation (car frame: nose +X, up +Y):
 *   bake camera sits below the floor looking up with its up-vector = +Z, so
 *   image right = +X and image up = +Z. A PlaneGeometry rotated +90° about X
 *   maps its local +Y to world +Z, so the texture lands the right way round.
 */

import * as THREE from 'three';

const BLUR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uStep;           // UV distance between taps along the blur axis
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
    sum += texture2D(tDiffuse, vUv + uStep * 1.3846153846) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv - uStep * 1.3846153846) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv + uStep * 3.2307692308) * 0.0702702703;
    sum += texture2D(tDiffuse, vUv - uStep * 3.2307692308) * 0.0702702703;
    gl_FragColor = sum;
  }
`;

const DEPTH_VERT = /* glsl */ `
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const DEPTH_FRAG = /* glsl */ `
  uniform float uPower;
  void main() {
    float d = clamp(gl_FragCoord.z, 0.0, 1.0);   // 0 at the floor, 1 at the cut-off height
    gl_FragColor = vec4(0.0, 0.0, 0.0, pow(1.0 - d, uPower));
  }
`;

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {{ size?: number }} [options] texture width in px
 */
export function createContactShadow(renderer, scene, { size = 1024 } = {}) {
  const FLOOR_OFFSET = 0.003;
  const CUT_OFF = 0.9;          // metres above the floor that can still cast
  const MARGIN = 1.3;           // metres of soft falloff beyond the car footprint

  let group = null;
  let targets = [];
  const materials = [];
  const geometry = new THREE.PlaneGeometry(1, 1);

  // `depth` is only true for the height pass. Without a depth buffer the GPU's depth
  // test does nothing, so each pixel would keep whichever mesh was drawn LAST instead of
  // the one nearest the floor and the baked shadow would depend on mesh order. The blur
  // targets are plain 2D images and need none.
  const makeTarget = (w, h, depth = false) => new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    generateMipmaps: false,
  });

  /**
   * Bakes the shadow for `subject` (its footprint must be centred on the origin
   * in the same frame the returned group is parented into) and returns the group.
   * @param {THREE.Object3D} subject  car root (identity transform at bake time)
   * @param {{ x:number, z:number }} half  half-extents of the car footprint (m)
   * @param {THREE.Object3D[]} hide  other scene objects to hide during the bake
   */
  function bake(subject, half, hideOthers = []) {
    // The previous shadow planes must not be drawn into the new depth map, and
    // the car must be un-rotated so the map is baked in the car's own frame.
    const hide = group ? [...hideOthers, group] : hideOthers;
    const savedYaw = subject.rotation.y;
    subject.rotation.y = 0;
    subject.updateMatrixWorld(true);

    const W = (half.x + MARGIN) * 2;
    const D = (half.z + MARGIN) * 2;
    const w = size;
    const h = Math.max(64, Math.round((size * D) / W));

    disposeTargets();
    const depthRT = makeTarget(w, h, true);
    const tight = makeTarget(w, h);
    const wide = makeTarget(w, h);
    const temp = makeTarget(w, h);
    targets = [tight, wide];

    // Depth pass ------------------------------------------------------------
    const bakeCam = new THREE.OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 0, CUT_OFF + 0.02);
    bakeCam.position.set(0, -0.02, 0);
    bakeCam.up.set(0, 0, 1);
    bakeCam.lookAt(0, 1, 0);

    const depthMat = new THREE.ShaderMaterial({
      vertexShader: DEPTH_VERT,
      fragmentShader: DEPTH_FRAG,
      uniforms: { uPower: { value: 1.7 } },
      side: THREE.DoubleSide,
    });

    const saved = {
      target: renderer.getRenderTarget(),
      clearAlpha: renderer.getClearAlpha(),
      clearColor: renderer.getClearColor(new THREE.Color()),
      background: scene.background,
      fog: scene.fog,
      override: scene.overrideMaterial,
      visibility: hide.map((o) => o.visible),
      autoClear: renderer.autoClear,
    };

    hide.forEach((o) => { o.visible = false; });
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = depthMat;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(depthRT);
    renderer.clear();
    renderer.render(scene, bakeCam);

    // Blur passes -------------------------------------------------------------
    const blurMat = new THREE.ShaderMaterial({
      vertexShader: BLUR_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const pass = (src, dst, metresX, metresZ) => {
      blurMat.uniforms.tDiffuse.value = src.texture;
      blurMat.uniforms.uStep.value.set(metresX / W, metresZ / D);
      renderer.setRenderTarget(dst);
      renderer.clear();
      renderer.render(quadScene, quadCam);
    };

    scene.overrideMaterial = null;
    // tight contact shadow: ~4 cm taps, two iterations each axis
    pass(depthRT, temp, 0.035, 0);
    pass(temp, tight, 0, 0.035);
    pass(tight, temp, 0.05, 0);
    pass(temp, tight, 0, 0.05);
    // wide ambient shadow: bigger taps, repeated
    pass(tight, temp, 0.22, 0);
    pass(temp, wide, 0, 0.22);
    pass(wide, temp, 0.38, 0);
    pass(temp, wide, 0, 0.38);

    // Restore renderer + scene ------------------------------------------------
    renderer.setRenderTarget(saved.target);
    renderer.setClearColor(saved.clearColor, saved.clearAlpha);
    renderer.autoClear = saved.autoClear;
    scene.background = saved.background;
    scene.fog = saved.fog;
    scene.overrideMaterial = saved.override;
    hide.forEach((o, i) => { o.visible = saved.visibility[i]; });
    subject.rotation.y = savedYaw;
    subject.updateMatrixWorld(true);

    depthRT.dispose(); temp.dispose();
    depthMat.dispose(); blurMat.dispose(); quad.geometry.dispose();

    // Display planes ----------------------------------------------------------
    if (!group) {
      group = new THREE.Group();
      group.name = 'contact-shadow';
    }
    group.clear();
    materials.splice(0).forEach((m) => m.dispose());

    const make = (rt, opacity, y, order) => {
      const mat = new THREE.MeshBasicMaterial({
        map: rt.texture,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      });
      materials.push(mat);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.scale.set(W, D, 1);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = y;
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      return mesh;
    };
    group.add(make(wide, 0.55, FLOOR_OFFSET, -1.3), make(tight, 0.85, FLOOR_OFFSET + 0.001, -1.2));
    return group;
  }

  function disposeTargets() {
    targets.forEach((t) => t.dispose());
    targets = [];
  }

  function dispose() {
    disposeTargets();
    materials.splice(0).forEach((m) => m.dispose());
    geometry.dispose();
    if (group) { group.removeFromParent(); group.clear(); }
    group = null;
  }

  return { bake, dispose };
}
