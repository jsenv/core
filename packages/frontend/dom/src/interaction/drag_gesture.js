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
        started = true;
        onDragStart?.(gestureInfo);
        onDrag?.(gestureInfo, "start");
      } else {
        onDrag?.(gestureInfo, "middle");
      }

      // Auto-scroll the first scrollable parent, if any
      if (scrollableParent) {
        autoScroll(scrollableParent, gestureInfo, direction);
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

const autoScroll = (scrollableElement, gestureInfo, direction) => {
  const rect = scrollableElement.getBoundingClientRect();
  const scrollZone = 30; // pixels from edge to trigger scrolling
  const scrollSpeed = 10; // pixels per scroll
  const { x, y } = gestureInfo;

  horizontal: {
    if (!direction.x) {
      break horizontal;
    }

    // left
    if (x < rect.left + scrollZone) {
      scrollableElement.scrollLeft = Math.max(
        0,
        scrollableElement.scrollLeft - scrollSpeed,
      );
      break horizontal;
    }
    // right
    if (x > rect.right - scrollZone) {
      const maxScrollLeft =
        scrollableElement.scrollWidth - scrollableElement.clientWidth;
      scrollableElement.scrollLeft = Math.min(
        maxScrollLeft,
        scrollableElement.scrollLeft + scrollSpeed,
      );
    }
  }
  vertical: {
    if (!direction.y) {
      break vertical;
    }

    // up
    if (y < rect.top + scrollZone) {
      scrollableElement.scrollTop = Math.max(
        0,
        scrollableElement.scrollTop - scrollSpeed,
      );
      break vertical;
    }
    // down
    if (y > rect.bottom - scrollZone) {
      const maxScrollTop =
        scrollableElement.scrollHeight - scrollableElement.clientHeight;
      scrollableElement.scrollTop = Math.min(
        maxScrollTop,
        scrollableElement.scrollTop + scrollSpeed,
      );
    }
  }
};
