// TODO: move this to @jsenv/dom (the initStickyGroup part, not the useLayoutEffect)

import { createPubSub, setStyles } from "@jsenv/dom";
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

const ITEM_LEFT_VAR = "--sticky-group-item-left";
const ITEM_TOP_VAR = "--sticky-group-item-top";
const FRONTIER_LEFT_VAR = "--sticky-group-left";
const FRONTIER_TOP_VAR = "--sticky-group-top";
// const FRONTIER_LEFT_VIEWPORT_VAR = "--sticky-group-left-viewport";
// const FRONTIER_TOP_VIEWPORT_VAR = "--sticky-group-top-viewport";

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

  const [teardown, addTeardown] = createPubSub();
  const [cleanup, addCleanup, clearCleanup] = createPubSub();
  addTeardown(cleanup);

  const element = elementSelector
    ? container.querySelector(elementSelector)
    : container;
  const isGrid =
    element.tagName === "TABLE" || element.classList.contains("navi_table");
  const updatePositions = () => {
    // Clear all previous CSS variable cleanups before setting new ones
    cleanup();
    clearCleanup();

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

      // Set CSS variable on all sticky cells in this column using setStyles for proper cleanup
      cellsInColumn.forEach((cell) => {
        const restoreStyles = setStyles(cell, {
          [ITEM_LEFT_VAR]: `${leftPosition}px`,
        });
        addCleanup(restoreStyles);
      });

      // Also set CSS variable on corresponding <col> element if it exists
      const colgroup = element.querySelector(".navi_colgroup");
      if (colgroup) {
        const colElements = Array.from(colgroup.querySelectorAll(".navi_col"));
        const correspondingCol = colElements[columnIndex];
        if (correspondingCol) {
          const restoreStyles = setStyles(correspondingCol, {
            [ITEM_LEFT_VAR]: `${leftPosition}px`,
          });
          addCleanup(restoreStyles);
        }
      }

      // Update cumulative width for next column using the first cell in this column as reference
      const referenceCell = cellsInColumn[0];
      const columnWidth = referenceCell.getBoundingClientRect().width;
      if (stickyIndex === 0) {
        cumulativeWidth = columnWidth;
      } else {
        cumulativeWidth += columnWidth;
      }
    });

    // Set frontier variables with proper cleanup tracking
    const restoreContainerStyles = setStyles(container, {
      [FRONTIER_LEFT_VAR]: `${cumulativeWidth}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [FRONTIER_LEFT_VAR]: `${cumulativeWidth}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
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

      // Set CSS variable on all sticky cells in this row using setStyles for proper cleanup
      rowCells.forEach((cell) => {
        const restoreStyles = setStyles(cell, {
          [ITEM_TOP_VAR]: `${topPosition}px`,
        });
        addCleanup(restoreStyles);
      });

      // Also set CSS variable on the <tr> element itself
      const restoreRowStyles = setStyles(row, {
        [ITEM_TOP_VAR]: `${topPosition}px`,
      });
      addCleanup(restoreRowStyles);

      // Update cumulative height for next row
      const rowHeight = row.getBoundingClientRect().height;
      if (index === 0) {
        cumulativeHeight = rowHeight;
      } else {
        cumulativeHeight += rowHeight;
      }
    });

    // Set frontier variables with proper cleanup tracking
    const restoreContainerStyles = setStyles(container, {
      [FRONTIER_TOP_VAR]: `${cumulativeHeight}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [FRONTIER_TOP_VAR]: `${cumulativeHeight}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
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
    const cssVariableName = isHorizontal ? ITEM_LEFT_VAR : ITEM_TOP_VAR;

    let cumulativeSize = 0;
    stickyElements.forEach((element, index) => {
      if (index === 0) {
        // First element stays at position 0
        const restoreStyles = setStyles(element, {
          [cssVariableName]: "0px",
        });
        addCleanup(restoreStyles);
        cumulativeSize = element.getBoundingClientRect()[dimensionProperty];
      } else {
        // Subsequent elements use cumulative positioning
        const position = cumulativeSize;
        const restoreStyles = setStyles(element, {
          [cssVariableName]: `${position}px`,
        });
        addCleanup(restoreStyles);
        cumulativeSize += element.getBoundingClientRect()[dimensionProperty];
      }
    });

    // Set frontier variables with proper cleanup tracking
    const frontierVar = isHorizontal ? FRONTIER_LEFT_VAR : FRONTIER_TOP_VAR;
    const restoreContainerStyles = setStyles(container, {
      [frontierVar]: `${cumulativeSize}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [frontierVar]: `${cumulativeSize}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
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
  addTeardown(() => {
    resizeObserver.disconnect();
  });

  mutationObserver.observe(element, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["data-sticky-left", "data-sticky-top"],
  });
  addTeardown(() => {
    mutationObserver.disconnect();
  });

  // Return cleanup function
  return () => {
    teardown();
  };
};

// const visualPositionEffect = (element, callback) => {
//   const updatePosition = () => {
//     const { left, top } = getVisualRect(element, document.body, {
//       isStickyLeft: false,
//       isStickyTop: false,
//     });
//     callback({ left, top });
//   };
//   updatePosition();

//   window.addEventListener("scroll", updatePosition, { passive: true });
//   window.addEventListener("resize", updatePosition);
//   window.addEventListener("touchmove", updatePosition);

//   return () => {
//     window.removeEventListener("scroll", updatePosition, {
//       passive: true,
//     });
//     window.removeEventListener("resize", updatePosition);
//     window.removeEventListener("touchmove", updatePosition);
//   };
// };
