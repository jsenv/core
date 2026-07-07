/**
 * Small, renderer-agnostic helpers shared by Popover and Dialog's own custom
 * (non-top-layer) renderers — operate on a plain DOM element, no knowledge
 * of which of the two owns it.
 */

import { findEvent } from "@jsenv/dom";

/**
 * Disables pointer-events on `el` until its current CSS transition settles
 * (via `transitionend`, with a safety `setTimeout` fallback matching the
 * longest `transition-duration` in case nothing actually transitions or an
 * event is missed) — avoids the cursor changing/something becoming
 * clickable while the popup is still visually moving into or out of place.
 *
 * Returns a "cancel" function: doesn't restore pointer-events (a fresh call
 * for the next open/close is about to set its own state) — only prevents
 * this stale instance's `transitionend` listener/timeout from firing later
 * and clobbering that fresh state.
 */
export const suppressPointerEventsDuringTransition = (el) => {
  el.style.pointerEvents = "none";
  let settled = false;
  const onTransitionEnd = (transitionEvent) => {
    if (transitionEvent.target === el) {
      finish();
    }
  };
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    el.style.pointerEvents = "";
    el.removeEventListener("transitionend", onTransitionEnd);
    clearTimeout(safetyTimeoutId);
  };
  el.addEventListener("transitionend", onTransitionEnd);
  const durationsInSeconds = getComputedStyle(el)
    .transitionDuration.split(",")
    .map((value) => parseFloat(value) || 0);
  const longestDurationMs = Math.max(0, ...durationsInSeconds) * 1000;
  const safetyTimeoutId = setTimeout(finish, longestDurationMs + 50);
  return () => {
    if (settled) {
      return;
    }
    settled = true;
    el.removeEventListener("transitionend", onTransitionEnd);
    clearTimeout(safetyTimeoutId);
  };
};

/**
 * Hides the backdrop, deferring until the browser's matching "click" fires
 * when `closeEvent` was triggered by a mousedown (see popover.jsx's top
 * comment for why) — same capture-phase-on-document pattern as
 * armSuppressNextOpenRequest in open_controller.js, which a plain timeout
 * can't safely replace: mouseup (and the click that follows it) can land an
 * arbitrarily long time after mousedown (the user is still holding the
 * button down), so a short timeout can fire first and hide the backdrop
 * before its own click ever arrives. A capture-phase listener on document
 * fires for every click regardless of what any bubble-phase handler does
 * downstream, so no fallback timer is needed.
 *
 * `hide` is the caller's own way to actually hide the backdrop
 * (`hidePopover()` for a top-layer backdrop, a plain `style.display = "none"`
 * for a plain div) — this helper only owns the mousedown/click timing.
 *
 * Returns a disarm function (or undefined if hidden immediately), so a
 * fresh open can cancel a pending hide it's about to make redundant.
 */
export const armPointerDownOutsideClose = (closeEvent, hide) => {
  const mousedownEvent = findEvent(closeEvent, "mousedown");
  if (!mousedownEvent) {
    hide();
    return undefined;
  }
  const onClick = () => {
    document.removeEventListener("click", onClick, { capture: true });
    hide();
  };
  document.addEventListener("click", onClick, { capture: true });
  return () => {
    document.removeEventListener("click", onClick, { capture: true });
  };
};
