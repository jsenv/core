import {
  createDragToMoveGestureController,
  createMouseDragThresholdPromise,
  createPubSub,
  getDropTargetInfo,
  getElementVisualCoords,
  getScrollContainer,
  getScrollRelativeRect,
  scrollableCoordsToViewport,
  stickyAsRelativeCoords,
} from "@jsenv/dom";
import { createContext } from "preact";
import { useMemo, useState } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";
import { Z_INDEX_CELL_FOREGROUND, Z_INDEX_DROP_PREVIEW } from "../z_indexes.js";

const DEBUG_VISUAL = false;

import.meta.css = /* css */ `
  .navi_table_drag_clone_viewport {
    position: absolute;
    overflow: hidden;
    left: var(--scroll-left);
    top: var(--scroll-top);
    width: 100%;
    height: 100%;
  }

  .navi_table_drag_clone_container {
    position: absolute;
    pointer-events: auto; /* Allow wheel events */
    /* background: rgba(0, 0, 0, 0.5); */
    left: var(--table-left);
    top: var(--table-top);
    width: var(--table-width);
    height: var(--table-height);
  }

  .navi_table_cell[data-grabbed]::before,
  .navi_table_cell[data-grabbed]::after {
    box-shadow: none !important;
  }

  /* We preprend ".navi_table_container" to ensure it propertly overrides */
  .navi_table_drag_clone_container .navi_table_cell {
    opacity: ${DEBUG_VISUAL ? 0.5 : 0};
  }

  .navi_table_drag_clone_container .navi_table_cell[data-grabbed] {
    opacity: 0.7;
  }

  .navi_table_drag_clone_container .navi_table_cell_sticky_frontier {
    opacity: 0;
  }

  .navi_table_drag_clone_container .navi_table_cell[data-sticky-left],
  .navi_table_drag_clone_container .navi_table_cell[data-sticky-top] {
    position: relative;
  }

  .navi_table_cell_foreground {
    pointer-events: none;
    position: absolute;
    inset: 0;
    background: lightgrey;
    opacity: 0;
    z-index: ${Z_INDEX_CELL_FOREGROUND};
  }
  .navi_table_cell[data-first-row] .navi_table_cell_foreground {
    background-color: grey;
  }
  .navi_table_cell_foreground[data-visible] {
    opacity: 1;
  }

  .navi_table_drag_clone_container .navi_table_cell_foreground {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
  }
  .navi_table_drag_clone_container
    .navi_table_cell[data-first-row][data-grabbed] {
    opacity: 1;
  }
  .navi_table_drag_clone_container
    .navi_table_cell[data-first-row]
    .navi_table_cell_foreground {
    opacity: 0;
  }

  .navi_table_column_drop_preview {
    position: absolute;
    left: var(--column-left);
    top: var(--column-top);
    width: var(--column-width);
    height: var(--column-height);
    pointer-events: none;
    z-index: ${Z_INDEX_DROP_PREVIEW};
    /* Invisible container - just for positioning */
    background: transparent;
    border: none;
  }

  .navi_table_column_drop_preview_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(0, 0, 255, 0.5);
    opacity: 0;
    left: 0; /* Default: left edge for dropping before */
    transform: translateX(-50%);
  }
  .navi_table_column_drop_preview[data-after]
    .navi_table_column_drop_preview_line {
    left: 100%; /* Right edge for dropping after */
  }
  .navi_table_column_drop_preview[data-visible]
    .navi_table_column_drop_preview_line {
    opacity: 1;
  }

  .navi_table_column_drop_preview .arrow_positioner {
    position: absolute;
    left: 0; /* Default: left edge for dropping before */
    display: flex;
    opacity: 0;
    transform: translateX(-50%);
    color: rgba(0, 0, 255, 0.5);
  }
  .navi_table_column_drop_preview[data-after] .arrow_positioner {
    left: 100%; /* Right edge for dropping after */
  }
  .navi_table_column_drop_preview[data-visible] .arrow_positioner {
    opacity: 1;
  }
  .navi_table_column_drop_preview .arrow_positioner[data-top] {
    top: -10px;
  }
  .navi_table_column_drop_preview .arrow_positioner[data-bottom] {
    bottom: -10px;
  }
  .arrow_positioner svg {
    width: 10px;
    height: 10px;
  }
`;

