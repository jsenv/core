import { useLayoutEffect } from "preact/hooks";

// React hook version for easy integration
export const useStickyGroup = (elementRef, { elementSelector } = {}) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    return initStickyGroup(element, { elementSelector });
  }, [elementSelector]);
};

const LEFT_CSS_VAR = "--sticky-group-left";
const TOP_CSS_VAR = "--sticky-group-top";

/**
 * Creates a sticky group that manages positioning for multiple sticky elements
 * that need to be aware of each other's dimensions.
 * Always uses CSS variables for positioning.
 *
 * @param {HTMLElement} container The container element
 * @returns {Function} Cleanup function
 */
const initStickyGroup = (
  container,
  {
    elementSelector,
    targetReceivingCumulativeStickyColumnPosition = ".navi_table_sticky_column_frontier",
    targetReceivingCumulativeStickyRowPosition = ".navi_table_sticky_row_frontier",
  } = {},
) => {
  if (!container) {
    throw new Error("initStickyGroup: container is required");
  }

  const element = elementSelector
    ? container.querySelector(elementSelector)
    : container;
  const isGrid = element.tagName === "TABLE";
  const updatePositions = () => {
    if (isGrid) {
      updateGridPositions();
    } else {
      updateLinearPositions();
    }
  };
  const updateGridPositions = () => {
    // Handle table grid - update both horizontal and vertical sticky elements
    updateTableColumns();
    updateTableRows();
  };

  const updateTableColumns = () => {
    // Find all sticky columns by checking the first row
    const headerRow = element.querySelector("thead tr");
    if (!headerRow) {
      return;
    }
    const stickyHeaderCells = headerRow.querySelectorAll("th[data-sticky-x]");
    let cumulativeWidth = 0;
    stickyHeaderCells.forEach((stickyHeaderCell, index) => {
      const columnIndex = Array.from(headerRow.children).indexOf(
        stickyHeaderCell,
      );
      const leftPosition = index === 0 ? 0 : cumulativeWidth;

      // Set CSS variable on all cells in this column
      const columnCells = element.querySelectorAll(
        `th:nth-child(${columnIndex + 1})[data-sticky-x], td:nth-child(${columnIndex + 1})[data-sticky-x]`,
      );
      columnCells.forEach((cell) => {
        cell.style.setProperty(LEFT_CSS_VAR, `${leftPosition}px`);
      });

      // Also set CSS variable on corresponding <col> element if it exists
      const colgroup = element.querySelector("colgroup");
      if (colgroup) {
        const correspondingCol = colgroup.querySelector(
          `col:nth-child(${columnIndex + 1})`,
        );
        if (correspondingCol) {
          correspondingCol.style.setProperty(LEFT_CSS_VAR, `${leftPosition}px`);
        }
      }

      // Update cumulative width for next column
      if (index === 0) {
        cumulativeWidth = stickyHeaderCell.getBoundingClientRect().width;
      } else {
        cumulativeWidth += stickyHeaderCell.getBoundingClientRect().width;
      }
    });

    if (targetReceivingCumulativeStickyColumnPosition) {
      const element = container.querySelector(
        targetReceivingCumulativeStickyColumnPosition,
      );
      if (element) {
        element.style.setProperty(LEFT_CSS_VAR, `${cumulativeWidth}px`);
      }
    }
  };
  const updateTableRows = () => {
    // Handle sticky rows by finding cells with data-sticky-y and grouping by row
    const stickyCells = element.querySelectorAll(
      "th[data-sticky-y], td[data-sticky-y]",
    );
    if (stickyCells.length === 0) {
      return;
    }

    // Group cells by their parent row
    const rowsWithStickyCells = new Map();
    stickyCells.forEach((cell) => {
      const row = cell.parentElement;
      if (!rowsWithStickyCells.has(row)) {
        rowsWithStickyCells.set(row, []);
      }
      rowsWithStickyCells.get(row).push(cell);
    });

    // Convert to array and sort by row position in DOM
    const stickyRows = Array.from(rowsWithStickyCells.keys()).sort((a, b) => {
      const aIndex = Array.from(element.querySelectorAll("tr")).indexOf(a);
      const bIndex = Array.from(element.querySelectorAll("tr")).indexOf(b);
      return aIndex - bIndex;
    });

    let cumulativeHeight = 0;
    stickyRows.forEach((row, index) => {
      const rowCells = rowsWithStickyCells.get(row);
      const topPosition = index === 0 ? 0 : cumulativeHeight;

      // Set CSS variable on all sticky cells in this row
      rowCells.forEach((cell) => {
        cell.style.setProperty(TOP_CSS_VAR, `${topPosition}px`);
      });

      // Also set CSS variable on the <tr> element itself
      row.style.setProperty(TOP_CSS_VAR, `${topPosition}px`);

      // Update cumulative height for next row
      if (index === 0) {
        cumulativeHeight = row.getBoundingClientRect().height;
      } else {
        cumulativeHeight += row.getBoundingClientRect().height;
      }
    });
    if (targetReceivingCumulativeStickyRowPosition) {
      const element = container.querySelector(
        targetReceivingCumulativeStickyRowPosition,
      );
      if (element) {
        element.style.setProperty(TOP_CSS_VAR, `${cumulativeHeight}px`);
      }
    }
  };

  const updateLinearPositions = () => {
    // Handle linear container - detect direction from first sticky element
    const stickyElements = element.querySelectorAll(
      "[data-sticky-x], [data-sticky-y]",
    );
    if (stickyElements.length <= 1) return;

    const firstElement = stickyElements[0];
    const isHorizontal = firstElement.hasAttribute("data-sticky-x");
    const dimensionProperty = isHorizontal ? "width" : "height";
    const cssVariableName = isHorizontal ? LEFT_CSS_VAR : TOP_CSS_VAR;

    let cumulativeSize = 0;

    stickyElements.forEach((element, index) => {
      if (index === 0) {
        // First element stays at position 0
        element.style.setProperty(cssVariableName, "0px");
        cumulativeSize = element.getBoundingClientRect()[dimensionProperty];
      } else {
        // Subsequent elements use cumulative positioning
        const position = cumulativeSize;
        element.style.setProperty(cssVariableName, `${position}px`);
        cumulativeSize += element.getBoundingClientRect()[dimensionProperty];
      }
    });
  };

  // Initial positioning
  updatePositions();

  // Set up ResizeObserver to handle size changes
  const resizeObserver = new ResizeObserver(() => {
    updatePositions();
  });

  // Set up MutationObserver to handle DOM changes
  const mutationObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    mutations.forEach((mutation) => {
      // Check if sticky elements were added/removed or attributes changed
      if (mutation.type === "childList") {
        shouldUpdate = true;
      }
      if (mutation.type === "attributes") {
        // Check if the mutation affects sticky attributes
        if (
          mutation.attributeName === "data-sticky-x" ||
          mutation.attributeName === "data-sticky-y"
        ) {
          shouldUpdate = true;
        }
      }
    });

    if (shouldUpdate) {
      updatePositions();
    }
  });

  // Start observing
  resizeObserver.observe(element);
  mutationObserver.observe(element, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["data-sticky-x", "data-sticky-y"],
  });

  // Return cleanup function
  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  };
};
