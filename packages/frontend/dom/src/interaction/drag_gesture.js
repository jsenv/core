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
    stickyLeftElement = null,
  } = setupResult;
  if (!direction.x && !direction.y) {
    return;
  }
  mousedownEvent.preventDefault();
  const xAtStart = mousedownEvent.clientX;
  const yAtStart = mousedownEvent.clientY;

  // Track initial scroll positions to account for auto-scrolling
  const scrollableParent = getScrollableParent(element);
  const initialScrollLeft = scrollableParent ? scrollableParent.scrollLeft : 0;
  const initialScrollTop = scrollableParent ? scrollableParent.scrollTop : 0;

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
    initialScrollLeft,
    initialScrollTop,
    autoScrolledX: 0,
    autoScrolledY: 0,
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
      const isGoingLeft = e.clientX < gestureInfo.x;
      const isGoingRight = e.clientX > gestureInfo.x;
      const isGoingTop = e.clientY < gestureInfo.y;
      const isGoingBottom = e.clientY > gestureInfo.y;
      gestureInfo.isGoingLeft = isGoingLeft;
      gestureInfo.isGoingRight = isGoingRight;
      gestureInfo.isGoingTop = isGoingTop;
      gestureInfo.isGoingBottom = isGoingBottom;

      if (direction.x) {
        gestureInfo.x = e.clientX;
        let xMove = gestureInfo.x - xAtStart;
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
        let yMove = gestureInfo.y - yAtStart;
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

      // Auto-scroll the first scrollable parent, if any
      if (scrollableParent) {
        const scrollableRect = scrollableParent.getBoundingClientRect();
        const availableWidth = scrollableParent.clientWidth;
        const scrollbarWidth = scrollableParent.offsetWidth - availableWidth;
        // Get the element's current size to calculate its bounds
        const elementRect = elementVisuallyMoving.getBoundingClientRect();
        const elementWidth = elementRect.width;
        const elementHeight = elementRect.height;
        const scrollLeft = scrollableParent.scrollLeft;
        const scrollXDiff = scrollLeft - initialScrollLeft;

        // Calculate where element bounds would be at the desired position
        const desiredElementLeft =
          initialLeft + gestureInfo.xMove + scrollXDiff;
        const desiredElementRight = desiredElementLeft + elementWidth;
        let scrollableLeft = scrollableRect.left;
        let scrollableRight = scrollableLeft + availableWidth;
        if (stickyLeftElement) {
          const stickyRect = stickyLeftElement.getBoundingClientRect();
          scrollableLeft = stickyRect.right;
        }
        horizontal: {
          if (!direction.x) {
            break horizontal;
          }
          console.log(gestureInfo.xMove);
          if (isGoingRight) {
            if (desiredElementRight <= scrollableRight) {
              break horizontal;
            }
            const scrollLeftRequired =
              desiredElementRight - scrollableRight + scrollbarWidth;
            scrollableParent.scrollLeft = scrollLeftRequired;
            gestureInfo.autoScrolledX = scrollLeftRequired;
            break horizontal;
          }
          // need to scroll left?
          if (!isGoingLeft) {
            break horizontal;
          }
          console.log({ desiredElementLeft, scrollableLeft });
          if (desiredElementLeft >= scrollableLeft) {
            break horizontal;
          }
          const scrollAmount = scrollableLeft - desiredElementLeft;
          const oldScrollLeft = scrollableParent.scrollLeft;
          scrollableParent.scrollLeft = Math.max(
            0,
            scrollableParent.scrollLeft - scrollAmount,
          );
          const actualScrolled = oldScrollLeft - scrollableParent.scrollLeft;
          gestureInfo.autoScrolledX -= actualScrolled;
        }

        // let scrollableTop = scrollableRect.top;
        // let scrollableBottom = scrollableRect.bottom;
        const desiredElementTop = elementRect.top + gestureInfo.yMove;
        const desiredElementBottom = desiredElementTop + elementHeight;

        vertical: {
          if (!direction.y) {
            break vertical;
          }

          let scrollAmount = 0;
          // Check if desired element position would be beyond scrollable area's top boundary
          if (desiredElementTop < scrollableRect.top) {
            // Need to scroll up to make room
            scrollAmount = scrollableRect.top - desiredElementTop;
            const oldScrollTop = scrollableParent.scrollTop;
            scrollableParent.scrollTop = Math.max(
              0,
              scrollableParent.scrollTop - scrollAmount,
            );
            const actualScrolled = oldScrollTop - scrollableParent.scrollTop;
            gestureInfo.autoScrolledY -= actualScrolled;
          }
          // Check if desired element position would be beyond scrollable area's bottom boundary
          else if (desiredElementBottom > scrollableRect.bottom) {
            // Need to scroll down to make room
            scrollAmount = desiredElementBottom - scrollableRect.bottom;
            const maxScrollTop =
              scrollableParent.scrollHeight - scrollableParent.clientHeight;
            const oldScrollTop = scrollableParent.scrollTop;
            scrollableParent.scrollTop = Math.min(
              maxScrollTop,
              scrollableParent.scrollTop + scrollAmount,
            );
            const actualScrolled = scrollableParent.scrollTop - oldScrollTop;
            gestureInfo.autoScrolledY += actualScrolled;
          }
        }
      }

      if (elementToMove) {
        // Position element accounting for auto-scroll
        const finalLeft = gestureInfo.xMove + gestureInfo.autoScrolledX;
        const finalTop = gestureInfo.yMove + gestureInfo.autoScrolledY;
        elementToMove.style.left = `${finalLeft}px`;
        elementToMove.style.top = `${finalTop}px`;
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
