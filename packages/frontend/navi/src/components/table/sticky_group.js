import { useLayoutEffect } from "preact/hooks";

// Update sticky column positions dynamically
export const useStickyGroup = (elementRef) => {
  useLayoutEffect(() => {
    if (!elementRef.current) return null;
    return initStickyGroup(elementRef.current);
  }, []);
};

const initStickyGroup = (table) => {
  const updateStickyColumnPositions = () => {
    // Find all sticky columns by checking the first row
    const headerRow = table.querySelector("thead tr");
    if (!headerRow) {
      return;
    }

    const stickyColumns = Array.from(headerRow.children).filter((cell) =>
      cell.hasAttribute("data-sticky-x"),
    );

    // Only proceed if we have more than one sticky column
    if (stickyColumns.length <= 1) return;

    // Calculate cumulative widths for positioning
    let cumulativeWidth = 0;

    stickyColumns.forEach((headerCell, index) => {
      const columnIndex = Array.from(headerRow.children).indexOf(headerCell);

      if (index === 0) {
        // First sticky column stays at left: 0, but we measure its width
        cumulativeWidth = headerCell.getBoundingClientRect().width;
      } else {
        // All subsequent sticky columns use inline styles
        const leftPosition = cumulativeWidth;

        // Apply to all cells in this column (both header and data cells)
        const columnCells = table.querySelectorAll(
          `th:nth-child(${columnIndex + 1})[data-sticky-x], td:nth-child(${columnIndex + 1})[data-sticky-x]`,
        );
        columnCells.forEach((cell) => {
          cell.style.left = `${leftPosition}px`;
        });

        // Add this column's width to cumulative width for next column
        cumulativeWidth += headerCell.getBoundingClientRect().width;
      }
    });
  };

  // Initial calculation
  updateStickyColumnPositions();

  // Set up ResizeObserver to handle size changes
  const resizeObserver = new ResizeObserver(() => {
    updateStickyColumnPositions();
  });

  // Set up MutationObserver to handle DOM changes
  const mutationObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    mutations.forEach((mutation) => {
      // Check if sticky attributes or structure changed
      if (
        mutation.type === "attributes" &&
        (mutation.attributeName === "data-sticky-x" ||
          mutation.attributeName === "data-sticky-y")
      ) {
        shouldUpdate = true;
      }
      if (mutation.type === "childList") {
        shouldUpdate = true;
      }
    });
    if (shouldUpdate) {
      updateStickyColumnPositions();
    }
  });

  // Observe the table for changes
  resizeObserver.observe(table);
  mutationObserver.observe(table, {
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
