// Foldable posture detection.
//
// Skyfold reads the device's *shape*, not a hard-coded model list:
//  • folded   – narrow phone (cover screen). Compact HUD + bottom tool dock.
//  • unfolded – the big inner screen (near-square). Tool rail + Mayor's Desk.
//  • book     – unfolded with a reported vertical hinge (two side-by-side
//               viewport segments): city on one panel, desk on the other.
//  • tabletop – half-folded like a laptop (two stacked segments): city on top,
//               controls on the bottom half.
// Segments come from the Viewport Segments API when the browser exposes it.
// A URL override (?posture=unfolded) or the settings menu can force a mode.

export const DEVICE = {
  // Target: iPhone foldable inner display — 1878 × 2670 px at 430 ppi.
  // At Apple's 3× scale that is 626 × 890 pt (aspect 0.70): it lands in the
  // "unfolded" posture (portrait → desk docked below, landscape → beside).
  // Balanced quality renders at 2× (1252 × 1780); Ultra renders native 3×.
  inner: { px: [1878, 2670], ppi: 430, scale: 3, pt: [626, 890] },
  // Breakpoints are in CSS px and separate a phone-width cover display from
  // the near-square inner display.
  unfoldedMinShortSide: 560,
  unfoldedAspectRange: [0.62, 1.75],
  tabletMinShortSide: 740,
};

export function readPosture(override = 'auto') {
  const w = window.innerWidth, h = window.innerHeight;
  const short = Math.min(w, h), aspect = w / h;
  const out = { posture: 'folded', orient: w >= h ? 'landscape' : 'portrait', w, h, hinge: null, segments: null };

  const segs = window.viewport && window.viewport.segments;
  if (segs && segs.length === 2) {
    const [a, b] = segs;
    out.segments = segs;
    if (Math.abs(a.top - b.top) < 2) { out.posture = 'book'; out.hinge = { axis: 'x', at: a.right, size: Math.max(0, b.left - a.right), first: a.width }; }
    else { out.posture = 'tabletop'; out.hinge = { axis: 'y', at: a.bottom, size: Math.max(0, b.top - a.bottom), first: a.height }; }
  } else if ((short >= DEVICE.unfoldedMinShortSide && aspect > DEVICE.unfoldedAspectRange[0] && aspect < DEVICE.unfoldedAspectRange[1]) || short >= DEVICE.tabletMinShortSide) {
    out.posture = 'unfolded';
  }

  if (override && override !== 'auto') {
    out.posture = override;
    if (override === 'book' && !out.hinge) out.hinge = { axis: 'x', at: Math.round(w / 2), size: 0, first: Math.round(w / 2) };
    if (override === 'tabletop' && !out.hinge) out.hinge = { axis: 'y', at: Math.round(h / 2), size: 0, first: Math.round(h / 2) };
  }
  return out;
}

export function watchPosture(cb) {
  let raf = 0;
  const fire = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(cb); };
  window.addEventListener('resize', fire);
  window.addEventListener('orientationchange', fire);
  window.visualViewport?.addEventListener('resize', fire);
  for (const q of ['(horizontal-viewport-segments: 2)', '(vertical-viewport-segments: 2)']) {
    try { window.matchMedia(q).addEventListener('change', fire); } catch { /* unsupported */ }
  }
}
