import { getKeyboardEventDefaultAction } from "../keyboard.js";
import { canScroll } from "./is_scrollable.js";

// A gesture on an element the browser paints in the top layer belongs to that
// element, wherever it sits in the DOM.
const TOP_LAYER_SELECTOR = [
  ":popover-open",
  "dialog:modal",
  ":fullscreen",
].join(",");

// The keys that scroll the document when nothing focusable holds them, and
// the way each one goes, as a wheel would: [deltaX, deltaY].
const SCROLL_KEY_DELTA_MAP = new Map([
  ["ArrowUp", [0, -1]],
  ["ArrowDown", [0, 1]],
  ["ArrowLeft", [-1, 0]],
  ["ArrowRight", [1, 0]],
  ["PageUp", [0, -1]],
  ["PageDown", [0, 1]],
  ["Home", [0, -1]],
  ["End", [0, 1]],
  [" ", [0, 1]],
]);
// What a scroll key does by itself on these, whatever it would scroll: a
// closed <select> changes its value with the arrows, a media element's
// controls seek with them.
const KEY_OWNER_SELECTOR = "select, audio, video";

/**
 * Stops the background from scrolling by cancelling the scroll gestures that
 * would reach it, leaving every style on the page untouched.
 *
 * **Why not overflow: hidden?**
 * A scroll container that cannot scroll has no sticky offsets: browsers only
 * apply `position: sticky` constraints to a scroller that can actually scroll.
 * Locking the document with `overflow: hidden` therefore drops every stuck
 * element (a sticky header, a sticky table column) back to its flow position —
 * off screen, since the page stays visually scrolled where it was. Cancelling
 * gestures keeps the scroller scrollable, so sticky, the scrollbar and the
 * layout width all stay exactly as they are (no gutter to compensate).
 *
 * **What it does not stop**
 * - dragging the native scrollbar: it sits outside the viewport, no backdrop
 *   covers it and no event of ours is involved;
 * - programmatic scroll (`scrollTo`, `scrollIntoView`, a focus moving into the
 *   background).
 * Both are deliberate acts on a background that is covered by a backdrop, hence
 * the requirement: without something covering the background, lock the overflow
 * instead (see `scroll_trap.js`).
 *
 * @param {HTMLElement} element - The overlay being shown. Gestures landing on
 *   it (or on any other top layer element) are left alone.
 * @param {Object} [options]
 * @param {HTMLElement} [options.boundaryElement] - Only block gestures landing
 *   inside this element. For an overlay confined to a local container: the
 *   container must stop scrolling, the rest of the page keeps its gestures.
 * @param {HTMLElement} [options.backdropElement] - The element covering the
 *   background, when it is one of ours (a modal dialog covers it with its own
 *   `::backdrop` and there is nothing to pass). It is in the top layer like the
 *   overlay itself, yet a gesture on it aims at the background behind it.
 * @param {() => {left: number, top: number, right: number, bottom: number}} [options.getElementBox]
 *   - Where `element` is on screen, when that is less than its border box (an
 *   overlay clipped by a clip-path): a gesture outside that box but reported on
 *   `element` landed on its `::backdrop`.
 * @param {boolean} [options.containInside] - Also cancel a gesture landing on
 *   or inside `element` that nothing between it and `element` can scroll in
 *   its direction, and a scroll key pressed there the same way. For an overlay
 *   that is not a scroll container itself (a box of the page shown in the top
 *   layer where it stood): its scroll chain goes straight to the viewport, and
 *   no `overscroll-behavior` of its own can stop it there. Decided once what
 *   the gesture landed on has had its say: what takes it from a listener of
 *   its own (a control moving by transform, a drag) cancels it there, and a
 *   gesture cancelled before it gets there is one it refuses.
 * @returns {() => void} Cleanup function removing the listeners.
 */

