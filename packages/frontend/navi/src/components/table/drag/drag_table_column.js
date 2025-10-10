import {
  createDragToMoveGestureController,
  createMouseDragThresholdPromise,
  getDropTargetInfo,
  getScrollableParent,
  getVisualRect,
  stickyAsRelativeCoords,
} from "@jsenv/dom";

import { createPubSub } from "../../pub_sub.js";

const DEBUG_VISUAL = false;

import.meta.css = /* css */ `
  .navi_table_column_drop_preview {
    position: absolute;
    left: var(--table-left);
    top: var(--table-top);
    width: var(--table-width);
    height: var(--table-height);
    pointer-events: none;
  }

  .navi_table_column_drop_preview_ui {
    position: absolute;
    top: -10px;
    left: var(--table-column-drop-target-left);
    /* background: yellow; */
    display: flex;
    opacity: 0;
  }

  .navi_table_column_drop_preview_ui[data-visible] {
    opacity: 1;
  }

  .navi_table_column_drop_preview_ui svg {
    width: 10px;
    height: 10px;
  }

  .navi_table_column_drop_preview_ui[data-after] {
    transform: translateX(-100%);
  }
`;

const dropPreviewTemplate = /* html */ `
  <div
    class="navi_table_column_drop_preview"
  >
    <div class="navi_table_column_drop_preview_ui">
      <svg fill="currentColor" viewBox="0 0 30.727 30.727" xml:space="preserve">
        <path
          d="M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0
		l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
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
  const mousemoveEvent = await createMouseDragThresholdPromise(mousedownEvent);

  const [teardown, addTeardown] = createPubSub();
  const [triggerDrag, addDragEffect] = createPubSub();

  const tableCell = mousedownEvent.target.closest(".navi_table_cell");
  const table = tableCell.closest(".navi_table");
  const columnIndex = Array.from(tableCell.parentNode.children).indexOf(
    tableCell,
  );

  // Track the drop target column index (starts as current column)
  let dropColumnIndex = columnIndex;

  const tableContainer = table.closest(".navi_table_container");
  const cloneParent = tableContainer.querySelector(
    ".navi_table_drag_clone_container",
  );
  const tableClone = table.cloneNode(true);
  // ensure [data-drag-obstacle] inside the table clone are ignored
  tableClone.setAttribute("data-drag-ignore", "");

  // Scale down the table clone and set transform origin to mouse grab point
  // const tableRect = table.getBoundingClientRect();
  // const mouseX = mousedownEvent.clientX - tableRect.left;
  // const mouseY = mousedownEvent.clientY - tableRect.top;
  // tableClone.style.transform = "scale(1.2)";
  // tableClone.style.transformOrigin = `${mouseX}px ${mouseY}px`;

  update_sticky_elements: {
    // In the table clone we need to convert sticky elements to position: relative
    // with calculated offsets that match their appearance in the original context
    const scrollableParent = getScrollableParent(table);

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
          scrollableParent,
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
    cloneParent.insertBefore(tableClone, cloneParent.firstChild);
    const cloneContainer = cloneParent.closest(
      ".navi_table_drag_clone_container",
    );
    cloneContainer.style.display = "block";
    addTeardown(() => {
      cloneContainer.style.display = "none";
      tableClone.remove();
      cloneParent.style.left = 0;
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

  const tableRoot = table.closest(".navi_table_root");
  const colgroup = table.querySelector(".navi_colgroup");
  const colElements = Array.from(colgroup.children);
  const colgroupClone = tableClone.querySelector(".navi_colgroup");
  const colClone = colgroupClone.children[columnIndex];
  const dropPreview = createDropPreview();
  const dropPreviewUI = dropPreview.querySelector(
    ".navi_table_column_drop_preview_ui",
  );

  drop_preview: {
    const tableRootRect = tableRoot.getBoundingClientRect();
    let left = tableRootRect.left;
    let top = tableRootRect.top;
    const { scrollLeft, scrollTop } = document.documentElement;
    left += scrollLeft;
    top += scrollTop;
    dropPreview.style.setProperty("--table-left", `${left}px`);
    dropPreview.style.setProperty("--table-top", `${top}px`);
    dropPreview.style.setProperty("--table-width", `${tableRootRect.width}px`);
    dropPreview.style.setProperty(
      "--table-height",
      `${tableRootRect.height}px`,
    );
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
        dropPreviewUI.removeAttribute("data-visible");
        return;
      }

      const targetColumnVisualRect = getVisualRect(targetColumn, tableRoot);
      let targetColumnVisualLeft = targetColumnVisualRect.left;
      if (dropColumnIndex > columnIndex) {
        targetColumnVisualLeft += targetColumnVisualRect.width;
        dropPreviewUI.setAttribute("data-after", "");
      } else {
        dropPreviewUI.removeAttribute("data-after");
      }
      dropPreviewUI.style.setProperty(
        "--table-column-drop-target-left",
        `${targetColumnVisualLeft}px`,
      );
      dropPreviewUI.setAttribute("data-drop-column-index", dropColumnIndex);
      dropPreviewUI.setAttribute("data-visible", "");
    };

    addDragEffect((gestureInfo) => {
      const dropTargetInfo = getDropTargetInfo(
        gestureInfo,
        dropCandidateElements,
      );
      if (!dropTargetInfo) {
        return;
      }
      // we need to update target position even when
      // index do not changed to take scroll into account
      // (because arrwo is positioned into document to be able to overflow
      // but outside the scrollable container to avoid having impact on scrollbars)
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
        onRelease?.(gestureInfo, dropColumnIndex);
      },
    });
    dragToMoveGestureController.addTeardown(() => {
      if (!DEBUG_VISUAL) {
        teardown();
      }
    });
    const dragToMoveGesture = dragToMoveGestureController.grabViaMouse(
      mousedownEvent,
      {
        element: table,
        elementToImpact: cloneParent,
        elementVisuallyImpacted: colClone,
      },
    );
    dragToMoveGesture.dragViaMouse(mousemoveEvent);
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
