import { getScrollRelativeRect } from "../position/dom_coords.js";
import { createObstacleContraint } from "./constraint.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { name, obstacleAttributeName, gestureInfo, isDraggedElementSticky = false },
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
      // Only apply the "before crossing visible area" logic when dragging sticky elements
      // Non-sticky elements should be able to cross sticky obstacles while stuck regardless of visible area crossing
      const useOriginalPositionEvenIfSticky = isDraggedElementSticky
        ? !gestureInfo.hasCrossedVisibleAreaLeftOnce &&
          !gestureInfo.hasCrossedVisibleAreaTopOnce
        : true;

      const obstacleBounds = getScrollRelativeRect(
        obstacle,
        scrollableElement,
        {
          useOriginalPositionEvenIfSticky,
        },
      );

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
