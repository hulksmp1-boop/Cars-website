/**
 * AETHER GT — The road journey (homepage).
 *
 * Draws a countryside lane (inline SVG), sizes the stage for the current width, places five
 * captions beside the lane without touching it, and slides each car along the lane as the page
 * scrolls. Pure enhancement: without this module the section is a stacked list (css/road.css).
 *
 * - Native scrolling only. One passive scroll listener -> one requestAnimationFrame per frame,
 *   only while the stage is near the viewport. Cars move with transform only.
 * - The car position is a pure function of scrollY, so scrolling back retraces the same frames.
 * - A car is on its "station" (beside its caption) when the stage's mid-line crosses the
 *   station; before that it is further up the lane, afterwards further down it.
 * - prefers-reduced-motion: cars stay at their stations; no scroll work at all.
 * - No libraries.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAD = 26;                 // transparent padding baked into each sprite (px at natural size)

/* Layout presets, chosen from the stage width. Lanes are x as a fraction of the stage width. */
const MODES = {
  desktop: { min: 1000, spacing: 660, top: 320, bottom: 380, scale: 0.36, roadW: 124, capW: 400, capMin: 300, margin: 48, drive: 0.45, lanes: [0.72, 0.25, 0.75, 0.25, 0.73], run: 0, gap: 26, trees: [9, 26] },
  tablet:  { min: 600,  spacing: 620, top: 300, bottom: 360, scale: 0.30, roadW: 100, capW: 300, capMin: 220, margin: 28, drive: 0.4,  lanes: [0.74, 0.27, 0.75, 0.26, 0.73], run: 0, gap: 22, trees: [8, 22] },
  mobile:  { min: 360,    spacing: 580, top: 280, bottom: 360, scale: 0.215, roadW: 72, capW: 260, capMin: 196, margin: 14, drive: 0.4,  lanes: [0.2, 0.8, 0.2, 0.8, 0.2],   run: 120, gap: 14, trees: [5, 14] },
  compact: { min: 0,    spacing: 560, top: 260, bottom: 340, scale: 0.18,  roadW: 58, capW: 220, capMin: 168, margin: 12, drive: 0.4,  lanes: [0.17, 0.83, 0.17, 0.83, 0.17], run: 120, gap: 12, trees: [4, 12] },
};

