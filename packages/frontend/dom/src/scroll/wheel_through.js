/**
 * Creates intuitive scrolling behavior when scrolling over an element that needs to stay interactive
 * (we can't use pointer-events: none). Instead of scrolling the document unexpectedly,
 * finds and scrolls the appropriate scrollable container behind the overlay.
 */

import { isScrollable } from "./is_scrollable.js";
import { getScrollableParent } from "./parent_scroll.js";

export const allowWheelThrough = (element, connectedElement) => {
  const isElementOrDescendant = (possibleDescendant) => {
    return (
      possibleDescendant === element || element.contains(possibleDescendant)
    );
  };
  const tryToScrollOne = (element, wheelEvent) => {
    if (element === document.documentElement) {
      // let browser handle document scrolling
      return true;
    }

    const { deltaX, deltaY } = wheelEvent;
    // we found what we want: a scrollable container behind the element
    // we try to scroll it.
    const elementCanApplyScrollDeltaX =
      deltaX && canApplyScrollDelta(element, deltaX, "x");
    const elementCanApplyScrollDeltaY =
      deltaY && canApplyScrollDelta(element, deltaY, "y");
    if (!elementCanApplyScrollDeltaX && !elementCanApplyScrollDeltaY) {
      return false;
    }
    if (!isScrollable(element)) {
      return false;
    }
    const belongsToElement = isElementOrDescendant(element);
    if (belongsToElement) {
      // let browser handle the scroll on the element itself
      return true;
    }
    wheelEvent.preventDefault();
    applyWheelScrollThrough(element, wheelEvent);
    return true;
  };

  if (connectedElement) {
    const onWheel = (wheelEvent) => {
      const connectedScrollableParent = getScrollableParent(connectedElement);
      if (connectedScrollableParent === document.documentElement) {
        // the connected scrollable parent is the document
        // there is nothing to do, browser native scroll will work as we want
        return;
      }

      const elementsBehindMouse = document.elementsFromPoint(
        wheelEvent.clientX,
        wheelEvent.clientY,
      );
      for (const elementBehindMouse of elementsBehindMouse) {
        const belongsToElement = isElementOrDescendant(elementBehindMouse);
        // try to scroll element itself
        if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
          return;
        }
        if (!belongsToElement) {
          break;
        }
      }
      // At this stage the element has no scrollable parts
      // we can try to scroll the connected scrollable parent
      tryToScrollOne(connectedScrollableParent, wheelEvent);
    };
    element.addEventListener("wheel", onWheel);
    return;
  }

  const onWheel = (wheelEvent) => {
    const elementsBehindMouse = document.elementsFromPoint(
      wheelEvent.clientX,
      wheelEvent.clientY,
    );
    for (const elementBehindMouse of elementsBehindMouse) {
      const belongsToElement = isElementOrDescendant(elementBehindMouse);
      // try to scroll element itself
      if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
        return;
      }
      if (belongsToElement) {
        // the element is not scrollable and we don't care about his
        // scrollable parent (because we know it's going to be the document)
        // we search for scrollable container that might be behind it
        continue;
      }
      const scrollableParent = getScrollableParent(elementBehindMouse);
      if (tryToScrollOne(scrollableParent, wheelEvent)) {
        return;
      }
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
  if (delta > 0 && currentScroll + size >= scrollEnd) {
    // when scrollLeft + size >= scrollWidth, we can't scroll to the right
    return false;
  }
  return true;
};

const applyWheelScrollThrough = (element, wheelEvent) => {
  wheelEvent.preventDefault();
  element.scrollBy({
    top: wheelEvent.deltaY,
    left: wheelEvent.deltaX,
    behavior: wheelEvent.deltaMode === 0 ? "auto" : "smooth", // optional tweak
  });
};
