import { getElementVisualCoords, getScrollableParent } from "@jsenv/dom";
import { createPortal, forwardRef } from "preact/compat";
import { useLayoutEffect } from "preact/hooks";

import { Z_INDEX_TABLE_UI } from "./z_indexes.js";

import.meta.css = /* css */ `
  .navi_table_ui {
    position: absolute;
    z-index: ${Z_INDEX_TABLE_UI};
    overflow: hidden; /* Ensure UI elements cannot impact scrollbars of the document  */
    left: var(--scroll-left);
    top: var(--scroll-top);
    width: 100%;
    height: 100%;
    pointer-events: none; /* UI elements must use pointer-events: auto if they need to be interactive */
    background: rgba(0, 255, 0, 0.2);
  }

  .navi_table_ui_container {
    position: absolute;
    left: var(--table-visual-left);
    top: var(--table-visual-top);
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
    // position the viewport
    const updateUIPosition = () => {
      const { scrollLeft, scrollTop } = scrollableParent;
      ui.style.setProperty("--scroll-left", `${scrollLeft}px`);
      ui.style.setProperty("--scroll-top", `${scrollTop}px`);
    };
    const uiContainer = ui.querySelector(".navi_table_ui_container");
    const updateUIContainerPosition = () => {
      // position the container on top of <table> inside this viewport
      const { scrollLeft, scrollTop } = scrollableParent;
      const [tableVisualLeft, tableVisualTop] = getElementVisualCoords(
        table,
        scrollableParent,
        { isStickyTop: true, isStickyLeft: true },
      );
      const visualLeft =
        scrollLeft < tableVisualLeft ? tableVisualLeft - scrollLeft : 0;
      const visualTop =
        scrollTop < tableVisualTop ? tableVisualTop - scrollTop : 0;
      const visualAvailableWidth = scrollableParent.clientWidth;
      const visualAvailableHeight = scrollableParent.clientHeight;
      const visualRemainingWidth = visualAvailableWidth - tableVisualLeft;
      const visualRemainingHeight = visualAvailableHeight - tableVisualTop;
      const { width, height } = table.getBoundingClientRect();
      const visibleWidth =
        width > visualRemainingWidth ? visualRemainingWidth : width;
      const visibleHeight =
        height > visualRemainingHeight ? visualRemainingHeight : height;
      uiContainer.style.setProperty("--table-visual-left", `${visualLeft}px`);
      uiContainer.style.setProperty(
        "--table-visual-width",
        `${visibleWidth}px`,
      );
      uiContainer.style.setProperty("--table-visual-top", `${visualTop}px`);
      uiContainer.style.setProperty(
        "--table-visual-height",
        `${visibleHeight}px`,
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

    // ensure we catch eventual "scroll" events cause by something else than drag gesture
    // TODO: external code should be able to call updateUIPosition
    // TODO: this code should re-exec when table scrollable parent changes
    const onScroll = () => {
      updateUIPosition();
      updateUIContainerPosition();
    };
    const scrollDispatcher =
      scrollableParent === document.documentElement
        ? document
        : scrollableParent;
    scrollDispatcher.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollDispatcher.removeEventListener("scroll", onScroll, {
        passive: true,
      });
    };
  }, []);

  return createPortal(
    <div ref={ref} className="navi_table_ui">
      <div className="navi_table_ui_container"></div>
    </div>,
    document.body,
  );
});
