const CONSOLE_DEBUG_CONSTRAINTS = true;

export const createBoundConstraint = (bounds, { element, name } = {}) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;

  const apply = (x, y, { elementWidth, elementHeight }) => {
    // Calculate actual positions where element would end up
    const left = x;
    const top = y;
    const right = x + elementWidth;
    const bottom = y + elementHeight;

    let xConstrained = x;
    let yConstrained = y;

    console.log(
      `${name || "bound"} constraint: checking x=${x}, y=${y}, bounds=[${leftBound},${topBound},${rightBound},${bottomBound}]`,
    );
    console.log(
      `Element would be at: left=${left}, top=${top}, right=${right}, bottom=${bottom}`,
    );

    // Left boundary: element's left edge should not go before leftBound
    if (leftBound !== undefined && left < leftBound) {
      console.log(
        `Left constraint: ${left} < ${leftBound} - constraining to ${leftBound}`,
      );
      xConstrained = leftBound;
    }
    // Right boundary: element's right edge should not go past rightBound
    if (rightBound !== undefined && right > rightBound) {
      console.log(
        `Right constraint: ${right} > ${rightBound} - constraining to ${rightBound - elementWidth}`,
      );
      xConstrained = rightBound - elementWidth;
    }
    // Top boundary: element's top edge should not go before topBound
    if (topBound !== undefined && top < topBound) {
      console.log(
        `Top constraint: ${top} < ${topBound} - constraining to ${topBound}`,
      );
      yConstrained = topBound;
    }
    // Bottom boundary: element's bottom edge should not go past bottomBound
    if (bottomBound !== undefined && bottom > bottomBound) {
      console.log(
        `Bottom constraint: ${bottom} > ${bottomBound} - constraining to ${bottomBound - elementHeight}`,
      );
      yConstrained = bottomBound - elementHeight;
    }

    console.log(
      `${name || "bound"} constraint result: x=${x} -> ${xConstrained}, y=${y} -> ${yConstrained}`,
    );
    return [xConstrained, yConstrained];
  };

  return {
    type: "bounds",
    name,
    apply,
    element,
    bounds,
  };
};

