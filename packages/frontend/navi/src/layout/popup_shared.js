/**
 * Small, renderer-agnostic helpers shared by Popover and Dialog's own custom
 * (non-top-layer) renderers — operate on a plain DOM element, no knowledge
 * of which of the two owns it.
 */

import {
  ELEMENT_SIZE_CHANGE,
  findEvent,
  getScrollContainer,
  scrollIntoViewScoped,
} from "@jsenv/dom";

/**
 * Whether a visibleRectEffect delivery is one that can have taken height away
 * from a popup, and so pushed whatever holds focus out of sight:
 * - "resize": the window/visual viewport settled — which is also how the
 *   on-screen keyboard arrives, overlay or not (window_size.js);
 * - ELEMENT_SIZE_CHANGE: the popup's own box measured different;
 * - "focusin": the focus-settled re-measure, for the room that changes with
 *   nothing announcing it (subscribeFocusSettled in window_size.js).
 *
 * Everything else is a scroll of one kind or another, where nothing got
 * smaller and scrolling the focused element back would fight the very gesture
 * that fired it.
 */
export const mayHaveHiddenFocus = (event) => {
  const type = event?.type;
  return (
    type === "resize" || type === ELEMENT_SIZE_CHANGE || type === "focusin"
  );
};

const scrollportHeightMap = new WeakMap();
/**
 * Scrolls whatever holds focus inside `popupEl` back into view, if the popup
 * getting shorter has pushed it out.
 *
 * The case this exists for: a field low in the scrolling body of a popup that
 * also has a footer (box.jsx — with a body, the body is the only thing that
 * scrolls and the footer is a sibling sitting right under it). Focusing the
 * field makes the browser scroll it into view, which it does against the
 * popup's height AT THAT MOMENT; the on-screen keyboard then opens and takes
 * that height away. The body shrinks, its scrollTop does not move, so the
 * content slides down relative to the shorter scrollport and the field ends up
 * past its bottom edge — visually, swallowed by the footer. The browser does
 * not redo a scroll-into-view it already answered, so this does.
 *
 * Only what the shrink itself hid, though: with the keyboard up the user reads
 * the rest of the popup by scrolling the field away — to reach the submit under
 * it, typically — and the room keeps changing while they do (a keyboard settling
 * in two steps, a suggestion strip, a browser bar). Answering each of those by
 * scrolling the field back takes the popup away from wherever they had just
 * scrolled it, over and over: what they were reading cannot be reached at all
 * without blurring the field first, and the popup reads as unscrollable. So the
 * field is brought back only when it was in view before the room shrank, which
 * one remembered number answers: a resize moves neither scrollTop nor the
 * element's offset inside the scrolled content, so measuring against the height
 * the scrollport HAD is measuring the state before the change.
 *
 * Scoped to the field's own scroll container (never the page): a popup traps
 * scrolling precisely so the document underneath cannot move, and a plain
 * scrollIntoView walks past a container whose scrollbar isn't visible — see
 * scrollIntoViewScoped's own doc.
 *
 * "nearest": the smallest scroll that makes it visible, and none at all when it
 * already is. Where it lands is the container's own business — a navi scroller
 * keeps a band free at its edges so a field never comes back glued to one (see
 * scroll-padding in box.jsx).
 */
export const keepFocusedElementVisible = (popupEl) => {
  const { activeElement } = document;
  if (!activeElement || activeElement === popupEl) {
    return;
  }
  if (!popupEl.contains(activeElement)) {
    return;
  }
  const scrollContainer = getScrollContainer(activeElement);
  if (!scrollContainer || !popupEl.contains(scrollContainer)) {
    // What scrolls the field is outside the popup, which means the page: a
    // popup holds it still on purpose (trapScrollInside), so there is nothing
    // here to scroll back.
    return;
  }
  const scrollportHeight = scrollContainer.clientHeight;
  const scrollportHeightBefore = scrollportHeightMap.get(scrollContainer);
  scrollportHeightMap.set(scrollContainer, scrollportHeight);
  if (scrollportHeightBefore !== undefined) {
    if (scrollportHeight >= scrollportHeightBefore) {
      // Nothing was taken away, so nothing was hidden by this.
      return;
    }
    if (
      !isVisibleInScrollport(
        activeElement,
        scrollContainer,
        scrollportHeightBefore,
      )
    ) {
      return;
    }
  }
  scrollIntoViewScoped(activeElement, {
    container: scrollContainer,
    block: "nearest",
  });
};