const SHOULDER = 14;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** Small deterministic generator, so the trees are the same on every visit and every resize. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Catmull-Rom through the points, written as cubic Beziers. */
function smoothPath(p) {
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function initRoadJourney() {
  const stage = document.querySelector('[data-road]');
  if (!stage) return;
  const svg = stage.querySelector('.road__map');
  const stops = [...stage.querySelectorAll('.road__stop')].map((li) => ({
    li,
    car: li.querySelector('.road__car'),
    cap: li.querySelector('.road__caption'),
  }));
  if (!svg || stops.length === 0) return;

  const section = stage.closest('.road') || stage;
  const headerH = () => document.querySelector('.site-header')?.offsetHeight || 72;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;

  let L = null;            // current layout
  let visible = true;
  let queued = false;
  let lastW = 0;

  /* Build everything that depends on the stage width ------------------------------------ */
  function layout() {
    const W = Math.round(stage.clientWidth);
    if (W < 200) return;
    lastW = W;
    const m = W >= MODES.desktop.min ? MODES.desktop : W >= MODES.tablet.min ? MODES.tablet : W >= MODES.mobile.min ? MODES.mobile : MODES.compact;
    const n = stops.length;
    const H = Math.round(m.top + (n - 1) * m.spacing + m.bottom);
    const st = stops.map((_, i) => m.top + i * m.spacing);

    root.classList.add('is-road-ready');
    stage.style.setProperty('--stage-h', `${H}px`);
    stage.style.setProperty('--s', String(m.scale));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();

    /* Centre line: straight runs (mobile) around each station, long diagonals between. */
    const pts = [{ x: m.lanes[0] * W, y: -140 }];
    stops.forEach((_, i) => {
      const x = m.lanes[i] * W;
      if (m.run) pts.push({ x, y: st[i] - m.run }, { x, y: st[i] + m.run });
      else pts.push({ x, y: st[i] });
    });
    pts.push({ x: m.lanes[n - 1] * W, y: H + 140 });
    const d = smoothPath(pts);

    /* Ground: slightly slanted field strips */
    const defs = el('defs');
    const grad = el('radialGradient', { id: 'road-tree', cx: '0.38', cy: '0.34', r: '0.72' });
    [['0', '#51704c'], ['0.55', '#2f4530'], ['1', '#1d2c20']].forEach(([o, c]) => grad.append(el('stop', { offset: o, 'stop-color': c })));
    defs.append(grad);
    svg.append(defs);

    const bands = el('g');
    const bandH = H / 7;
    for (let i = 0; i < 7; i++) {
      const y0 = i * bandH, tilt = (i % 2 ? 1 : -1) * Math.min(26, W * 0.02);
      bands.append(el('polygon', {
        points: `0,${y0 + tilt} ${W},${y0 - tilt} ${W},${y0 + bandH - tilt} 0,${y0 + bandH + tilt}`,
        fill: i % 2 ? '#1c271e' : '#17201a',
      }));
    }
    svg.append(bands);

    /* Contour lines: dashed copies of the lane, pushed sideways */
    const contours = el('g', { fill: 'none', stroke: 'rgb(236 230 217 / 0.2)', 'stroke-width': '1.4', 'stroke-dasharray': '5 8', 'stroke-linecap': 'round' });
    [-3.4, -1.9, 2.0, 3.6].forEach((k, i) => {
      const c = el('path', { d, transform: `translate(${(k * m.roadW).toFixed(1)} ${(i % 2 ? 18 : -10)})` });
      contours.append(c);
    });
    svg.append(contours);

    /* Lane (measured first so the trees can keep clear of it) */
    const road = el('g', { fill: 'none', 'stroke-linejoin': 'round' });
    const mk = (attrs) => el('path', { d, ...attrs });
    road.append(
      mk({ stroke: '#32352e', 'stroke-width': m.roadW + SHOULDER * 2 }),
      mk({ stroke: '#25272a', 'stroke-width': m.roadW }),
      mk({ stroke: 'rgb(236 230 217 / 0.3)', 'stroke-width': m.roadW - 14 }),
      mk({ stroke: '#25272a', 'stroke-width': m.roadW - 17 }),
      mk({ stroke: 'rgb(201 188 154 / 0.85)', 'stroke-width': 2.5, 'stroke-dasharray': '16 18' }),
    );
    const probe = road.lastChild;

    const total = probe.getTotalLength();
    const samples = [];
    for (let s = 0, prevY = -Infinity; s <= total; s += 3) {
      const p = probe.getPointAtLength(s);
      const y = Math.max(prevY, p.y);       // keep y non-decreasing, so it can be searched
      samples.push({ x: p.x, y });
      prevY = y;
    }
    const at = (y) => {                      // centre-line x and heading at height y
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (samples[mid].y < y) lo = mid + 1; else hi = mid; }
      const a = samples[Math.max(0, lo - 7)], b = samples[Math.min(samples.length - 1, lo + 7)];
      const s = samples[lo];
      const dx = b.x - a.x, dy = Math.max(1e-3, b.y - a.y);
      return { x: s.x, y, angle: Math.atan2(-dx, dy) * 180 / Math.PI };
    };
    const span = (y0, y1) => {               // sideways extent of the lane between two heights
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (samples[mid].y < y0) lo = mid + 1; else hi = mid; }
      let min = Infinity, max = -Infinity;
      for (let i = lo; i < samples.length && samples[i].y <= y1; i++) { min = Math.min(min, samples[i].x); max = Math.max(max, samples[i].x); }
      return { min, max };
    };

    /* Trees, kept off the lane and out of the lane's shoulder */
    const rand = rng(1911);
    const trees = el('g');
    const count = Math.round((W * H) / (m.min < 600 ? 30000 : 52000));
    const clear = m.roadW / 2 + SHOULDER + 10;
    for (let tries = 0, made = 0; made < count && tries < count * 14; tries++) {
      const r = m.trees[0] + rand() * (m.trees[1] - m.trees[0]);
      const x = rand() * W, y = rand() * H;
      const s = span(y - r - 6, y + r + 6);
      if (s.min === Infinity) { /* beyond the lane's ends: free */ } else if (x + r + clear > s.min && x - r - clear < s.max) {
        // inside the lane's sideways extent for these heights: accept only if clear of every sample nearby
        let hit = false;
        for (let i = 0; i < samples.length; i++) {
          const q = samples[i];
          if (q.y < y - r - clear) continue;
          if (q.y > y + r + clear) break;
          if ((q.x - x) ** 2 + (q.y - y) ** 2 < (r + clear) ** 2) { hit = true; break; }
        }
        if (hit) continue;
      }
      trees.append(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), fill: 'url(#road-tree)', opacity: (0.7 + rand() * 0.3).toFixed(2) }));
      made++;
    }
    svg.append(trees, road);

    /* Captions: opposite side of the lane first, outer-aligned, clear of the lane and of each other */
    const edge = m.roadW / 2 + SHOULDER + m.gap;
    const placed = [];
    stops.forEach((stop, i) => {
      const cap = stop.cap;
      const laneRight = m.lanes[i] > 0.5;
      const sides = laneRight ? ['left', 'right'] : ['right', 'left'];
      let spot = null;
      for (let w = m.capW; w >= m.capMin && !spot; w -= 16) {
        const cw = Math.min(w, W - 2 * m.margin);
        cap.style.setProperty('--cw', String(cw));
        const h = cap.offsetHeight;
        for (const side of sides) {
          const x = side === 'right' ? W - m.margin - cw : m.margin;
          for (let k = 0; k <= 14 && !spot; k++) {
            const dy = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 24;
            const y0 = st[i] + dy - h / 2;
            if (y0 < 16 || y0 + h > H - 16) continue;
            const s = span(y0 - 8, y0 + h + 8);
            const free = side === 'right' ? s.max + edge <= x : s.min - edge >= x + cw;
            const clashes = placed.some((r) => y0 < r.y1 + 16 && y0 + h > r.y0 - 16);
            if (free && !clashes) spot = { x, y0, h, cw };
          }
          if (spot) break;
        }
      }
      if (!spot) {                           // last resort: narrowest, outer-aligned, centred on the station
        const cw = Math.min(m.capMin, W - 2 * m.margin);
        cap.style.setProperty('--cw', String(cw));
        const h = cap.offsetHeight;
        spot = { x: sides[0] === 'right' ? W - m.margin - cw : m.margin, y0: st[i] - h / 2, h, cw };
      }
      cap.style.setProperty('--cw', String(spot.cw));
      cap.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y0.toFixed(1)}px)`;
      placed.push({ y0: spot.y0, y1: spot.y0 + spot.h });
    });

    /* Car sizes (rendered size is fixed by CSS from --s; read it back for centring) */
    L = { W, H, m, st, at, cars: stops.map((s) => ({ w: s.car.width || s.car.offsetWidth, h: s.car.height || s.car.offsetHeight })) };
    stage.classList.add('is-placed');
    update();
  }

  /* Per-frame: place the cars for the current scroll position -------------------------- */
  function update() {
    queued = false;
    // Header guard: while the road section is under the fixed header, give the header a firmer
    // scrim (css/road.css) so intro text and captions never read through the wordmark and link.
    const box = section.getBoundingClientRect();
    root.classList.toggle('is-over-road', box.top < headerH() && box.bottom > 0);
    if (!L) return;
    const { H, m, st, at } = L;
    const k = motion.matches ? 0 : m.drive;
    let c = H / 2;
    if (k) {
      const top = stage.getBoundingClientRect().top;
      c = window.innerHeight * 0.5 - top;                        // stage y under the viewport's mid-line
      // keep the first car clear of the lane's start and the last clear of its end
      const lo = (70 - (1 - k) * st[0]) / k, hi = (H - 70 - (1 - k) * st[st.length - 1]) / k;
      c = Math.min(hi, Math.max(lo, c));
    }
    stops.forEach((stop, i) => {
      const y = k ? (1 - k) * st[i] + k * c : st[i];
      const p = at(y);
      const car = stop.car;
      const w = L.cars[i].w || car.offsetWidth, h = L.cars[i].h || car.offsetHeight;
      car.style.transform = `translate3d(${(p.x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) rotate(${p.angle.toFixed(2)}deg)`;
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  /* Wiring ------------------------------------------------------------------------------ */
  const start = () => {
    layout();
    const relayout = () => { if (Math.round(stage.clientWidth) !== lastW) { layout(); } };
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(stage); else window.addEventListener('resize', relayout);
    window.addEventListener('scroll', schedule, { passive: true });
    new IntersectionObserver(([e]) => { if (e.isIntersecting || root.classList.contains('is-over-road')) schedule(); }, { rootMargin: '0px' }).observe(section);
    motion.addEventListener?.('change', () => { layout(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) schedule(); }, { rootMargin: '100% 0px' }).observe(stage);
    }
    // Late images change nothing (sizes come from width/height), but fonts change caption heights.
    document.fonts?.ready.then(() => layout());
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
