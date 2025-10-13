/**
 * Creates intuitive scrolling behavior when scrolling over an element that needs to stay interactive
 * (we can't use pointer-events: none). Instead of scrolling the document unexpectedly,
 * finds and scrolls the appropriate scrollable container behind the overlay.
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
      applyScrollByWheel(scrollableParent, wheelEvent);
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
    // when scrollWidth === clientWidth, there is no scroll to apply
    return false;
  }
  if (delta < 0 && currentScroll <= 0) {
    // when scrollLeft is 0, we can't scroll to the left
    return false;
  }
  if (delta > 0 && currentScroll >= scrollEnd) {
    // when scrollLeft + size >= scrollWidth, we can't scroll to the right
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
