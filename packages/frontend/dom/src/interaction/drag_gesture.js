import { getScrollableParent } from "../scroll.js";

const DEBUG_AUTO_SCROLL = true;

export const startDragGesture = (
  mousedownEvent,
  {
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    setup = () => {
      return {
        element: mousedownEvent.target,
      };
    },
    gestureAttribute,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    backdrop = true,
    minX = -Infinity,
    maxX = Infinity,
    minY = -Infinity,
    maxY = Infinity,
  },
) => {
  if (mousedownEvent.defaultPrevented) {
    // an other resize gesture has call preventDefault()
    // or something wants to prevent mousedown effects
    return;
  }
  if (mousedownEvent.button !== 0) {
    return;
  }
  const target = mousedownEvent.target;
  if (!target.closest) {
    return;
  }
  const endCallbackSet = new Set();
  const setupResult = setup({
    addTeardown: (callback) => {
      endCallbackSet.add(callback);
    },
  });
  if (!setupResult) {
    return;
  }
  const {
    element,
    elementToMove = element,
    elementVisuallyMoving = element,
    direction = defaultDirection,
    cursor = "grabbing",
    stickyLeftElement = null,
  } = setupResult;
  if (!direction.x && !direction.y) {
    return;
  }
  mousedownEvent.preventDefault();
  const xAtStart = mousedownEvent.clientX;
  const yAtStart = mousedownEvent.clientY;
  const gestureInfo = {
    element,
    elementVisuallyMoving,
    xAtStart,
    yAtStart,
    x: xAtStart,
    y: yAtStart,
    xMove: 0,
    yMove: 0,
    xChanged: false,
    yChanged: false,
    isMouseUp: false,
  };
  let previousGestureInfo = null;

  if (backdrop) {
    const backdropElement = document.createElement("div");
    backdropElement.style.position = "fixed";
    backdropElement.style.zIndex = "1000000";
    backdropElement.style.inset = "0";
    backdropElement.style.cursor = cursor;
    backdropElement.style.userSelect = "none";
    document.body.appendChild(backdropElement);
    endCallbackSet.add(() => {
      document.body.removeChild(backdropElement);
    });
  }

  let started = !threshold;

  // Track initial scroll positions to account for auto-scrolling
  const scrollableParent = getScrollableParent(element);
  const initialScrollLeft = scrollableParent ? scrollableParent.scrollLeft : 0;
  const initialScrollTop = scrollableParent ? scrollableParent.scrollTop : 0;
  const elementVisuallyMovingRect =
    elementVisuallyMoving.getBoundingClientRect();
  const initialLeft = elementVisuallyMovingRect.left;

  if (stickyLeftElement) {
    const stickyRect = stickyLeftElement.getBoundingClientRect();
    const stickyRightRelativeToElement = stickyRect.right - initialLeft;
    minX = Math.max(minX, stickyRightRelativeToElement);
  }

  mouse_events: {
    const updateMousePosition = (e) => {
      // Account for scroll changes when calculating position
      const currentScrollLeft = scrollableParent
        ? scrollableParent.scrollLeft
        : 0;
      const currentScrollTop = scrollableParent
        ? scrollableParent.scrollTop
        : 0;
      const scrollDeltaX = currentScrollLeft - initialScrollLeft;
      const scrollDeltaY = currentScrollTop - initialScrollTop;

      if (direction.x) {
        gestureInfo.x = e.clientX;
        let xMove = gestureInfo.x - xAtStart + scrollDeltaX;
        if (xMove < minX) {
          xMove = minX;
        } else if (xMove > maxX) {
          xMove = maxX;
        }
        gestureInfo.xMove = xMove;
        gestureInfo.xChanged = previousGestureInfo
          ? xMove !== previousGestureInfo.xMove
          : true;
      }
      if (direction.y) {
        gestureInfo.y = e.clientY;
        let yMove = gestureInfo.y - yAtStart + scrollDeltaY;
        if (yMove < minY) {
          yMove = minY;
        } else if (yMove > maxY) {
          yMove = maxY;
        }
        gestureInfo.yMove = yMove;
        gestureInfo.yChanged = previousGestureInfo
          ? yMove !== previousGestureInfo.yMove
          : true;
      }

      const isMouseUp = e.type === "mouseup";
      if (isMouseUp) {
        if (!started) {
          return;
        }
        onDrag?.(gestureInfo, "end");
        return;
      }

      let someChange = gestureInfo.xChanged || gestureInfo.yChanged;
      if (!someChange) {
        return;
      }
      previousGestureInfo = { ...gestureInfo };
      if (!started && threshold) {
        const deltaX = Math.abs(gestureInfo.xMove);
        const deltaY = Math.abs(gestureInfo.yMove);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return;
          }
        }
      }

      if (elementToMove) {
        console.log("move to", gestureInfo.xMove);
        elementToMove.style.left = `${gestureInfo.xMove}px`;
        elementToMove.style.top = `${gestureInfo.yMove}px`;
      }

      // Auto-scroll the first scrollable parent, if any
      if (scrollableParent) {
        autoScroll(scrollableParent, {
          elementVisuallyMoving,
          direction,
          stickyLeftElement,
          gestureInfo,
        });
      }

      if (!started) {
        started = true;
        onDragStart?.(gestureInfo);
        onDrag?.(gestureInfo, "start");
      } else {
        onDrag?.(gestureInfo, "middle");
      }
    };

    const handleMouseMove = (e) => {
      updateMousePosition(e);
    };
    const handleMouseUp = (e) => {
      e.preventDefault();
      gestureInfo.isMouseUp = true;
      updateMousePosition(e);
      for (const endCallback of endCallbackSet) {
        endCallback();
      }
      onRelease?.(gestureInfo);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    endCallbackSet.add(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
  }
  data_dragging_attribute: {
    element.setAttribute("data-dragging", "");
    endCallbackSet.add(() => {
      element.removeAttribute("data-dragging");
    });
  }
  if (gestureAttribute) {
    element.setAttribute(gestureAttribute, "");
    endCallbackSet.add(() => {
      element.removeAttribute(gestureAttribute);
    });
  }

  onGrab?.(gestureInfo);
};

