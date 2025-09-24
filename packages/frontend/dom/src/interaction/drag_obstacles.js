import { getElementBounds } from "./element_bounds.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  element,
  { name, sticky, positionedParent, obstacleQuerySelector },
) => {
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const obstacles = element.querySelectorAll(obstacleQuerySelector);
  const obstacleConstraints = [];
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
    const obstacleObject = createObstacle(obstacle, positionedParentRect);
    obstacleConstraints.push(() => {
      return obstacleObject;
    });
  }
  return obstacleConstraints;
};

const createObstacle = (element, positionedParentRect) => {
  const obstacleBounds = getElementBounds(element, positionedParentRect);
  const bounds = {
    left: obstacleBounds.left - positionedParentRect.left,
    top: obstacleBounds.top - positionedParentRect.top,
    right: obstacleBounds.right - positionedParentRect.left,
    bottom: obstacleBounds.bottom - positionedParentRect.top,
  };

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
    const leftBound = roundForConstraints(bounds.left);
    const rightBound = roundForConstraints(bounds.right);
    const topBound = roundForConstraints(bounds.top);
    const bottomBound = roundForConstraints(bounds.bottom);

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
    element,
    bounds,
    viewportBounds: obstacleBounds,
    name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(element)})`,
    apply,
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