export const TableDragContext = createContext();
export const useTableDragContextValue = ({
  columns,
  setColumnOrder,
  canChangeColumnOrder,
}) => {
  setColumnOrder = useStableCallback(setColumnOrder);

  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = (columnIndex, newColumnIndex) => {
    setGrabTarget(null);
    if (columnIndex === newColumnIndex) {
      return;
    }
    const columnIds = columns.map((col) => col.id);
    const columnIdsWithNewOrder = moveItem(
      columnIds,
      columnIndex,
      newColumnIndex,
    );
    setColumnOrder(columnIdsWithNewOrder);
  };

  return useMemo(() => {
    return {
      grabTarget,
      grabColumn,
      releaseColumn,
      setColumnOrder,
      canChangeColumnOrder,
    };
  }, [grabTarget, canChangeColumnOrder]);
};
const moveItem = (array, indexA, indexB) => {
  const newArray = [];
  const movedItem = array[indexA];
  const movingRight = indexA < indexB;

  for (let i = 0; i < array.length; i++) {
    if (movingRight) {
      // Moving right: add target first, then moved item after
      if (i !== indexA) {
        newArray.push(array[i]);
      }
      if (i === indexB) {
        newArray.push(movedItem);
      }
    } else {
      // Moving left: add moved item first, then target after
      if (i === indexB) {
        newArray.push(movedItem);
      }
      if (i !== indexA) {
        newArray.push(array[i]);
      }
    }
  }
  return newArray;
};
export const swapItem = (array, indexA, indexB) => {
  const newArray = [];
  const itemAtPositionA = array[indexA];
  const itemAtPositionB = array[indexB];
  for (let i = 0; i < array.length; i++) {
    if (i === indexB) {
      // At the new position, put the dragged column
      newArray.push(itemAtPositionA);
      continue;
    }
    if (i === indexA) {
      // At the old position, put what was at the new position
      newArray.push(itemAtPositionB);
      continue;
    }
    // Everything else stays the same
    newArray.push(array[i]);
  }
  return newArray;
};

const dropPreviewTemplate = /* html */ `
  <div
    class="navi_table_column_drop_preview"
  >
    <div class="arrow_positioner" data-top="">
      <!-- this is an arrow pointing down -->
      <svg fill="currentColor" viewBox="0 0 30.727 30.727" xml:space="preserve">
        <path
          d="M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0
		l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        />
      </svg>
    </div>
    <div class="navi_table_column_drop_preview_line"></div>
    <div class="arrow_positioner" data-bottom="">
      <!-- this is an arrow pointing up -->
      <svg fill="currentColor" viewBox="0 0 30.727 30.727" xml:space="preserve">
        <path
          d="M29.994,20.544L15.363,5.915L0.733,20.543c-0.977,0.978-0.977,2.561,0,3.536c0.977,0.977,2.559,0.976,3.536,0
		l11.095-11.093L26.461,24.08c0.977,0.976,2.559,0.976,3.535,0C30.971,23.103,30.971,21.521,29.994,20.544z"
        />
      </svg>
    </div>
  </div>
`;
const createDropPreview = () => {
  const dropPreview = document.createElement("div");
  dropPreview.innerHTML = dropPreviewTemplate;
  return dropPreview.firstElementChild;
};