export const trapScrollGestureInside = (
  element,
  {
    boundaryElement,
    backdropElement,
    getElementBox = () => element.getBoundingClientRect(),
    containInside = false,
  } = {},
) => {
  const { ownerDocument } = element;
  const { defaultView } = ownerDocument;
  const lockedRegion = boundaryElement || ownerDocument.documentElement;

  const isBackgroundGesture = (target, clientX, clientY) => {
    if (!lockedRegion.contains(target)) {
      return false;
    }
    if (element.contains(target)) {
      // A modal <dialog> is the event target for the whole backdrop area too
      // (::backdrop is not hit-testable), so being the target does not mean the
      // pointer is on it — the rect decides, same as the backdrop-click
      // detection in dialog.jsx.
      if (target !== element) {
        return false;
      }
      const { left, right, top, bottom } = getElementBox();
      return (
        clientX < left || clientX > right || clientY < top || clientY > bottom
      );
    }
    if (backdropElement && backdropElement.contains(target)) {
      return true;
    }
    let ancestorOrSelf = target;
    while (ancestorOrSelf && ancestorOrSelf.nodeType === 1) {
      if (ancestorOrSelf.matches(TOP_LAYER_SELECTOR)) {
        return false;
      }
      ancestorOrSelf = ancestorOrSelf.parentNode;
    }
    return true;
  };

  // Whether something from `target` up to `element` scrolls the way the
  // gesture mostly goes, with room left to go there. A box in the top layer,
  // or fixed, ends the walk: its scroll chain goes on to the viewport, not to
  // its parent in the DOM.
  const isTakenInside = (target, deltaX, deltaY) => {
    const axis = Math.abs(deltaY) >= Math.abs(deltaX) ? "y" : "x";
    const delta = axis === "y" ? deltaY : deltaX;
    let ancestorOrSelf = target;
    while (ancestorOrSelf && ancestorOrSelf.nodeType === 1) {
      if (
        canScroll(ancestorOrSelf, axis) &&
        hasRoomToScroll(ancestorOrSelf, axis, delta)
      ) {
        return true;
      }
      if (ancestorOrSelf === element) {
        return false;
      }
      if (
        ancestorOrSelf.matches(TOP_LAYER_SELECTOR) ||
        getComputedStyle(ancestorOrSelf).position === "fixed"
      ) {
        return false;
      }
      ancestorOrSelf = ancestorOrSelf.parentNode;
    }
    return false;
  };
  // On `element` itself too, inside its box: on its padding, between what it
  // holds. Outside that box it is the wall, decided first (isBackgroundGesture).
  const leaksFromInside = (target, deltaX, deltaY) =>
    // A move with no direction scrolls nothing.
    (deltaX !== 0 || deltaY !== 0) &&
    element.contains(target) &&
    !isTakenInside(target, deltaX, deltaY);

  const onWheel = (wheelEvent) => {
    if (wheelEvent.ctrlKey) {
      // Browser zoom, not a scroll — cancelling it would take zoom away from
      // the page while an overlay is open.
      return;
    }
    if (
      isBackgroundGesture(
        wheelEvent.target,
        wheelEvent.clientX,
        wheelEvent.clientY,
      )
    ) {
      wheelEvent.preventDefault();
    }
  };
  const onWheelInside = (wheelEvent) => {
    if (
      wheelEvent.ctrlKey ||
      wheelEvent.defaultPrevented ||
      !wheelEvent.cancelable
    ) {
      return;
    }
    if (
      leaksFromInside(wheelEvent.target, wheelEvent.deltaX, wheelEvent.deltaY)
    ) {
      wheelEvent.preventDefault();
    }
  };
  // Where the finger was at the previous touch event: a touchmove carries no
  // delta of its own. Read in the capture phase, which every touchmove goes
  // through, for the decision taken once it has been through its target.
  let previousTouch = null;
  let touchMoveDelta = null;
  const onTouchStart = (touchStartEvent) => {
    const { touches } = touchStartEvent;
    previousTouch =
      touches.length === 1
        ? { x: touches[0].clientX, y: touches[0].clientY }
        : null;
  };
  const onTouchMove = (touchMoveEvent) => {
    const { touches } = touchMoveEvent;
    if (touches.length !== 1) {
      return; // pinch
    }
    const [touch] = touches;
    // The content moves against the finger.
    touchMoveDelta = {
      touchMoveEvent,
      deltaX: previousTouch ? previousTouch.x - touch.clientX : 0,
      deltaY: previousTouch ? previousTouch.y - touch.clientY : 0,
    };
    previousTouch = { x: touch.clientX, y: touch.clientY };
    if (
      isBackgroundGesture(touchMoveEvent.target, touch.clientX, touch.clientY)
    ) {
      touchMoveEvent.preventDefault();
    }
  };
  const onTouchMoveInside = (touchMoveEvent) => {
    if (touchMoveDelta?.touchMoveEvent !== touchMoveEvent) {
      return; // pinch
    }
    const { deltaX, deltaY } = touchMoveDelta;
    touchMoveDelta = null;
    if (touchMoveEvent.defaultPrevented || !touchMoveEvent.cancelable) {
      return;
    }
    if (leaksFromInside(touchMoveEvent.target, deltaX, deltaY)) {
      touchMoveEvent.preventDefault();
    }
  };
  const onKeyDown = (keydownEvent) => {
    if (!SCROLL_KEY_DELTA_MAP.has(keydownEvent.key)) {
      return;
    }
    const { target } = keydownEvent;
    // Anything else focused (a field, a scrollable box, a button) owns the key
    // press; only a document with nothing focused scrolls on it. Inside
    // `element`, with containInside, what really owns it is asked
    // (onKeyDownInside).
    if (
      target !== ownerDocument.body &&
      target !== ownerDocument.documentElement
    ) {
      return;
    }
    if (isBackgroundGesture(target)) {
      keydownEvent.preventDefault();
    }
  };
  // A key whose default would scroll, pressed where nothing between there and
  // `element` scrolls that way.
  const onKeyDownInside = (keydownEvent) => {
    if (
      keydownEvent.defaultPrevented ||
      keydownEvent.altKey ||
      keydownEvent.ctrlKey ||
      keydownEvent.metaKey
    ) {
      return;
    }
    const scrollDelta = SCROLL_KEY_DELTA_MAP.get(keydownEvent.key);
    if (!scrollDelta) {
      return;
    }
    const { target } = keydownEvent;
    if (!element.contains(target)) {
      return;
    }
    if (keydownEvent.composedPath()[0] !== target) {
      // Pressed in a shadow tree, whose host the target is: what the key does
      // in there is not known from here.
      return;
    }
    if (target.matches(KEY_OWNER_SELECTOR)) {
      return;
    }
    const defaultAction = getKeyboardEventDefaultAction(keydownEvent);
    if (defaultAction !== "scroll" && defaultAction !== "scroll_self") {
      return;
    }
    const [deltaX, deltaY] =
      keydownEvent.key === " " && keydownEvent.shiftKey ? [0, -1] : scrollDelta;
    if (!isTakenInside(target, deltaX, deltaY)) {
      keydownEvent.preventDefault();
    }
  };

  // Capture phase: the gesture must be cancelled before whatever it landed on
  // gets a chance to act on it. passive: false is what makes preventDefault
  // effective at all on wheel/touchmove.
  const listenerOptions = { capture: true, passive: false };
  ownerDocument.addEventListener("wheel", onWheel, listenerOptions);
  ownerDocument.addEventListener("touchmove", onTouchMove, listenerOptions);
  ownerDocument.addEventListener("keydown", onKeyDown, listenerOptions);
  if (containInside) {
    ownerDocument.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    // On the window, after every listener on the way: what is inside has had
    // its say. passive: false said out loud — a wheel or touch listener on the
    // window is passive unless told otherwise.
    defaultView.addEventListener("wheel", onWheelInside, { passive: false });
    defaultView.addEventListener("touchmove", onTouchMoveInside, {
      passive: false,
    });
    defaultView.addEventListener("keydown", onKeyDownInside);
  }
  return () => {
    ownerDocument.removeEventListener("touchstart", onTouchStart, {
      capture: true,
    });
    ownerDocument.removeEventListener("wheel", onWheel, listenerOptions);
    ownerDocument.removeEventListener(
      "touchmove",
      onTouchMove,
      listenerOptions,
    );
    ownerDocument.removeEventListener("keydown", onKeyDown, listenerOptions);
    defaultView.removeEventListener("wheel", onWheelInside);
    defaultView.removeEventListener("touchmove", onTouchMoveInside);
    defaultView.removeEventListener("keydown", onKeyDownInside);
  };
};

