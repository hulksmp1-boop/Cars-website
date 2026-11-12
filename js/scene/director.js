/**
 * AETHER GT — Director.
 *
 * Binds page scroll to the camera, the car's turntable rotation and the HUD.
 *
 * One GSAP timeline, scrubbed by ScrollTrigger, tweens a single proxy value
 * `progress` 0 → 1 with a linear ease. Every update the camera track is
 * sampled at that progress (camera-rig.js), so the motion is one continuous
 * spline rather than a chain of separate tweens that each stop and start.
 * Scrolling back simply scrubs the same timeline in reverse.
 */

import { gsap, ScrollTrigger, prefersReducedMotion } from '../core/motion.js';
import { SHOWCASE } from '../config.js';
import { createTrack, resolvePose, compositionShift } from './camera-rig.js';
import { createSequence } from './sequence.js';

/**
 * @param {object} deps
 * @param {object} deps.stage       from createStage
 * @param {{ id:string, shot:object, rig:{ root: import('three').Object3D } }[]} deps.segments  Phase 02: just the BMW
 * @param {HTMLElement} deps.track  scroll track element
 * @param {HTMLElement} [deps.exitTrigger] element whose arrival fades the stage out
 * @param {object} [deps.hud]
 */
export function createDirector({ stage, segments, track, exitTrigger, hud }) {
  const { camera } = stage;
  const sequence = createSequence(segments.map((s) => ({ id: s.id })));
  const tracks = segments.map((s) => createTrack(s.shot.keys));

  const state = { progress: 0 };
  let lastFov = -1;
  let exit = 0;

  /** Positions camera + car for a global progress value. */
  function apply(progress) {
    const at = sequence.resolve(progress);
    const segment = segments[at.index];
    const aspect = camera.aspect || 1;
    const pose = resolvePose(tracks[at.index].sample(at.local), { aspect });

    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    if (pose.fov !== lastFov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      lastFov = pose.fov;
    }
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    segment.rig.root.rotation.y = pose.yaw;

    hud?.update(at.index, at.local, progress);
    stage.invalidate();
  }

  stage.setComposition(compositionShift(camera.aspect || 1));
  const offResize = stage.onResize(({ aspect }) => {
    stage.setComposition(compositionShift(aspect));
    lastFov = -1;
    apply(state.progress);
  });

  // Scroll → progress ---------------------------------------------------------
  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: prefersReducedMotion() ? true : SHOWCASE.scrubSmoothing,
      invalidateOnRefresh: true,
    },
  });
  timeline.to(state, { progress: 1, duration: 1, onUpdate: () => apply(state.progress) });
  const scrollTrigger = timeline.scrollTrigger;

  // Start exactly where the page already is (e.g. after a reload mid-page): no swoop.
  timeline.progress(scrollTrigger.progress);
  apply(state.progress);

  // Fade the stage out when the lineup arrives, and stop drawing while hidden.
  let exitTriggerInstance = null;
  if (exitTrigger) {
    exitTriggerInstance = ScrollTrigger.create({
      trigger: exitTrigger,
      start: 'top 95%',
      end: 'top 35%',
      onUpdate: (self) => {
        exit = self.progress;
        stage.renderer.domElement.style.opacity = String(1 - exit);
        hud?.setOpacity(1 - exit);
        stage.setActive(exit < 0.999);
      },
    });
    // Restore the right state straight away.
    exit = exitTriggerInstance.progress;
    stage.renderer.domElement.style.opacity = String(1 - exit);
    hud?.setOpacity(1 - exit);
    stage.setActive(exit < 0.999);
  }

  function dispose() {
    offResize();
    exitTriggerInstance?.kill();
    timeline.kill(); // also kills its ScrollTrigger
    stage.renderer.domElement.style.opacity = '';
  }

  return { apply, dispose, get progress() { return state.progress; }, scrollTrigger };
}
