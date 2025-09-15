import { getScrollableParent } from "../scroll.js";

const DRAG_DEBUG_VISUAL_MARKERS = false; // Set to true to enable visual debug markers

const createDebugMarker = (name, x, y, color = "red") => {
  if (!DRAG_DEBUG_VISUAL_MARKERS) return null;

  const marker = document.createElement("div");
  marker.style.position = "fixed";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = "2px";
  marker.style.height = "100vh";
  marker.style.backgroundColor = color;
  marker.style.zIndex = "9999";
  marker.style.pointerEvents = "none";
  marker.style.opacity = "0.7";
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.textContent = name;
  label.style.position = "absolute";
  label.style.top = "10px";
  label.style.left = "5px";
  label.style.fontSize = "12px";
  label.style.color = color;
  label.style.fontWeight = "bold";
  label.style.textShadow = "1px 1px 1px rgba(255,255,255,0.8)";
  marker.appendChild(label);

  document.body.appendChild(marker);
  return marker;
};

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
    minConstrainedX = -Infinity,
    maxConstrainedX = Infinity,
    minConstrainedY = -Infinity,
    maxConstrainedY = Infinity,
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
    // const stickyRect = stickyLeftElement.getBoundingClientRect();
    // const stickyRightRelativeToElement = stickyRect.right - initialLeft;
    // minX = Math.max(minX, stickyRightRelativeToElement);
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
        if (xMove < minConstrainedX) {
          xMove = minConstrainedX;
        } else if (xMove > maxConstrainedX) {
          xMove = maxConstrainedX;
        }
        gestureInfo.xMove = xMove;
        gestureInfo.xChanged = previousGestureInfo
          ? xMove !== previousGestureInfo.xMove
          : true;
      }
      if (direction.y) {
        gestureInfo.y = e.clientY;
        let yMove = gestureInfo.y - yAtStart;
        if (yMove < minConstrainedY) {
          yMove = minConstrainedY;
        } else if (yMove > maxConstrainedY) {
          yMove = maxConstrainedY;
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

      let scrollLeft = scrollableParent.scrollLeft;
      let scrollTop = scrollableParent.scrollTop;
      auto_scroll: {
        const scrollableRect = scrollableParent.getBoundingClientRect();
        const availableWidth = scrollableParent.clientWidth;
        // const scrollbarWidth = scrollableParent.offsetWidth - availableWidth;
        const elementRect = elementVisuallyMoving.getBoundingClientRect();
        const elementWidth = elementRect.width;
        const elementHeight = elementRect.height;

        const scrollXDiff = scrollLeft - initialScrollLeft;
        // Calculate where element bounds would be at the desired position
        const desiredElementLeft =
          initialLeft + gestureInfo.xMove + scrollXDiff;
        const desiredElementRight = desiredElementLeft + elementWidth;
        let visibleAreaLeft = scrollableRect.left;
        let visibleAreaRight = visibleAreaLeft + availableWidth;
        if (stickyLeftElement) {
          // const stickyRect = stickyLeftElement.getBoundingClientRect();
          // visibleAreaLeft = stickyRect.right;
        }

        // Create debug markers for horizontal boundaries
        const debugMarkers = [];
        if (DRAG_DEBUG_VISUAL_MARKERS) {
          debugMarkers.push(
            createDebugMarker("visibleAreaLeft", visibleAreaLeft, 0, "blue"),
          );
          debugMarkers.push(
            createDebugMarker("visibleAreaRight", visibleAreaRight, 0, "green"),
          );
          debugMarkers.push(
            createDebugMarker(
              "desiredElementLeft",
              desiredElementLeft,
              0,
              "orange",
            ),
          );
          debugMarkers.push(
            createDebugMarker(
              "desiredElementRight",
              desiredElementRight,
              0,
              "purple",
            ),
          );

          // Clean up previous markers after a short delay
          setTimeout(() => {
            debugMarkers.forEach((marker) => {
              if (marker && marker.parentNode) {
                marker.parentNode.removeChild(marker);
              }
            });
          }, 100);
        }

        horizontal: {
          if (!direction.x) {
            break horizontal;
          }
          if (isGoingRight) {
            if (desiredElementRight <= visibleAreaRight) {
              break horizontal;
            }
            const scrollLeftRequired = desiredElementRight - visibleAreaRight;
            scrollableParent.scrollLeft = scrollLeftRequired;
            gestureInfo.autoScrolledX = scrollLeftRequired;
            break horizontal;
          }
          // need to scroll left?
          if (!isGoingLeft) {
            break horizontal;
          }
          const visibleAreaLeftWithScrollOffset = visibleAreaLeft + scrollLeft;
          if (desiredElementLeft >= visibleAreaLeftWithScrollOffset) {
            break horizontal;
          }
          const scrollLeftRequired =
            scrollLeft + (desiredElementLeft - visibleAreaLeftWithScrollOffset);
          scrollableParent.scrollLeft = scrollLeftRequired;
          gestureInfo.autoScrolledX = scrollLeftRequired;
        }

        const visibleAreaTop = scrollableRect.top;
        const visibleAreaBottom = scrollableRect.bottom;
        const desiredElementTop = elementRect.top + gestureInfo.yMove;
        const desiredElementBottom = desiredElementTop + elementHeight;

        vertical: {
          if (!direction.y) {
            break vertical;
          }

          let scrollAmountForKeepInView = 0;
          // Check if desired element position would be beyond visible area's top boundary
          if (desiredElementTop < visibleAreaTop) {
            // Need to scroll up to keep element in view
            scrollAmountForKeepInView = visibleAreaTop - desiredElementTop;
            const oldScrollTop = scrollableParent.scrollTop;
            scrollableParent.scrollTop = Math.max(
              0,
              scrollableParent.scrollTop - scrollAmountForKeepInView,
            );
            const actualScrolled = oldScrollTop - scrollableParent.scrollTop;
            gestureInfo.autoScrolledY -= actualScrolled;
          }
          // Check if desired element position would be beyond visible area's bottom boundary
          else if (desiredElementBottom > visibleAreaBottom) {
            // Need to scroll down to keep element in view
            scrollAmountForKeepInView =
              desiredElementBottom - visibleAreaBottom;
            const maxScrollTop =
              scrollableParent.scrollHeight - scrollableParent.clientHeight;
            const oldScrollTop = scrollableParent.scrollTop;
            scrollableParent.scrollTop = Math.min(
              maxScrollTop,
              scrollableParent.scrollTop + scrollAmountForKeepInView,
            );
            const actualScrolled = scrollableParent.scrollTop - oldScrollTop;
            gestureInfo.autoScrolledY += actualScrolled;
          }
        }
      }

      if (elementToMove) {
        // Position element accounting for auto-scroll
        const finalLeft = gestureInfo.xMove + scrollLeft;
        const finalTop = gestureInfo.yMove + scrollTop;
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