// Whether `scroller` has room left on `axis` the way `delta` goes, with a
// pixel of slack against rounded sizes. Its scroll position counts from its
// scroll origin, which is on the right of a right-to-left box and at the bottom
// of some vertical writing modes: from there it reads 0, then negative.
const hasRoomToScroll = (scroller, axis, delta) => {
  const range =
    axis === "y"
      ? scroller.scrollHeight - scroller.clientHeight
      : scroller.scrollWidth - scroller.clientWidth;
  const position = axis === "y" ? scroller.scrollTop : scroller.scrollLeft;
  // From the top, or the left.
  const fromStart = isScrollOriginAtTheEnd(getComputedStyle(scroller), axis)
    ? range + position
    : position;
  return delta < 0 ? fromStart > 1 : fromStart < range - 1;
};
const isScrollOriginAtTheEnd = ({ writingMode, direction }, axis) => {
  const vertical =
    writingMode.startsWith("vertical") || writingMode.startsWith("sideways");
  if (!vertical) {
    return axis === "x" && direction === "rtl";
  }
  if (axis === "x") {
    // Lines stacked from the right.
    return writingMode.endsWith("-rl");
  }
  // sideways-lr runs its text bottom to top.
  return writingMode === "sideways-lr"
    ? direction !== "rtl"
    : direction === "rtl";
};
