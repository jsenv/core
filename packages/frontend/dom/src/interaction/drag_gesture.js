import { getScrollableParent } from "../scroll.js";

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
        elementToMove.style.left = `${gestureInfo.xMove}px`;
        elementToMove.style.top = `${gestureInfo.yMove}px`;
      }

      // Auto-scroll the first scrollable parent, if any
      if (scrollableParent) {
        autoScroll(scrollableParent, {
          elementVisuallyMoving,
          direction,
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
  { elementVisuallyMoving, direction },
) => {
  const scrollableRect = scrollableElement.getBoundingClientRect();
  const elementRect = elementVisuallyMoving.getBoundingClientRect();
  const scrollZone = 30; // pixels from edge to trigger scrolling

  horizontal: {
    if (!direction.x) {
      break horizontal;
    }

    // Check if element's left edge is beyond scrollable area's left boundary
    if (elementRect.left < scrollableRect.left + scrollZone) {
      // Scroll left by the amount the element is hidden on the left
      const hiddenAmount = scrollableRect.left + scrollZone - elementRect.left;
      scrollableElement.scrollLeft = Math.max(
        0,
        scrollableElement.scrollLeft - hiddenAmount,
      );
      break horizontal;
    }
    // Check if element's right edge is beyond scrollable area's right boundary
    if (elementRect.right > scrollableRect.right - scrollZone) {
      // Scroll right by the amount the element is hidden on the right
      const hiddenAmount =
        elementRect.right - (scrollableRect.right - scrollZone);
      const maxScrollLeft =
        scrollableElement.scrollWidth - scrollableElement.clientWidth;
      scrollableElement.scrollLeft = Math.min(
        maxScrollLeft,
        scrollableElement.scrollLeft + hiddenAmount,
      );
    }
  }
  vertical: {
    if (!direction.y) {
      break vertical;
    }

    // Check if element's top edge is beyond scrollable area's top boundary
    if (elementRect.top < scrollableRect.top + scrollZone) {
      // Scroll up by the amount the element is hidden at the top
      const hiddenAmount = scrollableRect.top + scrollZone - elementRect.top;
      scrollableElement.scrollTop = Math.max(
        0,
        scrollableElement.scrollTop - hiddenAmount,
      );
      break vertical;
    }
    // Check if element's bottom edge is beyond scrollable area's bottom boundary
    if (elementRect.bottom > scrollableRect.bottom - scrollZone) {
      // Scroll down by the amount the element is hidden at the bottom
      const hiddenAmount =
        elementRect.bottom - (scrollableRect.bottom - scrollZone);
      const maxScrollTop =
        scrollableElement.scrollHeight - scrollableElement.clientHeight;
      scrollableElement.scrollTop = Math.min(
        maxScrollTop,
        scrollableElement.scrollTop + hiddenAmount,
      );
    }
  }
};