const autoScroll = (
  scrollableElement,
  { elementVisuallyMoving, direction, stickyLeftElement = null },
) => {
  const scrollableRect = scrollableElement.getBoundingClientRect();
  const elementRect = elementVisuallyMoving.getBoundingClientRect();

  // Calculate effective visible area accounting for sticky elements
  let effectiveLeft = scrollableRect.left;
  if (stickyLeftElement) {
    const stickyRect = stickyLeftElement.getBoundingClientRect();
    effectiveLeft = stickyRect.right;
  }

  if (DEBUG_AUTO_SCROLL) {
    console.log("autoScroll check:", {
      scrollableRect: {
        left: scrollableRect.left,
        right: scrollableRect.right,
        top: scrollableRect.top,
        bottom: scrollableRect.bottom,
      },
      elementRect: {
        left: elementRect.left,
        right: elementRect.right,
        top: elementRect.top,
        bottom: elementRect.bottom,
      },
      direction,
      stickyLeftElement: stickyLeftElement ? "present" : "none",
      effectiveLeft,
    });
  }

  horizontal: {
    if (!direction.x) {
      break horizontal;
    }

    // Check if element's left edge is beyond effective left boundary (accounting for sticky elements)
    if (elementRect.left < effectiveLeft) {
      // Scroll left by exactly how much the element is hidden
      const scrollAmount = effectiveLeft - elementRect.left;
      const oldScrollLeft = scrollableElement.scrollLeft;
      scrollableElement.scrollLeft = Math.max(
        0,
        scrollableElement.scrollLeft - scrollAmount,
      );
      const actualScrolled = oldScrollLeft - scrollableElement.scrollLeft;
      if (DEBUG_AUTO_SCROLL) {
        console.log("autoScroll LEFT:", {
          elementLeft: elementRect.left,
          effectiveLeft,
          scrollAmount,
          actualScrolled,
          oldScrollLeft,
          newScrollLeft: scrollableElement.scrollLeft,
        });
      }
      return true;
    }
    // Check if element's right edge is beyond scrollable area's right boundary
    if (elementRect.right > scrollableRect.right) {
      // Scroll right by exactly how much the element is hidden
      const scrollAmount = elementRect.right - scrollableRect.right;
      const maxScrollLeft =
        scrollableElement.scrollWidth - scrollableElement.clientWidth;
      const oldScrollLeft = scrollableElement.scrollLeft;
      scrollableElement.scrollLeft = Math.min(
        maxScrollLeft,
        scrollableElement.scrollLeft + scrollAmount,
      );
      const actualScrolled = scrollableElement.scrollLeft - oldScrollLeft;
      if (DEBUG_AUTO_SCROLL) {
        console.log("autoScroll RIGHT:", {
          elementRight: elementRect.right,
          scrollableRight: scrollableRect.right,
          scrollAmount,
          actualScrolled,
          oldScrollLeft,
          newScrollLeft: scrollableElement.scrollLeft,
          maxScrollLeft,
        });
      }
      return true;
    }
  }
  vertical: {
    if (!direction.y) {
      break vertical;
    }

    // Check if element's top edge is beyond scrollable area's top boundary
    if (elementRect.top < scrollableRect.top) {
      // Scroll up by exactly how much the element is hidden
      const scrollAmount = scrollableRect.top - elementRect.top;
      const oldScrollTop = scrollableElement.scrollTop;
      scrollableElement.scrollTop = Math.max(
        0,
        scrollableElement.scrollTop - scrollAmount,
      );
      const actualScrolled = oldScrollTop - scrollableElement.scrollTop;
      if (DEBUG_AUTO_SCROLL) {
        console.log("autoScroll UP:", {
          elementTop: elementRect.top,
          scrollableTop: scrollableRect.top,
          scrollAmount,
          actualScrolled,
          oldScrollTop,
          newScrollTop: scrollableElement.scrollTop,
        });
      }
      return true;
    }
    // Check if element's bottom edge is beyond scrollable area's bottom boundary
    if (elementRect.bottom > scrollableRect.bottom) {
      // Scroll down by exactly how much the element is hidden
      const scrollAmount = elementRect.bottom - scrollableRect.bottom;
      const maxScrollTop =
        scrollableElement.scrollHeight - scrollableElement.clientHeight;
      const oldScrollTop = scrollableElement.scrollTop;
      scrollableElement.scrollTop = Math.min(
        maxScrollTop,
        scrollableElement.scrollTop + scrollAmount,
      );
      const actualScrolled = scrollableElement.scrollTop - oldScrollTop;
      if (DEBUG_AUTO_SCROLL) {
        console.log("autoScroll DOWN:", {
          elementBottom: elementRect.bottom,
          scrollableBottom: scrollableRect.bottom,
          scrollAmount,
          actualScrolled,
          oldScrollTop,
          newScrollTop: scrollableElement.scrollTop,
          maxScrollTop,
        });
      }
      return true;
    }
  }
  return false; // No auto-scroll occurred
};