export const initDragTableColumnByMousedown = async (
  mousedownEvent,
  { onGrab, onDrag, onRelease },
) => {
  const significantDragGestureInfo =
    await createMouseDragThresholdPromise(mousedownEvent);
  if (significantDragGestureInfo.status === "released") {
    return;
  }

  const [teardown, addTeardown] = createPubSub();
  const [triggerDrag, addDragEffect] = createPubSub();

  const tableCell = mousedownEvent.target.closest(".navi_table_cell");
  const table = tableCell.closest(".navi_table");
  const columnIndex = Array.from(tableCell.parentNode.children).indexOf(
    tableCell,
  );

  // Track the drop target column index (starts as current column)
  let dropColumnIndex = columnIndex;

  const tableClone = table.cloneNode(true);
  // ensure [data-drag-obstacle] inside the table clone are ignored
  tableClone.setAttribute("data-drag-ignore", "");

  const scrollContainer = getScrollContainer(table);

  // We'll create our own clone container in append_in_dom section
  let cloneParent; // Will be set when we create the drag clone container

  // Scale down the table clone and set transform origin to mouse grab point
  // const tableRect = table.getBoundingClientRect();
  // const mouseX = mousedownEvent.clientX - tableRect.left;
  // const mouseY = mousedownEvent.clientY - tableRect.top;
  // tableClone.style.transform = "scale(1.2)";
  // tableClone.style.transformOrigin = `${mouseX}px ${mouseY}px`;

  update_sticky_elements: {
    // In the table clone we need to convert sticky elements to position: relative
    // with calculated offsets that match their appearance in the original context
    const scrollContainer = getScrollContainer(table);

    // important: only on cells, not on <col> nor <tr>
    const originalStickyCells = table.querySelectorAll(
      ".navi_table_cell[data-sticky-left], .navi_table_cell[data-sticky-top]",
    );
    const cloneStickyCells = tableClone.querySelectorAll(
      ".navi_table_cell[data-sticky-left], .navi_table_cell[data-sticky-top]",
    );

    originalStickyCells.forEach((originalCell, index) => {
      const cloneCell = cloneStickyCells[index];
      const relativePosition = stickyAsRelativeCoords(
        originalCell,
        // Our clone is absolutely positioned on top of <table />
        // So we need the sticky position relative to <table />
        table,
        {
          scrollContainer,
        },
      );
      if (relativePosition) {
        const [relativeLeft, relativeTop] = relativePosition;
        cloneCell.style.position = "relative";
        if (relativeLeft !== undefined) {
          cloneCell.style.left = `${relativeLeft}px`;
        }
        if (relativeTop !== undefined) {
          cloneCell.style.top = `${relativeTop}px`;
        }
      }
    });
  }

  sync_data_grabbed: {
    // ensure [data-grabbed] are present in the table clone
    // we could retry on "sync_attributes" but we want to be sure it's done asap to prevent table from being displayed at all
    // I fear without this we might have an intermediate step where the table column clone is not visible
    // as [data-grabbed] are not set
    // Would not be a problem but this ensure we see exactly the table clone right away preventing any possibility
    // of visual glitches
    const tableCloneCells = tableClone.querySelectorAll(".navi_table_cell");
    tableCloneCells.forEach((cellClone) => {
      const cellColumnIndex = Array.from(cellClone.parentNode.children).indexOf(
        cellClone,
      );
      if (cellColumnIndex === columnIndex) {
        cellClone.setAttribute("data-grabbed", "");
      }
    });
  }

  append_in_dom: {
    // Position the container exactly on the <table>
    // but within document to allow overflow
    // but within a viewport preventing any impact on the scrollable parent

    const dragCloneHtml = /* html */ `
      <div
        class="navi_table_drag_clone_viewport"
      >
        <div class="navi_table_drag_clone_container"></div>
      </div>`;
    const div = document.createElement("div");
    div.innerHTML = dragCloneHtml;
    const dragCloneViewport = div.querySelector(
      ".navi_table_drag_clone_viewport",
    );
    const dragCloneContainer = dragCloneViewport.querySelector(
      ".navi_table_drag_clone_container",
    );

    viewport_positioning: {
      // position the viewport
      const updateViewportPosition = () => {
        const { scrollLeft, scrollTop } = scrollContainer;
        dragCloneViewport.style.setProperty("--scroll-left", `${scrollLeft}px`);
        dragCloneViewport.style.setProperty("--scroll-top", `${scrollTop}px`);
      };
      addDragEffect(() => {
        updateViewportPosition();
      });
      // ensure we catch eventual "scroll" events cause by something else than drag gesture
      const onScroll = () => {
        updateViewportPosition();
      };
      scrollContainer.addEventListener("scroll", onScroll, { passive: true });
      addTeardown(() => {
        scrollContainer.removeEventListener("scroll", onScroll, {
          passive: true,
        });
      });
    }

    container_position_and_dimension: {
      // position the container on top of <table> inside this viewport
      const { scrollLeft, scrollTop } = scrollContainer;
      const [
        tableVisualLeftRelativeToScrollContainer,
        tableVisualTopRelativeToScrollContainer,
      ] = getElementVisualCoords(table, scrollContainer);
      const cloneViewportLeft =
        scrollLeft < tableVisualLeftRelativeToScrollContainer
          ? tableVisualLeftRelativeToScrollContainer - scrollLeft
          : 0;
      const cloneViewportTop =
        scrollTop < tableVisualTopRelativeToScrollContainer
          ? tableVisualTopRelativeToScrollContainer - scrollTop
          : 0;
      dragCloneContainer.style.setProperty(
        "--table-left",
        `${cloneViewportLeft}px`,
      );
      dragCloneContainer.style.setProperty(
        "--table-top",
        `${cloneViewportTop}px`,
      );

      const { width, height } = table.getBoundingClientRect();
      dragCloneContainer.style.setProperty("--table-width", `${width}px`);
      dragCloneContainer.style.setProperty("--table-height", `${height}px`);
    }

    dragCloneContainer.appendChild(tableClone);
    document.body.appendChild(dragCloneViewport);
    cloneParent = dragCloneContainer;
    addTeardown(() => {
      dragCloneViewport.remove();
    });
  }

  sync_attributes: {
    // Sync attribute changes from original table to clone
    // This is used to:
    // - handle table cells being selected as result of mousedown on the <th />
    // - nothing else is supposed to change in the original <table /> during the drag gesture
    const syncTableAttributes = createTableAttributeSync(table, tableClone);
    addTeardown(() => {
      syncTableAttributes.disconnect();
    });
  }

  // const tableRoot = table.closest(".navi_table_root");
  const colgroup = table.querySelector(".navi_colgroup");
  const colElements = Array.from(colgroup.children);
  const col = colElements[columnIndex];
  const colgroupClone = tableClone.querySelector(".navi_colgroup");
  const colClone = colgroupClone.children[columnIndex];
  const dropPreview = createDropPreview();

  drop_preview: {
    const dropCandidateElements = colElements.filter(
      (col) =>
        !(col.getAttribute("data-drag-obstacle") || "").includes("move-column"),
    );

    // Get all column elements for drop target detection
    const updateDropTarget = (dropTargetInfo) => {
      const targetColumn = dropTargetInfo.element;
      const targetColumnIndex = colElements.indexOf(targetColumn);

      dropColumnIndex = targetColumnIndex;
      if (dropColumnIndex === columnIndex) {
        dropPreview.removeAttribute("data-visible");
        return;
      }

      const targetColumnRect = getScrollRelativeRect(
        targetColumn,
        scrollContainer,
      );

      // Convert column position to viewport coordinates, then to document coordinates
      const [columnViewportLeft, columnViewportTop] =
        scrollableCoordsToViewport(
          targetColumnRect.left,
          targetColumnRect.top,
          scrollContainer,
        );

      // Convert viewport coordinates to document coordinates for absolute positioning
      const { scrollLeft, scrollTop } = document.documentElement;
      const columnDocumentLeft = columnViewportLeft + scrollLeft;
      const columnDocumentTop = columnViewportTop + scrollTop;

      // Position the invisible container to match the target column
      dropPreview.style.setProperty("--column-left", `${columnDocumentLeft}px`);
      dropPreview.style.setProperty("--column-top", `${columnDocumentTop}px`);
      dropPreview.style.setProperty(
        "--column-width",
        `${targetColumnRect.width}px`,
      );
      dropPreview.style.setProperty(
        "--column-height",
        `${targetColumnRect.height}px`,
      );

      // Set data-after attribute to control line position via CSS
      if (dropColumnIndex > columnIndex) {
        // Dropping after: CSS will position line at right edge (100%)
        dropPreview.setAttribute("data-after", "");
      } else {
        // Dropping before: CSS will position line at left edge (0%)
        dropPreview.removeAttribute("data-after");
      }

      dropPreview.setAttribute("data-drop-column-index", dropColumnIndex);
      dropPreview.setAttribute("data-visible", "");
    };

    addDragEffect((gestureInfo) => {
      const dropTargetInfo = getDropTargetInfo(
        gestureInfo,
        dropCandidateElements,
      );
      if (!dropTargetInfo) {
        dropPreview.removeAttribute("data-visible");
        return;
      }
      updateDropTarget(dropTargetInfo);
    });

    document.body.appendChild(dropPreview);
    addTeardown(() => {
      dropPreview.remove();
    });
  }

  init_drag_gesture: {
    const dragToMoveGestureController = createDragToMoveGestureController({
      name: "move-column",
      direction: { x: true },
      threshold: 0,
      onGrab,
      onDragStart: () => {},
      onDrag: (gestureInfo) => {
        triggerDrag(gestureInfo);
        onDrag?.(gestureInfo, dropColumnIndex);
      },
      onRelease: (gestureInfo) => {
        if (!DEBUG_VISUAL) {
          teardown();
        }
        onRelease?.(gestureInfo, dropColumnIndex);
      },
    });
    const dragToMoveGesture = dragToMoveGestureController.grabViaMouse(
      mousedownEvent,
      {
        element: col,
        elementToImpact: cloneParent,
        elementVisuallyImpacted: colClone,
      },
    );
    dragToMoveGesture.dragViaMouse(significantDragGestureInfo.dragEvent);
  }
};

