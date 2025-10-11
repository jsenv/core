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
  }

  .navi_table_ui_container {
    position: absolute;
    left: var(--table-left);
    top: var(--table-top);
    width: var(--table-width);
    height: var(--table-height);
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
    // ensure we catch eventual "scroll" events cause by something else than drag gesture
    // TODO: external code should be able to call updateUIPosition
    // TODO: this code should re-exec when table scrollable parent changes
    const onScroll = () => {
      updateUIPosition();
    };
    scrollableParent.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollableParent.removeEventListener("scroll", onScroll, {
        passive: true,
      });
    };
  }, []);

  // ui container positioning and dimensioning
  useLayoutEffect(() => {
    const ui = ref.current;
    const table = tableRef.current;
    if (!ui || !table) {
      return;
    }

    const uiContainer = ui.querySelector(".navi_table_ui_container");
    const updateUIContainerPosition = () => {
      const scrollableParent = getScrollableParent(table);
      // position the container on top of <table> inside this viewport
      const { scrollLeft, scrollTop } = scrollableParent;
      const [
        tableVisualLeftRelativeToScrollableParent,
        tableVisualTopRelativeToScrollableParent,
      ] = getElementVisualCoords(table, scrollableParent);
      const cloneViewportLeft =
        scrollLeft < tableVisualLeftRelativeToScrollableParent
          ? tableVisualLeftRelativeToScrollableParent - scrollLeft
          : 0;
      const cloneViewportTop =
        scrollTop < tableVisualTopRelativeToScrollableParent
          ? tableVisualTopRelativeToScrollableParent - scrollTop
          : 0;
      uiContainer.style.setProperty("--table-left", `${cloneViewportLeft}px`);
      uiContainer.style.setProperty("--table-top", `${cloneViewportTop}px`);
    };

    const updateUIContainerDimension = () => {
      const { width, height } = table.getBoundingClientRect();
      uiContainer.style.setProperty("--table-width", `${width}px`);
      uiContainer.style.setProperty("--table-height", `${height}px`);
    };

    updateUIContainerPosition();
    updateUIContainerDimension();
  }, []);

  return createPortal(
    <div ref={ref} className="navi_table_ui">
      <div className="navi_table_ui_container"></div>
    </div>,
    document.body,
  );
});
