import { createDragToMoveGesture } from "@jsenv/dom";

import.meta.css = /* css */ `
  .navi_table {
    table-layout: fixed;
  }

  .navi_table_column_resize_handle_left,
  .navi_table_column_resize_handle_right {
    cursor: ew-resize;
    position: absolute;
    width: 8px;
    height: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 15px;
    /* background: orange; */
    /* opacity: 0.5; */
  }
  .navi_table_column_resize_handle_left {
    left: 0px;
  }
  .navi_table_column_resize_handle_right {
    right: 0px;
  }

  .navi_table_column_resizer {
    pointer-events: none;
    position: absolute;
    z-index: 1000000;
    top: 0;
    bottom: 0;
    width: 10px;
    left: var(--table-cell-right, 0);
    opacity: 0;
  }

  .navi_table_column_resizer .navi_table_column_resize_handle_left,
  .navi_table_column_resizer .navi_table_column_resize_handle_right {
    background: #444746;
    /* opacity: 0.5; */
    width: 5px;
    height: 26px;
    max-height: 80%;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle_left {
    left: 2px;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle_right {
    right: 2px;
  }

  .navi_table_column_resize_handle_container {
    position: absolute;
    top: 0;
    left: -10px;
    right: 0;
    height: var(--table-cell-height);
  }

  .navi_table_column_resizer_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    left: -3px;
    background: #c0c0c0;
    opacity: 0;
  }

  .navi_table_column_resizer[data-hover],
  .navi_table_column_resizer[data-resizing] {
    opacity: 1;
  }

  .navi_table_column_resizer[data-resizing] .navi_table_column_resizer_line {
    opacity: 1;
  }
`;

export const TableColumnLeftResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease,
}) => {
  return (
    <div
      className="navi_table_column_resize_handle_left"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation(); // prevent drag column
        initResizeTableColumnByMousedown(e, {
          columnMinWidth,
          columnMaxWidth,
          onGrab,
          onDrag,
          onRelease,
          isLeft: true,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterLeftResizeHandle(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveLeftResizeHandle(e);
      }}
    ></div>
  );
};
export const TableColumnRightResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease,
}) => {
  return (
    <div
      className="navi_table_column_resize_handle_right"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation(); // prevent drag column
        initResizeTableColumnByMousedown(e, {
          columnMinWidth,
          columnMaxWidth,
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterRightResizeHandle(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveRightResizeHandle(e);
      }}
    ></div>
  );
};
const onMouseEnterLeftResizeHandle = (e) => {
  const previousCell = e.target.closest("th").previousElementSibling;
  updateTableColumnResizerPosition(previousCell);
};
const onMouseEnterRightResizeHandle = (e) => {
  const cell = e.target.closest("th");
  updateTableColumnResizerPosition(cell);
};
const onMouseLeaveLeftResizeHandle = (e) => {
  const tableContainer = e.target.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  tableColumnResizer.removeAttribute("data-hover");
};
const onMouseLeaveRightResizeHandle = (e) => {
  const tableContainer = e.target.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  tableColumnResizer.removeAttribute("data-hover");
};

const updateTableColumnResizerPosition = (tableCell) => {
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const tableCellLeftRelative = tableCellRect.left - tableContainerRect.left;
  const tableCellHeight = tableCellRect.height;
  const tableCellWidth = tableCellRect.width;

  const tableCellRelativeRight = tableCellLeftRelative + tableCellWidth;
  tableColumnResizer.style.setProperty(
    "--table-cell-right",
    `${tableCellRelativeRight}px`,
  );
  tableColumnResizer.style.setProperty(
    "--table-cell-height",
    `${tableCellHeight}px`,
  );
  tableColumnResizer.setAttribute("data-hover", "");
};

export const TableColumnResizer = () => {
  return (
    <div className="navi_table_column_resizer">
      <div className="navi_table_column_resize_handle_container">
        <div className="navi_table_column_resize_handle_left" data-hover></div>
        <div className="navi_table_column_resize_handle_right" data-hover></div>
      </div>
      <div className="navi_table_column_resizer_line"></div>
    </div>
  );
};

// TODO:
// - a gauche column.minWidth si définie avec in min a 50 quoiqu'il (par rapport a la taille actuelle)
// donc si elle fait 200px on mettre un leftBound a cell.left - 150px
// - a droite column.maxWidth avec un max a 1000 quoi qu'il
// on a pas cette option pour le moment
// puisqu'on utilise que des obstacles
// aussi ici on va autorise a dépasser la traille du scrollable parent
// donc il faut une option pour forcer une right bound qui lorsque'elle est définié override le right bound du scrollable parent
const initResizeTableColumnByMousedown = (
  mousedownEvent,
  { columnMinWidth, columnMaxWidth, onGrab, onDrag, onRelease, isLeft },
) => {
  let tableCell = mousedownEvent.target.closest("th");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );

  // Calculate custom bounds for column resizing
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const currentCellLeft = tableCellRect.left - tableContainerRect.left;
  const currentCellWidth = tableCellRect.width;

  // Left bound: minimum width of 50px (can shrink column down to this width)
  const minWidth =
    typeof columnMinWidth === "number" && columnMinWidth > 50
      ? columnMinWidth
      : 50;
  // Right bound: maximum width of 1000px (can expand beyond scrollable parent if needed)
  const maxWidth =
    typeof columnMaxWidth === "number" && columnMaxWidth < 1000
      ? columnMaxWidth
      : 1000;
  const customLeftBound = currentCellLeft + minWidth;
  const maxExpandAmount = maxWidth - currentCellWidth;
  const customRightBound = currentCellLeft + currentCellWidth + maxExpandAmount;

  const dragToMoveGesture = createDragToMoveGesture({
    direction: { x: true },
    customLeftBound,
    customRightBound,
    onGrab: () => {
      updateTableColumnResizerPosition(tableCell);
      onGrab({ rowHeight: 0 });
    },
    onDrag,
    onRelease: (gesture) => {
      const newWidth = currentCellWidth + gesture.xMove;
      onRelease({
        width: newWidth,
        currentWidth: currentCellWidth,
      });
    },
  });
  dragToMoveGesture.addTeardown(() => {
    tableColumnResizer.style.left = "";
    tableColumnResizer.removeAttribute("data-resizing");
  });

  tableColumnResizer.setAttribute("data-resizing", "");
  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableColumnResizer,
  });
};
