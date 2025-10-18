import {
  addScrollToRect,
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
    areaConstraint,
    obstaclesContainer,
    obstacleAttributeName,
    showConstraintFeedbackLine,
    showDebugMarkers,
    referenceElement,
  },
) => {
  const dragGestureName = dragGesture.gestureInfo.name;
  const direction = dragGesture.gestureInfo.direction;
  const scrollContainer = dragGesture.gestureInfo.scrollContainer;
  const leftAtGrab = dragGesture.gestureInfo.grabLayout.left;
  const topAtGrab = dragGesture.gestureInfo.grabLayout.top;

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
    dragDebugMarkers = setupDragDebugMarkers(dragGesture, {
      referenceElement,
    });
    dragGesture.addReleaseCallback(() => {
      dragDebugMarkers.onRelease();
    });
  }

  area: {
    const areaConstraintFunction = createAreaConstraint(areaConstraint, {
      scrollContainer,
    });
    if (areaConstraintFunction) {
      addConstraint(areaConstraintFunction);
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
    layoutRequested,
    currentLayout,
    limitLayout,
    {
      elementWidth,
      elementHeight,
      scrollArea,
      scrollport,
      hasCrossedScrollportLeftOnce,
      hasCrossedScrollportTopOnce,
      autoScrollArea,
      dragEvent,
    },
  ) => {
    if (constraintFunctions.length === 0) {
      return;
    }

    const elementCurrentLeft = currentLayout.left;
    const elementCurrentTop = currentLayout.top;
    const elementLeftRequested = layoutRequested.left;
    const elementTopRequested = layoutRequested.top;
    let elementLeft = elementLeftRequested;
    let elementTop = elementTopRequested;

    const constraintInitParams = {
      leftAtGrab,
      topAtGrab,
      left: elementCurrentLeft,
      top: elementCurrentTop,
      right: elementCurrentLeft + elementWidth,
      bottom: elementCurrentTop + elementHeight,
      width: elementWidth,
      height: elementHeight,
      scrollContainer,
      scrollArea,
      scrollport,
      autoScrollArea,
      dragGestureName,
      dragEvent,
    };
    const constraints = constraintFunctions.map((fn) =>
      fn(constraintInitParams),
    );
    // Development safeguards: detect impossible/illogical constraints
    if (import.meta.dev) {
      validateConstraints(constraints, constraintInitParams);
    }

    const logConstraintEnforcement = (axis, constraint) => {
      if (!CONSOLE_DEBUG_BOUNDS && constraint.type === "bounds") {
        return;
      }
      if (!CONSOLE_DEBUG_OBSTACLES && constraint.type === "obstacle") {
        return;
      }
      const requested =
        axis === "x" ? elementLeftRequested : elementTopRequested;
      const constrained = axis === "x" ? elementLeft : elementTop;
      const action = constrained > requested ? "increased" : "capped";
      const property = axis === "x" ? "left" : "top";
      console.debug(
        `Drag by ${dragEvent.type}: ${property} ${action} from ${requested.toFixed(2)} to ${constrained.toFixed(2)} by ${constraint.type}:${constraint.name}`,
        constraint.element,
      );
    };

    // Apply each constraint in sequence, accumulating their effects
    // This allows multiple constraints to work together (e.g., bounds + obstacles)
    for (const constraint of constraints) {
      const result = constraint.apply({
        // each constraint works with scroll included coordinates
        // and coordinates we provide here includes the scroll of the container
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        width: elementWidth,
        height: elementHeight,
        currentLeft: elementCurrentLeft,
        currentTop: elementCurrentTop,
        scrollport,
        hasCrossedScrollportLeftOnce,
        hasCrossedScrollportTopOnce,
      });
      if (!result) {
        continue;
      }
      const [elementLeftConstrained, elementTopConstrained] = result;
      if (direction.x && elementLeftConstrained !== elementLeft) {
        elementLeft = elementLeftConstrained;
        logConstraintEnforcement("x", constraint);
      }
      if (direction.y && elementTopConstrained !== elementTop) {
        elementTop = elementTopConstrained;
        logConstraintEnforcement("y", constraint);
      }
    }

    if (dragDebugMarkers) {
      dragDebugMarkers.onConstraints(constraints, {
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        elementWidth,
        elementHeight,
        scrollport,
        autoScrollArea,
      });
    }

    const leftModified = elementLeft !== elementLeftRequested;
    const topModified = elementTop !== elementTopRequested;
    if (!leftModified && !topModified) {
      if (CONSOLE_DEBUG_BOUNDS || CONSOLE_DEBUG_OBSTACLES) {
        console.debug(
          `Drag by ${dragEvent.type}: no constraint enforcement needed (${elementLeftRequested.toFixed(2)}, ${elementTopRequested.toFixed(2)})`,
        );
      }
      return;
    }

    limitLayout(elementLeft, elementTop);
  };

  return { applyConstraints };
};

const createAreaConstraint = (areaConstraint, { scrollContainer }) => {
  if (!areaConstraint || areaConstraint === "none") {
    return null;
  }
  if (areaConstraint === "scrollport") {
    const scrollportConstraintFunction = ({ scrollport }) => {
      return createBoundConstraint(scrollport, {
        element: scrollContainer,
        name: "scrollport",
      });
    };
    return scrollportConstraintFunction;
  }
  if (areaConstraint === "scroll_area") {
    const scrollAreaConstraintFunction = ({ scrollArea }) => {
      return createBoundConstraint(scrollArea, {
        element: scrollContainer,
        name: "scroll_area",
      });
    };
    return scrollAreaConstraintFunction;
  }
  if (typeof areaConstraint === "function") {
    const dynamicAreaConstraintFunction = (params) => {
      const bounds = areaConstraint(params);
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  if (typeof areaConstraint === "object") {
    const { left, top, right, bottom } = areaConstraint;
    const turnSidePropertyInToGetter = (value, side) => {
      if (value === "scrollport") {
        return ({ scrollport }) => scrollport[side];
      }
      if (value === "scroll") {
        return ({ scrollArea }) => scrollArea[side];
      }
      if (typeof value === "function") {
        return value;
      }
      if (value === undefined) {
        // defaults to scrollport
        return ({ scrollport }) => scrollport[side];
      }
      return () => value;
    };
    const getLeft = turnSidePropertyInToGetter(left, "left");
    const getRight = turnSidePropertyInToGetter(right, "right");
    const getTop = turnSidePropertyInToGetter(top, "top");
    const getBottom = turnSidePropertyInToGetter(bottom, "bottom");

    const dynamicAreaConstraintFunction = (params) => {
      const bounds = {
        left: getLeft(params),
        right: getRight(params),
        top: getTop(params),
        bottom: getBottom(params),
      };
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  return null;
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

    obstacleConstraintFunctions.push(
      ({ hasCrossedVisibleAreaLeftOnce, hasCrossedVisibleAreaTopOnce }) => {
        // Only apply the "before crossing visible area" logic when dragging sticky elements
        // Non-sticky elements should be able to cross sticky obstacles while stuck regardless of visible area crossing
        const useOriginalPositionEvenIfSticky = isDraggedElementSticky
          ? !hasCrossedVisibleAreaLeftOnce && !hasCrossedVisibleAreaTopOnce
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
      },
    );
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
