import { Z_INDEX_DRAGGING_CELL_PLACEHOLDER } from "../z_indexes.js";

const DEBUG_VISUAL = false;

import.meta.css = /* css */ `
  .navi_table_cell[data-grabbed]::before,
  .navi_table_cell[data-grabbed]::after {
    box-shadow: none !important;
  }

  .navi_table_drag_clone_container {
    position: absolute;
    pointer-events: auto; /* Allow wheel events */
    /* background: rgba(0, 0, 0, 0.5); */
  }

  /* We preprend ".navi_table_container" to ensure it propertly overrides */
  .navi_table_container .navi_table_drag_clone_container .navi_table_cell {
    opacity: ${DEBUG_VISUAL ? 0.5 : 0};
  }
  .navi_table_container
    .navi_table_drag_clone_container
    .navi_table_cell[data-grabbed] {
    opacity: 1;
  }

  .navi_table_drag_clone_container .navi_table_cell_sticky_frontier {
    opacity: 0;
  }

  .navi_table_container
    .navi_table_drag_clone_container
    .navi_table_cell[data-sticky-left],
  .navi_table_container
    .navi_table_drag_clone_container
    .navi_table_cell[data-sticky-top] {
    position: relative;
  }

  .navi_table_cell_placeholder {
    position: absolute;
    inset: 0;
    background: lightgrey;
    z-index: ${Z_INDEX_DRAGGING_CELL_PLACEHOLDER};
  }
`;

export const TableDragCloneContainer = () => {
  return (
    <div
      className="navi_table_drag_clone_container"
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
  );
};
