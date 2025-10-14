import { getScrollCoords } from "../position/dom_coords.js";
import { createObstacleContraint } from "./constraint.js";
import { getElementSelector } from "./element_log.js";

// Helper to get element rect in scroll container coordinates with sticky position handling
const getElementScrollRect = (
  element,
  scrollContainer,
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const [left, top, metadata] = getScrollCoords(element, scrollContainer, {
    useOriginalPositionEvenIfSticky,
  });

  return {
    left,
    top,
    right: metadata.right,
    bottom: metadata.bottom,
    width: metadata.width,
    height: metadata.height,
    fromFixed: metadata.fromFixed,
    fromStickyLeft: metadata.fromStickyLeft,
    fromStickyTop: metadata.fromStickyTop,
    fromStickyLeftAttr: metadata.fromStickyLeftAttr,
    fromStickyTopAttr: metadata.fromStickyTopAttr,
    sticky: Boolean(
      metadata.fromStickyLeft ||
        metadata.fromStickyTop ||
        metadata.fromStickyLeftAttr ||
        metadata.fromStickyTopAttr,
    ),
  };
};

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

      const obstacleBounds = getElementScrollRect(obstacle, scrollableElement, {
        useOriginalPositionEvenIfSticky,
      });

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
