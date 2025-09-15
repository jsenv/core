import { getScrollableParent } from "../scroll.js";

export let DRAG_DEBUG_VISUAL_MARKERS = true;
export const enableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = true;
};
export const disableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = false;
};

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

const getPositionedParent = (element) => {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const position = window.getComputedStyle(parent).position;
    if (
      position === "relative" ||
      position === "absolute" ||
      position === "fixed"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.body;
};

const getDefaultConstraint = (scrollableParent) => {
  const parentRect = scrollableParent.getBoundingClientRect();
  const scrollWidth = scrollableParent.scrollWidth;
  const scrollHeight = scrollableParent.scrollHeight;
  // const scrollbarWidth = parentRect.width - positionedParent.clientWidth;
  // const scrollbarHeight = parentRect.height - positionedParent.clientHeight;
  return {
    left: parentRect.left,
    top: parentRect.top,
    right: parentRect.left + scrollWidth,
    bottom: parentRect.top + scrollHeight,
  };
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
    constraint = null,
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

  const positionedParent = getPositionedParent(element);
  const elementVisuallyMovingRect =
    elementVisuallyMoving.getBoundingClientRect();
  const initialLeft = elementVisuallyMovingRect.left;
  const initialTop = elementVisuallyMovingRect.top;

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

  // Set up constraint bounds
  const finalConstraint = constraint || getDefaultConstraint(scrollableParent);
  console.log(finalConstraint);
  const constraintLeft = finalConstraint.left ?? -Infinity;
  const constraintTop = finalConstraint.top ?? -Infinity;
  const constraintRight = finalConstraint.right ?? Infinity;
  const constraintBottom = finalConstraint.bottom ?? Infinity;

  if (stickyLeftElement) {
    // const stickyRect = stickyLeftElement.getBoundingClientRect();
    // const stickyRightRelativeToElement = stickyRect.right - initialLeft;
    // constraintLeft = Math.max(constraintLeft, stickyRightRelativeToElement);
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
        if (xMove < constraintLeft) {
          xMove = constraintLeft;
        } else if (xMove > constraintRight) {
          xMove = constraintRight;
        }
        gestureInfo.xMove = xMove;
        gestureInfo.xChanged = previousGestureInfo
          ? xMove !== previousGestureInfo.xMove
          : true;
      }
      if (direction.y) {
        gestureInfo.y = e.clientY;
        let yMove = gestureInfo.y - yAtStart;
        if (yMove < constraintTop) {
          yMove = constraintTop;
        } else if (yMove > constraintBottom) {
          yMove = constraintBottom;
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
        if (DRAG_DEBUG_VISUAL_MARKERS) {
          // Schedule removal of previous markers if they exist
          if (gestureInfo.currentDebugMarkers) {
            const previousMarkers = gestureInfo.currentDebugMarkers;
            setTimeout(() => {
              previousMarkers.forEach((marker) => {
                if (marker && marker.parentNode) {
                  marker.parentNode.removeChild(marker);
                }
              });
            }, 100);
          }

          // Create new markers (these become the current ones)
          const newDebugMarkers = [];
          newDebugMarkers.push(
            createDebugMarker("visibleAreaLeft", visibleAreaLeft, 0, "blue"),
          );
          newDebugMarkers.push(
            createDebugMarker("visibleAreaRight", visibleAreaRight, 0, "green"),
          );
          newDebugMarkers.push(
            createDebugMarker(
              "desiredElementLeft",
              desiredElementLeft,
              0,
              "orange",
            ),
          );
          newDebugMarkers.push(
            createDebugMarker(
              "desiredElementRight",
              desiredElementRight,
              0,
              "purple",
            ),
          );

          // Store as current markers for next mousemove
          gestureInfo.currentDebugMarkers = newDebugMarkers;
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
        // Calculate final viewport position accounting for auto-scroll
        const finalViewportLeft = initialLeft + gestureInfo.xMove + scrollLeft;
        const finalViewportTop = initialTop + gestureInfo.yMove + scrollTop;

        // Convert to coordinates relative to positioned parent
        const positionedParentRect = positionedParent.getBoundingClientRect();
        const relativeLeft = finalViewportLeft - positionedParentRect.left;
        const relativeTop = finalViewportTop - positionedParentRect.top;

        elementToMove.style.left = `${relativeLeft}px`;
        elementToMove.style.top = `${relativeTop}px`;
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

      // Clean up any remaining debug markers when drag ends
      if (DRAG_DEBUG_VISUAL_MARKERS && gestureInfo.currentDebugMarkers) {
        gestureInfo.currentDebugMarkers.forEach((marker) => {
          if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
          }
        });
        gestureInfo.currentDebugMarkers = null;
      }

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
