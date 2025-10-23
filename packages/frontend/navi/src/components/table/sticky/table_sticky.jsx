// TODO: sticky left/top frontier should likely use "followPosition"
// to be properly position in absolute in the document body
// because otherwise they can't properly follow table as it scrolls
// (they can't be sticky, they can't react to scroll, so they have to be absolute in the document body)

import {
  createDragToMoveGestureController,
  getDropTargetInfo,
  getScrollContainer,
} from "@jsenv/dom";
import { useContext, useRef } from "preact/hooks";

import {
  Z_INDEX_STICKY_COLUMN,
  Z_INDEX_STICKY_CORNER,
  Z_INDEX_STICKY_FRONTIER_BACKDROP,
  Z_INDEX_STICKY_FRONTIER_GHOST,
  Z_INDEX_STICKY_FRONTIER_PREVIEW,
  Z_INDEX_STICKY_ROW,
} from "../z_indexes.js";
import { TableStickyContext } from "./table_sticky.js";

import.meta.css = /* css */ `
  body {
    --sticky-frontier-color: #c0c0c0;
    --sticky-frontier-size: 12px;
    --sticky-frontier-ghost-size: 8px;
  }

  .navi_table_cell[data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-item-top, 0);
    z-index: ${Z_INDEX_STICKY_ROW};
  }
  .navi_table_cell[data-sticky-left] {
    position: sticky;
    left: var(--sticky-group-item-left, 0);
    z-index: ${Z_INDEX_STICKY_COLUMN};
  }
  .navi_table_cell[data-sticky-left][data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-item-top, 0);
    left: var(--sticky-group-item-left, 0);
    z-index: ${Z_INDEX_STICKY_CORNER};
  }

  /* Useful because drag gesture will read this value to detect <col>, <tr> virtual position */
  .navi_col {
    left: var(--sticky-group-item-left, 0);
  }
  .navi_tr {
    top: var(--sticky-group-item-top, 0);
  }

  .navi_table_sticky_frontier {
    position: absolute;
    cursor: grab;
    pointer-events: auto;
  }

  .navi_table_sticky_frontier[data-left] {
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: var(--sticky-frontier-size);
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    height: calc(var(--table-visual-height) - var(--sticky-group-top));
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier[data-top] {
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: calc(var(--table-visual-width) - var(--sticky-group-left));
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    height: var(--sticky-frontier-size);
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier_ghost,
  .navi_table_sticky_frontier_preview {
    position: absolute;
    pointer-events: none;
    opacity: 0;
  }
  .navi_table_sticky_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
  }
  .navi_table_sticky_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: rgba(56, 121, 200, 0.5);
  }
  .navi_table_sticky_frontier_ghost[data-visible],
  .navi_table_sticky_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_sticky_frontier_ghost[data-left],
  .navi_table_sticky_frontier_preview[data-left] {
    top: 0;
    width: var(--sticky-frontier-ghost-size);
    height: var(--table-height, 100%);
  }
  .navi_table_sticky_frontier_ghost[data-left] {
    left: var(--sticky-frontier-ghost-position, 0px);
  }
  .navi_table_sticky_frontier_preview[data-left] {
    left: var(--sticky-frontier-preview-position, 0px);
  }

  .navi_table_sticky_frontier_ghost[data-top],
  .navi_table_sticky_frontier_preview[data-top] {
    left: 0;
    width: var(--table-width, 100%);
    height: var(--sticky-frontier-ghost-size);
  }

  .navi_table_sticky_frontier_ghost[data-top] {
    top: var(--sticky-frontier-ghost-position, 0px);
  }
  .navi_table_sticky_frontier_preview[data-top] {
    top: var(--sticky-frontier-preview-position, 0px);
  }

  /* Positioning adjustments for ::after pseudo-elements on cells adjacent to sticky frontiers */
  /* These ensure selection and focus borders align with the ::before borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier]::after {
    left: 0;
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-top-frontier]::after {
    top: 0;
  }

  /* Base borders for sticky cells (will be overridden by frontier rules) */
  .navi_table[data-border-collapse] .navi_table_cell[data-sticky-left]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] .navi_table_cell[data-sticky-top]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header row sticky cells need top border */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-sticky-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column sticky cells need left border */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-sticky-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-sticky-top]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column sticky cells get all four regular borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column][data-sticky-left]::before,
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column][data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Borders for cells immediately after sticky frontiers */

  /* Left border for the column after sticky-x-frontier */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-x-frontier also need top border (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Top border for the row after sticky-y-frontier */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-y-frontier also need left border (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells after sticky-y-frontier need all four borders (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Corner case: cell after both sticky frontiers */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }
`;