/**
 * Creates a MutationObserver that syncs attribute changes from original table to clone
 * @param {HTMLElement} table - The original table element
 * @param {HTMLElement} cloneTable - The cloned table element
 * @returns {MutationObserver} The observer instance with disconnect method
 */
const createTableAttributeSync = (table, tableClone) => {
  // Create a map to quickly find corresponding elements in the clone
  const createElementMap = () => {
    const map = new Map();
    const cells = table.querySelectorAll(".navi_table_cell");
    const cellClones = tableClone.querySelectorAll(".navi_table_cell");
    for (let i = 0; i < cells.length; i++) {
      if (cellClones[i]) {
        map.set(cells[i], cellClones[i]);
      }
    }
    return map;
  };

  const elementMap = createElementMap();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        const originalElement = mutation.target;
        const cloneElement = elementMap.get(originalElement);

        if (cloneElement) {
          const attributeName = mutation.attributeName;
          if (attributeName === "style") {
            return;
          }

          // Sync the attribute change to the clone
          if (originalElement.hasAttribute(attributeName)) {
            const attributeValue = originalElement.getAttribute(attributeName);
            cloneElement.setAttribute(attributeName, attributeValue);
          } else {
            cloneElement.removeAttribute(attributeName);
          }
        }
      }
    });
  });

  // Observe attribute changes on all table cells
  const cellsToObserve = table.querySelectorAll(".navi_table_cell");
  cellsToObserve.forEach((cell) => {
    observer.observe(cell, {
      attributes: true,
      attributeOldValue: false,
      subtree: false,
    });
  });

  return observer;
};
