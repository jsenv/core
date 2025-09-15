import { getScrollableParent } from "../scroll.js";

import.meta.css = /* css */ `
  .navi_constraint_feedback_line {
    position: fixed;
    pointer-events: none;
    z-index: 9998;
    border-top: 2px dotted #ff6b35;
    opacity: 0;
    transition: opacity 0.1s ease;
    transform-origin: left center;
  }

  .navi_constraint_feedback_line [data-visible] {
    opacity: 1;
  }
`;

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

// Visual feedback line connecting mouse cursor to dragged element when constraints prevent following
// This provides intuitive feedback during drag operations when the element cannot reach the mouse
// position due to obstacles, boundaries, or other constraints. The line becomes visible when there's
// a significant distance between the mouse and the element, helping users understand why the
// element isn't moving as expected.
const createConstraintFeedbackLine = () => {
  if (!DRAG_DEBUG_VISUAL_MARKERS) return null;
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title =
    "Constraint feedback - shows distance between mouse and constrained element";
  document.body.appendChild(line);
  return line;
};

const updateConstraintFeedbackLine = (
  line,
  mouseX,
  mouseY,
  elementX,
  elementY,
) => {
  if (!line) return;

  // Calculate distance between mouse and element center
  const deltaX = mouseX - elementX;
  const deltaY = mouseY - elementY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Show line only when distance is significant (> 20px threshold)
  const threshold = 20;
  if (distance <= threshold) {
    line.removeAttribute("data-visible");
    return;
  }

  // Calculate angle and position
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  line.setAttribute("data-visible", "");
  // Position line at element center
  line.style.left = `${elementX}px`;
  line.style.top = `${elementY}px`;
  line.style.width = `${distance}px`;
  line.style.transform = `rotate(${angle}deg)`;
  // Fade in based on distance (more visible as distance increases)
  const maxOpacity = 0.8;
  const opacityFactor = Math.min((distance - threshold) / 100, 1);
  line.style.opacity = `${maxOpacity * opacityFactor}`;
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

const getDefaultConstraint = (
  scrollableParent,
  elementWidth,
  elementHeight,
) => {
  const scrollWidth = scrollableParent.scrollWidth;
  const scrollHeight = scrollableParent.scrollHeight;
  return {
    left: 0,
    top: 0,
    right: scrollWidth - elementWidth, // Element can't go beyond scroll area minus its own width
    bottom: scrollHeight - elementHeight, // Element can't go beyond scroll area minus its own height
  };
};

// Function to get obstacle bounds for collision detection
const getObstacleBounds = (scrollableParent) => {
  const obstacles = scrollableParent.querySelectorAll("[data-drag-obstacle]");
  const bounds = [];
  for (const obstacle of obstacles) {
    bounds.push({
      left: obstacle.offsetLeft,
      top: obstacle.offsetTop,
      right: obstacle.offsetLeft + obstacle.offsetWidth,
      bottom: obstacle.offsetTop + obstacle.offsetHeight,
      width: obstacle.offsetWidth,
      height: obstacle.offsetHeight,
    });
  }
  return bounds;
};

// Function to create constraint that respects solid obstacles
const createObstacleConstraint = (
  scrollableParent,
  elementWidth,
  elementHeight,
) => {
  const obstacles = getObstacleBounds(scrollableParent);
  const scrollWidth = scrollableParent.scrollWidth;
  const scrollHeight = scrollableParent.scrollHeight;

  return {
    left: 0,
    top: 0,
    right: scrollWidth - elementWidth,
    bottom: scrollHeight - elementHeight,
    // Custom constraint function that checks obstacle collisions
    checkPosition: (left, top) => {
      const elementRect = {
        left,
        top,
        right: left + elementWidth,
        bottom: top + elementHeight,
      };

      // Check collision with each obstacle
      for (const obstacle of obstacles) {
        if (
          elementRect.left < obstacle.right &&
          elementRect.right > obstacle.left &&
          elementRect.top < obstacle.bottom &&
          elementRect.bottom > obstacle.top
        ) {
          // Collision detected - element cannot move to this position
          return false;
        }
      }
      return true;
    },
  };
};

export const createDragGesture = ({
  onGrab,
  onDragStart,
  onDrag,
  onRelease,
  gestureAttribute,
  threshold = 5,
  direction: defaultDirection = { x: true, y: true },
  backdrop = true,
  constraint = null,
}) => {
  const grab = ({
    element,
    elementToMove = element,
    elementVisuallyMoving = element,
    direction = defaultDirection,
    cursor = "grabbing",
    xAtStart,
    yAtStart,
    addTeardown = () => {},
  }) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const positionedParent = getPositionedParent(element);
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const elementVisuallyMovingRect =
      elementVisuallyMoving.getBoundingClientRect();

    // Convert to coordinates relative to positioned parent
    const initialLeft =
      elementVisuallyMovingRect.left - positionedParentRect.left;
    const initialTop = elementVisuallyMovingRect.top - positionedParentRect.top;

    // Capture element dimensions at start to avoid changing values during drag
    const elementWidth = elementVisuallyMovingRect.width;
    const elementHeight = elementVisuallyMovingRect.height;

    const scrollableParent = getScrollableParent(element);
    const initialScrollLeft = scrollableParent
      ? scrollableParent.scrollLeft
      : 0;
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
    let started = !threshold;

    // Set up backdrop
    if (backdrop) {
      const backdropElement = document.createElement("div");
      backdropElement.style.position = "fixed";
      backdropElement.style.zIndex = "1000000";
      backdropElement.style.inset = "0";
      backdropElement.style.cursor = cursor;
      backdropElement.style.userSelect = "none";
      document.body.appendChild(backdropElement);
      addTeardown(() => {
        document.body.removeChild(backdropElement);
      });
    }

    // Set up constraint feedback line
    const constraintFeedbackLine = createConstraintFeedbackLine();
    if (constraintFeedbackLine) {
      addTeardown(() => {
        document.body.removeChild(constraintFeedbackLine);
      });
    }

    // Set up constraint bounds
    let finalConstraint =
      constraint ||
      getDefaultConstraint(scrollableParent, elementWidth, elementHeight);

    // Check for obstacles and enhance constraint if found
    const obstacles = scrollableParent.querySelectorAll("[drag-obstacle]");
    if (obstacles.length > 0) {
      finalConstraint = createObstacleConstraint(
        scrollableParent,
        elementWidth,
        elementHeight,
      );
    }
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
        const constraintLeftViewport =
          positionedParentRect.left + constraintLeft;
        constraintMarkers.push(
          createDebugMarker("constraintLeft", constraintLeftViewport, 0, "red"),
        );
      }
      if (constraintRight !== Infinity) {
        const constraintRightViewport =
          positionedParentRect.left + constraintRight;
        constraintMarkers.push(
          createDebugMarker(
            "constraintRight",
            constraintRightViewport,
            0,
            "red",
          ),
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
      addTeardown(() => {
        constraintMarkers.forEach((marker) => {
          if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
          }
        });
      });
    }

    // Set up dragging attribute
    element.setAttribute("data-dragging", "");
    addTeardown(() => {
      element.removeAttribute("data-dragging");
    });

    if (gestureAttribute) {
      element.setAttribute(gestureAttribute, "");
      addTeardown(() => {
        element.removeAttribute(gestureAttribute);
      });
    }

    const drag = (
      currentXRelative,
      currentYRelative,
      { isRelease = false, mouseX = null, mouseY = null } = {},
    ) => {
      const isGoingLeft = currentXRelative < gestureInfo.x;
      const isGoingRight = currentXRelative > gestureInfo.x;
      const isGoingUp = currentYRelative < gestureInfo.y;
      const isGoingDown = currentYRelative > gestureInfo.y;

      gestureInfo.isGoingLeft = isGoingLeft;
      gestureInfo.isGoingRight = isGoingRight;
      gestureInfo.isGoingUp = isGoingUp;
      gestureInfo.isGoingDown = isGoingDown;

      if (direction.x) {
        gestureInfo.x = currentXRelative;
        let xMove = gestureInfo.x - gestureInfo.xAtStart;

        // Apply constraints accounting for initial position
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

      // Apply custom collision detection if provided
      if (finalConstraint.checkPosition) {
        const proposedLeft = initialLeft + gestureInfo.xMove;
        const proposedTop = initialTop + gestureInfo.yMove;

        if (!finalConstraint.checkPosition(proposedLeft, proposedTop)) {
          // Position would cause collision - revert to previous valid position
          gestureInfo.xMove = previousGestureInfo?.xMove || 0;
          gestureInfo.yMove = previousGestureInfo?.yMove || 0;
        }
      }

      if (isRelease) {
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

      // Helper function to handle auto-scroll and element positioning for an axis
      const moveAndKeepIntoView = ({
        isGoingPositive, // right/down
        isGoingNegative, // left/up
        desiredElementStart, // left/top edge of element
        desiredElementEnd, // right/bottom edge of element
        visibleAreaStart, // visible left/top boundary
        visibleAreaEnd, // visible right/bottom boundary
        currentScroll, // current scrollLeft or scrollTop value
        initialPosition, // initialLeft or initialTop
        moveAmount, // gestureInfo.xMove or gestureInfo.yMove
        scrollProperty, // 'scrollLeft' or 'scrollTop'
        styleProperty, // 'left' or 'top'
        autoScrollProperty, // 'autoScrolledX' or 'autoScrolledY'
      }) => {
        let scroll = currentScroll;

        keep_into_view: {
          if (isGoingPositive) {
            if (desiredElementEnd > visibleAreaEnd) {
              const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
              scroll = currentScroll + scrollAmountNeeded;
            }
          } else if (isGoingNegative) {
            if (desiredElementStart < visibleAreaStart) {
              const scrollAmountNeeded = visibleAreaStart - desiredElementStart;
              scroll = Math.max(0, currentScroll - scrollAmountNeeded);
            }
          }
          scrollableParent[scrollProperty] = scroll;
          gestureInfo[autoScrollProperty] = scroll;
        }
        move: {
          const elementPosition = initialPosition + moveAmount;
          if (elementToMove) {
            elementToMove.style[styleProperty] = `${elementPosition}px`;
          }
        }
      };

      const scrollableRect = scrollableParent.getBoundingClientRect();

      // Calculate where element bounds would be in viewport coordinates
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();

      // Horizontal auto-scroll
      if (direction.x) {
        const availableWidth = scrollableParent.clientWidth;
        const visibleAreaLeft = scrollableRect.left;
        const visibleAreaRight = visibleAreaLeft + availableWidth;
        const desiredElementLeftRelative = initialLeft + gestureInfo.xMove;
        const desiredElementLeft =
          desiredElementLeftRelative + currentPositionedParentRect.left;
        const desiredElementRight = desiredElementLeft + elementWidth;
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
        moveAndKeepIntoView({
          isGoingPositive: isGoingRight,
          isGoingNegative: isGoingLeft,
          desiredElementStart: desiredElementLeft,
          desiredElementEnd: desiredElementRight,
          visibleAreaStart: visibleAreaLeft,
          visibleAreaEnd: visibleAreaRight,
          currentScroll: scrollableParent.scrollLeft,
          initialPosition: initialLeft,
          moveAmount: gestureInfo.xMove,
          scrollProperty: "scrollLeft",
          styleProperty: "left",
          autoScrollProperty: "autoScrolledX",
        });
      }

      // Vertical auto-scroll
      if (direction.y) {
        const availableHeight = scrollableParent.clientHeight;
        const visibleAreaTop = scrollableRect.top;
        const visibleAreaBottom = visibleAreaTop + availableHeight;
        const desiredElementTopRelative = initialTop + gestureInfo.yMove;
        const desiredElementTop =
          desiredElementTopRelative + currentPositionedParentRect.top;
        const desiredElementBottom = desiredElementTop + elementHeight;
        moveAndKeepIntoView({
          isGoingPositive: isGoingDown,
          isGoingNegative: isGoingUp,
          desiredElementStart: desiredElementTop,
          desiredElementEnd: desiredElementBottom,
          visibleAreaStart: visibleAreaTop,
          visibleAreaEnd: visibleAreaBottom,
          currentScroll: scrollableParent.scrollTop,
          initialPosition: initialTop,
          moveAmount: gestureInfo.yMove,
          scrollProperty: "scrollTop",
          styleProperty: "top",
          autoScrollProperty: "autoScrolledY",
        });
      }

      // Update constraint feedback line to show visual connection between mouse and element
      // when constraints prevent the element from following the mouse cursor
      if (
        !isRelease &&
        constraintFeedbackLine &&
        mouseX !== null &&
        mouseY !== null
      ) {
        // Calculate element center position in viewport coordinates
        const currentElementRect =
          elementVisuallyMoving.getBoundingClientRect();
        const elementCenterX =
          currentElementRect.left + currentElementRect.width / 2;
        const elementCenterY =
          currentElementRect.top + currentElementRect.height / 2;

        updateConstraintFeedbackLine(
          constraintFeedbackLine,
          mouseX,
          mouseY,
          elementCenterX,
          elementCenterY,
        );
      }

      if (!started) {
        started = true;
        onDragStart?.(gestureInfo);
        onDrag?.(gestureInfo, "start");
      } else {
        onDrag?.(gestureInfo, "middle");
      }
    };

    const release = (currentXRelative, currentYRelative) => {
      gestureInfo.isMouseUp = true;
      drag(currentXRelative, currentYRelative, { isRelease: true });

      // Hide constraint feedback line
      if (constraintFeedbackLine) {
        constraintFeedbackLine.style.opacity = "0";
      }

      // Clean up any remaining debug markers when drag ends
      if (DRAG_DEBUG_VISUAL_MARKERS && gestureInfo.currentDebugMarkers) {
        gestureInfo.currentDebugMarkers.forEach((marker) => {
          if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
          }
        });
        gestureInfo.currentDebugMarkers = null;
      }

      onRelease?.(gestureInfo);
    };

    onGrab?.(gestureInfo);

    return {
      drag,
      release,
      gestureInfo,
    };
  };

  const grabViaMousedown = (
    mousedownEvent,
    setup = () => {
      return {
        element: mousedownEvent.target,
      };
    },
  ) => {
    if (mousedownEvent.defaultPrevented) {
      return null;
    }
    if (mousedownEvent.button !== 0) {
      return null;
    }
    const target = mousedownEvent.target;
    if (!target.closest) {
      return null;
    }

    mousedownEvent.preventDefault();
    const xAtStart = mousedownEvent.clientX;
    const yAtStart = mousedownEvent.clientY;

    const endCallbackSet = new Set();
    const setupResult = setup({
      addTeardown: (callback) => {
        endCallbackSet.add(callback);
      },
    });
    if (!setupResult) {
      return null;
    }

    const positionedParent = getPositionedParent(setupResult.element);
    const positionedParentRect = positionedParent.getBoundingClientRect();

    // Convert mouse start position to relative coordinates
    const xAtStartRelative = xAtStart - positionedParentRect.left;
    const yAtStartRelative = yAtStart - positionedParentRect.top;

    const dragGesture = grab({
      ...setupResult,
      xAtStart: xAtStartRelative,
      yAtStart: yAtStartRelative,
      addTeardown: (callback) => {
        endCallbackSet.add(callback);
      },
    });

    // Set up mouse event handlers
    const handleMouseMove = (e) => {
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();
      const currentXRelative = e.clientX - currentPositionedParentRect.left;
      const currentYRelative = e.clientY - currentPositionedParentRect.top;
      dragGesture.drag(currentXRelative, currentYRelative, {
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    };

    const handleMouseUp = (e) => {
      e.preventDefault();
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();
      const currentXRelative = e.clientX - currentPositionedParentRect.left;
      const currentYRelative = e.clientY - currentPositionedParentRect.top;
      dragGesture.release(currentXRelative, currentYRelative);

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      for (const endCallback of endCallbackSet) {
        endCallback();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    endCallbackSet.add(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });

    return dragGesture;
  };

  return {
    grab,
    grabViaMousedown,
  };
};

// Legacy compatibility
export const startDragGesture = (mousedownEvent, options) => {
  const dragGesture = createDragGesture(options);
  return dragGesture.grabViaMousedown(mousedownEvent, options.setup);
};
