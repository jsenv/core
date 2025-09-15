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

  .navi_debug_marker {
    position: fixed;
    width: 2px;
    height: 100vh;
    z-index: 9999;
    pointer-events: none;
    opacity: 0.7;
  }

  .navi_debug_marker--vertical {
    width: 2px;
    height: 100vh;
  }

  .navi_debug_marker--horizontal {
    width: 100vw;
    height: 2px;
  }

  .navi_debug_marker--red {
    background-color: red;
  }

  .navi_debug_marker--blue {
    background-color: blue;
  }

  .navi_debug_marker--green {
    background-color: green;
  }

  .navi_debug_marker--orange {
    background-color: orange;
  }

  .navi_debug_marker--purple {
    background-color: purple;
  }

  .navi_debug_marker_label {
    position: absolute;
    top: 10px;
    left: 5px;
    font-size: 12px;
    font-weight: bold;
    text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.8);
    pointer-events: none;
  }

  .navi_debug_marker_label--red {
    color: red;
  }

  .navi_debug_marker_label--blue {
    color: blue;
  }

  .navi_debug_marker_label--green {
    color: green;
  }

  .navi_debug_marker_label--orange {
    color: orange;
  }

  .navi_debug_marker_label--purple {
    color: purple;
  }

  .navi_obstacle_marker {
    position: fixed;
    background-color: orange;
    opacity: 0.5;
    z-index: 9999;
    pointer-events: none;
  }

  .navi_obstacle_marker_label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
    pointer-events: none;
  }
