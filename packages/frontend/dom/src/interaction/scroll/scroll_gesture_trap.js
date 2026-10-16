import { canScroll } from "./is_scrollable.js";

// A gesture on an element the browser paints in the top layer belongs to that
// element, wherever it sits in the DOM.
const TOP_LAYER_SELECTOR = [
  ":popover-open",
  "dialog:modal",
  ":fullscreen",
].join(",");

// The keys that scroll the document when nothing focusable holds them.
const SCROLL_KEY_SET = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

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
 * @param {boolean} [options.containInside] - Also cancel a gesture landing
 *   inside `element` that nothing between it and `element` can scroll in its
 *   direction. For an overlay that is not a scroll container itself (a box of
 *   the page shown in the top layer where it stood): its scroll chain goes
 *   straight to the viewport, and no `overscroll-behavior` of its own can stop
 *   it there.
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
  // gesture goes, with room left to go there.
  const isTakenInside = (target, deltaX, deltaY) => {
    let ancestorOrSelf = target;
    while (ancestorOrSelf && ancestorOrSelf.nodeType === 1) {
      if (deltaY && canScroll(ancestorOrSelf, "y")) {
        const { scrollTop, scrollHeight, clientHeight } = ancestorOrSelf;
        if (
          deltaY < 0 ? scrollTop > 0 : scrollTop + clientHeight < scrollHeight
        ) {
          return true;
        }
      }
      if (deltaX && canScroll(ancestorOrSelf, "x")) {
        const { scrollLeft, scrollWidth, clientWidth } = ancestorOrSelf;
        if (
          deltaX < 0
            ? Math.abs(scrollLeft) > 0
            : Math.abs(scrollLeft) + clientWidth < scrollWidth
        ) {
          return true;
        }
      }
      if (ancestorOrSelf === element) {
        break;
      }
      ancestorOrSelf = ancestorOrSelf.parentNode;
    }
    return false;
  };
  const leaksFromInside = (target, deltaX, deltaY) =>
    containInside &&
    target !== element &&
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
      ) ||
      leaksFromInside(wheelEvent.target, wheelEvent.deltaX, wheelEvent.deltaY)
    ) {
      wheelEvent.preventDefault();
    }
  };
  // Where the finger was at the previous touch event: a touchmove carries no
  // delta of its own.
  let previousTouch = null;
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
    const deltaX = previousTouch ? previousTouch.x - touch.clientX : 0;
    const deltaY = previousTouch ? previousTouch.y - touch.clientY : 0;
    previousTouch = { x: touch.clientX, y: touch.clientY };
    if (
      isBackgroundGesture(
        touchMoveEvent.target,
        touch.clientX,
        touch.clientY,
      ) ||
      leaksFromInside(touchMoveEvent.target, deltaX, deltaY)
    ) {
      touchMoveEvent.preventDefault();
    }
  };
  const onKeyDown = (keydownEvent) => {
    if (!SCROLL_KEY_SET.has(keydownEvent.key)) {
      return;
    }
    const { target } = keydownEvent;
    // Anything else focused (a field, a scrollable box, a button) owns the key
    // press; only a document with nothing focused scrolls on it.
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

  // Capture phase: the gesture must be cancelled before whatever it landed on
  // gets a chance to act on it. passive: false is what makes preventDefault
  // effective at all on wheel/touchmove.
  const listenerOptions = { capture: true, passive: false };
  ownerDocument.addEventListener("wheel", onWheel, listenerOptions);
  if (containInside) {
    ownerDocument.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
  }
  ownerDocument.addEventListener("touchmove", onTouchMove, listenerOptions);
  ownerDocument.addEventListener("keydown", onKeyDown, listenerOptions);
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
  };
};
