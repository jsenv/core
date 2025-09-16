import { getScrollableParent } from "../scroll.js";

import.meta.css = /* css */ `
  .navi_constraint_feedback_line {
    position: fixed;
    pointer-events: none;
    z-index: 9998;
    opacity: 0;
    transition: opacity 0.15s ease;
    transform-origin: left center;
    border-top: 2px dotted rgba(59, 130, 246, 0.7);
  }

  .navi_constraint_feedback_line[data-visible] {
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
  // Visual feedback line connecting mouse cursor to dragged element when constraints prevent following
  // This provides intuitive feedback during drag operations when the element cannot reach the mouse
  // position due to obstacles, boundaries, or other constraints. The line becomes visible when there's
  // a significant distance between the mouse and the element, helping users understand why the
  // element isn't moving as expected.
  constrainedFeedbackLine = true,
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
    const initialScrollLeft = scrollableParent.scrollLeft;
    const initialScrollTop = scrollableParent.scrollTop;

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
      xMouseMove: 0, // Movement caused by mouse drag
      yMouseMove: 0, // Movement caused by mouse drag
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
    };
    definePropertyAsReadOnly(gestureInfo, "xAtStart");
    definePropertyAsReadOnly(gestureInfo, "yAtStart");
    definePropertyAsReadOnly(gestureInfo, "initialLeft");
    definePropertyAsReadOnly(gestureInfo, "initialTop");
    definePropertyAsReadOnly(gestureInfo, "initialScrollLeft");
    definePropertyAsReadOnly(gestureInfo, "initialScrollTop");
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
    let constraintFeedbackLine;
    if (constrainedFeedbackLine) {
      constraintFeedbackLine = createConstraintFeedbackLine();
      addTeardown(() => {
        document.body.removeChild(constraintFeedbackLine);
      });
    }

    // Track last known mouse position for constraint feedback line during scroll
    let lastMouseX = null;
    let lastMouseY = null;
    // Internal function to update constraint feedback line
    const updateConstraintFeedbackLine = ({ mouseX, mouseY }) => {
      if (!constraintFeedbackLine) {
        return;
      }

      // Update last known mouse position if provided
      if (mouseX !== null && mouseY !== null) {
        lastMouseX = mouseX;
        lastMouseY = mouseY;
      }

      // Use last known position if current position not available (e.g., during scroll)
      const effectiveMouseX = mouseX !== null ? mouseX : lastMouseX;
      const effectiveMouseY = mouseY !== null ? mouseY : lastMouseY;

      if (effectiveMouseX === null || effectiveMouseY === null) {
        return;
      }

      // Calculate element center position in viewport coordinates
      const currentElementRect =
        elementVisuallyImpacted.getBoundingClientRect();
      const elementCenterX =
        currentElementRect.left + currentElementRect.width / 2;
      const elementCenterY =
        currentElementRect.top + currentElementRect.height / 2;

      // Calculate distance between mouse and element center
      const deltaX = effectiveMouseX - elementCenterX;
      const deltaY = effectiveMouseY - elementCenterY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Show line only when distance is significant (> 20px threshold)
      const threshold = 20;
      if (distance <= threshold) {
        constraintFeedbackLine.removeAttribute("data-visible");
        return;
      }

      // Calculate angle and position
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      constraintFeedbackLine.setAttribute("data-visible", "");
      // Position line at element center (which automatically accounts for scroll via getBoundingClientRect)
      constraintFeedbackLine.style.left = `${elementCenterX}px`;
      constraintFeedbackLine.style.top = `${elementCenterY}px`;
      constraintFeedbackLine.style.width = `${distance}px`;
      constraintFeedbackLine.style.transform = `rotate(${angle}deg)`;
      // Fade in based on distance (more visible as distance increases)
      const maxOpacity = 0.8;
      const opacityFactor = Math.min((distance - threshold) / 100, 1);
      constraintFeedbackLine.style.opacity = `${maxOpacity * opacityFactor}`;
    };

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

    // Set up scroll event handling to adjust drag position when scrolling occurs
    update_on_scroll: {
      let isHandlingScroll = false;
      const handleScroll = () => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;

        // When scrolling occurs during drag, recalculate with scroll interaction type
        // This preserves mouse movement but recalculates total movement with new scroll offset
        drag(gestureInfo.x, gestureInfo.y, { interactionType: "scroll" });

        isHandlingScroll = false;
      };
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addTeardown(() => {
        scrollableParent.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const drawVisualMarkers = ({
      constraints,
      visibleAreaLeft,
      visibleAreaRight,
      visibleAreaTop,
      visibleAreaBottom,
    }) => {
      // Schedule removal of previous markers if they exist
      const previousDebugMarkers = [...currentDebugMarkers];
      const previousConstraintMarkers = [...currentConstraintMarkers];

      if (
        previousDebugMarkers.length > 0 ||
        previousConstraintMarkers.length > 0
      ) {
        setTimeout(() => {
          previousDebugMarkers.forEach((marker) => marker.remove());
          previousConstraintMarkers.forEach((marker) => marker.remove());
        }, 100);
      }

      // Clear current marker arrays
      currentDebugMarkers.length = 0;
      currentConstraintMarkers.length = 0;

      // Add visual markers for visible area bounds
      currentDebugMarkers.push(
        createDebugMarker("visibleAreaTop", 0, visibleAreaTop, "red"),
      );
      currentDebugMarkers.push(
        createDebugMarker("visibleAreaBottom", 0, visibleAreaBottom, "orange"),
      );
      currentDebugMarkers.push(
        createDebugMarker("visibleAreaLeft", visibleAreaLeft, 0, "blue"),
      );
      currentDebugMarkers.push(
        createDebugMarker("visibleAreaRight", visibleAreaRight, 0, "green"),
      );

      // Create dynamic constraint markers based on current element size
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();

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
          createDebugMarker("constraintLeft", constraintLeftViewport, 0, "red"),
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
    };

    const determineDragData = (
      currentXRelative,
      currentYRelative,
      { isRelease = false, interactionType },
    ) => {
      const previousX = gestureInfo.x;
      const previousY = gestureInfo.y;

      const x = currentXRelative;
      const y = currentYRelative;
      const xDiff = previousX - currentXRelative;
      const yDiff = previousY - currentYRelative;

      // Calculate movement based on interaction type
      let xMouseMove;
      let yMouseMove;
      let xMove;
      let yMove;

      if (interactionType === "scroll") {
        // For scroll events, keep existing mouse movement but recalculate total movement with new scroll
        xMouseMove = gestureInfo.xMouseMove; // Keep existing mouse movement
        yMouseMove = gestureInfo.yMouseMove; // Keep existing mouse movement

        // Recalculate total movement with current scroll offset
        const currentScrollLeft = scrollableParent.scrollLeft;
        const currentScrollTop = scrollableParent.scrollTop;
        const scrollDeltaX = direction.x
          ? currentScrollLeft - initialScrollLeft
          : 0;
        const scrollDeltaY = direction.y
          ? currentScrollTop - initialScrollTop
          : 0;

        xMove = xMouseMove + scrollDeltaX;
        yMove = yMouseMove + scrollDeltaY;

        console.log(`[SCROLL] Recalculating with scroll delta:`, {
          xMouseMove,
          yMouseMove,
          scrollDeltaX,
          scrollDeltaY,
          xMove,
          yMove,
        });
      } else {
        // For mouse movement and programmatic calls, calculate scroll offset first
        const currentScrollLeft = scrollableParent.scrollLeft;
        const currentScrollTop = scrollableParent.scrollTop;
        const scrollDeltaX = direction.x
          ? currentScrollLeft - initialScrollLeft
          : 0;
        const scrollDeltaY = direction.y
          ? currentScrollTop - initialScrollTop
          : 0;

        // For mouse movement, currentXRelative already includes scroll effects
        // So mouse movement = current position - start position - scroll offset
        xMouseMove = direction.x ? x - gestureInfo.xAtStart - scrollDeltaX : 0;
        yMouseMove = direction.y ? y - gestureInfo.yAtStart - scrollDeltaY : 0;

        // Total movement = mouse movement + scroll offset (should equal x - xAtStart)
        xMove = xMouseMove + scrollDeltaX;
        yMove = yMouseMove + scrollDeltaY;

        console.log(`[${interactionType.toUpperCase()}] Fixed calculation:`, {
          xFromStart: direction.x ? x - gestureInfo.xAtStart : 0,
          yFromStart: direction.y ? y - gestureInfo.yAtStart : 0,
          scrollDeltaX,
          scrollDeltaY,
          xMouseMove,
          yMouseMove,
          xMove,
          yMove,
        });
      }

      // Calculate direction based on where the element is trying to move (relative to previous position)
      const previousXMove = previousGestureInfo ? previousGestureInfo.xMove : 0;
      const previousYMove = previousGestureInfo ? previousGestureInfo.yMove : 0;

      const isGoingLeft = xMove < previousXMove;
      const isGoingRight = xMove > previousXMove;
      const isGoingUp = yMove < previousYMove;
      const isGoingDown = yMove > previousYMove;

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

      const scrollableRect = scrollableParent.getBoundingClientRect();
      const availableWidth = scrollableParent.clientWidth;
      const visibleAreaLeft = scrollableRect.left;
      const visibleAreaRight = visibleAreaLeft + availableWidth;
      const availableHeight = scrollableParent.clientHeight;
      const visibleAreaTop = scrollableRect.top;
      const visibleAreaBottom = visibleAreaTop + availableHeight;

      if (DRAG_DEBUG_VISUAL_MARKERS) {
        drawVisualMarkers({
          constraints,
          visibleAreaLeft,
          visibleAreaRight,
          visibleAreaTop,
          visibleAreaBottom,
        });
      }

      const constrainedMoves = applyConstraints(gestureInfo, {
        xMove,
        yMove,
        constraints,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
      });
      const finalXMove = constrainedMoves.xMove;
      const finalYMove = constrainedMoves.yMove;
      const dragData = {
        x,
        y,
        xDiff,
        yDiff,
        xMove: finalXMove,
        yMove: finalYMove,
        xMouseMove,
        yMouseMove,
        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,
        visibleAreaLeft,
        visibleAreaRight,
        visibleAreaTop,
        visibleAreaBottom,
      };

      if (isRelease) {
        if (!started) {
          return null;
        }
        return dragData;
      }
      if (!started && threshold) {
        const deltaX = Math.abs(finalXMove);
        const deltaY = Math.abs(finalYMove);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return null;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return null;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return null;
          }
        }
      }
      return dragData;
    };

    const drag = (
      currentXRelative,
      currentYRelative,
      {
        isRelease = false,
        mouseX = null,
        mouseY = null,
        interactionType = "programmatic", // "mousemove", "scroll", "programmatic"
      } = {},
    ) => {
      // Debug logging
      console.log(`[DRAG] ${interactionType}:`, {
        currentXRelative,
        currentYRelative,
        isRelease,
        mouseX,
        mouseY,
        gestureInfoX: gestureInfo.x,
        gestureInfoY: gestureInfo.y,
        xMouseMove: gestureInfo.xMouseMove,
        yMouseMove: gestureInfo.yMouseMove,
        xMove: gestureInfo.xMove,
        yMove: gestureInfo.yMove,
      });

      const dragData = determineDragData(currentXRelative, currentYRelative, {
        isRelease,
        interactionType,
      });

      if (!dragData) {
        updateConstraintFeedbackLine({ mouseX, mouseY });
        return;
      }
      // Only update previousGestureInfo if it's not a release
      if (!isRelease) {
        previousGestureInfo = { ...gestureInfo };
      }

      Object.assign(gestureInfo, dragData);
      // Calculate xChanged/yChanged based on previous gesture info
      const xChanged = previousGestureInfo
        ? dragData.xMove !== previousGestureInfo.xMove
        : true;
      const yChanged = previousGestureInfo
        ? dragData.yMove !== previousGestureInfo.yMove
        : true;
      Object.assign(gestureInfo, { xChanged, yChanged });
      const someChange = xChanged || yChanged;
      if (someChange) {
        lifecycle?.drag?.(gestureInfo, {
          scrollableParent,
          positionedParent,
          direction,
        });
      }
      updateConstraintFeedbackLine({ mouseX, mouseY });
      if (isRelease) {
        onDrag?.(gestureInfo, "end");
      } else if (!started) {
        started = true;
        onDragStart?.(gestureInfo);
        onDrag?.(gestureInfo, "start");
      } else {
        onDrag?.(gestureInfo, "middle");
      }
    };

    const release = (
      currentXRelative,
      currentYRelative,
      { interactionType = "programmatic" } = {},
    ) => {
      gestureInfo.isMouseUp = true;
      drag(currentXRelative, currentYRelative, {
        isRelease: true,
        interactionType,
      });
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
      interactionType: "mousedown",
    });

    const handleMouseMove = (e) => {
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();
      const currentXRelative = e.clientX - currentPositionedParentRect.left;
      const currentYRelative = e.clientY - currentPositionedParentRect.top;
      dragGesture.drag(currentXRelative, currentYRelative, {
        mouseX: e.clientX,
        mouseY: e.clientY,
        interactionType: "mousemove",
      });
    };

    const handleMouseUp = (e) => {
      e.preventDefault();
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();
      const currentXRelative = e.clientX - currentPositionedParentRect.left;
      const currentYRelative = e.clientY - currentPositionedParentRect.top;
      dragGesture.release(currentXRelative, currentYRelative, {
        interactionType: "mouseup",
      });
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

const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title =
    "Constraint feedback - shows distance between mouse and constrained element";
  document.body.appendChild(line);
  return line;
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
    // getBoundingClientRect() already accounts for scroll position
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
      // Current element position using the passed current movement values
      // This ensures we use the actual current position, not potentially stale gestureInfo values
      const actualCurrentXMove = gestureInfo.xMove || 0;
      const actualCurrentYMove = gestureInfo.yMove || 0;

      const currentActualLeft = initialLeft + actualCurrentXMove;
      const currentActualRight = currentActualLeft + elementWidth;
      const currentActualTop = initialTop + actualCurrentYMove;
      const currentActualBottom = currentActualTop + elementHeight;

      // Determine current position relative to obstacle
      const isOnTheLeft = currentActualRight <= constraint.left;
      const isOnTheRight = currentActualLeft >= constraint.right;
      const isAbove = currentActualBottom <= constraint.top;
      const isBelow = currentActualTop >= constraint.bottom;

      // Debug logging for obstacle constraints
      console.log(`[OBSTACLE] Checking constraint:`, {
        constraintLeft: constraint.left,
        constraintRight: constraint.right,
        currentActualLeft,
        currentActualRight,
        actualCurrentXMove,
        proposedXMove: xMove,
        isOnTheLeft,
        isOnTheRight,
        elementWidth,
      });

      // Apply constraints based on element position - handle all cases including diagonal

      // Always check Y constraints if element is above or below
      if (isAbove || isBelow) {
        const proposedLeft = initialLeft + xMove;
        const proposedRight = proposedLeft + elementWidth;
        const wouldHaveXOverlap =
          proposedLeft < constraint.right && proposedRight > constraint.left;

        if (wouldHaveXOverlap) {
          if (isAbove) {
            // Element above - prevent it from going down into obstacle
            const maxAllowedYMove = constraint.top - elementHeight - initialTop;
            if (yMove > maxAllowedYMove) {
              yMove = maxAllowedYMove;
            }
          } else if (isBelow) {
            // Element below - prevent it from going up into obstacle
            const minAllowedYMove = constraint.bottom - initialTop;
            if (yMove < minAllowedYMove) {
              yMove = minAllowedYMove;
            }
          }
        }
      }

      // Always check X constraints if element is on left or right (even after Y adjustment)
      if (isOnTheLeft || isOnTheRight) {
        const proposedTop = initialTop + yMove; // Use potentially adjusted yMove
        const proposedBottom = proposedTop + elementHeight;
        const wouldHaveYOverlap =
          proposedTop < constraint.bottom && proposedBottom > constraint.top;

        if (wouldHaveYOverlap) {
          if (isOnTheLeft) {
            // Element on left - prevent it from going right into obstacle
            const maxAllowedXMove =
              constraint.left - elementWidth - initialLeft;
            if (xMove > maxAllowedXMove) {
              xMove = maxAllowedXMove;
            }
          } else if (isOnTheRight) {
            // Element on right - prevent it from going left into obstacle
            const minAllowedXMove = constraint.right - initialLeft;
            if (xMove < minAllowedXMove) {
              xMove = minAllowedXMove;
            }
          }
        }
      }

      // Handle overlap case - when element is already overlapping with obstacle
      if (!isOnTheLeft && !isOnTheRight && !isAbove && !isBelow) {
        // Element is overlapping with obstacle - push it out in the direction of least resistance
        console.log(
          `[OBSTACLE] Element is overlapping with obstacle, resolving collision`,
        );

        // Calculate distances to push element out in each direction
        const distanceToLeft = currentActualRight - constraint.left; // Distance to push left
        const distanceToRight = constraint.right - currentActualLeft; // Distance to push right
        const distanceToTop = currentActualBottom - constraint.top; // Distance to push up
        const distanceToBottom = constraint.bottom - currentActualTop; // Distance to push down

        // Find the minimum distance (direction of least resistance)
        const minDistance = Math.min(
          distanceToLeft,
          distanceToRight,
          distanceToTop,
          distanceToBottom,
        );

        if (minDistance === distanceToLeft) {
          // Push left: element should not go past constraint.left - elementWidth
          const maxAllowedXMove = constraint.left - elementWidth - initialLeft;
          if (xMove > maxAllowedXMove) {
            xMove = maxAllowedXMove;
          }
        } else if (minDistance === distanceToRight) {
          // Push right: element should not go before constraint.right
          const minAllowedXMove = constraint.right - initialLeft;
          if (xMove < minAllowedXMove) {
            xMove = minAllowedXMove;
          }
        } else if (minDistance === distanceToTop) {
          // Push up: element should not go past constraint.top - elementHeight
          const maxAllowedYMove = constraint.top - elementHeight - initialTop;
          if (yMove > maxAllowedYMove) {
            yMove = maxAllowedYMove;
          }
        } else if (minDistance === distanceToBottom) {
          // Push down: element should not go before constraint.bottom
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

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};
