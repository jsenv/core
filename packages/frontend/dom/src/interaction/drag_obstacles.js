import { getElementScrollableRect } from "../scroll/scrollable_rect.js";
import { createObstacleContraint } from "./constraint.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { name, obstacleAttributeName, gestureInfo },
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
      const forceOriginalPositionEvenIfSticky =
        !gestureInfo.hasCrossedVisibleAreaLeftOnce &&
        !gestureInfo.hasCrossedVisibleAreaTopOnce;
      const obstacleBounds = getElementScrollableRect(
        obstacle,
        gestureInfo.scrollableParent,
        {
          forceOriginalPositionEvenIfSticky,
        },
      );

      // obstacleBounds are already in scrollable-relative coordinates, no conversion needed
      const obstacleObject = createObstacleContraint(obstacleBounds, {
        name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
        element: obstacle,
      });
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};
