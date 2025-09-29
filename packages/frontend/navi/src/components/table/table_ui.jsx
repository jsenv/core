import { useLayoutEffect, useRef } from "preact/hooks";

import { TableDragCloneContainer } from "./drag/table_drag_clone_container.jsx";
import { TableColumnResizer, TableRowResizer } from "./resize/table_resize.jsx";
import { TableStickyFrontier } from "./sticky/table_sticky.jsx";
import { Z_INDEX_TABLE_UI_CONTAINER } from "./z_indexes.js";

/**
 * The native <table> element does not support adding other elements inside of it
 * that are not <tr>, <td>, <th>, etc.
 *
 * To be able to display things on top of the <table> we use the following structure:
 *
 * <div class="navi_table_container">
 *   <table></table>
 *   <div class="navi_table_ui_container">
 *     <!-- UI elements go here -->
 *   </div>
 * </div>
 *
 * .navi_table_ui_container follow the <table> dimensions so that elements within can take the full
 * table dimensions.
 *
 * Also .navi_table_ui_container has overflow: hidden so that elements within cannot increase the eventual scrollbars
 * cause by <table>
 * - This is useful mostly for the drag clone that otherwise would increase the .navi_table_container overall width
 * - And also for row resizer that can be too big as we don't update then while scrolling
 *
 */

import.meta.css = /* css */ `
  .navi_table_ui {
    position: absolute;
    z-index: ${Z_INDEX_TABLE_UI_CONTAINER};
    user-select: none;
    overflow: hidden;
    left: 0;
    top: 0;
    width: var(--table-width, 0);
    height: var(--table-height, 0);
    pointer-events: none;
  }
`;

export const TableUI = ({ grabTarget }) => {
  const ref = useRef();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return null;
    }
    const table = element
      .closest(".navi_table_container")
      .querySelector("table");
    const updateScrollDimensions = () => {
      const { width, height } = table.getBoundingClientRect();
      element.style.setProperty("--table-width", `${width}px`);
      element.style.setProperty("--table-height", `${height}px`);
    };

    updateScrollDimensions();
    const resizeObserver = new ResizeObserver(updateScrollDimensions);
    resizeObserver.observe(table);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="navi_table_ui">
      <TableDragCloneContainer dragging={Boolean(grabTarget)} />
      <TableColumnResizer />
      <TableRowResizer />
      <TableStickyFrontier />
    </div>
  );
};
