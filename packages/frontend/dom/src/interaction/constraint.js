const CONSOLE_DEBUG_CONSTRAINTS = true;

export const createBoundConstraint = (bounds, { element, name } = {}) => {
  const { left, top, right, bottom } = bounds;

  const apply = (xMove, yMove, { gestureInfo }) => {
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
  const { left, top, right, bottom } = bounds;
  const leftBound = roundForConstraints(left);
  const rightBound = roundForConstraints(right);
  const topBound = roundForConstraints(top);
  const bottomBound = roundForConstraints(bottom);

  const apply = (
    xMove,
    yMove,
    { gestureInfo, elementWidth, elementHeight },
  ) => {
    const { leftAtStart, topAtStart } = gestureInfo;
    const enforcements = [];

    // Calculate current visual position (initialLeft/initialTop are now visual coordinates)
    const currentVisualLeft = leftAtStart + xMove;
    const currentVisualTop = topAtStart + yMove;

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

    // Determine current position relative to obstacle
    const isOnTheLeft = currentActualRight <= leftBound;
    const isOnTheRight = currentActualLeft >= rightBound;
    const isAbove = currentActualBottom <= topBound;
    const isBelow = currentActualTop >= bottomBound;

    // Apply constraints based on element position - handle all cases including diagonal

    // Always check Y constraints if element is above or below
    if (isAbove || isBelow) {
      const proposedLeft = leftAtStart + xMove;
      const proposedRight = proposedLeft + elementWidth;
      const wouldHaveXOverlap =
        proposedLeft < rightBound && proposedRight > leftBound;

      if (wouldHaveXOverlap) {
        if (isAbove) {
          // Element above - prevent it from going down into obstacle
          const maxAllowedYMove = topBound - elementHeight - topAtStart;
          if (yMove > maxAllowedYMove) {
            enforcements.push({ y: maxAllowedYMove });
          }
        } else if (isBelow) {
          // Element below - prevent it from going up into obstacle
          const minAllowedYMove = bottomBound - topAtStart;
          if (yMove < minAllowedYMove) {
            enforcements.push({ y: minAllowedYMove });
          }
        }
      }
    }

    // Always check X constraints if element is on left or right (even after Y adjustment)
    if (isOnTheLeft || isOnTheRight) {
      const proposedTop = topAtStart + yMove; // Use potentially adjusted yMove
      const proposedBottom = proposedTop + elementHeight;
      const wouldHaveYOverlap =
        proposedTop < bottomBound && proposedBottom > topBound;

      if (wouldHaveYOverlap) {
        if (isOnTheLeft) {
          // Element on left - prevent it from going right into obstacle
          const maxAllowedXMove = leftBound - elementWidth - leftAtStart;
          if (xMove > maxAllowedXMove) {
            enforcements.push({ x: maxAllowedXMove });
          }
        } else if (isOnTheRight) {
          // Element on right - prevent it from going left into obstacle
          const minAllowedXMove = rightBound - leftAtStart;
          if (xMove < minAllowedXMove) {
            enforcements.push({ x: minAllowedXMove });
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
        const maxAllowedXMove = leftBound - elementWidth - leftAtStart;
        if (xMove > maxAllowedXMove) {
          enforcements.push({ x: maxAllowedXMove });
        }
      } else if (minDistance === distanceToRight) {
        // Push right: element should not go before rightBound
        const minAllowedXMove = rightBound - leftAtStart;
        if (xMove < minAllowedXMove) {
          enforcements.push({ x: minAllowedXMove });
        }
      } else if (minDistance === distanceToTop) {
        // Push up: element should not go past topBound - elementHeight
        const maxAllowedYMove = topBound - elementHeight - topAtStart;
        if (yMove > maxAllowedYMove) {
          enforcements.push({ x: maxAllowedYMove });
        }
      } else if (minDistance === distanceToBottom) {
        // Push down: element should not go before bottomBound
        const minAllowedYMove = bottomBound - topAtStart;
        if (yMove < minAllowedYMove) {
          enforcements.push({ x: minAllowedYMove });
        }
      }
    }
  };

  return {
    type: "obstacle",
    name,
    apply,
    element,
    bounds,
  };
};

export const prepareConstraints = (
  constraintFunctions,
  { name, elementWidth, elementHeight },
) => {
  const constraints = constraintFunctions.map((fn) =>
    fn({
      elementWidth,
      elementHeight,
    }),
  );
  // Development safeguards: detect impossible/illogical constraints
  if (import.meta.dev) {
    validateConstraints(constraints, {
      elementWidth,
      elementHeight,
      dragName: name,
    });
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
  {
    gestureInfo,
    xMove,
    yMove,
    elementWidth,
    elementHeight,
    direction,
    interactionType,
  },
) => {
  if (constraints.length === 0) {
    return [xMove, yMove];
  }

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
      if (direction.x && enforcement.x !== undefined) {
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
      if (direction.y && enforcement.y !== undefined) {
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
    CONSOLE_DEBUG_CONSTRAINTS &&
    xMoveNoConstraint === xMove &&
    yMoveNoConstraint === yMove
  ) {
    console.debug(
      `Drag by ${interactionType}: no constraint enforcement needed (xMove=${xMove.toFixed(2)}, yMove=${yMove.toFixed(2)})`,
    );
  }
  return [xMove, yMove];
};
const logConstraintEnforcement = (
  axis,
  originalValue,
  constrainedValue,
  constraint,
  interactionType = "unknown",
) => {
  if (!CONSOLE_DEBUG_CONSTRAINTS) {
    return;
  }
  const direction = constrainedValue > originalValue ? "increased" : "capped";
  console.debug(
    `Drag by ${interactionType}: ${axis} movement ${direction} from ${originalValue.toFixed(2)} to ${constrainedValue.toFixed(2)} by ${constraint.name}`,
    constraint.element,
  );
};

/**
 * Validates constraints for logical consistency and reports issues during development.
 * Helps catch configuration errors like inappropriate obstacle assignments.
 */
const validateConstraints = (
  constraints,
  { elementWidth, elementHeight, dragName },
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