export const createObstacleContraint = (bounds, { element, name }) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;
  const leftBoundRounded = roundForConstraints(leftBound);
  const rightBoundRounded = roundForConstraints(rightBound);
  const topBoundRounded = roundForConstraints(topBound);
  const bottomBoundRounded = roundForConstraints(bottomBound);

  const apply = (x, y, { elementWidth, elementHeight }) => {
    const left = x;
    const top = y;
    const right = left + elementWidth;
    const bottom = top + elementHeight;

    // Determine current position relative to obstacle
    let isOnTheLeft;
    let isOnTheRight;
    let isAbove;
    let isBelow;
    {
      const leftRounded = roundForConstraints(x);
      const rightRounded = roundForConstraints(x + elementWidth);
      const topRounded = roundForConstraints(y);
      const bottomRounded = roundForConstraints(y + elementHeight);
      isOnTheLeft = rightRounded <= leftBoundRounded;
      isOnTheRight = leftRounded >= rightBoundRounded;
      isAbove = bottomRounded <= topBoundRounded;
      isBelow = topRounded >= bottomBoundRounded;
      // Debug logging to understand element position
      if (CONSOLE_DEBUG_CONSTRAINTS) {
        console.log(
          `Element position relative to obstacle: left=${isOnTheLeft}, right=${isOnTheRight}, above=${isAbove}, below=${isBelow}`,
        );
        console.log(
          `Element: left=${left}, right=${right}, top=${top}, bottom=${bottom}`,
        );
        console.log(
          `Obstacle: leftBound=${leftBound}, rightBound=${rightBound}, topBound=${topBound}, bottomBound=${bottomBound}`,
        );
      }
    }

    // Simple collision detection: check where element is and prevent movement into obstacle
    // If element is on the left, apply X constraint to prevent moving right into obstacle
    if (isOnTheLeft) {
      // Only apply constraint if there would be Y overlap (element would collide)
      const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
      if (wouldHaveYOverlap) {
        const maxAllowedX = leftBound - elementWidth;
        if (x > maxAllowedX) {
          return [maxAllowedX, y];
        }
      }
    }
    // If element is on the right, apply X constraint to prevent moving left into obstacle
    else if (isOnTheRight) {
      // Only apply constraint if there would be Y overlap (element would collide)
      const wouldHaveYOverlap = top < bottomBound && bottom > topBound;

      if (wouldHaveYOverlap) {
        const minAllowedX = rightBound;
        if (x < minAllowedX) {
          return [minAllowedX, y];
        }
      }
    }
    // If element is above, apply Y constraint to prevent moving down into obstacle
    else if (isAbove) {
      // Only apply constraint if there would be X overlap (element would collide)
      const wouldHaveXOverlap = left < rightBound && right > leftBound;

      if (wouldHaveXOverlap) {
        const maxAllowedY = topBound - elementHeight;
        if (y > maxAllowedY) {
          return [x, maxAllowedY];
        }
      }
    }
    // If element is below, apply Y constraint to prevent moving up into obstacle
    else if (isBelow) {
      // Only apply constraint if there would be X overlap (element would collide)
      const wouldHaveXOverlap = left < rightBound && right > leftBound;

      if (wouldHaveXOverlap) {
        const minAllowedY = bottomBound;
        if (y < minAllowedY) {
          return [x, minAllowedY];
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
      const maxAllowedX = leftBound - elementWidth;
      if (x > maxAllowedX) {
        return [maxAllowedX, y];
      }
    } else if (minDistance === distanceToRight) {
      // Push right: element should not go before rightBound
      const minAllowedX = rightBound;
      if (x < minAllowedX) {
        return [minAllowedX, y];
      }
    } else if (minDistance === distanceToTop) {
      // Push up: element should not go past topBound - elementHeight
      const maxAllowedY = topBound - elementHeight;
      if (y > maxAllowedY) {
        return [x, maxAllowedY];
      }
    } else if (minDistance === distanceToBottom) {
      // Push down: element should not go before bottomBound
      const minAllowedY = bottomBound;
      if (y < minAllowedY) {
        return [x, minAllowedY];
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

export const prepareConstraints = (constraintFunctions, constraintInfo) => {
  const constraints = constraintFunctions.map((fn) => fn(constraintInfo));
  // Development safeguards: detect impossible/illogical constraints
  if (import.meta.dev) {
    validateConstraints(constraints, constraintInfo);
  }
  return constraints;
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

// Apply constraints on both X and Y axes
export const applyConstraints = (
  constraints,
  x,
  y,
  { gestureInfo, elementWidth, elementHeight, direction, interactionType },
) => {
  if (constraints.length === 0) {
    return [x, y];
  }

  // Capture original movement values for debug logging
  const xNoConstraint = x;
  const yNoConstraint = y;
  let currentX = x;
  let currentY = y;

  for (const constraint of constraints) {
    const result = constraint.apply(currentX, currentY, {
      gestureInfo,
      elementWidth,
      elementHeight,
      interactionType,
    });
    if (!result) {
      continue;
    }
    const [constrainedX, constrainedY] = result;
    if (direction.x && constrainedX !== currentX) {
      logConstraintEnforcement(
        "x",
        currentX,
        constrainedX,
        constraint,
        interactionType,
        gestureInfo,
      );
      currentX = constrainedX;
    }
    if (direction.y && constrainedY !== currentY) {
      logConstraintEnforcement(
        "y",
        currentY,
        constrainedY,
        constraint,
        interactionType,
        gestureInfo,
      );
      currentY = constrainedY;
    }
  }
  // Log when no constraints were applied (movement unchanged)
  if (
    CONSOLE_DEBUG_CONSTRAINTS &&
    xNoConstraint === currentX &&
    yNoConstraint === currentY
  ) {
    console.debug(
      `Drag by ${interactionType}: no constraint enforcement needed (xMove=${currentX.toFixed(2)}, yMove=${currentY.toFixed(2)})`,
      gestureInfo,
    );
  }
  return [currentX, currentY];
};
const logConstraintEnforcement = (
  axis,
  originalValue,
  constrainedValue,
  constraint,
  interactionType = "unknown",
  gestureInfo,
) => {
  if (!CONSOLE_DEBUG_CONSTRAINTS) {
    return;
  }
  const action = constrainedValue > originalValue ? "increased" : "capped";
  console.debug(
    `Drag by ${interactionType}: ${axis} ${action} from ${originalValue.toFixed(2)} to ${constrainedValue.toFixed(2)} by ${constraint.name}`,
    constraint.element,
    gestureInfo,
  );
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
