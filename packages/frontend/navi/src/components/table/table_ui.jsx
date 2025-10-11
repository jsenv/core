import { initOverlay } from "@jsenv/dom";
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
    /* background: rgba(0, 255, 0, 0.2); */
  }

  .navi_table_ui_container {
    position: absolute;
    left: var(--table-visual-left);
    top: var(--table-visual-top);
    width: var(--table-visual-width);
    height: var(--table-visual-height);
    /* background: rgba(0, 0, 0, 0.7); */
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

    const uiContainer = ui.querySelector(".navi_table_ui_container");
    // TODO: external code should be able to call overlay.update();
    const overlay = initOverlay(table, (visibleRect) => {
      uiContainer.style.setProperty(
        "--table-visual-left",
        `${visibleRect.left}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-width",
        `${visibleRect.width}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-top",
        `${visibleRect.top}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-height",
        `${visibleRect.height}px`,
      );
    });
    return overlay.destroy;
  });

  return createPortal(
    <div ref={ref} className="navi_table_ui">
      <div className="navi_table_ui_container"></div>
    </div>,
    document.body,
  );
});