export const TableStickyFrontier = ({ tableRef }) => {
  const stickyLeftFrontierGhostRef = useRef();
  const stickyLeftFrontierPreviewRef = useRef();
  const stickyTopFrontierGhostRef = useRef();
  const stickyTopFrontierPreviewRef = useRef();

  return (
    <>
      <TableStickyLeftFrontier
        tableRef={tableRef}
        stickyLeftFrontierGhostRef={stickyLeftFrontierGhostRef}
        stickyLeftFrontierPreviewRef={stickyLeftFrontierPreviewRef}
      />
      <TableStickyTopFrontier
        tableRef={tableRef}
        stickyTopFrontierGhostRef={stickyTopFrontierGhostRef}
        stickyTopFrontierPreviewRef={stickyTopFrontierPreviewRef}
      />
      <div
        ref={stickyLeftFrontierGhostRef}
        className="navi_table_sticky_frontier_ghost"
        data-left=""
      ></div>
      <div
        ref={stickyLeftFrontierPreviewRef}
        className="navi_table_sticky_frontier_preview"
        data-left=""
      ></div>
      <div
        ref={stickyTopFrontierGhostRef}
        className="navi_table_sticky_frontier_ghost"
        data-top=""
      ></div>
      <div
        ref={stickyTopFrontierPreviewRef}
        className="navi_table_sticky_frontier_preview"
        data-top=""
      ></div>
    </>
  );
};

const TableStickyLeftFrontier = ({
  tableRef,
  stickyLeftFrontierGhostRef,
  stickyLeftFrontierPreviewRef,
}) => {
  const { stickyLeftFrontierColumnIndex, onStickyLeftFrontierChange } =
    useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyLeftFrontierChange);

  return (
    <div
      className="navi_table_sticky_frontier"
      data-left=""
      inert={!canMoveFrontier}
      onPointerDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column

        const table = tableRef.current;
        const stickyLeftFrontierGhost = stickyLeftFrontierGhostRef.current;
        const stickyLeftFrontierPreview = stickyLeftFrontierPreviewRef.current;
        const colgroup = table.querySelector("colgroup");
        const colElements = Array.from(colgroup.children);
        initMoveStickyFrontierViaPointer(e, {
          table,
          frontierGhost: stickyLeftFrontierGhost,
          frontierPreview: stickyLeftFrontierPreview,
          elements: colElements,
          frontierIndex: stickyLeftFrontierColumnIndex,
          axis: "x",
          onRelease: (_, index) => {
            if (index !== stickyLeftFrontierColumnIndex) {
              onStickyLeftFrontierChange(index);
            }
          },
        });
      }}
    ></div>
  );
};
const TableStickyTopFrontier = ({
  tableRef,
  stickyTopFrontierGhostRef,
  stickyTopFrontierPreviewRef,
}) => {
  const { stickyTopFrontierRowIndex, onStickyTopFrontierChange } =
    useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyTopFrontierChange);

  return (
    <div
      className="navi_table_sticky_frontier"
      data-top=""
      inert={!canMoveFrontier}
      onPointerDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column

        const table = tableRef.current;
        const rowElements = Array.from(table.querySelectorAll("tr"));
        initMoveStickyFrontierViaPointer(e, {
          table,
          frontierGhost: stickyTopFrontierGhostRef.current,
          frontierPreview: stickyTopFrontierPreviewRef.current,
          elements: rowElements,
          frontierIndex: stickyTopFrontierRowIndex,
          axis: "y",
          onRelease: (_, index) => {
            if (index !== stickyTopFrontierRowIndex) {
              onStickyTopFrontierChange(index);
            }
          },
        });
      }}
    ></div>
  );
};

