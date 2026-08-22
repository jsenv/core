import { createPubSub } from "../pub_sub.js";
import { subscribeVirtualKeyboardGeometryChange } from "./virtual_keyboard.js";

// Both "resize" sources fire transiently on mobile (keyboard/UI chrome
// briefly shifting when focus moves between inputs) — debounced so
// consumers skip that in-between state. One shared timer per source (not
// one per subscriber) so everything settles on the same tick.
const RESIZE_SETTLE_MS = 100;

// Set while a visualViewport resize is debouncing, cleared once it settles —
// read by the window resize listener below.
let visualViewportResizePending = false;

const [publishVisualViewportResize, subscribeVisualViewportResizeSettled] =
  createPubSub();
// Calls `callback` once `window.visualViewport` settles after a resize —
// no-op (never calls back) without support. Returns an unsubscribe function.
export { subscribeVisualViewportResizeSettled };
const [publishWindowResize, subscribeWindowResizeSettled] = createPubSub();
// Calls `callback` once `window` settles after a resize. Returns an unsubscribe function.
export { subscribeWindowResizeSettled };

let visualViewportResizeTimeoutId;
const scheduleVisualViewportResize = (event) => {
  visualViewportResizePending = true;
  clearTimeout(visualViewportResizeTimeoutId);
  visualViewportResizeTimeoutId = setTimeout(() => {
    visualViewportResizePending = false;
    publishVisualViewportResize(event);
  }, RESIZE_SETTLE_MS);
};
if (window.visualViewport) {
  window.visualViewport.addEventListener(
    "resize",
    scheduleVisualViewportResize,
  );
}
// The same event, said differently: where the keyboard overlays the content
// (virtual_keyboard.js) there is no visualViewport resize at all when it
// opens — the room left to place anything in changed
// all the same, and every consumer here asks the same question either way
// (getVisibleViewportRect in visible_rect.js already subtracts it). Through
// the same debounce, and for the same reason: going straight from one input
// to the next hides and re-shows the keyboard.
subscribeVirtualKeyboardGeometryChange(scheduleVisualViewportResize);

let windowResizeTimeoutId;
window.addEventListener("resize", (event) => {
  clearTimeout(windowResizeTimeoutId);
  // Mobile browsers appear to dispatch visualViewport resize, then window
  // resize, then visualViewport resize again for the same keyboard/UI-chrome
  // shift — debounce the same way only when it looks like part of that
  // sequence (a visualViewport resize is already pending); otherwise react
  // immediately, so a genuine window resize isn't delayed for nothing.
  if (!visualViewportResizePending) {
    publishWindowResize(event);
    return;
  }
  windowResizeTimeoutId = setTimeout(() => {
    publishWindowResize(event);
  }, RESIZE_SETTLE_MS);
});
