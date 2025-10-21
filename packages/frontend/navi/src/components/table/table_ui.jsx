import { visibleRectEffect } from "@jsenv/dom";
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
`;

export const TableUI = forwardRef((props, ref) => {
  const { tableRef, tableId, children } = props;

  // ui positioning
  useLayoutEffect(() => {
    const ui = ref.current;
    const table = tableRef.current;
    if (!ui || !table) {
      return null;
    }

    // TODO: external code should be able to call tableVisibleRectEffect.check();
    // (for the drag operation when we scroll)
    // -> actually not that important because browser will dispatch "scroll" events
    // cause by programmatic scrolls before re-painting
    // -> no intermediate state visible to the user where overlay is not in sync
    const tableVisibleRectEffect = visibleRectEffect(table, (visibleRect) => {
      ui.style.setProperty("--table-visual-left", `${visibleRect.left}px`);
      ui.style.setProperty("--table-visual-width", `${visibleRect.width}px`);
      ui.style.setProperty("--table-visual-top", `${visibleRect.top}px`);
      ui.style.setProperty("--table-visual-height", `${visibleRect.height}px`);
    });
    return tableVisibleRectEffect.disconnect;
  });

  return createPortal(
    <div ref={ref} className="navi_table_ui" data-overlay-for={tableId}>
      {children}
    </div>,
    document.body,
  );
});
