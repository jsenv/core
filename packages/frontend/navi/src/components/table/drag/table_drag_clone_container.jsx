import { useLayoutEffect, useRef } from "preact/compat";
import { Z_INDEX_DRAGGING_CLONE } from "../z_indexes.js";

import.meta.css = /* css */ `
  .navi_table th[data-grabbed],
  .navi_table td[data-grabbed] {
    opacity: 0;
  }

  .navi_table_drag_clone_container {
    position: absolute;
    z-index: ${Z_INDEX_DRAGGING_CLONE};
    cursor: grabbing;
    user-select: none;
    overflow: hidden;
    left: 0;
    top: 0;
    pointer-events: none;
  }

  .navi_table_drag_clone_positioner {
    position: absolute;
    pointer-events: auto; /* Allow wheel events */
    /* background: rgba(0, 0, 0, 0.5); */
  }

  /* We preprend ".navi_table_container" to ensure it propertly overrides */
  .navi_table_container .navi_table_drag_clone_container th,
  .navi_table_container .navi_table_drag_clone_container td {
    opacity: 0;
  }
  .navi_table_container .navi_table_drag_clone_container th[data-grabbed],
  .navi_table_container .navi_table_drag_clone_container td[data-grabbed] {
    opacity: 1;
  }

  .navi_table_container .navi_table_drag_clone_container th[data-sticky-y],
  .navi_table_container .navi_table_drag_clone_container td[data-sticky-y] {
    position: relative;
  }
  .navi_table_container .navi_table_drag_clone_container th[data-sticky-x],
  .navi_table_container .navi_table_drag_clone_container td[data-sticky-x] {
    position: relative;
  }
  .navi_table_container
    .navi_table_drag_clone_container
    th[data-sticky-x][data-sticky-y],
  .navi_table_container
    .navi_table_drag_clone_container
    td[data-sticky-x][data-sticky-y] {
    position: relative;
  }
`;

export const TableDragCloneContainer = ({ dragging }) => {
  const cloneParentElementRef = useRef();

  useLayoutEffect(() => {
    const cloneParentElement = cloneParentElementRef.current;
    if (!cloneParentElement) {
      return;
    }
    const cloneContainer = cloneParentElement.closest(
      ".navi_table_drag_clone_container",
    );
    const tableContainer = cloneParentElement.closest(".navi_table_container");
    cloneContainer.style.width = `${tableContainer.scrollWidth}px`;
    cloneContainer.style.height = `${tableContainer.scrollHeight}px`;
  }, [dragging]);

  return (
    <div
      className="navi_table_drag_clone_container"
      style={{
        display: dragging ? "block" : "none",
      }}
    >
      <div
        ref={cloneParentElementRef}
        className="navi_table_drag_clone_positioner"
        onWheel={(e) => {
          if (e.deltaY) {
            // the dragged column is not really sticky so we prevent vertical scroll while dragging
            // otherwise it would look weird if user scrolls using the wheel
            e.preventDefault();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // the dragged column is not really sticky so we prevent vertical scroll while dragging
            // otherwise it would look weird if user scrolls using arrow keys
            e.preventDefault();
          }
          if (e.key === " ") {
            e.preventDefault();
          }
        }}
      >
        {/* to catch any mouse over effect and stuff like that */}
        {/* <div style={{ position: "absolute", inset: 0 }}></div> */}
      </div>
    </div>
  );
};
