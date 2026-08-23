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

// A focus change is not a resize, and yet: on a phone, giving focus to a field
// is the moment the browser decides what to put over the page — the on-screen
// keyboard, and above it the suggestion/autofill strip whose height NOTHING
// reports. No event describes that strip: visualViewport stays silent about
// it, and so does the keyboard's own geometrychange. So the focus itself is
// taken as the only hint there is, and whoever sizes against the viewport
// re-measures while the furniture settles.
//
// Several delays rather than one because there is nothing to wait for: the
// strip comes up on its own schedule, after the keyboard, sometimes after a
// round-trip to the IME. Polling is what is left when the platform describes
// nothing — bounded, and free whenever it finds nothing: a re-measure that
// reads the same numbers does nothing at all (visible_rect.js's own check()
// dedupes on exactly that).
const FOCUS_SETTLE_DELAYS = [250, 350, 700];
const [publishFocusSettled, subscribeFocusSettled] = createPubSub();
// Calls `callback` a few times over the ~700ms following a focus change, while
// the browser's own on-screen furniture settles. Returns an unsubscribe
// function.
export { subscribeFocusSettled };
let focusSettleTimeoutIds = [];
document.addEventListener(
  "focusin",
  (event) => {
    for (const timeoutId of focusSettleTimeoutIds) {
      clearTimeout(timeoutId);
    }
    focusSettleTimeoutIds = FOCUS_SETTLE_DELAYS.map((delay) =>
      setTimeout(() => {
        publishFocusSettled(event);
      }, delay),
    );
  },
  // Capture: a focus moving into something that stops the event on its way up
  // still moved the furniture.
  { capture: true },
);

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
