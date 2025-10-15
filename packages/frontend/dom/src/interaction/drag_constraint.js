import {
  addScrollToRect,
  getScrollContainerVisibleArea,
  getScrollRelativeRect,
} from "../position/dom_coords.js";
import { setupConstraintFeedbackLine } from "./constraint_feedback_line.js";
import { setupDragDebugMarkers } from "./drag_debug_markers.js";
import { getElementSelector } from "./element_log.js";

const CONSOLE_DEBUG_BOUNDS = true;
const CONSOLE_DEBUG_OBSTACLES = false;

export const initDragConstraints = (
  dragGesture,
  {
    areaConstraintElement,
    areaConstraint,
    customAreaConstraint,
    obstaclesContainer,
    obstacleAttributeName,
    showConstraintFeedbackLine,
    showDebugMarkers,
  },
) => {
  const dragGestureName = dragGesture.gestureInfo.name;
  const direction = dragGesture.gestureInfo.direction;

  const constraintFunctions = [];
  const addConstraint = (constraint) => {
    constraintFunctions.push(constraint);
  };

  if (showConstraintFeedbackLine) {
    const constraintFeedbackLine = setupConstraintFeedbackLine(dragGesture);
    dragGesture.addDragCallback((gestureInfo) => {
      constraintFeedbackLine.onDrag(gestureInfo);
    });
    dragGesture.addReleaseCallback(() => {
      constraintFeedbackLine.onRelease();
    });
  }
  let dragDebugMarkers;
  if (showDebugMarkers) {
    dragDebugMarkers = setupDragDebugMarkers(dragGesture);
    dragGesture.addReleaseCallback(() => {
      dragDebugMarkers.onRelease();
    });
  }

  area: {
    if (areaConstraint === "scroll") {
      const scrollWidthAtStart = areaConstraintElement.scrollWidth;
      const scrollHeightAtStart = areaConstraintElement.scrollHeight;
      let left = 0;
      let top = 0;
      const scrollAreaConstraintFunction = () => {
        const right = left + scrollWidthAtStart;
        const bottom = top + scrollHeightAtStart;
        return createBoundConstraint(
          { left, top, right, bottom },
          {
            element: areaConstraintElement,
            name: "scroll_area",
          },
        );
      };
      addConstraint(scrollAreaConstraintFunction);
      break area;
    }
    if (areaConstraint === "visible") {
      const visibleAreaConstraintFunction = () => {
        const bounds = getScrollContainerVisibleArea(areaConstraintElement);
        return createBoundConstraint(bounds, {
          element: areaConstraintElement,
          name: "visible_area",
        });
      };
      addConstraint(visibleAreaConstraintFunction);
      break area;
    }
  }
  custom_area: {
    if (customAreaConstraint) {
      const customAreaConstraintFunction = () => {
        return createBoundConstraint(customAreaConstraint, {
          element: undefined,
          name: "custom_area",
        });
      };
      addConstraint(customAreaConstraintFunction);
    }
  }
  obstacles: {
    if (!obstacleAttributeName || !obstaclesContainer) {
      break obstacles;
    }
    const obstacleConstraintFunctions =
      createObstacleConstraintsFromQuerySelector(obstaclesContainer, {
        obstacleAttributeName,
        gestureInfo: dragGesture.gestureInfo,
        isDraggedElementSticky: false,
        // isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
      });
    for (const obstacleConstraintFunction of obstacleConstraintFunctions) {
      addConstraint(obstacleConstraintFunction);
    }
  }

  const applyConstraints = (
    moveXRequested,
    moveYRequested,
    { elementWidth, elementHeight, moveConverter, visibleArea, dragEvent },
  ) => {
    if (constraintFunctions.length === 0) {
      return [moveXRequested, moveYRequested];
    }

    const constraintInitParams = {
      dragGestureName,
      visibleArea,
    };
    const constraints = constraintFunctions.map((fn) =>
      fn(constraintInitParams),
    );
    // Development safeguards: detect impossible/illogical constraints
    if (import.meta.dev) {
      validateConstraints(constraints, constraintInitParams);
    }
    if (dragDebugMarkers) {
      dragDebugMarkers.onConstraints(constraints, {
        elementWidth,
        elementHeight,
        visibleArea,
      });
    }

    let moveXConstrained = moveXRequested;
    let moveYConstrained = moveYRequested;
    const logConstraintEnforcement = (axis, constraint) => {
      if (!CONSOLE_DEBUG_BOUNDS && constraint.type === "bounds") {
        return;
      }
      if (!CONSOLE_DEBUG_OBSTACLES && constraint.type === "obstacle") {
        return;
      }
      const moveRequested = axis === "x" ? moveXRequested : moveYRequested;
      const moveConstrained =
        axis === "x" ? moveXConstrained : moveYConstrained;
      const action = moveConstrained > moveRequested ? "increased" : "capped";
      console.debug(
        `Drag by ${dragEvent.type}: ${axis} ${action} from ${moveRequested.toFixed(2)} to ${moveConstrained.toFixed(2)} by ${constraint.type}:${constraint.name}`,
        constraint.element,
      );
    };

    const elementLeftRequested = moveConverter.toElementLeft(moveXRequested);
    const elementTopRequested = moveConverter.toElementTop(moveYRequested);
    let elementLeftToTry = elementLeftRequested;
    let elementTopToTry = elementTopRequested;
    for (const constraint of constraints) {
      const result = constraint.apply({
        left: elementLeftToTry,
        top: elementTopToTry,
        right: elementLeftToTry + elementWidth,
        bottom: elementTopToTry + elementHeight,
        width: elementWidth,
        height: elementHeight,
        visibleArea,
        currentLeft: moveConverter.toElementLeft(dragGesture.gestureInfo.moveX),
        currentTop: moveConverter.toElementTop(dragGesture.gestureInfo.moveY),
      });
      if (!result) {
        continue;
      }
      const [elementLeftConstrained, elementTopConstrained] = result;
      if (direction.x && elementLeftConstrained !== elementLeftToTry) {
        moveXConstrained = moveConverter.fromElementLeft(
          elementLeftConstrained,
        );
        logConstraintEnforcement("x", constraint);
        elementLeftToTry = elementLeftConstrained;
      }
      if (direction.y && elementTopConstrained !== elementTopToTry) {
        moveYConstrained = moveConverter.fromElementTop(elementTopConstrained);
        logConstraintEnforcement("y", constraint);
        elementTopToTry = elementTopConstrained;
      }
    }
    // Log when no constraints were applied (movement unchanged)
    if (
      (CONSOLE_DEBUG_BOUNDS || CONSOLE_DEBUG_OBSTACLES) &&
      moveXRequested === moveXConstrained &&
      moveYRequested === moveYConstrained
    ) {
      console.debug(
        `Drag by ${dragEvent.type}: no constraint enforcement needed (moveX=${moveXRequested.toFixed(2)}, moveY=${moveYRequested.toFixed(2)})`,
      );
    }
    return [moveXConstrained, moveYConstrained];
  };

  return { applyConstraints };
};

