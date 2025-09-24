/**
 * Drag Gesture System
 *
 * Provides constraint-based dragging functionality for DOM elements with support for:
 *
 * **Core Features:**
 * - Mouse and scroll-based dragging interactions
 * - Bounds constraints (keep elements within container boundaries)
 * - Obstacle constraints (prevent elements from overlapping with other elements)
 * - Visual feedback with constraint lines and debug markers
 *
 * **Interaction Types:**
 * - Mouse dragging: Traditional click-and-drag with mouse events
 * - Scroll dragging: Drag using scroll wheel while holding mouse button
 * - Programmatic: Direct position updates via API
 *
 * **Constraint System:**
 * - Bounds constraints: Define rectangular areas elements must stay within
 * - Obstacle constraints: Define rectangular areas elements cannot overlap
 * - Sticky frontiers: Trigger scrolling when encountered, allow movement beyond when scroll exhausted
 * - Floating point precision handling: Ensures reliable constraint detection
 * - Overlap resolution: Automatic collision detection and resolution
 *
 * **Technical Details:**
 * - Uses floating point rounding to prevent precision issues in boundary detection
 * - Scroll events are more susceptible to floating point errors than mouse events
 * - Supports both relative and absolute positioning contexts
 * - Integrates with scrollable containers for viewport-aware constraints
 *
 * **Debug Features:**
 * - Visual markers show bounds, obstacles, and constraint feedback lines
 * - Optional marker persistence after drag ends for debugging constraint systems
 * - Enable/disable debug markers globally via DRAG_DEBUG_VISUAL_MARKERS
 *
 * **Usage:**
 * Call `createDragGesture(options)` to create a drag gesture system.
 * Configure constraints, interaction callbacks, visual feedback, and debug options.
 *
 * **Sticky Frontiers:**
 * Elements with one of
 * `[data-drag-sticky-frontier-left="dragName"]`,
 * `[data-drag-sticky-frontier-right="dragName"]`,
 * `[data-drag-sticky-frontier-top="dragName"]`,
 * `[data-drag-sticky-frontier-bottom="dragName"]`
 * create directional scroll barriers. When dragging encounters these barriers on their specified side,
 * scrolling is triggered first. Once scroll is exhausted, dragging can continue beyond the frontier.
 * This allows smooth scrolling behavior while maintaining drag flexibility.
 *
 * **Important:** Each sticky frontier element should have only ONE side attribute. Elements with
 * multiple side attributes will log a warning and only use the first detected side.
 *
 * **Examples:**
 * ```html
 * <!-- Sticky column header (blocks vertical movement from top) -->
 * <div
 *   data-drag-sticky-frontier-bottom="table-content"
 * >
 *   Header
 * </div>
 *
 * <!-- Sticky left sidebar (blocks horizontal movement from left) -->
 * <div
 *   data-drag-sticky-frontier-right="main-content"
 * >
 *   Sidebar
 * </div>
 * ```
 */

import { getScrollableParent } from "../scroll.js";
import { getBorderSizes } from "../size/get_border_sizes.js";
import { setStyles } from "../style_and_attributes.js";

export let DRAG_DEBUG_VISUAL_MARKERS = true;
export const enableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = true;
};
export const disableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = false;
};

import.meta.css = /* css */ `
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    user-select: none;
  }

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
    z-index: 999999;
    pointer-events: none;
    opacity: 0.5;
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
    opacity: 0.6;
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

  .navi_sticky_frontier_marker {
    position: fixed;
    background-color: purple;
    opacity: 0.1;
    z-index: 9999;
    pointer-events: none;
    border: 2px dashed purple;
  }

  .navi_sticky_frontier_marker_label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: bold;
    color: purple;
    text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.8);
    pointer-events: none;
  }
`;

