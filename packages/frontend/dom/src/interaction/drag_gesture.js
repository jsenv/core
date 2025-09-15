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
  // const parentRect = scrollableParent.getBoundingClientRect();
  const scrollWidth = scrollableParent.scrollWidth;
  const scrollHeight = scrollableParent.scrollHeight;
  // const scrollbarWidth = parentRect.width - positionedParent.clientWidth;
  // const scrollbarHeight = parentRect.height - positionedParent.clientHeight;
  return {
    left: 0,
    top: 0,
    right: scrollWidth,
    bottom: scrollHeight,
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
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const elementVisuallyMovingRect =
    elementVisuallyMoving.getBoundingClientRect();

  // Convert to coordinates relative to positioned parent
  const initialLeft =
    elementVisuallyMovingRect.left - positionedParentRect.left;
  const initialTop = elementVisuallyMovingRect.top - positionedParentRect.top;

  // Convert mouse start position to relative coordinates
  const xAtStartRelative = xAtStart - positionedParentRect.left;
  const yAtStartRelative = yAtStart - positionedParentRect.top;

  const scrollableParent = getScrollableParent(element);
  const initialScrollLeft = scrollableParent ? scrollableParent.scrollLeft : 0;
  const initialScrollTop = scrollableParent ? scrollableParent.scrollTop : 0;

  const gestureInfo = {
    element,
    elementVisuallyMoving,
    xAtStart: xAtStartRelative,
    yAtStart: yAtStartRelative,
    x: xAtStartRelative,
    y: yAtStartRelative,
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

  // Create visual markers for constraints
  const constraintMarkers = [];
  if (DRAG_DEBUG_VISUAL_MARKERS) {
    const positionedParentRect = positionedParent.getBoundingClientRect();

    // Only create markers for finite constraints
    if (constraintLeft !== -Infinity) {
      const constraintLeftViewport = positionedParentRect.left + constraintLeft;
      constraintMarkers.push(
        createDebugMarker("constraintLeft", constraintLeftViewport, 0, "red"),
      );
    }
    if (constraintRight !== Infinity) {
      const constraintRightViewport =
        positionedParentRect.left + constraintRight;
      constraintMarkers.push(
        createDebugMarker("constraintRight", constraintRightViewport, 0, "red"),
      );
    }
    if (constraintTop !== -Infinity) {
      // Create horizontal line for top constraint
      const constraintTopViewport = positionedParentRect.top + constraintTop;
      const topMarker = document.createElement("div");
      topMarker.style.position = "fixed";
      topMarker.style.left = "0";
      topMarker.style.top = `${constraintTopViewport}px`;
      topMarker.style.width = "100vw";
      topMarker.style.height = "2px";
      topMarker.style.backgroundColor = "red";
      topMarker.style.zIndex = "9999";
      topMarker.style.pointerEvents = "none";
      topMarker.style.opacity = "0.7";
      topMarker.title = "constraintTop";

      const topLabel = document.createElement("div");
      topLabel.textContent = "constraintTop";
      topLabel.style.position = "absolute";
      topLabel.style.left = "10px";
      topLabel.style.top = "5px";
      topLabel.style.fontSize = "12px";
      topLabel.style.color = "red";
      topLabel.style.fontWeight = "bold";
      topLabel.style.textShadow = "1px 1px 1px rgba(255,255,255,0.8)";
      topMarker.appendChild(topLabel);

      document.body.appendChild(topMarker);
      constraintMarkers.push(topMarker);
    }
    if (constraintBottom !== Infinity) {
      // Create horizontal line for bottom constraint
      const constraintBottomViewport =
        positionedParentRect.top + constraintBottom;
      const bottomMarker = document.createElement("div");
      bottomMarker.style.position = "fixed";
      bottomMarker.style.left = "0";
      bottomMarker.style.top = `${constraintBottomViewport}px`;
      bottomMarker.style.width = "100vw";
      bottomMarker.style.height = "2px";
      bottomMarker.style.backgroundColor = "red";
      bottomMarker.style.zIndex = "9999";
      bottomMarker.style.pointerEvents = "none";
      bottomMarker.style.opacity = "0.7";
      bottomMarker.title = "constraintBottom";

      const bottomLabel = document.createElement("div");
      bottomLabel.textContent = "constraintBottom";
      bottomLabel.style.position = "absolute";
      bottomLabel.style.left = "10px";
      bottomLabel.style.top = "-20px";
      bottomLabel.style.fontSize = "12px";
      bottomLabel.style.color = "red";
      bottomLabel.style.fontWeight = "bold";
      bottomLabel.style.textShadow = "1px 1px 1px rgba(255,255,255,0.8)";
      bottomMarker.appendChild(bottomLabel);

      document.body.appendChild(bottomMarker);
      constraintMarkers.push(bottomMarker);
    }

    // Clean up constraint markers when gesture ends
    endCallbackSet.add(() => {
      constraintMarkers.forEach((marker) => {
        if (marker && marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      });
    });
  }

  if (stickyLeftElement) {
    // const stickyRect = stickyLeftElement.getBoundingClientRect();
    // const stickyRightRelativeToElement = stickyRect.right - initialLeft;
    // constraintLeft = Math.max(constraintLeft, stickyRightRelativeToElement);
  }

  mouse_events: {
    const updateMousePosition = (e) => {
      // Get current positioned parent rect in case it moved due to scrolling
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();

      // Convert current mouse position to relative coordinates
      const currentXRelative = e.clientX - currentPositionedParentRect.left;
      const currentYRelative = e.clientY - currentPositionedParentRect.top;

      const isGoingLeft = currentXRelative < gestureInfo.x;
      const isGoingRight = currentXRelative > gestureInfo.x;
      const isGoingTop = currentYRelative < gestureInfo.y;
      const isGoingBottom = currentYRelative > gestureInfo.y;
      gestureInfo.isGoingLeft = isGoingLeft;
      gestureInfo.isGoingRight = isGoingRight;
      gestureInfo.isGoingTop = isGoingTop;
      gestureInfo.isGoingBottom = isGoingBottom;

      if (direction.x) {
        gestureInfo.x = currentXRelative;
        let xMove = gestureInfo.x - gestureInfo.xAtStart;

        // Apply constraints accounting for initial position
        // finalX = initialLeft + xMove, so xMove = finalX - initialLeft
        const minXMove = constraintLeft - initialLeft;
        const maxXMove = constraintRight - initialLeft;

        if (xMove < minXMove) {
          xMove = minXMove;
        } else if (xMove > maxXMove) {
          xMove = maxXMove;
        }
        gestureInfo.xMove = xMove;
        gestureInfo.xChanged = previousGestureInfo
          ? xMove !== previousGestureInfo.xMove
          : true;
      }
      if (direction.y) {
        gestureInfo.y = currentYRelative;
        let yMove = gestureInfo.y - gestureInfo.yAtStart;

        // Apply constraints accounting for initial position
        // finalY = initialTop + yMove, so yMove = finalY - initialTop
        const minYMove = constraintTop - initialTop;
        const maxYMove = constraintBottom - initialTop;

        if (yMove < minYMove) {
          yMove = minYMove;
        } else if (yMove > maxYMove) {
          yMove = maxYMove;
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

        // Calculate where element bounds would be in viewport coordinates
        const currentPositionedParentRect =
          positionedParent.getBoundingClientRect();
        const desiredElementLeftRelative = initialLeft + gestureInfo.xMove;
        const desiredElementTopRelative = initialTop + gestureInfo.yMove;

        // Convert to viewport coordinates for auto-scroll calculations
        const desiredElementLeft =
          desiredElementLeftRelative + currentPositionedParentRect.left;
        const desiredElementRight = desiredElementLeft + elementWidth;
        const desiredElementTop =
          desiredElementTopRelative + currentPositionedParentRect.top;
        const desiredElementBottom = desiredElementTop + elementHeight;

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
        // Position element using relative coordinates (already accounting for positioned parent)
        const finalLeft = initialLeft + gestureInfo.xMove + scrollLeft;
        const finalTop = initialTop + gestureInfo.yMove + scrollTop;

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
