import { useLayoutEffect } from "preact/hooks";

// React hook version for easy integration
export const useStickyGroup = (elementRef) => {
  useLayoutEffect(() => {
    if (!elementRef.current) return undefined;
    return initStickyGroup(elementRef.current);
  }, []);
};

/**
 * Creates a sticky group that manages positioning for multiple sticky elements
 * that need to be aware of each other's dimensions.
 * Always uses CSS variables for positioning.
 *
 * @param {HTMLElement} container The container element
 * @returns {Function} Cleanup function
 */
const initStickyGroup = (container) => {
  if (!container) {
    throw new Error("initStickyGroup: container is required");
  }

  const isGrid = container.tagName === "TABLE";

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
    const headerRow = container.querySelector("thead tr");
    if (!headerRow) return;

    const stickyColumns = Array.from(headerRow.children).filter((cell) =>
      cell.hasAttribute("data-sticky-x"),
    );

    // Only proceed if we have more than one sticky column
    if (stickyColumns.length <= 1) return;

    let cumulativeWidth = 0;

    stickyColumns.forEach((headerCell, index) => {
      const columnIndex = Array.from(headerRow.children).indexOf(headerCell);

      if (index === 0) {
        // First sticky column stays at left: 0, set CSS variable
        headerCell.style.setProperty("--cumulative-left", "0px");
        cumulativeWidth = headerCell.getBoundingClientRect().width;
      } else {
        // Subsequent columns use cumulative positioning
        const leftPosition = cumulativeWidth;

        // Set CSS variable on all cells in this column
        const columnCells = container.querySelectorAll(
          `th:nth-child(${columnIndex + 1})[data-sticky-x], td:nth-child(${columnIndex + 1})[data-sticky-x]`,
        );
        columnCells.forEach((cell) => {
          cell.style.setProperty("--cumulative-left", `${leftPosition}px`);
        });

        // Add this column's width to cumulative width for next column
        cumulativeWidth += headerCell.getBoundingClientRect().width;
      }
    });
  };

  const updateTableRows = () => {
    // Handle sticky rows (if any)
    const stickyRows = container.querySelectorAll("tr[data-sticky-y]");
    if (stickyRows.length <= 1) return;

    let cumulativeHeight = 0;

    stickyRows.forEach((row, index) => {
      if (index === 0) {
        // First sticky row stays at top: 0
        const rowCells = row.querySelectorAll(
          "th[data-sticky-y], td[data-sticky-y]",
        );
        rowCells.forEach((cell) => {
          cell.style.setProperty("--cumulative-top", "0px");
        });
        cumulativeHeight = row.getBoundingClientRect().height;
      } else {
        // Subsequent rows use cumulative positioning
        const topPosition = cumulativeHeight;
        const rowCells = row.querySelectorAll(
          "th[data-sticky-y], td[data-sticky-y]",
        );
        rowCells.forEach((cell) => {
          cell.style.setProperty("--cumulative-top", `${topPosition}px`);
        });
        cumulativeHeight += row.getBoundingClientRect().height;
      }
    });
  };

  const updateLinearPositions = () => {
    // Handle linear container - detect direction from first sticky element
    const stickyElements = container.querySelectorAll(
      "[data-sticky-x], [data-sticky-y]",
    );
    if (stickyElements.length <= 1) return;

    const firstElement = stickyElements[0];
    const isHorizontal = firstElement.hasAttribute("data-sticky-x");
    const dimensionProperty = isHorizontal ? "width" : "height";
    const cssVariableName = isHorizontal
      ? "--cumulative-left"
      : "--cumulative-top";

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
  resizeObserver.observe(container);
  mutationObserver.observe(container, {
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
