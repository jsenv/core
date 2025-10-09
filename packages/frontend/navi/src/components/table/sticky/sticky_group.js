import { useLayoutEffect } from "preact/hooks";

// React hook version for easy integration
export const useStickyGroup = (
  elementRef,
  { elementReceivingCumulativeStickyPositionRef, elementSelector } = {},
) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    return initStickyGroup(element, {
      elementSelector,
      elementReceivingCumulativeStickyPosition:
        elementReceivingCumulativeStickyPositionRef.current,
    });
  }, [elementSelector]);
};

const LEFT_CSS_VAR = "--sticky-group-left";
const TOP_CSS_VAR = "--sticky-group-top";
const CONTAINER_LEFT_FRONTIER_CSS_VAR = "--sticky-group-left-frontier";
const CONTAINER_TOP_FRONTIER_CSS_VAR = "--sticky-group-top-frontier";

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
  { elementSelector, elementReceivingCumulativeStickyPosition } = {},
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
    // Find all sticky columns by checking all rows to identify which columns have sticky cells
    const allStickyColumnCells = element.querySelectorAll(
      ".navi_table_cell[data-sticky-left]",
    );
    if (allStickyColumnCells.length === 0) {
      return;
    }

    // Get the first row to determine column indices (use any row that exists)
    const firstRow = element.querySelector(".navi_tr");
    if (!firstRow) {
      return;
    }

    // Group sticky cells by column index
    const stickyColumnsByIndex = new Map();
    allStickyColumnCells.forEach((cell) => {
      const row = cell.closest(".navi_tr");
      const columnIndex = Array.from(row.children).indexOf(cell);
      if (!stickyColumnsByIndex.has(columnIndex)) {
        stickyColumnsByIndex.set(columnIndex, []);
      }
      stickyColumnsByIndex.get(columnIndex).push(cell);
    });

    // Sort columns by index and process them
    const sortedColumnIndices = Array.from(stickyColumnsByIndex.keys()).sort(
      (a, b) => a - b,
    );
    let cumulativeWidth = 0;

    sortedColumnIndices.forEach((columnIndex, stickyIndex) => {
      const cellsInColumn = stickyColumnsByIndex.get(columnIndex);
      const leftPosition = stickyIndex === 0 ? 0 : cumulativeWidth;

      // Set CSS variable on all sticky cells in this column
      cellsInColumn.forEach((cell) => {
        cell.style.setProperty(LEFT_CSS_VAR, `${leftPosition}px`);
      });

      // Also set CSS variable on corresponding <col> element if it exists
      const colgroup = element.querySelector(".navi_colgroup");
      if (colgroup) {
        const colElements = Array.from(colgroup.querySelectorAll(".navi_col"));
        const correspondingCol = colElements[columnIndex + 1];
        if (correspondingCol) {
          correspondingCol.style.setProperty(LEFT_CSS_VAR, `${leftPosition}px`);
        }
      }

      // Update cumulative width for next column using the first cell in this column as reference
      const referenceCell = cellsInColumn[0];
      if (stickyIndex === 0) {
        cumulativeWidth = referenceCell.getBoundingClientRect().width;
      } else {
        cumulativeWidth += referenceCell.getBoundingClientRect().width;
      }
    });
    container.style.setProperty(
      CONTAINER_LEFT_FRONTIER_CSS_VAR,
      `${cumulativeWidth}px`,
    );
    if (elementReceivingCumulativeStickyPosition) {
      elementReceivingCumulativeStickyPosition.style.setProperty(
        CONTAINER_LEFT_FRONTIER_CSS_VAR,
        `${cumulativeWidth}px`,
      );
    }
  };
  const updateTableRows = () => {
    // Handle sticky rows by finding cells with data-sticky-top and grouping by row
    const stickyCells = element.querySelectorAll(
      ".navi_table_cell[data-sticky-top]",
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
    const allRows = Array.from(element.querySelectorAll(".navi_tr"));
    const stickyRows = Array.from(rowsWithStickyCells.keys()).sort((a, b) => {
      const aIndex = allRows.indexOf(a);
      const bIndex = allRows.indexOf(b);
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
    container.style.setProperty(
      CONTAINER_TOP_FRONTIER_CSS_VAR,
      `${cumulativeHeight}px`,
    );
    if (elementReceivingCumulativeStickyPosition) {
      elementReceivingCumulativeStickyPosition.style.setProperty(
        CONTAINER_TOP_FRONTIER_CSS_VAR,
        `${cumulativeHeight}px`,
      );
    }
  };

  const updateLinearPositions = () => {
    // Handle linear container - detect direction from first sticky element
    const stickyElements = element.querySelectorAll(
      "[data-sticky-left], [data-sticky-top]",
    );
    if (stickyElements.length <= 1) return;

    const firstElement = stickyElements[0];
    const isHorizontal = firstElement.hasAttribute("data-sticky-left");
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
    const containerCssVariableName = isHorizontal
      ? CONTAINER_LEFT_FRONTIER_CSS_VAR
      : CONTAINER_TOP_FRONTIER_CSS_VAR;
    container.style.setProperty(
      containerCssVariableName,
      `${cumulativeSize}px`,
    );
    if (elementReceivingCumulativeStickyPosition) {
      elementReceivingCumulativeStickyPosition.style.setProperty(
        containerCssVariableName,
        `${cumulativeSize}px`,
      );
    }
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
          mutation.attributeName === "data-sticky-left" ||
          mutation.attributeName === "data-sticky-top"
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
    attributeFilter: ["data-sticky-left", "data-sticky-top"],
  });

  // Return cleanup function
  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  };
};
