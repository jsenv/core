import { createObstacleContraint } from "./constraint.js";
import { getElementBounds } from "./element_bounds.js";
import { getElementSelector } from "./element_log.js";

export const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { name, positionedParent, obstacleAttributeName, draggedElementIsSticky },
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

    // Adjust obstacle bounds based on whether the dragged element is sticky
    let adjustedObstacleBounds;
    if (obstacleBounds.sticky && draggedElementIsSticky) {
      const scrollLeft = scrollableElement.scrollLeft;
      const scrollTop = scrollableElement.scrollTop;
      // If the obstacle is sticky but the dragged element is not,
      // offset the obstacle bounds by the scroll amount so they appear
      // "farther away" in the direction of scroll
      adjustedObstacleBounds = {
        left: obstacleBounds.left - positionedParentRect.left + scrollLeft,
        top: obstacleBounds.top - positionedParentRect.top + scrollTop,
        right: obstacleBounds.right - positionedParentRect.left + scrollLeft,
        bottom: obstacleBounds.bottom - positionedParentRect.top + scrollTop,
      };
    } else {
      adjustedObstacleBounds = {
        left: obstacleBounds.left - positionedParentRect.left,
        top: obstacleBounds.top - positionedParentRect.top,
        right: obstacleBounds.right - positionedParentRect.left,
        bottom: obstacleBounds.bottom - positionedParentRect.top,
      };
    }

    const obstacleObject = createObstacleContraint(adjustedObstacleBounds, {
      name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
      element: obstacle,
    });
    obstacleConstraintFunctions.push(() => {
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};