// Generic function to handle sticky frontier movement for both axes
const initMoveStickyFrontierViaPointer = (
  pointerdownEvent,
  {
    table,
    frontierGhost,
    frontierPreview,
    frontierIndex,
    onGrab,
    onDrag,
    onRelease,
    // Axis-specific configuration
    axis, // 'x' or 'y'
    elements, // array of colElements or rowElements
  },
) => {
  // Get elements based on axis
  const gestureName =
    axis === "x" ? "move-sticky-left-frontier" : "move-sticky-top-frontier";
  const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
  const ghostVariableName = "--sticky-frontier-ghost-position";
  const previewVariableName = "--sticky-frontier-preview-position";
  const ghostElement = frontierGhost;
  const previewElement = frontierPreview;
  const scrollContainer = getScrollContainer(table);
  // Reset scroll to prevent starting drag in obstacle position
  scrollContainer[scrollProperty] = 0;

  // Setup table dimensions for ghost/preview
  const ghostOffsetParent = ghostElement.offsetParent;
  const ghostOffsetParentRect = ghostOffsetParent.getBoundingClientRect();

  const getPosition = (elementRect) => {
    if (axis === "x") {
      const elementLeftRelative = elementRect.left - ghostOffsetParentRect.left;
      return elementLeftRelative + elementRect.width;
    }
    const elementTopRelative = elementRect.top - ghostOffsetParentRect.top;
    return elementTopRelative + elementRect.height;
  };

  // Setup initial ghost position
  if (frontierIndex === -1) {
    ghostElement.style.setProperty(ghostVariableName, "0px");
  } else {
    const element = elements[frontierIndex];
    const elementRect = element.getBoundingClientRect();
    const position = getPosition(elementRect);
    ghostElement.style.setProperty(ghostVariableName, `${position}px`);
  }
  ghostElement.setAttribute("data-visible", "");

  let futureFrontierIndex = frontierIndex;
  const onFutureFrontierIndexChange = (index) => {
    futureFrontierIndex = index;

    // We maintain a visible preview of the frontier
    // to tell user "hey if you grab here, the frontier will be there"
    // At this stage user can see 3 frontiers. Where it is, the one he grab, the future one if he releases.
    if (index === frontierIndex) {
      previewElement.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      previewPosition = 0;
    } else {
      const element = elements[index];
      const elementRect = element.getBoundingClientRect();
      previewPosition = getPosition(elementRect);
    }
    previewElement.style.setProperty(
      previewVariableName,
      `${previewPosition}px`,
    );
    previewElement.setAttribute("data-visible", "");
  };

  const moveFrontierGestureController = createDragToMoveGestureController({
    name: gestureName,
    direction: { [axis]: true },
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,
    areaConstraint: "visible",
    areaConstraintElement: table.closest(".navi_table_root"),

    onGrab,
    onDrag: (gestureInfo) => {
      const dropTargetInfo = getDropTargetInfo(gestureInfo, elements);
      if (dropTargetInfo) {
        const dropColumnIndex = dropTargetInfo.index;
        const dropFrontierIndex =
          dropTargetInfo.elementSide[axis] === "start"
            ? dropColumnIndex - 1
            : dropColumnIndex;
        if (dropFrontierIndex !== futureFrontierIndex) {
          onFutureFrontierIndexChange(dropFrontierIndex);
        }
      }
      onDrag?.(gestureInfo, futureFrontierIndex);
    },
    onRelease: (gesture) => {
      previewElement.removeAttribute("data-visible");
      previewElement.style.removeProperty(previewVariableName);
      ghostElement.removeAttribute("data-visible");
      ghostElement.style.removeProperty(ghostVariableName);
      ghostElement.style[axis === "x" ? "left" : "top"] = ""; // reset position set by drag

      onRelease?.(gesture, futureFrontierIndex);
    },
  });
  moveFrontierGestureController.grabViaPointer(pointerdownEvent, {
    element: ghostElement,
  });
};