const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { obstacleAttributeName, gestureInfo, isDraggedElementSticky = false },
) => {
  const dragGestureName = gestureInfo.name;
  const obstacles = scrollableElement.querySelectorAll(
    `[${obstacleAttributeName}]`,
  );
  const obstacleConstraintFunctions = [];
  for (const obstacle of obstacles) {
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (dragGestureName) {
      const obstacleAttributeValue = obstacle.getAttribute(
        obstacleAttributeName,
      );
      if (obstacleAttributeValue) {
        const obstacleNames = obstacleAttributeValue.split(",");
        const found = obstacleNames.some(
          (obstacleName) =>
            obstacleName.trim().toLowerCase() === dragGestureName.toLowerCase(),
        );
        if (!found) {
          continue;
        }
      }
    }

    obstacleConstraintFunctions.push(() => {
      // Only apply the "before crossing visible area" logic when dragging sticky elements
      // Non-sticky elements should be able to cross sticky obstacles while stuck regardless of visible area crossing
      const useOriginalPositionEvenIfSticky = isDraggedElementSticky
        ? !gestureInfo.hasCrossedVisibleAreaLeftOnce &&
          !gestureInfo.hasCrossedVisibleAreaTopOnce
        : true;

      const obstacleScrollRelativeRect = getScrollRelativeRect(
        obstacle,
        scrollableElement,
        {
          useOriginalPositionEvenIfSticky,
        },
      );
      let obstacleBounds;
      if (
        useOriginalPositionEvenIfSticky &&
        obstacleScrollRelativeRect.isSticky
      ) {
        obstacleBounds = obstacleScrollRelativeRect;
      } else {
        obstacleBounds = addScrollToRect(obstacleScrollRelativeRect);
      }

      // obstacleBounds are already in scrollable-relative coordinates, no conversion needed
      const obstacleObject = createObstacleContraint(obstacleBounds, {
        name: `${obstacleBounds.isSticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
        element: obstacle,
      });
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};

const createBoundConstraint = (bounds, { name, element } = {}) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;

  const apply = ({ left, top, right, bottom, width, height }) => {
    let leftConstrained = left;
    let topConstrained = top;
    // Left boundary: element's left edge should not go before leftBound
    if (leftBound !== undefined && left < leftBound) {
      leftConstrained = leftBound;
    }
    // Right boundary: element's right edge should not go past rightBound
    if (rightBound !== undefined && right > rightBound) {
      leftConstrained = rightBound - width;
    }
    // Top boundary: element's top edge should not go before topBound
    if (topBound !== undefined && top < topBound) {
      topConstrained = topBound;
    }
    // Bottom boundary: element's bottom edge should not go past bottomBound
    if (bottomBound !== undefined && bottom > bottomBound) {
      topConstrained = bottomBound - height;
    }
    if (CONSOLE_DEBUG_BOUNDS) {
      console.log(
        `${name || "bound"} constraint result: left=${left} -> ${leftConstrained}, top=${top} -> ${topConstrained}`,
      );
    }
    return [leftConstrained, topConstrained];
  };

  return {
    type: "bounds",
    name,
    apply,
    element,
    bounds,
  };
};
const createObstacleContraint = (bounds, { element, name }) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;
  const leftBoundRounded = roundForConstraints(leftBound);
  const rightBoundRounded = roundForConstraints(rightBound);
  const topBoundRounded = roundForConstraints(topBound);
  const bottomBoundRounded = roundForConstraints(bottomBound);

  const apply = ({
    left,
    top,
    right,
    bottom,
    width,
    height,
    currentLeft,
    currentTop,
  }) => {
    // Simple collision detection: check where element is and prevent movement into obstacle
    {
      // Determine current position relative to obstacle
      const currentLeftRounded = roundForConstraints(currentLeft);
      const currentRightRounded = roundForConstraints(currentLeft + width);
      const currentTopRounded = roundForConstraints(currentTop);
      const currentBottomRounded = roundForConstraints(currentTop + height);
      const isOnTheLeft = currentRightRounded <= leftBoundRounded;
      const isOnTheRight = currentLeftRounded >= rightBoundRounded;
      const isAbove = currentBottomRounded <= topBoundRounded;
      const isBelow = currentTopRounded >= bottomBoundRounded;
      // Debug logging to understand element position
      if (CONSOLE_DEBUG_OBSTACLES) {
        const position = isOnTheLeft
          ? "left"
          : isOnTheRight
            ? "right"
            : isAbove
              ? "above"
              : isBelow
                ? "below"
                : "overlapping";
        console.log(`Element position relative to obstacle: ${position}`);
        console.log(
          `Element current position: left=${currentLeftRounded}, right=${currentRightRounded}, top=${currentTopRounded}, bottom=${currentBottomRounded}`,
        );
        console.log(
          `Obstacle position: leftBound=${leftBound}, rightBound=${rightBound}, topBound=${topBound}, bottomBound=${bottomBound}`,
        );
      }

      // If element is on the left, apply X constraint to prevent moving right into obstacle
      if (isOnTheLeft) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const maxLeft = leftBound - width;
          if (left > maxLeft) {
            return [maxLeft, top];
          }
        }
      }
      // If element is on the right, apply X constraint to prevent moving left into obstacle
      else if (isOnTheRight) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const minLeft = rightBound;
          if (left < minLeft) {
            return [minLeft, top];
          }
        }
      }
      // If element is above, apply Y constraint to prevent moving down into obstacle
      else if (isAbove) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const maxTop = topBound - height;
          if (top > maxTop) {
            return [left, maxTop];
          }
        }
      }
      // If element is below, apply Y constraint to prevent moving up into obstacle
      else if (isBelow) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const minTop = bottomBound;
          if (top < minTop) {
            return [left, minTop];
          }
        }
      }
    }

    // Element is overlapping with obstacle - push it out in the direction of least resistance
    // Calculate distances to push element out in each direction
    const distanceToLeft = right - leftBound; // Distance to push left
    const distanceToRight = rightBound - left; // Distance to push right
    const distanceToTop = bottom - topBound; // Distance to push up
    const distanceToBottom = bottomBound - top; // Distance to push down
    // Find the minimum distance (direction of least resistance)
    const minDistance = Math.min(
      distanceToLeft,
      distanceToRight,
      distanceToTop,
      distanceToBottom,
    );
    if (minDistance === distanceToLeft) {
      // Push left: element should not go past leftBound - elementWidth
      const maxLeft = leftBound - width;
      if (left > maxLeft) {
        return [maxLeft, top];
      }
    } else if (minDistance === distanceToRight) {
      // Push right: element should not go before rightBound
      const minLeft = rightBound;
      if (left < minLeft) {
        return [minLeft, top];
      }
    } else if (minDistance === distanceToTop) {
      // Push up: element should not go past topBound - elementHeight
      const maxTop = topBound - height;
      if (top > maxTop) {
        return [left, maxTop];
      }
    } else if (minDistance === distanceToBottom) {
      // Push down: element should not go before bottomBound
      const minTop = bottomBound;
      if (top < minTop) {
        return [left, minTop];
      }
    }

    return null;
  };

  return {
    type: "obstacle",
    name,
    apply,
    element,
    bounds,
  };
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

/**
 * Validates constraints for logical consistency and reports issues during development.
 * Helps catch configuration errors like inappropriate obstacle assignments.
 */
const validateConstraints = (
  constraints,
  { elementWidth, elementHeight, name: dragName },
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

    const availableWidth = bounds.right - bounds.left;
    const availableHeight = bounds.bottom - bounds.top;
    const roundedElementWidth = elementWidth;
    const roundedElementHeight = elementHeight;

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
};
