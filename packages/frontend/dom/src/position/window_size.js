import { createPubSub } from "../pub_sub.js";

// Both "resize" sources fire transiently on mobile (keyboard/UI chrome
// briefly shifting when focus moves between inputs) — debounced so
// consumers skip that in-between state. One shared timer per source (not
// one per subscriber) so everything settles on the same tick.
const RESIZE_SETTLE_MS = 100;

const createResizeSettledSubscription = (target, eventName) => {
  const [publish, subscribe] = createPubSub();
  if (!target) {
    return subscribe;
  }
  let timeoutId;
  target.addEventListener(eventName, (event) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      publish(event);
    }, RESIZE_SETTLE_MS);
  });
  return subscribe;
};

// Calls `callback` once `window` settles after a resize. Returns an unsubscribe function.
export const subscribeWindowResizeSettled = createResizeSettledSubscription(
  window,
  "resize",
);

// Same, for `window.visualViewport` — no-op (never calls back) without support.
export const subscribeVisualViewportResizeSettled =
  createResizeSettledSubscription(window.visualViewport, "resize");
