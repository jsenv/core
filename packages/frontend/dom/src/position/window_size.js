import { createPubSub } from "../pub_sub.js";

/**
 * Both `window`'s own "resize" and `window.visualViewport`'s "resize" fire
 * once per real size change, but also transiently on mobile: the on-screen
 * keyboard briefly closes (and the browser's own UI chrome — address bar,
 * etc. — briefly shows/hides) when focus moves from one input to another,
 * generating a spurious "resize" before the keyboard reopens and things
 * settle back. Debouncing skips that transient in-between state instead of
 * reacting to (and flickering through) it.
 *
 * A *single* module-level timer per source, shared by every subscriber
 * (rather than each consumer keeping its own identical-duration timer), is
 * the load-bearing part: visible_rect.js's own visibleRectEffect
 * (repositions anchored elements — e.g. a Dialog's top/left) and
 * @jsenv/navi's responsive.js (windowWidthSignal/HeightSignal,
 * navi-vvh/navi-vvw custom properties) all need to settle on the exact same
 * tick, or whichever one *doesn't* delay quite as long flickers a moment
 * out of sync with the ones that do — independent `setTimeout(fn, 100)`
 * calls scheduled from separate listeners are not guaranteed to land in the
 * same tick. Routing every subscriber of a given source through that
 * source's one shared publish instead removes that drift entirely.
 */
const RESIZE_SETTLE_MS = 100;

const createResizeSettledSubscription = (target, eventName) => {
  const [publish, subscribe] = createPubSub();
  if (!target) {
    // No-op subscription (never calls back) — e.g. subscribeVisualViewportResizeSettled
    // on an engine without visualViewport support.
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

/**
 * Registers `callback` to run once `window` "settles" after a resize (see
 * the module-level comment above). Returns an unsubscribe function.
 */
export const subscribeWindowResizeSettled = createResizeSettledSubscription(
  window,
  "resize",
);

/**
 * Registers `callback` to run once `window.visualViewport` "settles" after
 * a resize (see the module-level comment above). Returns an unsubscribe
 * function. A no-op subscription (never calls back) on engines without
 * `visualViewport` support.
 */
export const subscribeVisualViewportResizeSettled =
  createResizeSettledSubscription(window.visualViewport, "resize");
