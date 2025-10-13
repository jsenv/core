import { createObstacleContraint } from "./constraint.js";
import { getElementSelector } from "./element_log.js";

// Helper to get element rect in document-relative coordinates with sticky position handling
const getElementDocumentRect = (
  element,
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const viewportRect = element.getBoundingClientRect();
  const documentScrollLeft = document.documentElement.scrollLeft;
  const documentScrollTop = document.documentElement.scrollTop;
  const computedStyle = getComputedStyle(element);

  // Check position type
  const isFixed = computedStyle.position === "fixed";
  const isSticky = computedStyle.position === "sticky";

  // For now, use the current position regardless of this flag
  // TODO: Implement proper sticky position handling if needed
  if (useOriginalPositionEvenIfSticky && isSticky) {
    // This would need more complex logic to get the original position
    // For now, just use the current position
  }

  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;

  if (isSticky) {
    const isStickyLeft = computedStyle.left !== "auto";
    const isStickyTop = computedStyle.top !== "auto";
    fromStickyLeft = isStickyLeft
      ? { value: parseFloat(computedStyle.left) || 0 }
      : undefined;
    fromStickyTop = isStickyTop
      ? { value: parseFloat(computedStyle.top) || 0 }
      : undefined;
    fromStickyLeftAttr = isStickyLeft ? computedStyle.left : undefined;
    fromStickyTopAttr = isStickyTop ? computedStyle.top : undefined;
  }

  return {
    left: viewportRect.left + documentScrollLeft,
    top: viewportRect.top + documentScrollTop,
    right: viewportRect.right + documentScrollLeft,
    bottom: viewportRect.bottom + documentScrollTop,
    width: viewportRect.width,
    height: viewportRect.height,
    fromFixed: isFixed,
    fromStickyLeft,
    fromStickyTop,
    fromStickyLeftAttr,
    fromStickyTopAttr,
    sticky: isSticky,
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

      const obstacleBounds = getElementDocumentRect(obstacle, {
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
