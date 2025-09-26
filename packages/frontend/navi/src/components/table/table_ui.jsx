import { useLayoutEffect, useRef } from "preact/hooks";

import { TableDragCloneContainer } from "./drag/table_drag_clone_container.jsx";
import { TableColumnResizer, TableRowResizer } from "./resize/table_resize.jsx";
import { TableStickyFrontier } from "./sticky/table_sticky.jsx";

export const TableUIContainer = ({ grabTarget }) => {
  const ref = useRef();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return null;
    }
    const tableContainer = element.closest(".navi_table_container");
    const updateScrollDimensions = () => {
      element.style.setProperty(
        "--table-scroll-width",
        `${tableContainer.scrollWidth}px`,
      );
      element.style.setProperty(
        "--table-scroll-height",
        `${tableContainer.scrollHeight}px`,
      );
    };

    updateScrollDimensions();
    const resizeObserver = new ResizeObserver(updateScrollDimensions);
    resizeObserver.observe(tableContainer);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="navi_table_ui_container">
      <TableDragCloneContainer dragging={Boolean(grabTarget)} />
      <TableColumnResizer />
      <TableRowResizer />
      <TableStickyFrontier />
    </div>
  );
};
