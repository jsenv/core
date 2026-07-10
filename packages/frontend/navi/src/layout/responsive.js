import { subscribeVisualViewportResizeSettled } from "@jsenv/dom";
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
  subscribeVisualViewportResizeSettled(update);
  vv.addEventListener("scroll", update);
}