// Whether any part of `el` was showing in `container` back when its scrollport
// was `scrollportHeight` tall. Both boxes are read now: the container may have
// moved as well as shrunk (a centered dialog re-centers itself), and the
// difference between the two tops is what that move leaves alone.
const isVisibleInScrollport = (el, container, scrollportHeight) => {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const elTop = elRect.top - containerRect.top + container.scrollTop;
  const elBottom = elTop + elRect.height;
  const scrollportTop = container.scrollTop;
  const scrollportBottom = scrollportTop + scrollportHeight;
  return elBottom > scrollportTop && elTop < scrollportBottom;
};

/**
 * Calls `onSettled` once `el`'s current CSS transition is over — via
 * `transitionend`, with a safety `setTimeout` fallback matching the longest
 * `transition-duration`, in case nothing actually transitions or an event is
 * missed.
 *
 * Returns a "cancel" function, so a caller whose instance has been superseded
 * (a fresh open/close about to set its own state) can keep this stale one from
 * firing later. Cancelling only stops `onSettled`: undoing whatever the caller
 * did up front is that fresh call's business, not this one's.
 */
export const whenTransitionSettles = (el, onSettled) => {
  let settled = false;
  const onTransitionEnd = (transitionEvent) => {
    if (transitionEvent.target === el) {
      finish();
    }
  };
  const stopWatching = () => {
    settled = true;
    el.removeEventListener("transitionend", onTransitionEnd);
    clearTimeout(safetyTimeoutId);
  };
  const finish = () => {
    if (settled) {
      return;
    }
    stopWatching();
    onSettled();
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
    stopWatching();
  };
};

/**
 * Drops the document's text selection when it lives inside `el`, leaving a
 * selection made elsewhere on the page alone.
 *
 * A popup being closed takes its content with it, and a selection is a claim
 * on content the user can still act on: kept, it would outlive the surface it
 * was made on — painted on the box for the length of its exit transition, with
 * the handles and the copy toolbar a phone draws from the live selection
 * hanging over something that is going away — and reappear with the box on
 * the next opening. Dropping the selection is the only way to remove that
 * chrome: a `user-select: none` on the closing box hides the highlight in some
 * browsers only, and the handles are the browser's own, drawn from the
 * selection object rather than from any style.
 */
export const clearTextSelectionInside = (el) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) {
    return;
  }
  selection.removeAllRanges();
};

/**
 * Disables pointer-events on `el` until its current CSS transition settles —
 * avoids the cursor changing/something becoming clickable while the popup is
 * still visually moving into or out of place.
 *
 * Returns whenTransitionSettles' own "cancel" function: it doesn't restore
 * pointer-events, since a fresh call for the next open/close is about to set
 * its own state.
 */
