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

/**
 * The `positionArea` grammar shared by Popover and Dialog: two
 * space-separated words, order-independent (every value but "center"
 * belongs to exactly one axis). y: above/aligned-top/center/aligned-bottom/
 * below. x: on-the-left/aligned-left/center/aligned-right/on-the-right. A
 * bare word means no overlap with whatever it's positioned relative to;
 * "aligned-" means edges touching. A single word implies "center" on the
 * other axis (e.g. a corner is spelled out as "aligned-top aligned-left",
 * no dedicated corner presets). Loosely inspired by CSS `position-area`.
 */
export const POSITION_AREA_X_VALUES = new Set([
  "on-the-left",
  "aligned-left",
  "center",
  "aligned-right",
  "on-the-right",
]);
export const POSITION_AREA_Y_VALUES = new Set([
  "above",
  "aligned-top",
  "center",
  "aligned-bottom",
  "below",
]);

/**
 * Parses a positionArea string into a { y, x } pair, or null if it's not a
 * recognized word/pair.
 */
export const parsePositionArea = (
  value,
  { defaultX = "center", defaultY = "center" } = {},
) => {
  const tokens = value.split(" ");
  if (tokens.length === 1) {
    const [token] = tokens;
    if (token === "center") {
      return { y: "center", x: "center" };
    }
    if (POSITION_AREA_Y_VALUES.has(token)) {
      return { y: token, x: defaultX };
    }
    if (POSITION_AREA_X_VALUES.has(token)) {
      return { y: defaultY, x: token };
    }
    return null;
  }
  if (tokens.length === 2) {
    const [a, b] = tokens;
    // Every value but "center" is unique to one axis, so either order
    // works — whichever token is the Y value becomes y, the other x.
    if (POSITION_AREA_Y_VALUES.has(a) && POSITION_AREA_X_VALUES.has(b)) {
      return { y: a, x: b };
    }
    if (POSITION_AREA_X_VALUES.has(a) && POSITION_AREA_Y_VALUES.has(b)) {
      return { y: b, x: a };
    }
  }
  return null;
};

/**
 * Maps a positionArea y/x pair to a concrete `navi-animation` value (a
 * `prefix` plus a direction word), or `null` if both axes overlap the anchor
 * (no direction at all — that's `resolvedAnimationKind === "scaling"`
 * territory instead, see resolveAutoAnimationKind below).
 *
 * `prefix: "slide-from"` (used with no real anchor — Dialog always, Popover
 * when docked) keeps the word as the compass direction the popup comes
 * from: placed "above" (a point/corner), it slides in from the top.
 * `prefix: "expand"` (a real anchor, Popover-only) uses the motion/growth
 * direction instead, the opposite compass point: placed "above" the
 * anchor, it moves/grows up, away from the anchor (which sits below it).
 *
 * "aligned-*"/"center" contribute no direction on their axis either way.
 */
export const resolveDirectionValue = (y, x, { prefix }) => {
  const yWord =
    y === "above"
      ? prefix === "expand"
        ? "up"
        : "top"
      : y === "below"
        ? prefix === "expand"
          ? "down"
          : "bottom"
        : null;
  const xWord =
    x === "on-the-left" ? "left" : x === "on-the-right" ? "right" : null;
  if (!yWord && !xWord) {
    return null;
  }
  return yWord && xWord
    ? `${prefix}-${yWord}-${xWord}`
    : `${prefix}-${yWord || xWord}`;
};

/**
 * Shared `animation="auto"`/`true` resolution: "scaling" reads best overall
 * — picked for any real anchor, or for a point/corner placed dead-center
 * (both positionArea axes overlapping — there's no sensible direction to
 * slide from in that case). "sliding" otherwise. `anchor` is `undefined`
 * for any no-anchor/docked case (Dialog always, Popover's own custom
 * renderer when there's no real anchor), so this collapses to "scaling"
 * there only for the dead-center case, "sliding" otherwise. The two
 * "overlapping" booleans below describe the *positionArea* itself (a bare
 * word vs. "aligned-"/"center"), not anything about the anchor — they'd
 * mean exactly the same thing even with no anchor at all, since it's the
 * position strategy, not the anchor, that decides whether there's a
 * direction to slide from.
 */
export const resolveAutoAnimationKind = (anchor, parsedPositionArea) => {
  const yIsOverlapping =
    parsedPositionArea.y !== "above" && parsedPositionArea.y !== "below";
  const xIsOverlapping =
    parsedPositionArea.x !== "on-the-left" &&
    parsedPositionArea.x !== "on-the-right";
  return anchor || (yIsOverlapping && xIsOverlapping) ? "scaling" : "sliding";
};
