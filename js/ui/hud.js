/**
 * AETHER GT — Showcase HUD.
 * Minimal identification, current chapter caption, chapter rail, scroll cue.
 * DOM is only touched when something visibly changes.
 */

/**
 * @param {HTMLElement} root  the [data-hud] element
 * @param {{ make:string, model:string, designation:string }} vehicle
 * @param {{ chapters: { t:number, title:string }[] }} shot
 */
export function createHud(root, vehicle, shot) {
  const q = (sel) => root.querySelector(sel);
  const make = q('[data-hud-make]');
  const model = q('[data-hud-model]');
  const designation = q('[data-hud-designation]');
  const indexEl = q('[data-hud-index]');
  const totalEl = q('[data-hud-total]');
  const titleEl = q('[data-hud-title]');
  const rail = q('[data-hud-rail]');
  const cue = q('[data-hud-cue]');
  const ident = q('.hud__ident');

  const chapters = shot.chapters;
  const pad = (n) => String(n).padStart(2, '0');

  make.textContent = vehicle.make;
  model.textContent = vehicle.model;
  designation.textContent = vehicle.designation;
  totalEl.textContent = pad(chapters.length);

  const ticks = chapters.map(() => {
    const li = document.createElement('li');
    rail.append(li);
    return li;
  });

  let current = -1;
  let cueHidden = false;
  let identVisible = null;
  let opacity = 1;

  function update(_segmentIndex, local) {
    // Chapter
    let index = 0;
    for (let i = 0; i < chapters.length; i++) if (local >= chapters[i].t) index = i;
    if (index !== current) {
      if (current >= 0) ticks[current].classList.remove('is-active');
      ticks[index].classList.add('is-active');
      current = index;
      indexEl.textContent = pad(index + 1);
      titleEl.textContent = chapters[index].title;
    }
    // Identification fades in once the hero headline has scrolled away.
    const showIdent = local > 0.045;
    if (showIdent !== identVisible) {
      identVisible = showIdent;
      ident.classList.toggle('is-visible', showIdent);
      root.classList.toggle('is-started', showIdent);
    }
    // Scroll cue disappears after the first nudge.
    const hideCue = local > 0.012;
    if (hideCue !== cueHidden) {
      cueHidden = hideCue;
      cue.classList.toggle('is-hidden', hideCue);
    }
  }

  function setOpacity(value) {
    if (value === opacity) return;
    opacity = value;
    root.style.opacity = String(value);
    root.style.visibility = value <= 0.01 ? 'hidden' : '';
  }

  return { update, setOpacity };
}
