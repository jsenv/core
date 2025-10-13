/**
 * Enables scroll-through behavior for overlay elements like validation messages.
 * When a user scrolls over an overlay, instead of scrolling the document or the overlay itself,
 * this finds and scrolls the most appropriate scrollable container that's behind the overlay.
 * This creates more intuitive scrolling behavior where the content the user is focused on
 * (behind the overlay) scrolls as expected, rather than unexpected document scrolling.
 */

import { isScrollable } from "./is_scrollable.js";
import { getScrollableParent } from "./parent_scroll.js";

export const allowWheelThrough = (element) => {
  const onWheel = (wheelEvent) => {
    const deltaX = wheelEvent.deltaX;
    const deltaY = wheelEvent.deltaY;
    const elementsBehindMouse = document.elementsFromPoint(
      wheelEvent.clientX,
      wheelEvent.clientY,
    );
    for (const elementBehindMouse of elementsBehindMouse) {
      if (elementBehindMouse === document.documentElement) {
        // let browser handle document scrolling
        return;
      }

      // check if jsenv validation message itself is scrollable
      // if yes we'll let the browser handle it
      const mightScrollLeft =
        deltaX && canApplyScrollDelta(elementBehindMouse, deltaX, "x");
      const mightScrollTop =
        deltaY && canApplyScrollDelta(elementBehindMouse, deltaY, "y");
      if (
        (mightScrollLeft || mightScrollTop) &&
        isScrollable(elementBehindMouse)
      ) {
        if (element.contains(elementBehindMouse)) {
          // let browser handle the scroll hapenning on the jsenv validation message
          return;
        }
        applyScrollByWheel(elementBehindMouse, wheelEvent);
        return;
      }

      if (
        elementBehindMouse === element ||
        element.contains(elementBehindMouse)
      ) {
        // we don't care about jsenv validation message itself
        // we search for scrollable element that might be behind it
        continue;
      }

      const scrollableParent = getScrollableParent(elementBehindMouse);
      if (scrollableParent === document.documentElement) {
        // the scrollable element directly behind jsenv validation message is the document
        return;
      }

      // we found what we want to fix: a scrollable element behind jsenv validation message
      // we want to scroll this little guy
      const parentCanApplyScrollDeltaX =
        deltaX && canApplyScrollDelta(scrollableParent, deltaX, "x");
      const parentCanApplyScrollDeltaY =
        deltaY && canApplyScrollDelta(scrollableParent, deltaY, "y");
      if (!parentCanApplyScrollDeltaX && !parentCanApplyScrollDeltaY) {
        // the parent cannot scroll, give a chance to next element behind
        // to find the next scrollable parent
        continue;
      }
      applyScrollByWheel(elementBehindMouse, wheelEvent);
      return;
    }
  };
  element.addEventListener("wheel", onWheel);
};

const canApplyScrollDelta = (element, delta, axis) => {
  const {
    clientWidth,
    clientHeight,
    scrollWidth,
    scrollHeight,
    scrollLeft,
    scrollTop,
  } = element;

  let size = axis === "x" ? clientWidth : clientHeight;
  let currentScroll = axis === "x" ? scrollLeft : scrollTop;
  let scrollEnd = axis === "x" ? scrollWidth : scrollHeight;

  if (size === scrollEnd) {
    return false;
  }
  if (delta > 0) {
    if (currentScroll >= scrollEnd) {
      return false;
    }
  } else if (currentScroll <= 0) {
    return false;
  }
  return true;
};

const applyScrollByWheel = (element, wheelEvent) => {
  wheelEvent.preventDefault();
  element.scrollBy({
    top: wheelEvent.deltaY,
    left: wheelEvent.deltaX,
    behavior: wheelEvent.deltaMode === 0 ? "auto" : "smooth", // optional tweak
  });
};