export const createDragGesture = ({
  name,
  onGrab,
  onDragStart,
  onDrag,
  onRelease,
  gestureAttribute,
  threshold = 5,
  direction: defaultDirection = { x: true, y: true },
  backdrop = true,
  backdropZIndex = 1,
  // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
  // This provides intuitive feedback during drag operations when the element cannot reach the mouse
  // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
  // initially grabbed the element, but moves with the element to show the current anchor position.
  // It becomes visible when there's a significant distance between mouse and grab point.
  constrainedFeedbackLine = true,
  // Keep visual markers (debug markers, obstacle markers, constraint feedback line) in DOM after drag ends
  // Useful for debugging constraint systems and understanding why elements behave certain ways
  // When enabled, markers persist until next drag gesture starts or page is refreshed
  keepMarkersOnRelease = false,
  // Custom bounds that override the default scrollable area bounds
  // Useful for scenarios like column resizing where you want custom min/max constraints
  customLeftBound,
  customRightBound,
  customTopBound,
  customBottomBound,
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
    interactionType,
  }) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const scrollableParent = getScrollableParent(element);
    const computedStyle = getComputedStyle(element);
    if (computedStyle.position === "sticky") {
      const left = parseFloat(computedStyle.left) || 0;
      const top = parseFloat(computedStyle.top) || 0;
      const leftWithScroll = left + scrollableParent.scrollLeft;
      const topWithScroll = top + scrollableParent.scrollTop;
      const restoreStyles = setStyles(element, {
        position: "relative",
        left: `${leftWithScroll}px`,
        top: `${topWithScroll}px`,
      });
      addTeardown(() => {
        const elementRect = element.getBoundingClientRect();
        const scrollableRect = scrollableParent.getBoundingClientRect();
        const leftRelative = elementRect.left - scrollableRect.left;
        const topRelative = elementRect.top - scrollableRect.top;
        restoreStyles();
        setStyles(element, {
          left: `${leftRelative}px`,
          top: `${topRelative}px`,
        });
      });
    }

    const positionedParent = getPositionedParent(element);
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const elementToImpactRect = elementToImpact.getBoundingClientRect();
    const elementVisuallyImpactedRect =
      elementVisuallyImpacted.getBoundingClientRect();

    // Use elementVisuallyImpacted as primary coordinate system for all calculations
    // This keeps constraint logic, logging, and calculations in meaningful visual coordinates
    const initialLeft =
      elementVisuallyImpactedRect.left - positionedParentRect.left;
    const initialTop =
      elementVisuallyImpactedRect.top - positionedParentRect.top;

    // Calculate offset to translate visual movement to elementToImpact movement
    // This offset is applied only when setting elementToImpact position (xMoveToApply, yMoveToApply)
    // All constraint calculations use visual coordinates (xMove, yMove)
    const visualOffsetX =
      elementVisuallyImpactedRect.left - elementToImpactRect.left;
    const visualOffsetY =
      elementVisuallyImpactedRect.top - elementToImpactRect.top;

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
      visualOffsetX,
      visualOffsetY,
      interactionType,
    };
    definePropertyAsReadOnly(gestureInfo, "xAtStart");
    definePropertyAsReadOnly(gestureInfo, "yAtStart");
    definePropertyAsReadOnly(gestureInfo, "initialLeft");
    definePropertyAsReadOnly(gestureInfo, "initialTop");
    definePropertyAsReadOnly(gestureInfo, "initialScrollLeft");
    definePropertyAsReadOnly(gestureInfo, "initialScrollTop");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetX");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetY");
    let previousGestureInfo = null;
    let started = !threshold;

    // Debug markers storage (separate from gestureInfo)
    let currentDebugMarkers = [];
    let currentConstraintMarkers = [];

    // Clean up any existing persistent markers from previous drag gestures
    if (keepMarkersOnRelease) {
      // Remove any existing markers from previous gestures
      document
        .querySelectorAll(
          ".navi_debug_marker, .navi_obstacle_marker, .navi_sticky_frontier_marker, .navi_constraint_feedback_line",
        )
        .forEach((marker) => marker.remove());
    }

    // Set up backdrop
    if (backdrop) {
      const backdropElement = document.createElement("div");
      backdropElement.className = "navi_drag_gesture_backdrop";
      backdropElement.style.zIndex = backdropZIndex;
      backdropElement.style.cursor = cursor;
      document.body.appendChild(backdropElement);
      addTeardown(() => {
        backdropElement.remove();
      });
    }

    // Set up constraint feedback line
    let constraintFeedbackLine;
    if (constrainedFeedbackLine) {
      constraintFeedbackLine = createConstraintFeedbackLine();
      addTeardown(() => {
        if (!keepMarkersOnRelease) {
          constraintFeedbackLine.remove();
        }
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

      // Calculate current grab point position in viewport coordinates
      // The grab point is where the mouse initially clicked on the element, but moves with the element
      const positionedParentRect = positionedParent.getBoundingClientRect();

      // Current grab point = initial grab position + element movement
      // xAtStart/yAtStart are relative to positioned parent, add current movement
      const currentGrabPointX =
        positionedParentRect.left + xAtStart + (gestureInfo.xMove || 0);
      const currentGrabPointY =
        positionedParentRect.top + yAtStart + (gestureInfo.yMove || 0);

      // Calculate distance between mouse and current grab point
      const deltaX = effectiveMouseX - currentGrabPointX;
      const deltaY = effectiveMouseY - currentGrabPointY;
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
      // Position line at current grab point (follows element movement)
      constraintFeedbackLine.style.left = `${currentGrabPointX}px`;
      constraintFeedbackLine.style.top = `${currentGrabPointY}px`;
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
    const boundsConstraint = createScrollableAreaConstraint(scrollableParent, {
      customLeftBound,
      customRightBound,
      customTopBound,
      customBottomBound,
    });
    constraintFunctions.push(boundsConstraint);

    // Check for obstacles and add obstacle constraint if found
    const obstacles = createObstaclesFromQuerySelector(scrollableParent, {
      name,
      positionedParent,
    });
    for (const obstacle of obstacles) {
      constraintFunctions.push(createObstacleConstraintFromObject(obstacle));
    }

    // Clean up debug markers when gesture ends
    addTeardown(() => {
      if (!keepMarkersOnRelease) {
        currentDebugMarkers.forEach((marker) => {
          marker.remove();
        });
        currentConstraintMarkers.forEach((marker) => {
          marker.remove();
        });
        currentDebugMarkers = [];
        currentConstraintMarkers = [];
      }
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
      visibleArea,
      elementWidth,
      elementHeight,
      obstacleObjects,
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

      // Add visual markers for visible area bounds - only for allowed movement directions
      if (direction.y) {
        currentDebugMarkers.push(
          createDebugMarker({
            name: "visibleAreaTop",
            x: 0,
            y: visibleArea.top,
            color: "red",
            orientation: "horizontal",
          }),
        );
        currentDebugMarkers.push(
          createDebugMarker({
            name: "visibleAreaBottom",
            x: 0,
            y: visibleArea.bottom,
            color: "orange",
            orientation: "horizontal",
          }),
        );
      }
      if (direction.x) {
        currentDebugMarkers.push(
          createDebugMarker({
            name: "visibleAreaLeft",
            x: visibleArea.left,
            y: 0,
            color: "blue",
            orientation: "vertical",
          }),
        );
        currentDebugMarkers.push(
          createDebugMarker({
            name: "visibleAreaRight",
            x: visibleArea.right,
            y: 0,
            color: "green",
            orientation: "vertical",
          }),
        );
      }

      // Create dynamic constraint markers based on current element size
      const currentPositionedParentRect =
        positionedParent.getBoundingClientRect();

      // For debug markers, we'll show bounds constraints and obstacle zones
      let leftBound = 0;
      let topBound = 0;
      let rightBound = Infinity;
      let bottomBound = Infinity;

      // Extract bounds from bounds constraints and collect obstacle data
      const obstacles = [];
      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          leftBound = Math.max(leftBound, constraint.left);
          topBound = Math.max(topBound, constraint.top);
          rightBound = Math.min(rightBound, constraint.right);
          bottomBound = Math.min(bottomBound, constraint.bottom);
        } else if (constraint.type === "obstacle") {
          obstacles.push(constraint);
        }
      }

      // Create markers for obstacles using pre-calculated objects
      obstacleObjects.forEach((obstacleObj) => {
        const obstacleMarker = createObstacleMarker(obstacleObj);

        if (obstacleMarker) {
          currentConstraintMarkers.push(obstacleMarker);
        }
      });

      // Sticky frontier constraints are now consolidated into the visible area

      // Create bound markers - only for allowed movement directions
      if (direction.x) {
        if (leftBound > 0) {
          const leftBoundViewport =
            currentPositionedParentRect.left + leftBound;
          currentConstraintMarkers.push(
            createDebugMarker({
              name: "leftBound",
              x: leftBoundViewport,
              y: 0,
              color: "red",
              orientation: "vertical",
            }),
          );
        }
        if (rightBound !== Infinity) {
          // For visual clarity, show rightBound at the right edge of the element
          // when element is positioned at rightBound (not the left edge position)
          const rightBoundViewport =
            currentPositionedParentRect.left + rightBound + elementWidth;
          currentConstraintMarkers.push(
            createDebugMarker({
              name: "rightBound",
              x: rightBoundViewport,
              y: 0,
              color: "red",
              orientation: "vertical",
            }),
          );
        }
      }
      if (direction.y) {
        if (topBound > 0) {
          const topBoundViewport = currentPositionedParentRect.top + topBound;
          currentConstraintMarkers.push(
            createDebugMarker({
              name: "topBound",
              x: 0,
              y: topBoundViewport,
              color: "red",
              orientation: "horizontal",
            }),
          );
        }
        if (bottomBound !== Infinity) {
          // For visual clarity, show bottomBound at the bottom edge of the element
          // when element is positioned at bottomBound (not the top edge position)
          const bottomBoundViewport =
            currentPositionedParentRect.top + bottomBound + elementHeight;
          currentConstraintMarkers.push(
            createDebugMarker({
              name: "bottomBound",
              x: 0,
              y: bottomBoundViewport,
              color: "red",
              orientation: "horizontal",
            }),
          );
        }
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

      // Calculate obstacles and sticky frontiers for visual markers (avoiding recalculation)
      const obstacleObjects = createObstaclesFromQuerySelector(
        scrollableParent,
        { name, positionedParent },
      );
      const stickyFrontierObjects = [];
      if (direction.x) {
        const horizontalFrontiers =
          createHorizontalStickyFrontiersFromQuerySelector(scrollableParent, {
            name,
            scrollableParent,
          });
        stickyFrontierObjects.push(...horizontalFrontiers);
      }
      if (direction.y) {
        const verticalFrontiers =
          createVerticalStickyFrontiersFromQuerySelector(scrollableParent, {
            name,
            scrollableParent,
          });
        stickyFrontierObjects.push(...verticalFrontiers);
      }

      // Development safeguards: detect impossible/illogical constraints
      if (import.meta.dev) {
        validateConstraints(constraints, {
          elementWidth: currentElementWidth,
          elementHeight: currentElementHeight,
          dragName: name,
          stickyFrontierObjects, // Pass pre-calculated frontiers
        });
      }

      const scrollableRect = scrollableParent.getBoundingClientRect();
      const availableWidth = scrollableParent.clientWidth;
      const availableHeight = scrollableParent.clientHeight;

      // Calculate base visible area accounting for borders
      const borderSizes = getBorderSizes(scrollableParent);
      const visibleAreaBase = {
        left: scrollableRect.left + borderSizes.left,
        top: scrollableRect.top + borderSizes.top,
        right: null,
        bottom: null,
      };
      visibleAreaBase.right = visibleAreaBase.left + availableWidth;
      visibleAreaBase.bottom = visibleAreaBase.top + availableHeight;

      // Reduce sticky frontiers to a single visible area object
      const visibleArea = reduceStickyFrontiersToVisibleArea(
        visibleAreaBase,
        stickyFrontierObjects,
        { direction, dragName: name },
      );

      if (DRAG_DEBUG_VISUAL_MARKERS) {
        drawVisualMarkers({
          constraints,
          visibleArea,
          elementWidth: currentElementWidth,
          elementHeight: currentElementHeight,
          obstacleObjects,
        });
      }

      const constrainedMoves = applyConstraints(gestureInfo, {
        xMove,
        yMove,
        constraints,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
        interactionType,
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
        visibleArea,
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
    if (mousedownEvent.button !== 0) {
      return null;
    }
    const target = mousedownEvent.target;
    if (!target.closest) {
      return null;
    }

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

const createObstaclesFromQuerySelector = (
  element,
  { name, sticky, positionedParent },
) => {
  const obstacles = element.querySelectorAll("[data-drag-obstacle]");
  const matchingObstacles = [];
  for (const obstacle of obstacles) {
    if (
      sticky &&
      !obstacle.hasAttribute("data-sticky-left") &&
      !obstacle.hasAttribute("data-sticky-top")
    ) {
      continue;
    }
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (name) {
      const obstacleAttributeValue =
        obstacle.getAttribute("data-drag-obstacle");
      if (obstacleAttributeValue) {
        const obstacleNames = obstacleAttributeValue.split(",");
        const found = obstacleNames.some(
          (obstacleName) =>
            obstacleName.trim().toLowerCase() === name.toLowerCase(),
        );
        if (!found) {
          continue;
        }
      }
    }

    // Create obstacle object with bounds
    const obstacleBounds = getElementBounds(obstacle, positionedParent);
    const positionedParentRect = positionedParent.getBoundingClientRect();

    const obstacleObject = {
      type: "obstacle",
      element: obstacle,
      bounds: {
        left: obstacleBounds.left - positionedParentRect.left,
        top: obstacleBounds.top - positionedParentRect.top,
        right: obstacleBounds.right - positionedParentRect.left,
        bottom: obstacleBounds.bottom - positionedParentRect.top,
      },
      viewportBounds: obstacleBounds,
      name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
    };

    matchingObstacles.push(obstacleObject);
  }
  return matchingObstacles;
};

const createStickyFrontierOnAxis = (
  element,
  { name, scrollableParent, primarySide, oppositeSide },
) => {
  const primaryAttrName = `data-drag-sticky-frontier-${primarySide}`;
  const oppositeAttrName = `data-drag-sticky-frontier-${oppositeSide}`;
  const frontiers = element.querySelectorAll(
    `[${primaryAttrName}], [${oppositeAttrName}]`,
  );
  const matchingStickyFrontiers = [];
  for (const frontier of frontiers) {
    if (frontier.closest("[data-drag-ignore]")) {
      continue;
    }
    const hasPrimary = frontier.hasAttribute(primaryAttrName);
    const hasOpposite = frontier.hasAttribute(oppositeAttrName);
    // Check if element has both sides (invalid)
    if (hasPrimary && hasOpposite) {
      const elementSelector = getElementSelector(frontier);
      console.warn(
        `Sticky frontier element (${elementSelector}) has both ${primarySide} and ${oppositeSide} attributes. 
  A sticky frontier should only have one side attribute.`,
      );
      continue;
    }
    const attrName = hasPrimary ? primaryAttrName : oppositeAttrName;
    const attributeValue = frontier.getAttribute(attrName);
    if (attributeValue && name) {
      const frontierNames = attributeValue.split(",");
      const isMatching = frontierNames.some(
        (frontierName) =>
          frontierName.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!isMatching) {
        continue;
      }
    }
    const frontierBounds = getElementBounds(frontier, scrollableParent);
    const stickyFrontierObject = {
      type: "sticky-frontier",
      element: frontier,
      side: hasPrimary ? primarySide : oppositeSide,
      bounds: frontierBounds,
      name: `Sticky Frontier (${getElementSelector(frontier)}) - side: ${hasPrimary ? primarySide : oppositeSide}`,
    };
    matchingStickyFrontiers.push(stickyFrontierObject);
  }
  return matchingStickyFrontiers;
};
const createHorizontalStickyFrontiersFromQuerySelector = (
  element,
  { name, scrollableParent },
) => {
  return createStickyFrontierOnAxis(element, {
    name,
    scrollableParent,
    primarySide: "left",
    oppositeSide: "right",
  });
};
const createVerticalStickyFrontiersFromQuerySelector = (
  element,
  { name, scrollableParent },
) => {
  return createStickyFrontierOnAxis(element, {
    name,
    scrollableParent,
    primarySide: "top",
    oppositeSide: "bottom",
  });
};

const reduceStickyFrontiersToVisibleArea = (
  initialVisibleArea,
  stickyFrontierObjects,
  { direction, dragName },
) => {
  let { left, right, top, bottom } = initialVisibleArea;

  // Process each sticky frontier and reduce visible area accordingly
  for (const stickyFrontierObject of stickyFrontierObjects) {
    const frontierRect = stickyFrontierObject.bounds;
    const frontierSide = stickyFrontierObject.side;

    // Apply constraints based on the specific side this frontier affects
    if (frontierSide === "left") {
      // Frontier acts as a left barrier - constrains from the right edge of the frontier
      if (!direction.x || frontierRect.right <= left) {
        continue;
      }
      const originalRight = right;
      left = frontierRect.right;

      // Debug warning for invalid visible area caused by this specific frontier
      if (import.meta.dev && left > right) {
        console.warn(
          `Sticky frontier created invalid horizontal visible area: left (${left}) > right (${right}). Original: left=${frontierRect.right}, right=${originalRight}`,
          {
            frontierElement: stickyFrontierObject.element,
            frontierBounds: frontierRect,
            dragName,
            frontierSide,
          },
        );
      }
      continue;
    }

    if (frontierSide === "right") {
      // Frontier acts as a right barrier - constrains from the left edge of the frontier
      if (!direction.x || frontierRect.left >= right) {
        continue;
      }
      const originalLeft = left;
      right = frontierRect.left;

      // Debug warning for invalid visible area caused by this specific frontier
      if (import.meta.dev && left > right) {
        console.warn(
          `Sticky frontier created invalid horizontal visible area: left (${left}) > right (${right}). Original: left=${originalLeft}, right=${frontierRect.left}`,
          {
            frontierElement: stickyFrontierObject.element,
            frontierBounds: frontierRect,
            dragName,
            frontierSide,
          },
        );
      }
      continue;
    }

    if (frontierSide === "top") {
      // Frontier acts as a top barrier - constrains from the bottom edge of the frontier
      if (!direction.y || frontierRect.bottom <= top) {
        continue;
      }
      const originalBottom = bottom;
      top = frontierRect.bottom;

      // Debug warning for invalid visible area caused by this specific frontier
      if (import.meta.dev && top > bottom) {
        console.warn(
          `Sticky frontier created invalid vertical visible area: top (${top}) > bottom (${bottom}). Original: top=${frontierRect.bottom}, bottom=${originalBottom}`,
          {
            frontierElement: stickyFrontierObject.element,
            frontierBounds: frontierRect,
            dragName,
            frontierSide,
          },
        );
      }
      continue;
    }

    if (frontierSide === "bottom") {
      // Frontier acts as a bottom barrier - constrains from the top edge of the frontier
      if (!direction.y || frontierRect.top >= bottom) {
        continue;
      }
      const originalTop = top;
      bottom = frontierRect.top;

      // Debug warning for invalid visible area caused by this specific frontier
      if (import.meta.dev && top > bottom) {
        console.warn(
          `Sticky frontier created invalid vertical visible area: top (${top}) > bottom (${bottom}). Original: top=${originalTop}, bottom=${frontierRect.top}`,
          {
            frontierElement: stickyFrontierObject.element,
            frontierBounds: frontierRect,
            dragName,
            frontierSide,
          },
        );
      }
      continue;
    }
  }

  return { left, right, top, bottom };
};

const getElementSelector = (element) => {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.className
    ? `.${element.className.split(" ").join(".")}`
    : "";
  return `${tagName}${id}${className}`;
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
/**
 * Get element bounds, handling both normal positioning and data-sticky-left|top
 * @param {HTMLElement} element - The element to get bounds for
 * @returns {Object} Bounds object with left, top, right, bottom properties
 */
const getElementBounds = (element, positionedParent) => {
  const rect = element.getBoundingClientRect();
  const isHorizontallySticky = element.hasAttribute("data-sticky-left");
  const isVerticallySticky = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = isHorizontallySticky || isVerticallySticky;
  if (!useStickyAttribute) {
    return rect;
  }
  const computedStyle = getComputedStyle(element);
  const hasPositionSticky = computedStyle.position === "sticky";
  if (hasPositionSticky) {
    return {
      sticky: true,
      ...rect,
    };
  }

  // handle virtually sticky obstacles (<col> or <tr>)
  // are not really sticky but should be handled as such
  // For sticky elements, calculate current position based on scroll and sticky behavior
  // The sticky element "sticks" at its CSS left position relative to the scrollable parent
  let left;
  const scrollableRect = positionedParent.getBoundingClientRect();
  const borderSizes = getBorderSizes(positionedParent);
  if (isHorizontallySticky) {
    const stickyLeft = parseFloat(computedStyle.left) || 0;
    const stickyPositionInViewport =
      scrollableRect.left + borderSizes.left + stickyLeft;
    left = stickyPositionInViewport;
  } else {
    left = rect.left;
  }
  let top;
  if (isVerticallySticky) {
    const stickyTop = parseFloat(computedStyle.top) || 0;
    const stickyPositionInViewport =
      scrollableRect.top + borderSizes.top + stickyTop;
    top = stickyPositionInViewport;
  } else {
    top = rect.top;
  }
  return {
    sticky: true,
    left,
    top,
    right: left + rect.width,
    bottom: top + rect.height,
  };
};
const createScrollableAreaConstraint = (
  scrollableParent,
  { customLeftBound, customRightBound, customTopBound, customBottomBound } = {},
) => {
  return ({ elementWidth, elementHeight }) => {
    // Handle floating point precision issues between getBoundingClientRect() and scroll dimensions
    // - elementWidth/elementHeight: floats from getBoundingClientRect() (e.g., 2196.477294921875)
    // - scrollWidth/scrollHeight: integers from browser's internal calculations (e.g., 2196)
    //
    // When element dimensions exceed or equal scroll dimensions due to precision differences,
    // we cap the constraint bounds to prevent negative positioning that would push elements
    // outside their intended scrollable area.

    const scrollWidth = scrollableParent.scrollWidth;
    const scrollHeight = scrollableParent.scrollHeight;

    // Calculate horizontal bounds: element can be positioned from left=0 to right=constraint
    let left = 0;
    let right;
    if (elementWidth >= scrollWidth) {
      // Element fills or exceeds container width - constraint to left edge only
      right = scrollWidth;
    } else {
      // Normal case: element can move within available space
      right = scrollWidth - elementWidth;
    }

    // Calculate vertical bounds: element can be positioned from top=0 to bottom=constraint
    let top = 0;
    let bottom;
    if (elementHeight >= scrollHeight) {
      // Element fills or exceeds container height - constraint to top edge only
      bottom = scrollHeight;
    } else {
      // Normal case: element can move within available space
      bottom = scrollHeight - elementHeight;
    }

    // Override with custom bounds if provided
    if (customLeftBound !== undefined) {
      left = customLeftBound;
    }
    if (customRightBound !== undefined) {
      right = customRightBound;
    }
    if (customTopBound !== undefined) {
      top = customTopBound;
    }
    if (customBottomBound !== undefined) {
      bottom = customBottomBound;
    }

    return {
      type: "bounds",
      left,
      top,
      right,
      bottom,
      element: scrollableParent,
      name:
        customLeftBound !== undefined ||
        customRightBound !== undefined ||
        customTopBound !== undefined ||
        customBottomBound !== undefined
          ? "custom bounds constraint"
          : "scrollable area bounds",
    };
  };
};
// Function to create constraint from obstacle object (no longer needs to recalculate bounds)
const createObstacleConstraintFromObject = (obstacleObject) => {
  return () => {
    return obstacleObject;
  };
};

/**
 * Validates constraints for logical consistency and reports issues during development.
 * Helps catch configuration errors like inappropriate obstacle assignments.
 */
const validateConstraints = (
  constraints,
  { elementWidth, elementHeight, dragName, stickyFrontierObjects },
) => {
  const boundsConstraints = constraints.filter((c) => c.type === "bounds");
  const obstacleConstraints = constraints.filter((c) => c.type === "obstacle");

  // Check for impossible bounds constraints
  boundsConstraints.forEach((bounds) => {
    if (bounds.left >= bounds.right) {
      console.warn(
        `Impossible bounds constraint: left (${bounds.left}) >= right (${bounds.right})`,
        { constraint: bounds, dragName, element: bounds.element },
      );
    }
    if (bounds.top >= bounds.bottom) {
      console.warn(
        `Impossible bounds constraint: top (${bounds.top}) >= bottom (${bounds.bottom})`,
        { constraint: bounds, dragName, element: bounds.element },
      );
    }

    const availableWidth = roundForConstraints(bounds.right - bounds.left);
    const availableHeight = roundForConstraints(bounds.bottom - bounds.top);
    const roundedElementWidth = roundForConstraints(elementWidth);
    const roundedElementHeight = roundForConstraints(elementHeight);

    // Math.round because some values comes from getBoundingClientRect() (floats)
    // and some from scrollWidth/Height (integers) causing precision issues
    if (
      Math.round(availableWidth) < Math.round(roundedElementWidth) &&
      availableWidth >= 0
    ) {
      console.warn(
        `Bounds constraint too narrow: available width (${availableWidth.toFixed(2)}) < element width (${roundedElementWidth.toFixed(2)})`,
        { constraint: bounds, dragName, element: bounds.element },
      );
    }
    if (
      Math.round(availableHeight) < Math.round(roundedElementHeight) &&
      availableHeight >= 0
    ) {
      console.warn(
        `Bounds constraint too short: available height (${availableHeight.toFixed(2)}) < element height (${roundedElementHeight.toFixed(2)})`,
        { constraint: bounds, dragName, element: bounds.element },
      );
    }
  });

  // Check for problematic obstacle overlaps and inappropriate obstacle assignments
  obstacleConstraints.forEach((obstacle, index) => {
    // Check for impossible obstacle geometry
    if (
      obstacle.bounds.left > obstacle.bounds.right ||
      obstacle.bounds.top > obstacle.bounds.bottom
    ) {
      console.warn(
        `Impossible obstacle geometry: left=${obstacle.bounds.left}, right=${obstacle.bounds.right}, top=${obstacle.bounds.top}, bottom=${obstacle.bounds.bottom}`,
        { constraint: obstacle, dragName, element: obstacle.element },
      );
    }

    // Check for obstacles that completely block movement in all directions
    boundsConstraints.forEach((bounds) => {
      const obstacleWidth = obstacle.bounds.right - obstacle.bounds.left;
      const obstacleHeight = obstacle.bounds.bottom - obstacle.bounds.top;
      const boundsWidth = bounds.right - bounds.left;
      const boundsHeight = bounds.bottom - bounds.top;

      if (obstacleWidth >= boundsWidth && obstacleHeight >= boundsHeight) {
        console.warn(
          `Obstacle completely blocks bounds area: obstacle (${obstacleWidth.toFixed(2)}×${obstacleHeight.toFixed(2)}) >= bounds (${boundsWidth.toFixed(2)}×${boundsHeight.toFixed(2)})`,
          {
            obstacle,
            bounds,
            dragName,
            obstacleElement: obstacle.element,
            boundsElement: bounds.element,
          },
        );
      }
    });

    // Check for overlapping obstacles that might create conflicting constraints
    obstacleConstraints.forEach((otherObstacle, otherIndex) => {
      if (index >= otherIndex) return; // Avoid duplicate checks

      const hasOverlap = !(
        obstacle.bounds.right <= otherObstacle.bounds.left ||
        obstacle.bounds.left >= otherObstacle.bounds.right ||
        obstacle.bounds.bottom <= otherObstacle.bounds.top ||
        obstacle.bounds.top >= otherObstacle.bounds.bottom
      );

      if (hasOverlap) {
        console.warn(
          `Overlapping obstacles detected: may create conflicting constraints`,
          {
            obstacle1: obstacle,
            obstacle2: otherObstacle,
            dragName,
            element1: obstacle.element,
            element2: otherObstacle.element,
          },
        );
      }
    });
  });

  // Validate sticky frontiers (development only, no actual constraints to validate but useful for debugging)
  if (dragName && stickyFrontierObjects.length > 0) {
    console.debug(
      `Found ${stickyFrontierObjects.length} sticky frontier(s) for drag operation "${dragName}"`,
      {
        dragName,
        frontiers: stickyFrontierObjects.map((f, i) => ({
          index: i,
          element: f.element,
          bounds: f.bounds,
          side: f.side,
        })),
      },
    );
  }
};

/**
 * Rounds coordinates to prevent floating point precision issues in constraint calculations.
 *
 * This is critical for obstacle detection because:
 * 1. Boundary detection relies on precise comparisons (e.g., elementRight <= obstacleLeft)
 * 2. Floating point arithmetic can produce values like 149.99999999 instead of 150
 * 3. This causes incorrect boundary classifications (element appears "on left" when it should be "overlapping")
 *
 * Scroll events are more susceptible to this issue because:
 * - Mouse events use integer pixel coordinates from the DOM (e.g., clientX: 150)
 * - Scroll events use element.scrollLeft which can have sub-pixel values from CSS transforms, zoom, etc.
 * - Scroll compensation calculations (scrollDelta * ratios) amplify floating point errors
 * - Multiple scroll events accumulate these errors over time
 *
 * Using 2-decimal precision maintains smooth sub-pixel positioning while ensuring
 * reliable boundary detection for constraint systems.
 */
const roundForConstraints = (value) => {
  return Math.round(value * 100) / 100;
};

// Helper function for debug logging constraint enforcement
const logConstraintEnforcement = (
  axis,
  originalValue,
  constrainedValue,
  constraint,
  interactionType = "unknown",
) => {
  if (!DRAG_DEBUG_VISUAL_MARKERS || originalValue === constrainedValue) {
    return; // No constraint applied or debug disabled
  }

  const direction = constrainedValue > originalValue ? "increased" : "capped";
  console.debug(
    `Drag by ${interactionType}: ${axis} movement ${direction} from ${originalValue.toFixed(2)} to ${constrainedValue.toFixed(2)} by ${constraint.name}`,
    constraint.element,
  );
};

// Apply constraints on both X and Y axes
const applyConstraints = (
  gestureInfo,
  { xMove, yMove, elementWidth, elementHeight, constraints, interactionType },
) => {
  const { initialLeft, initialTop } = gestureInfo;

  // Capture original movement values for debug logging
  const originalXMove = xMove;
  const originalYMove = yMove;

  for (const constraint of constraints) {
    if (constraint.type === "bounds") {
      // Apply bounds constraints directly using visual coordinates
      // initialLeft/initialTop now represent elementVisuallyImpacted position
      const minAllowedXMove = constraint.left - initialLeft;
      const maxAllowedXMove = constraint.right - initialLeft;
      const minAllowedYMove = constraint.top - initialTop;
      const maxAllowedYMove = constraint.bottom - initialTop;
      if (xMove < minAllowedXMove) {
        logConstraintEnforcement(
          "x",
          xMove,
          minAllowedXMove,
          constraint,
          interactionType,
        );
        xMove = minAllowedXMove;
      }
      if (xMove > maxAllowedXMove) {
        logConstraintEnforcement(
          "x",
          xMove,
          maxAllowedXMove,
          constraint,
          interactionType,
        );
        xMove = maxAllowedXMove;
      }
      if (yMove < minAllowedYMove) {
        logConstraintEnforcement(
          "y",
          yMove,
          minAllowedYMove,
          constraint,
          interactionType,
        );
        yMove = minAllowedYMove;
      }
      if (yMove > maxAllowedYMove) {
        logConstraintEnforcement(
          "y",
          yMove,
          maxAllowedYMove,
          constraint,
          interactionType,
        );
        yMove = maxAllowedYMove;
      }
    } else if (constraint.type === "obstacle") {
      // Current element position using the passed current movement values
      // This ensures we use the actual current position, not potentially stale gestureInfo values
      const actualCurrentXMove = gestureInfo.xMove || 0;
      const actualCurrentYMove = gestureInfo.yMove || 0;

      // Calculate current visual position (initialLeft/initialTop are now visual coordinates)
      const currentVisualLeft = initialLeft + actualCurrentXMove;
      const currentVisualTop = initialTop + actualCurrentYMove;

      // Round coordinates to prevent floating point precision issues in boundary detection
      const currentActualLeft = roundForConstraints(currentVisualLeft);
      const currentActualRight = roundForConstraints(
        currentActualLeft + elementWidth,
      );
      const currentActualTop = roundForConstraints(currentVisualTop);
      const currentActualBottom = roundForConstraints(
        currentActualTop + elementHeight,
      );

      // Round constraint boundaries as well for consistent comparison
      const leftBound = roundForConstraints(constraint.bounds.left);
      const rightBound = roundForConstraints(constraint.bounds.right);
      const topBound = roundForConstraints(constraint.bounds.top);
      const bottomBound = roundForConstraints(constraint.bounds.bottom);

      // Determine current position relative to obstacle
      const isOnTheLeft = currentActualRight <= leftBound;
      const isOnTheRight = currentActualLeft >= rightBound;
      const isAbove = currentActualBottom <= topBound;
      const isBelow = currentActualTop >= bottomBound;

      // Apply constraints based on element position - handle all cases including diagonal

      // Always check Y constraints if element is above or below
      if (isAbove || isBelow) {
        const proposedLeft = initialLeft + xMove;
        const proposedRight = proposedLeft + elementWidth;
        const wouldHaveXOverlap =
          proposedLeft < rightBound && proposedRight > leftBound;

        if (wouldHaveXOverlap) {
          if (isAbove) {
            // Element above - prevent it from going down into obstacle
            const maxAllowedYMove = topBound - elementHeight - initialTop;
            if (yMove > maxAllowedYMove) {
              logConstraintEnforcement(
                "y",
                yMove,
                maxAllowedYMove,
                constraint,
                interactionType,
              );
              yMove = maxAllowedYMove;
            }
          } else if (isBelow) {
            // Element below - prevent it from going up into obstacle
            const minAllowedYMove = bottomBound - initialTop;
            if (yMove < minAllowedYMove) {
              logConstraintEnforcement(
                "y",
                yMove,
                minAllowedYMove,
                constraint,
                interactionType,
              );
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
          proposedTop < bottomBound && proposedBottom > topBound;

        if (wouldHaveYOverlap) {
          if (isOnTheLeft) {
            // Element on left - prevent it from going right into obstacle
            const maxAllowedXMove = leftBound - elementWidth - initialLeft;
            if (xMove > maxAllowedXMove) {
              logConstraintEnforcement(
                "x",
                xMove,
                maxAllowedXMove,
                constraint,
                interactionType,
              );
              xMove = maxAllowedXMove;
            }
          } else if (isOnTheRight) {
            // Element on right - prevent it from going left into obstacle
            const minAllowedXMove = rightBound - initialLeft;
            if (xMove < minAllowedXMove) {
              logConstraintEnforcement(
                "x",
                xMove,
                minAllowedXMove,
                constraint,
                interactionType,
              );
              xMove = minAllowedXMove;
            }
          }
        }
      }

      // Handle overlap case - when element is already overlapping with obstacle
      // This should not normally happen due to floating point rounding fixes above,
      // but may occur if:
      // - Element starts in overlapped state during initialization
      // - Programmatic positioning places element over obstacle
      // - Other interactions (resize, external transforms) create overlap
      if (!isOnTheLeft && !isOnTheRight && !isAbove && !isBelow) {
        // Element is overlapping with obstacle - push it out in the direction of least resistance

        // Calculate distances to push element out in each direction
        const distanceToLeft = currentActualRight - leftBound; // Distance to push left
        const distanceToRight = rightBound - currentActualLeft; // Distance to push right
        const distanceToTop = currentActualBottom - topBound; // Distance to push up
        const distanceToBottom = bottomBound - currentActualTop; // Distance to push down

        // Find the minimum distance (direction of least resistance)
        const minDistance = Math.min(
          distanceToLeft,
          distanceToRight,
          distanceToTop,
          distanceToBottom,
        );

        if (minDistance === distanceToLeft) {
          // Push left: element should not go past leftBound - elementWidth
          const maxAllowedXMove = leftBound - elementWidth - initialLeft;
          if (xMove > maxAllowedXMove) {
            xMove = maxAllowedXMove;
          }
        } else if (minDistance === distanceToRight) {
          // Push right: element should not go before rightBound
          const minAllowedXMove = rightBound - initialLeft;
          if (xMove < minAllowedXMove) {
            xMove = minAllowedXMove;
          }
        } else if (minDistance === distanceToTop) {
          // Push up: element should not go past topBound - elementHeight
          const maxAllowedYMove = topBound - elementHeight - initialTop;
          if (yMove > maxAllowedYMove) {
            yMove = maxAllowedYMove;
          }
        } else if (minDistance === distanceToBottom) {
          // Push down: element should not go before bottomBound
          const minAllowedYMove = bottomBound - initialTop;
          if (yMove < minAllowedYMove) {
            yMove = minAllowedYMove;
          }
        }
      }
    }
  }

  // Log when no constraints were applied (movement unchanged)
  if (
    DRAG_DEBUG_VISUAL_MARKERS &&
    originalXMove === xMove &&
    originalYMove === yMove &&
    (originalXMove !== 0 || originalYMove !== 0)
  ) {
    console.debug(
      `Drag by ${interactionType}: no constraint enforcement needed (xMove=${xMove.toFixed(2)}, yMove=${yMove.toFixed(2)})`,
    );
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

const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title =
    "Constraint feedback - shows distance between mouse and moving grab point";
  document.body.appendChild(line);
  return line;
};
const createDebugMarker = ({
  name,
  x,
  y,
  color = "red",
  orientation = "vertical",
}) => {
  if (!DRAG_DEBUG_VISUAL_MARKERS) {
    return null;
  }

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
const createObstacleMarker = (obstacleObj) => {
  if (!DRAG_DEBUG_VISUAL_MARKERS) return null;

  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${obstacleObj.viewportBounds.left}px`;
  marker.style.top = `${obstacleObj.viewportBounds.top}px`;
  marker.style.width = `${obstacleObj.viewportBounds.right - obstacleObj.viewportBounds.left}px`;
  marker.style.height = `${obstacleObj.viewportBounds.bottom - obstacleObj.viewportBounds.top}px`;
  marker.title = obstacleObj.name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = obstacleObj.name;
  marker.appendChild(label);

  document.body.appendChild(marker);
  return marker;
};
