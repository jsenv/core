/**
 * A visualViewport "resize" fires once per real keyboard/browser-chrome
 * change, but also transiently on mobile whenever focus moves from one
 * input to another (the keyboard briefly starts to close before the next
 * input reopens it) — debounced here so anything reacting to "the visual
 * viewport settled" skips that transient in-between state instead of
 * flickering through it.
 *
 * A *single*, module-level timer shared by every subscriber (rather than
 * each consumer keeping its own identical-duration timer) is the
 * load-bearing part: visible_rect.js's own visibleRectEffect (repositions
 * anchored elements — e.g. a Dialog's top/left) and @jsenv/navi's
 * navi-vvh/navi-vvw custom properties (drive height/width off the same
 * viewport) both need to settle on the exact same tick, or whichever one
 * *doesn't* delay quite as long flickers a moment out of sync with the one
 * that does — two independent `setTimeout(fn, 100)` calls scheduled from
 * two separate listeners are not guaranteed to land in the same tick.
 * Routing every subscriber through one shared publish instead removes that
 * drift entirely.
 */

import { createPubSub } from "../pub_sub.js";

const [publish, subscribeVisualViewportResizeSettled] = createPubSub();
if (window.visualViewport) {
  let resizeTimeoutId;
  window.visualViewport.addEventListener("resize", (event) => {
    clearTimeout(resizeTimeoutId);
    resizeTimeoutId = setTimeout(() => {
      publish(event);
    }, 100);
  });
}

/**
 * Registers `callback` to run once the visual viewport "settles" after a
 * resize (see the module-level comment above for why this is debounced, and
 * shared across every subscriber rather than each debouncing
 * independently). Returns an unsubscribe function. A no-op subscription
 * (never calls back) on engines without `visualViewport` support.
 */
export { subscribeVisualViewportResizeSettled };
