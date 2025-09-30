import { createObstacleContraint } from "./constraint.js";
import { getElementBounds } from "./element_bounds.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { name, positionedParent, obstacleAttributeName, isStickyLeft, isStickyTop },
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

    obstacleConstraintFunctions.push(() => {
      const obstacleBounds = getElementBounds(obstacle, positionedParent);

      obstacleBounds.left -= positionedParentRect.left;
      obstacleBounds.right -= positionedParentRect.left;
      obstacleBounds.top -= positionedParentRect.top;
      obstacleBounds.bottom -= positionedParentRect.top;

      if (obstacleBounds.sticky) {
        if (isStickyLeft) {
          const scrollLeft = scrollableElement.scrollLeft;
          obstacleBounds.left += scrollLeft;
          obstacleBounds.right += scrollLeft;
        }
        if (isStickyTop) {
          const scrollTop = scrollableElement.scrollTop;
          obstacleBounds.top += scrollTop;
          obstacleBounds.bottom += scrollTop;
        }
      }
      const obstacleObject = createObstacleContraint(obstacleBounds, {
        name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
        element: obstacle,
      });
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};
