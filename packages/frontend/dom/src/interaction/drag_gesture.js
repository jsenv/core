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

import { getPositionedParent } from "../offset_parent.js";
import { getScrollableParent } from "../scroll.js";
import { getBorderSizes } from "../size/get_border_sizes.js";
import { setStyles } from "../style_and_attributes.js";
import { validateConstraints } from "./constraint_validation.js";
import "./drag_gesture_css.js";
import { createObstacleConstraintsFromQuerySelector } from "./drag_obstacles.js";
import { applyStickyFrontiersToVisibleArea } from "./sticky_frontiers.js";

export let DRAG_DEBUG_VISUAL_MARKERS = true;
export const enableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = true;
};
export const disableDebugMarkers = () => {
  DRAG_DEBUG_VISUAL_MARKERS = false;
};

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
  stickyFrontiers = true,
  keepInScrollableArea = true,
  obstacleQuerySelector = "[data-drag-obstacle]",
  lifecycle,
}) => {
  const teardownCallbackSet = new Set();
  const addTeardown = (callback) => {
    teardownCallbackSet.add(callback);
  };

  const grab = (
    element,
    {
      xAtStart = 0,
      yAtStart = 0,
      elementToImpact = element,
      elementVisuallyImpacted = elementToImpact,
      direction = defaultDirection,
      cursor = "grabbing",
      interactionType,
    } = {},
  ) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const scrollableParent = getScrollableParent(element);
    const positionedParent = getPositionedParent(element);

    const scrollableRect = scrollableParent.getBoundingClientRect();
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const elementToImpactRect = elementToImpact.getBoundingClientRect();
    const elementVisuallyImpactedRect =
      elementVisuallyImpacted.getBoundingClientRect();
    const parentRect = positionedParentRect;

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
        const leftRelative = elementRect.left - scrollableRect.left;
        const topRelative = elementRect.top - scrollableRect.top;
        restoreStyles();
        setStyles(element, {
          left: `${leftRelative}px`,
          top: `${topRelative}px`,
        });
      });
    }

    const leftAtStart = elementVisuallyImpactedRect.left - parentRect.left;
    const topAtStart = elementVisuallyImpactedRect.top - parentRect.top;
    const scrollLeftAtStart = scrollableParent.scrollLeft;
    const scrollTopAtStart = scrollableParent.scrollTop;

    // Calculate offset to translate visual movement to elementToImpact movement
    // This offset is applied only when setting elementToImpact position (xMoveToApply, yMoveToApply)
    // All constraint calculations use visual coordinates (xMove, yMove)
    const visualOffsetX =
      elementVisuallyImpactedRect.left - elementToImpactRect.left;
    const visualOffsetY =
      elementVisuallyImpactedRect.top - elementToImpactRect.top;

    const gestureInfo = {
      element,
      elementToImpact,
      elementVisuallyImpacted,

      xAtStart,
      yAtStart,
      leftAtStart,
      topAtStart,
      scrollLeftAtStart,
      scrollTopAtStart,
      visualOffsetX,
      visualOffsetY,

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

      interactionType,
    };
    definePropertyAsReadOnly(gestureInfo, "xAtStart");
    definePropertyAsReadOnly(gestureInfo, "yAtStart");
    definePropertyAsReadOnly(gestureInfo, "leftAtStart");
    definePropertyAsReadOnly(gestureInfo, "topAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollLeftAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollTopAtStart");
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
    if (keepInScrollableArea) {
      const boundsConstraint = createScrollableAreaConstraint(
        scrollableParent,
        {
          customLeftBound,
          customRightBound,
          customTopBound,
          customBottomBound,
        },
      );
      constraintFunctions.push(boundsConstraint);
    }
    if (obstacleQuerySelector) {
      const obstacleConstraints = createObstacleConstraintsFromQuerySelector(
        scrollableParent,
        {
          name,
          positionedParent,
          obstacleQuerySelector,
        },
      );
      constraintFunctions.push(...obstacleConstraints);
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
      obstacles.forEach((obstacleObj) => {
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
          ? currentScrollLeft - scrollLeftAtStart
          : 0;
        const scrollDeltaY = direction.y
          ? currentScrollTop - scrollTopAtStart
          : 0;

        xMove = xMouseMove + scrollDeltaX;
        yMove = yMouseMove + scrollDeltaY;
      } else {
        // For mouse movement and programmatic calls, calculate scroll offset first
        const currentScrollLeft = scrollableParent.scrollLeft;
        const currentScrollTop = scrollableParent.scrollTop;
        const scrollDeltaX = direction.x
          ? currentScrollLeft - scrollLeftAtStart
          : 0;
        const scrollDeltaY = direction.y
          ? currentScrollTop - scrollTopAtStart
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

      // Development safeguards: detect impossible/illogical constraints
      if (import.meta.dev) {
        validateConstraints(constraints, {
          elementWidth: currentElementWidth,
          elementHeight: currentElementHeight,
          dragName: name,
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
      let visibleArea;
      if (stickyFrontiers) {
        visibleArea = applyStickyFrontiersToVisibleArea(visibleAreaBase, {
          scrollableParent,
          direction,
          dragName: name,
        });
      } else {
        visibleArea = visibleAreaBase;
      }

      if (DRAG_DEBUG_VISUAL_MARKERS) {
        drawVisualMarkers({
          constraints,
          visibleArea,
          elementWidth: currentElementWidth,
          elementHeight: currentElementHeight,
        });
      }

      const [finalXMove, finalYMove] = applyConstraints(constraints, {
        gestureInfo,
        xMove,
        yMove,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
        interactionType,
      });

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

    const release = ({
      xAtRelease = gestureInfo.x,
      yAtRelease = gestureInfo.y,
      interactionType = "programmatic",
    } = {}) => {
      drag(xAtRelease, yAtRelease, {
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

  const grabViaMousedown = (mousedownEvent, { element, ...options } = {}) => {
    if (mousedownEvent.button !== 0) {
      return null;
    }
    const target = mousedownEvent.target;
    if (!target.closest) {
      return null;
    }

    const positionedParent = getPositionedParent(element);
    const parentRect = positionedParent.getBoundingClientRect();
    const mouseEventRelativeCoords = (mouseEvent) => {
      const xViewport = mouseEvent.clientX;
      const yViewport = mouseEvent.clientY;
      const xRelative = xViewport - parentRect.left;
      const yRelative = yViewport - parentRect.top;
      return [xRelative, yRelative];
    };

    const [xAtStart, yAtStart] = mouseEventRelativeCoords(mousedownEvent);
    const dragGesture = grab(element, {
      xAtStart,
      yAtStart,
      interactionType: "mousedown",
      ...options,
    });

    const handleMouseMove = (mousemoveEvent) => {
      const [x, y] = mouseEventRelativeCoords(mousemoveEvent);
      dragGesture.drag(x, y, {
        mouseX: mousemoveEvent.clientX,
        mouseY: mousemoveEvent.clientY,
        interactionType: "mousemove",
      });
    };

    const handleMouseUp = (mouseupEvent) => {
      const [x, y] = mouseEventRelativeCoords(mouseupEvent);
      dragGesture.release({
        x,
        y,
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

export const createDragToMoveGesture = (options) => {
  const dragToMoveGesture = createDragGesture({
    ...options,
    lifecycle: {
      drag: (
        gestureInfo,
        { direction, positionedParent, scrollableParent },
      ) => {
        const {
          leftAtStart,
          topAtStart,
          visualOffsetX,
          visualOffsetY,
          isGoingDown,
          isGoingUp,
          isGoingLeft,
          isGoingRight,
          elementToImpact,
          elementVisuallyImpacted,
          visibleArea,
        } = gestureInfo;

        // Calculate initial position for elementToImpact (initialLeft/initialTop are now visual coordinates)
        const initialLeftToImpact = leftAtStart - visualOffsetX;
        const initialTopToImpact = topAtStart - visualOffsetY;
        const elementVisuallyImpactedRect =
          elementVisuallyImpacted.getBoundingClientRect();
        const elementWidth = elementVisuallyImpactedRect.width;
        const elementHeight = elementVisuallyImpactedRect.height;

        // Calculate where element bounds would be in viewport coordinates
        const currentPositionedParentRect =
          positionedParent.getBoundingClientRect();

        // Helper function to handle auto-scroll and element positioning for an axis
        const moveAndKeepIntoView = ({
          // axis,
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
        }) => {
          keep_into_view: {
            if (isGoingPositive) {
              if (desiredElementEnd > visibleAreaEnd) {
                const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
                const scroll = currentScroll + scrollAmountNeeded;
                scrollableParent[scrollProperty] = scroll;
              }
            } else if (isGoingNegative) {
              if (desiredElementStart < visibleAreaStart) {
                const scrollAmountNeeded =
                  visibleAreaStart - desiredElementStart;
                const scroll = Math.max(0, currentScroll - scrollAmountNeeded);
                scrollableParent[scrollProperty] = scroll;
              }
            }
          }
          move: {
            const elementPosition = initialPosition + moveAmount;
            if (elementToImpact) {
              elementToImpact.style[styleProperty] = `${elementPosition}px`;
            }
          }
        };

        // Horizontal auto-scroll
        if (direction.x) {
          const desiredElementLeftRelative = leftAtStart + gestureInfo.xMove;
          const desiredElementLeft =
            desiredElementLeftRelative + currentPositionedParentRect.left;
          const desiredElementRight = desiredElementLeft + elementWidth;
          moveAndKeepIntoView({
            // axis: "x",
            isGoingPositive: isGoingRight,
            isGoingNegative: isGoingLeft,
            desiredElementStart: desiredElementLeft,
            desiredElementEnd: desiredElementRight,
            visibleAreaStart: visibleArea.left,
            visibleAreaEnd: visibleArea.right,
            currentScroll: scrollableParent.scrollLeft,
            initialPosition: initialLeftToImpact,
            moveAmount: gestureInfo.xMove,
            scrollProperty: "scrollLeft",
            styleProperty: "left",
          });
        }

        // Vertical auto-scroll
        if (direction.y) {
          const desiredElementTopRelative = topAtStart + gestureInfo.yMove;
          const desiredElementTop =
            desiredElementTopRelative + currentPositionedParentRect.top;
          const desiredElementBottom = desiredElementTop + elementHeight;
          moveAndKeepIntoView({
            // axis: "y",
            isGoingPositive: isGoingDown,
            isGoingNegative: isGoingUp,
            desiredElementStart: desiredElementTop,
            desiredElementEnd: desiredElementBottom,
            visibleAreaStart: visibleArea.top,
            visibleAreaEnd: visibleArea.bottom,
            currentScroll: scrollableParent.scrollTop,
            initialPosition: initialTopToImpact,
            moveAmount: gestureInfo.yMove,
            scrollProperty: "scrollTop",
            styleProperty: "top",
          });
        }
      },
    },
  });
  return dragToMoveGesture;
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
    let left;
    if (customLeftBound === undefined) {
      left = 0;
    } else {
      left = customLeftBound;
    }
    let right;
    if (customRightBound === undefined) {
      if (elementWidth >= scrollWidth) {
        // Element fills or exceeds container width - constraint to left edge only
        right = scrollWidth;
      } else {
        // Normal case: element can move within available space
        right = scrollWidth - elementWidth;
      }
    } else {
      right = customRightBound;
    }

    // Calculate vertical bounds: element can be positioned from top=0 to bottom=constraint
    let top;
    if (customTopBound === undefined) {
      top = 0;
    } else {
      top = customTopBound;
    }
    let bottom;
    if (customBottomBound === undefined) {
      if (elementHeight >= scrollHeight) {
        // Element fills or exceeds container height - constraint to top edge only
        bottom = scrollHeight;
      } else {
        // Normal case: element can move within available space
        bottom = scrollHeight - elementHeight;
      }
    } else {
      bottom = customBottomBound;
    }

    const constraint = {
      type: "bounds",
      left,
      top,
      right,
      bottom,
      element: scrollableParent,
      name: "scrollable area bounds",
      apply: (xMove, yMove, { gestureInfo }) => {
        const { leftAtStart, topAtStart } = gestureInfo;

        // Apply bounds constraints directly using visual coordinates
        // initialLeft/initialTop now represent elementVisuallyImpacted position
        const minAllowedXMove = left - leftAtStart;
        const maxAllowedXMove = right - leftAtStart;
        const minAllowedYMove = top - topAtStart;
        const maxAllowedYMove = bottom - topAtStart;
        const constraints = [];
        if (xMove < minAllowedXMove) {
          constraints.push({ x: minAllowedXMove });
        } else if (xMove > maxAllowedXMove) {
          constraints.push({ x: maxAllowedXMove });
        }
        if (yMove < minAllowedYMove) {
          constraints.push({ y: minAllowedYMove });
        } else if (yMove > maxAllowedYMove) {
          constraints.push({ y: maxAllowedYMove });
        }
        return constraints;
      },
    };
    return constraint;
  };
};

// Apply constraints on both X and Y axes
const applyConstraints = (
  constraints,
  { gestureInfo, xMove, yMove, elementWidth, elementHeight, interactionType },
) => {
  // Capture original movement values for debug logging
  const xMoveNoConstraint = xMove;
  const yMoveNoConstraint = yMove;

  for (const constraint of constraints) {
    const enforcements = constraint.apply(xMove, yMove, {
      gestureInfo,
      elementWidth,
      elementHeight,
      interactionType,
    });
    if (!enforcements || enforcements.length === 0) {
      continue;
    }
    for (const enforcement of enforcements) {
      if (enforcement.x !== undefined) {
        logConstraintEnforcement(
          "x",
          xMove,
          enforcement.x,
          constraint,
          interactionType,
        );
        xMove = enforcement.x;
        continue;
      }
      if (enforcement.y !== undefined) {
        logConstraintEnforcement(
          "y",
          xMove,
          enforcement.y,
          constraint,
          interactionType,
        );
        yMove = enforcement.y;
        continue;
      }
    }
  }
  // Log when no constraints were applied (movement unchanged)
  if (
    DRAG_DEBUG_VISUAL_MARKERS &&
    xMoveNoConstraint === xMove &&
    yMoveNoConstraint === yMove
  ) {
    console.debug(
      `Drag by ${interactionType}: no constraint enforcement needed (xMove=${xMove.toFixed(2)}, yMove=${yMove.toFixed(2)})`,
    );
  }

  return [xMove, yMove];
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