`;

export let DRAG_DEBUG_VISUAL_MARKERS = true;
export const enableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = true;
};
export const disableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = false;
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
  lifecycle,
}) => {
  const teardownCallbackSet = new Set();
  const addTeardown = (callback) => {
    teardownCallbackSet.add(callback);
  };

  const grab = ({
    element,
    elementToImpact = element,
    elementVisuallyImpacted = elementToImpact,
    direction = defaultDirection,
    cursor = "grabbing",
    xAtStart,
    yAtStart,
  }) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const positionedParent = getPositionedParent(element);
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const elementVisuallyImpactedRect =
      elementVisuallyImpacted.getBoundingClientRect();

    // Convert to coordinates relative to positioned parent
    const initialLeft =
      elementVisuallyImpactedRect.left - positionedParentRect.left;
    const initialTop =
      elementVisuallyImpactedRect.top - positionedParentRect.top;

    const scrollableParent = getScrollableParent(element);
    const initialScrollLeft = scrollableParent
      ? scrollableParent.scrollLeft
      : 0;
    const initialScrollTop = scrollableParent ? scrollableParent.scrollTop : 0;

    const gestureInfo = {
      element,
      elementToImpact,
      elementVisuallyImpacted,
      xAtStart,
      yAtStart,
      x: xAtStart,
      y: yAtStart,
      xMove: 0,
      yMove: 0,
      xChanged: false,
      yChanged: false,
      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,
      isMouseUp: false,
      initialLeft,
      initialTop,
      initialScrollLeft,
      initialScrollTop,
      autoScrolledX: 0,
      autoScrolledY: 0,
    };
    let previousGestureInfo = null;
    let started = !threshold;

    // Debug markers storage (separate from gestureInfo)
    let currentDebugMarkers = [];
    let currentConstraintMarkers = [];

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

    // Set up constraints - collect all constraint functions
    const constraintFunctions = [];

    // Always add bounds constraint (scrollable area)
    const boundsConstraint = createScrollableAreaConstraint(scrollableParent);
    constraintFunctions.push(boundsConstraint);

    // Check for obstacles and add obstacle constraint if found
    const obstacles = scrollableParent.querySelectorAll("[data-drag-obstacle]");
    for (const obstacle of obstacles) {
      constraintFunctions.push(
        createObstacleConstraint(obstacle, positionedParent),
      );
    }

    // Clean up debug markers when gesture ends
    addTeardown(() => {
      currentDebugMarkers.forEach((marker) => {
        if (marker && marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      });
      currentConstraintMarkers.forEach((marker) => {
        if (marker && marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      });
      currentDebugMarkers = [];
      currentConstraintMarkers = [];
    });

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
          elementVisuallyImpacted.getBoundingClientRect();
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

      const previousX = gestureInfo.x;
      const previousY = gestureInfo.y;

      gestureInfo.x = currentXRelative;
      gestureInfo.y = currentYRelative;
      gestureInfo.xDiff = previousX - currentXRelative;
      gestureInfo.yDiff = previousY - currentYRelative;
      const xMove = direction.x ? gestureInfo.x - gestureInfo.xAtStart : 0;
      const yMove = direction.y ? gestureInfo.y - gestureInfo.yAtStart : 0;

      // Calculate direction based on where the element is trying to move (relative to previous position)
      const previousXMove = previousGestureInfo ? previousGestureInfo.xMove : 0;
      const previousYMove = previousGestureInfo ? previousGestureInfo.yMove : 0;

      const isGoingLeft = xMove < previousXMove;
      const isGoingRight = xMove > previousXMove;
      const isGoingUp = yMove < previousYMove;
      const isGoingDown = yMove > previousYMove;

      gestureInfo.isGoingLeft = isGoingLeft;
      gestureInfo.isGoingRight = isGoingRight;
      gestureInfo.isGoingUp = isGoingUp;
      gestureInfo.isGoingDown = isGoingDown;

      // Get current element dimensions for dynamic constraint calculation
      const currentElementRect =
        elementVisuallyImpacted.getBoundingClientRect();
      const currentElementWidth = currentElementRect.width;
      const currentElementHeight = currentElementRect.height;

      const constraints = constraintFunctions.map((fn) =>
        fn({
          elementWidth: currentElementWidth,
          elementHeight: currentElementHeight,
        }),
      );
      const constrainedMoves = applyConstraints(gestureInfo, {
        xMove,
        yMove,
        constraints,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
      });
      gestureInfo.xMove = constrainedMoves.xMove;
      gestureInfo.yMove = constrainedMoves.yMove;
      gestureInfo.xChanged = previousGestureInfo
        ? gestureInfo.xMove !== previousGestureInfo.xMove
        : true;
      gestureInfo.yChanged = previousGestureInfo
        ? gestureInfo.yMove !== previousGestureInfo.yMove
        : true;

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

      const scrollableRect = scrollableParent.getBoundingClientRect();
      const availableWidth = scrollableParent.clientWidth;
      const visibleAreaLeft = scrollableRect.left;
      const visibleAreaRight = visibleAreaLeft + availableWidth;
      const availableHeight = scrollableParent.clientHeight;
      const visibleAreaTop = scrollableRect.top;
      const visibleAreaBottom = visibleAreaTop + availableHeight;

      if (DRAG_DEBUG_VISUAL_MARKERS) {
        // Schedule removal of previous markers if they exist
        const previousDebugMarkers = [...currentDebugMarkers];
        const previousConstraintMarkers = [...currentConstraintMarkers];

        if (
          previousDebugMarkers.length > 0 ||
          previousConstraintMarkers.length > 0
        ) {
          setTimeout(() => {
            previousDebugMarkers.forEach((marker) => {
              if (marker && marker.parentNode) {
                marker.parentNode.removeChild(marker);
              }
            });
            previousConstraintMarkers.forEach((marker) => {
              if (marker && marker.parentNode) {
                marker.parentNode.removeChild(marker);
              }
            });
          }, 100);
        }
        currentConstraintMarkers = [];
        currentDebugMarkers = [];

        // Create new debug markers
        currentDebugMarkers.push(
          createDebugMarker("visibleAreaLeft", visibleAreaLeft, 0, "blue"),
        );
        currentDebugMarkers.push(
          createDebugMarker("visibleAreaRight", visibleAreaRight, 0, "green"),
        );

        // Create dynamic constraint markers based on current element size
        const currentPositionedParentRect =
          positionedParent.getBoundingClientRect();

        // Compute current constraint bounds for debug markers
        const constraints = constraintFunctions.map((fn) =>
          fn({
            elementWidth: currentElementWidth,
            elementHeight: currentElementHeight,
          }),
        );

        // For debug markers, we'll show bounds constraints and obstacle zones
        let constraintLeft = 0;
        let constraintTop = 0;
        let constraintRight = Infinity;
        let constraintBottom = Infinity;

        // Extract bounds from bounds constraints and collect obstacle data
        const obstacles = [];
        for (const constraint of constraints) {
          if (constraint.type === "bounds") {
            constraintLeft = Math.max(constraintLeft, constraint.left);
            constraintTop = Math.max(constraintTop, constraint.top);
            constraintRight = Math.min(constraintRight, constraint.right);
            constraintBottom = Math.min(constraintBottom, constraint.bottom);
          } else if (constraint.type === "obstacle") {
            obstacles.push(constraint);
          }
        }

        // Create markers for obstacles
        obstacles.forEach((obstacle, index) => {
          const obstacleLeftViewport =
            currentPositionedParentRect.left + obstacle.left;
          const obstacleTopViewport =
            currentPositionedParentRect.top + obstacle.top;
          const obstacleWidth = obstacle.right - obstacle.left;
          const obstacleHeight = obstacle.bottom - obstacle.top;

          const obstacleMarker = createObstacleMarker(
            `Obstacle ${index + 1}`,
            obstacleLeftViewport,
            obstacleTopViewport,
            obstacleWidth,
            obstacleHeight,
          );

          if (obstacleMarker) {
            currentConstraintMarkers.push(obstacleMarker);
          }
        });

        // Create constraint markers
        if (constraintLeft > 0) {
          const constraintLeftViewport =
            currentPositionedParentRect.left + constraintLeft;
          currentConstraintMarkers.push(
            createDebugMarker(
              "constraintLeft",
              constraintLeftViewport,
              0,
              "red",
            ),
          );
        }
        if (constraintRight !== Infinity) {
          const constraintRightViewport =
            currentPositionedParentRect.left + constraintRight;
          currentConstraintMarkers.push(
            createDebugMarker(
              "constraintRight",
              constraintRightViewport,
              0,
              "red",
            ),
          );
        }
        if (constraintTop > 0) {
          const constraintTopViewport =
            currentPositionedParentRect.top + constraintTop;
          currentConstraintMarkers.push(
            createDebugMarker(
              "constraintTop",
              constraintTopViewport,
              0,
              "red",
              "horizontal",
            ),
          );
        }
        if (constraintBottom !== Infinity) {
          const constraintBottomViewport =
            currentPositionedParentRect.top + constraintBottom;
          currentConstraintMarkers.push(
            createDebugMarker(
              "constraintBottom",
              constraintBottomViewport,
              0,
              "red",
              "horizontal",
            ),
          );
        }
      }

      lifecycle?.drag?.(gestureInfo, {
        scrollableParent,
        positionedParent,
        direction,
        visibleAreaLeft,
        visibleAreaRight,
        visibleAreaTop,
        visibleAreaBottom,
      });

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
      for (const teardownCallback of teardownCallbackSet) {
        teardownCallback();
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

  const grabViaMousedown = (mousedownEvent, options) => {
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

    const element = options.element;
    const positionedParent = getPositionedParent(element);
    const positionedParentRect = positionedParent.getBoundingClientRect();

    // Convert mouse start position to relative coordinates
    const xAtStartRelative = xAtStart - positionedParentRect.left;
    const yAtStartRelative = yAtStart - positionedParentRect.top;

    const dragGesture = grab({
      ...options,
      xAtStart: xAtStartRelative,
      yAtStart: yAtStartRelative,
    });

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
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    addTeardown(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
    return dragGesture;
  };

  return {
    grab,
    grabViaMousedown,
    addTeardown,
  };
};

const createDebugMarker = (
  name,
  x,
  y,
  color = "red",
  orientation = "vertical",
) => {
  if (!DRAG_DEBUG_VISUAL_MARKERS) return null;

  const marker = document.createElement("div");
  marker.className = `navi_debug_marker navi_debug_marker--${orientation} navi_debug_marker--${color}`;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = `navi_debug_marker_label navi_debug_marker_label--${color}`;
  label.textContent = name;
  marker.appendChild(label);

  document.body.appendChild(marker);
  return marker;
};

const createObstacleMarker = (name, left, top, width, height) => {
  if (!DRAG_DEBUG_VISUAL_MARKERS) return null;

  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${left}px`;
  marker.style.top = `${top}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = name;
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

const createScrollableAreaConstraint = (scrollableParent) => {
  return ({ elementWidth, elementHeight }) => {
    return {
      type: "bounds",
      left: 0,
      top: 0,
      right: scrollableParent.scrollWidth - elementWidth,
      bottom: scrollableParent.scrollHeight - elementHeight,
    };
  };
};

// Function to create constraint that respects solid obstacles
const createObstacleConstraint = (obstacle, positionedParent) => {
  return () => {
    const obstacleRect = obstacle.getBoundingClientRect();
    const positionedParentRect = positionedParent.getBoundingClientRect();

    // Convert obstacle coordinates to be relative to positioned parent
    return {
      type: "obstacle",
      left: obstacleRect.left - positionedParentRect.left,
      top: obstacleRect.top - positionedParentRect.top,
      right: obstacleRect.right - positionedParentRect.left,
      bottom: obstacleRect.bottom - positionedParentRect.top,
    };
  };
};

// Apply constraints on both X and Y axes
const applyConstraints = (
  gestureInfo,
  { xMove, yMove, elementWidth, elementHeight, constraints },
) => {
  const { initialLeft, initialTop } = gestureInfo;

  for (const constraint of constraints) {
    if (constraint.type === "bounds") {
      // Apply bounds constraints directly
      const minAllowedXMove = constraint.left - initialLeft;
      if (xMove < minAllowedXMove) {
        xMove = minAllowedXMove;
      }
      const maxAllowedXMove = constraint.right - initialLeft;
      if (xMove > maxAllowedXMove) {
        xMove = maxAllowedXMove;
      }
      const minAllowedYMove = constraint.top - initialTop;
      if (yMove < minAllowedYMove) {
        yMove = minAllowedYMove;
      }
      const maxAllowedYMove = constraint.bottom - initialTop;
      if (yMove > maxAllowedYMove) {
        yMove = maxAllowedYMove;
      }
    } else if (constraint.type === "obstacle") {
      // Current element position
      const currentLeft = initialLeft;
      const currentRight = currentLeft + elementWidth;
      const currentTop = initialTop;
      const currentBottom = currentTop + elementHeight;

      // Determine current position relative to obstacle
      const isOnTheLeft = currentRight <= constraint.left;
      const isOnTheRight = currentLeft >= constraint.right;
      const isAbove = currentBottom <= constraint.top;
      const isBelow = currentTop >= constraint.bottom;

      // Check for potential Y overlap with proposed position
      const proposedTop = initialTop + yMove;
      const proposedBottom = proposedTop + elementHeight;
      const wouldHaveYOverlap =
        proposedTop < constraint.bottom && proposedBottom > constraint.top;

      // Apply X constraints if Y overlap would occur
      if (wouldHaveYOverlap) {
        if (isOnTheLeft && gestureInfo.isGoingRight) {
          // Element on left, trying to go right - stop at obstacle left
          const maxAllowedXMove = constraint.left - elementWidth - initialLeft;
          if (xMove > maxAllowedXMove) {
            xMove = maxAllowedXMove;
          }
        } else if (isOnTheRight && gestureInfo.isGoingLeft) {
          // Element on right, trying to go left - stop at obstacle right
          const minAllowedXMove = constraint.right - initialLeft;
          if (xMove < minAllowedXMove) {
            xMove = minAllowedXMove;
          }
        }
      }

      // Apply Y constraints if X overlap would occur (using updated xMove)
      const finalProposedLeft = initialLeft + xMove;
      const finalProposedRight = finalProposedLeft + elementWidth;
      const finalWouldHaveXOverlap =
        finalProposedLeft < constraint.right &&
        finalProposedRight > constraint.left;

      if (finalWouldHaveXOverlap) {
        if (isAbove && gestureInfo.isGoingDown) {
          // Element above, trying to go down - stop at obstacle top
          const maxAllowedYMove = constraint.top - elementHeight - initialTop;
          if (yMove > maxAllowedYMove) {
            yMove = maxAllowedYMove;
          }
        } else if (isBelow && gestureInfo.isGoingUp) {
          // Element below, trying to go up - stop at obstacle bottom
          const minAllowedYMove = constraint.bottom - initialTop;
          if (yMove < minAllowedYMove) {
            yMove = minAllowedYMove;
          }
        }
      }
    }
  }

  return {
    xMove,
    yMove,
  };
};
