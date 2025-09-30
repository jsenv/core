import { createObstacleContraint } from "./constraint.js";
import { getElementBounds } from "./element_bounds.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { name, positionedParent, obstacleAttributeName, gestureInfo },
) => {
  const obstacles = scrollableElement.querySelectorAll(
    `[${obstacleAttributeName}]`,
  );
  const obstacleConstraintFunctions = [];
  for (const obstacle of obstacles) {
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (name) {
      const obstacleAttributeValue = obstacle.getAttribute(
        obstacleAttributeName,
      );
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

    obstacleConstraintFunctions.push(() => {
      const obstacleBounds = getElementBounds(obstacle, {
        positionedParent: gestureInfo.positionedParent,
        scrollableParent: gestureInfo.scrollableParent,
        useNonStickyLeftEvenIfStickyLeft:
          !gestureInfo.hasCrossedVisibleAreaLeftOnce,
        useNonStickyTopEvenIfStickyTop:
          !gestureInfo.hasCrossedVisibleAreaTopOnce,
      });
      const positionedParentRect = positionedParent.getBoundingClientRect();

      obstacleBounds.left -= positionedParentRect.left;
      obstacleBounds.right -= positionedParentRect.left;
      obstacleBounds.top -= positionedParentRect.top;
      obstacleBounds.bottom -= positionedParentRect.top;
      const obstacleObject = createObstacleContraint(obstacleBounds, {
        name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
        element: obstacle,
      });
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};
