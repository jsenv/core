import { getScrollRelativeRect } from "../../position/dom_coords.js";
import { getElementSelector } from "../element_log.js";

export const applyStickyFrontiersToAutoScrollArea = (
  autoScrollArea,
  { direction, scrollContainer, dragName },
) => {
  let { left, right, top, bottom } = autoScrollArea;

  if (direction.x) {
    const horizontalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "left",
        oppositeSide: "right",
      },
    );
    for (const horizontalStickyFrontier of horizontalStickyFrontiers) {
      const { side, bounds, element } = horizontalStickyFrontier;
      if (side === "left") {
        if (bounds.right <= left) {
          continue;
        }
        left = bounds.right;
        if (import.meta.dev && left > right) {
          console.warn(
            `Sticky frontier created invalid horizontal visible area: left (${left}) > right (${right}). Original: left=${bounds.right}, right=${right}`,
            {
              frontierElement: element,
              frontierBounds: bounds,
              dragName,
            },
          );
        }
        continue;
      }
      // right
      if (bounds.left >= right) {
        continue;
      }
      right = bounds.left;
      if (import.meta.dev && left > right) {
        console.warn(
          `Sticky frontier created invalid horizontal visible area: left (${left}) > right (${right}). Original: left=${left}, right=${bounds.left}`,
          {
            frontierElement: element,
            frontierBounds: bounds,
            dragName,
          },
        );
      }
      continue;
    }
  }

  if (direction.y) {
    const verticalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "top",
        oppositeSide: "bottom",
      },
    );
    for (const verticalStickyFrontier of verticalStickyFrontiers) {
      const { side, bounds, element } = verticalStickyFrontier;

      // Frontier acts as a top barrier - constrains from the bottom edge of the frontier
      if (side === "top") {
        if (bounds.bottom <= top) {
          continue;
        }
        top = bounds.bottom;
        if (import.meta.dev && top > bottom) {
          console.warn(
            `Sticky frontier created invalid vertical visible area: top (${top}) > bottom (${bottom}). Original: top=${bounds.bottom}, bottom=${bottom}`,
            {
              frontierElement: element,
              frontierBounds: bounds,
              dragName,
            },
          );
        }
        continue;
      }

      // Frontier acts as a bottom barrier - constrains from the top edge of the frontier
      if (bounds.top >= bottom) {
        continue;
      }
      bottom = bounds.top;
      if (import.meta.dev && top > bottom) {
        console.warn(
          `Sticky frontier created invalid vertical visible area: top (${top}) > bottom (${bottom}). Original: top=${top}, bottom=${bounds.top}`,
          {
            frontierElement: element,
            frontierBounds: bounds,
            dragName,
          },
        );
      }
      continue;
    }
  }

  return { left, right, top, bottom };
};

const createStickyFrontierOnAxis = (
  element,
  { name, scrollContainer, primarySide, oppositeSide },
) => {
  const primaryAttrName = `data-drag-sticky-${primarySide}-frontier`;
  const oppositeAttrName = `data-drag-sticky-${oppositeSide}-frontier`;
  const frontiers = element.querySelectorAll(
    `[${primaryAttrName}], [${oppositeAttrName}]`,
  );
  const matchingStickyFrontiers = [];
  for (const frontier of frontiers) {
    if (frontier.closest("[data-drag-ignore]")) {
      continue;
    }
    const hasPrimary = frontier.hasAttribute(primaryAttrName);
    const hasOpposite = frontier.hasAttribute(oppositeAttrName);
    // Check if element has both sides (invalid)
    if (hasPrimary && hasOpposite) {
      const elementSelector = getElementSelector(frontier);
      console.warn(
        `Sticky frontier element (${elementSelector}) has both ${primarySide} and ${oppositeSide} attributes. 
  A sticky frontier should only have one side attribute.`,
      );
      continue;
    }
    const attrName = hasPrimary ? primaryAttrName : oppositeAttrName;
    const attributeValue = frontier.getAttribute(attrName);
    if (attributeValue && name) {
      const frontierNames = attributeValue.split(",");
      const isMatching = frontierNames.some(
        (frontierName) =>
          frontierName.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!isMatching) {
        continue;
      }
    }
    const frontierBounds = getScrollRelativeRect(frontier, scrollContainer);
    const stickyFrontierObject = {
      type: "sticky-frontier",
      element: frontier,
      side: hasPrimary ? primarySide : oppositeSide,
      bounds: frontierBounds,
      name: `sticky_frontier_${hasPrimary ? primarySide : oppositeSide} (${getElementSelector(frontier)})`,
    };
    matchingStickyFrontiers.push(stickyFrontierObject);
  }
  return matchingStickyFrontiers;
};
