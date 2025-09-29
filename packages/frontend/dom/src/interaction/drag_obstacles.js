import { createObstacleContraint } from "./constraint.js";
import { getElementBounds } from "./element_bounds.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { name, positionedParent, obstacleAttributeName },
) => {
  const obstacles = scrollableElement.querySelectorAll(
    `[${obstacleAttributeName}]`,
  );
  const positionedParentRect = positionedParent.getBoundingClientRect();
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

    const obstacleBounds = getElementBounds(obstacle, positionedParent);
    const obstacleObject = createObstacleContraint(
      {
        left: obstacleBounds.left - positionedParentRect.left,
        top: obstacleBounds.top - positionedParentRect.top,
        right: obstacleBounds.right - positionedParentRect.left,
        bottom: obstacleBounds.bottom - positionedParentRect.top,
      },
      {
        name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
        element: obstacle,
      },
    );
    obstacleConstraintFunctions.push(() => {
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};
