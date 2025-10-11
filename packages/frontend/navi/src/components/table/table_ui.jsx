import { getElementVisualCoords, getScrollableParent } from "@jsenv/dom";
import { createPortal, forwardRef } from "preact/compat";
import { useLayoutEffect } from "preact/hooks";

import { Z_INDEX_TABLE_UI } from "./z_indexes.js";

import.meta.css = /* css */ `
  .navi_table_ui {
    position: fixed;
    z-index: ${Z_INDEX_TABLE_UI};
    overflow: hidden; /* Ensure UI elements cannot impact scrollbars of the document  */
    inset: 0;
    pointer-events: none; /* UI elements must use pointer-events: auto if they need to be interactive */
    background: rgba(0, 255, 0, 0.2);
  }

  .navi_table_ui_container {
    position: absolute;
    left: calc(var(--scrollable-parent-left) + var(--table-visual-left));
    top: calc(var(--scrollable-parent-top) + var(--table-visual-top));
    width: var(--table-visual-width);
    height: var(--table-visual-height);
    background: rgba(0, 0, 0, 0.7);
  }
`;

export const TableUI = forwardRef((props, ref) => {
  const { tableRef } = props;

  // ui positioning
  useLayoutEffect(() => {
    const ui = ref.current;
    const table = tableRef.current;
    if (!ui || !table) {
      return null;
    }

    const scrollableParent = getScrollableParent(table);

    // Position the UI container relative to its scrollable parent
    const updateUIPosition = () => {
      if (scrollableParent === document.documentElement) {
        // Document scrolling - container positions are relative to viewport
        ui.style.setProperty("--scrollable-parent-left", "0px");
        ui.style.setProperty("--scrollable-parent-top", "0px");
      } else {
        // Custom container scrolling - need to account for container's position in viewport
        const containerRect = scrollableParent.getBoundingClientRect();
        ui.style.setProperty(
          "--scrollable-parent-left",
          `${containerRect.left}px`,
        );
        ui.style.setProperty(
          "--scrollable-parent-top",
          `${containerRect.top}px`,
        );
      }
    };

    const uiContainer = ui.querySelector(".navi_table_ui_container");
    const updateUIContainerPosition = () => {
      // position the container on top of <table> inside this visible area
      const { scrollLeft, scrollTop } = scrollableParent;
      const [tableAbsoluteLeft, tableAbsoluteTop] = getElementVisualCoords(
        table,
        scrollableParent,
        { isStickyTop: true, isStickyLeft: true },
      );
      const tableRelativeLeft =
        scrollLeft < tableAbsoluteLeft ? tableAbsoluteLeft - scrollLeft : 0;
      const tableRelativeTop =
        scrollTop < tableAbsoluteTop ? tableAbsoluteTop - scrollTop : 0;
      const visibleAreaWidth = scrollableParent.clientWidth;
      const visibleAreaHeight = scrollableParent.clientHeight;
      const spaceRemainingFromTableLeft = visibleAreaWidth - tableRelativeLeft;
      const spaceRemainingFromTableTop = visibleAreaHeight - tableRelativeTop;
      const { width: tableFullWidth, height: tableFullHeight } =
        table.getBoundingClientRect();

      // Calculate visible width - need to check if visible area extends beyond table right edge
      let tableVisibleWidth = tableFullWidth;

      // First limit by remaining space from table left to visible area right
      if (tableVisibleWidth > spaceRemainingFromTableLeft) {
        tableVisibleWidth = spaceRemainingFromTableLeft;
      }

      // Check if visible area extends beyond table right edge
      const tableRightEdge = tableAbsoluteLeft + tableFullWidth;
      const visibleAreaLeft = scrollLeft;
      const visibleAreaRight = scrollLeft + visibleAreaWidth;

      if (visibleAreaRight > tableRightEdge) {
        // Visible area extends beyond table right edge
        // Calculate how much of the table is still visible from visible area left
        const tableVisibleFromLeft = tableRightEdge - visibleAreaLeft;
        if (tableVisibleFromLeft < tableVisibleWidth) {
          tableVisibleWidth =
            tableVisibleFromLeft > 0 ? tableVisibleFromLeft : 0;
        }
      }

      // Calculate visible height - need to check if visible area extends beyond table bottom
      let tableVisibleHeight = tableFullHeight;

      // First limit by remaining space from table top to visible area bottom
      if (tableVisibleHeight > spaceRemainingFromTableTop) {
        tableVisibleHeight = spaceRemainingFromTableTop;
      }

      // Check if visible area extends beyond table bottom
      const tableBottomEdge = tableAbsoluteTop + tableFullHeight;
      const visibleAreaTop = scrollTop;
      const visibleAreaBottom = scrollTop + visibleAreaHeight;

      if (visibleAreaBottom > tableBottomEdge) {
        // Visible area extends beyond table bottom
        // Calculate how much of the table is still visible from visible area top
        const tableVisibleFromTop = tableBottomEdge - visibleAreaTop;
        if (tableVisibleFromTop < tableVisibleHeight) {
          tableVisibleHeight =
            tableVisibleFromTop > 0 ? tableVisibleFromTop : 0;
        }
      }

      uiContainer.style.setProperty(
        "--table-visual-left",
        `${tableRelativeLeft}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-width",
        `${tableVisibleWidth}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-top",
        `${tableRelativeTop}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-height",
        `${tableVisibleHeight}px`,
      );
    };
    const updateUIContainerDimension = () => {
      const { width, height } = table.getBoundingClientRect();
      uiContainer.style.setProperty("--table-width", `${width}px`);
      uiContainer.style.setProperty("--table-height", `${height}px`);
    };

    updateUIPosition();
    updateUIContainerPosition();
    updateUIContainerDimension();

    // TODO: external code should be able to call updateUIPosition
    const onScroll = () => {
      updateUIPosition();
      updateUIContainerPosition();
    };
    scrollableParent.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollableParent.removeEventListener("scroll", onScroll, {
        passive: true,
      });
    };
  });

  return createPortal(
    <div ref={ref} className="navi_table_ui">
      <div className="navi_table_ui_container"></div>
    </div>,
    document.body,
  );
});

// redispatch "scroll" events from document to documentElement
// This way getScrollableParent(el).addEventListener("scroll")
// can be used even if scrollable parent is documentElement
document.addEventListener(
  "scroll",
  (scrollEvent) => {
    const scrollEventCopy = new scrollEvent.constructor(scrollEvent.type, {
      bubbles: false,
      cancelable: scrollEvent.cancelable,
      composed: scrollEvent.composed,
    });
    document.documentElement.dispatchEvent(scrollEventCopy);
  },
  { passive: true },
);
