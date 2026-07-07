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

if (vv) {
  const update = () => {
    visualViewportWidthSignal.value = vv.width;
    visualViewportHeightSignal.value = vv.height;
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