export const suppressPointerEventsDuringTransition = (el) => {
  el.style.pointerEvents = "none";
  return whenTransitionSettles(el, () => {
    el.style.pointerEvents = "";
  });
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
 * Maps a positionArea y/x pair to a concrete `navi-animation` value (a
 * `prefix` plus a direction word), or `null` if both axes overlap the anchor
 * (no direction at all — that's `resolvedAnimationKind === "scaling"`
 * territory instead, see resolveAutoAnimationKind below).
 *
 * `prefix: "slide-from"` (used with no real anchor — Dialog always, Popover
 * when docked) keeps the word as the compass direction the popup comes
 * from: placed "top" (a point/corner), it slides in from the top.
 * `prefix: "expand"` (a real anchor, Popover-only) uses the motion/growth
 * direction instead, the opposite compass point: placed "top" of the
 * anchor, it moves/grows up, away from the anchor (which sits below it).
 *
 * "inset-*"/"center" contribute no direction on their axis either way.
 */
export const resolveDirectionValue = (y, x, { prefix }) => {
  const yWord =
    y === "top"
      ? prefix === "expand"
        ? "up"
        : "top"
      : y === "bottom"
        ? prefix === "expand"
          ? "down"
          : "bottom"
        : null;
  const xWord = x === "left" ? "left" : x === "right" ? "right" : null;
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
 * word vs. "inset-"/"center"), not anything about the anchor — they'd
 * mean exactly the same thing even with no anchor at all, since it's the
 * position strategy, not the anchor, that decides whether there's a
 * direction to slide from.
 */
export const resolveAutoAnimationKind = (anchor, parsedPositionArea) => {
  const yIsOverlapping =
    parsedPositionArea.y !== "top" && parsedPositionArea.y !== "bottom";
  const xIsOverlapping =
    parsedPositionArea.x !== "left" && parsedPositionArea.x !== "right";
  return anchor || (yIsOverlapping && xIsOverlapping) ? "scaling" : "sliding";
};

/**
 * An opening that reaches a popup with no element of its own to show.
 *
 * The one cause seen so far, and it is silent: something inside the popup
 * suspended while its content was being built, and the `<Loading>` that caught
 * it sits ABOVE the popup. A boundary suspending on an update keeps the page as
 * it was, as a copy, so what is opened here belongs to a copy nobody owns any
 * more — and once the data arrives the subtree is rebuilt from scratch, closed
 * and empty. Nothing is thrown, nothing is drawn, and the press is lost.
 */
export const warnPopupHasNoElementToOpen = (popupKind) => {
  console.warn(
    `[navi] a "${popupKind}" was asked to open and has no element to open. What usually did it: content inside it suspended, and the <Loading> that caught the wait is above the popup rather than inside it — the popup was set aside with the rest of what that boundary holds, and this opening is lost (the next one works). Put a <Loading> inside the popup, or draw the wait in the component itself with useAsyncData(action, { loading: true }).`,
  );
};

/**
 * A popup reads "outside" from its own border box: what a press lands on
 * decides nothing on its own (a genuine backdrop press and a press on the
 * popup's padding both report the popup element as their target, there being
 * no real ::backdrop node to be one), so the rectangle is what tells them
 * apart. That holds as long as the box and what the popup paints are the same
 * thing — which stops being true for a popup with no surface of its own
 * (`backgroundColor="transparent"`, no shadow, no padding): what the eye reads
 * as backdrop is then inside the box, and a press there stays a press on the
 * popup.
 *
 * `data-navi-popup-outside` is how a caller says which of its own boxes are
 * not the surface. It is opt-in because navi cannot infer it — a background
 * can come from anywhere — while the caller who made the popup see-through
 * knows exactly which box is decoration and which is paper.
 *
 * The marker answers for the element it is on, never for its descendants: a
 * box painted inside a marked one is still surface, so a row can be marked and
 * its empty halves read as backdrop while presses on the controls it holds do
 * not dismiss anything. A descendant with `pointer-events: none` never becomes
 * a press target at all, so the marked box answers in its place — while the
 * same declaration on the marked box itself takes it out of hit-testing and
 * makes the marker unreachable (see warnAboutUnreachableOutsideRegions).
 */
const OUTSIDE_REGION_ATTRIBUTE = "data-navi-popup-outside";

/**
 * What a press landing on a region the caller declared as not-its-surface
 * does: exactly what the same press on the backdrop would do.
 *
 * Lives on the popup's own content element rather than in the backdrop's
 * handler, for both renderers: the backdrop is a sibling behind the popup
 * (never an ancestor), so a press inside the popup's box never reaches it.
 */
export const handlePressOnOutsideRegion = (
  mouseDownEvent,
  { popupEl, openController, pointerInteractionOutsideEffect },
) => {
  if (mouseDownEvent.button !== 0) {
    return;
  }
  const { target } = mouseDownEvent;
  if (!target.hasAttribute(OUTSIDE_REGION_ATTRIBUTE)) {
    return;
  }
  // A popup opens inside its opener's own subtree, so a press on a region
  // belonging to a popup nested in this one bubbles through here too — and it
  // is a press on what is in front, not on this popup's own decoration.
  if (
    target.closest(`[navi-control="dialog"], [navi-control="popover"]`) !==
    popupEl
  ) {
    return;
  }
  if (pointerInteractionOutsideEffect === "capture") {
    mouseDownEvent.preventDefault();
    return;
  }
  if (
    pointerInteractionOutsideEffect === "close" ||
    pointerInteractionOutsideEffect === "cancel"
  ) {
    openController.requestClose(mouseDownEvent, {
      isCancel: pointerInteractionOutsideEffect === "cancel",
    });
  }
};

/**
 * `pointer-events: none` and `inert` are the two things reached for to say
 * "this part of my box is not really there", and neither reaches the popup:
 * inert speaks to the keyboard and to assistive technology, and
 * pointer-events takes the box out of hit-testing so the press is answered by
 * an ancestor that is still the popup's own surface. Writing them next to the
 * marker is the natural mistake, and it makes the marker silently unreachable
 * — so it is said out loud, once per open.
 */
export const warnAboutUnreachableOutsideRegions = (popupEl) => {
  for (const regionEl of popupEl.querySelectorAll(
    `[${OUTSIDE_REGION_ATTRIBUTE}]`,
  )) {
    if (getComputedStyle(regionEl).pointerEvents === "none") {
      console.warn(
        `[navi] ${OUTSIDE_REGION_ATTRIBUTE} on an element with "pointer-events: none" is never read: the press is answered by the nearest ancestor still in hit-testing, which is the popup itself. Drop pointer-events; the marker alone is what makes a press there count as outside.`,
        regionEl,
      );
    }
  }
};
