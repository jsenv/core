import { createObstacleContraint } from "./constraint.js";
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

    const obstacleBounds = getElementBounds(element, positionedParentRect);
    const obstacleObject = createObstacleContraint(
      {
        left: obstacleBounds.left - positionedParentRect.left,
        top: obstacleBounds.top - positionedParentRect.top,
        right: obstacleBounds.right - positionedParentRect.left,
        bottom: obstacleBounds.bottom - positionedParentRect.top,
      },
      {
        name: `${obstacleBounds.sticky ? "sticky " : ""}obstacle (${getElementSelector(element)})`,
        element: obstacle,
      },
    );
    obstacleConstraints.push(() => {
      return obstacleObject;
    });
  }
  return obstacleConstraints;
};
