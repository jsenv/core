import { computed, signal } from "@preact/signals";

export const windowWidthSignal = signal(window.innerWidth);
export const windowHeightSignal = signal(window.innerHeight);

window.addEventListener("resize", () => {
  windowWidthSignal.value = window.innerWidth;
  windowHeightSignal.value = window.innerHeight;
});

// Visual viewport dimensions — update when the virtual keyboard opens/closes or
// when the browser UI (address bar) shows/hides.
// When visualViewport is not available, derived from window signals so they
// stay live without any extra listeners.
const vv = window.visualViewport;
export const visualViewportWidthSignal = vv
  ? signal(vv.width)
  : computed(() => windowWidthSignal.value);
export const visualViewportHeightSignal = vv
  ? signal(vv.height)
  : computed(() => windowHeightSignal.value);

// How far the visual viewport's own edges sit inset from the layout
// viewport's (window.innerWidth/innerHeight) — nonzero whenever something
// shrinks the *visually* available area without resizing the layout
// viewport itself. Named generically ("visual viewport inset"), but in
// practice today this is almost always the on-screen keyboard on mobile,
// shrinking the bottom inset specifically — tracked on all 4 sides anyway
// (not just top/bottom) since in principle any edge could move (a side
// panel, a foldable device, etc.).
export const visualViewportInsetLeftSignal = vv
  ? signal(vv.offsetLeft)
  : computed(() => 0);
export const visualViewportInsetTopSignal = vv
  ? signal(vv.offsetTop)
  : computed(() => 0);
export const visualViewportInsetRightSignal = vv
  ? signal(window.innerWidth - (vv.offsetLeft + vv.width))
  : computed(() => 0);
export const visualViewportInsetBottomSignal = vv
  ? signal(window.innerHeight - (vv.offsetTop + vv.height))
  : computed(() => 0);

if (vv) {
  const update = () => {
    visualViewportWidthSignal.value = vv.width;
    visualViewportHeightSignal.value = vv.height;
    visualViewportInsetLeftSignal.value = vv.offsetLeft;
    visualViewportInsetTopSignal.value = vv.offsetTop;
    visualViewportInsetRightSignal.value =
      window.innerWidth - (vv.offsetLeft + vv.width);
    visualViewportInsetBottomSignal.value =
      window.innerHeight - (vv.offsetTop + vv.height);
  };
  let resizeTimeout;
  const onResize = () => {
    // On mobile, tapping from one input to another triggers a resize
    // because the virtual keyboard briefly starts to close before the new
    // input receives focus and the keyboard reopens. Debouncing prevents
    // updating during that transient state, which would cause a visible
    // flicker in anything positioned off these vars.
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(update, 100);
  };
  vv.addEventListener("resize", onResize);
  vv.addEventListener("scroll", update);
}
