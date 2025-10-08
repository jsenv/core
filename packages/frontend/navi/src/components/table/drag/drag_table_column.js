import {
  createDragToMoveGesture,
  getDropTargetInfo,
  getScrollableParent,
  getVisualRect,
} from "@jsenv/dom";

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

export const initDragTableColumnByMousedown = (
  mousedownEvent,
  { onGrab, onDrag, onRelease },
) => {
  const teardownCallbackSet = new Set();
  const addTeardown = (callback) => {
    teardownCallbackSet.add(callback);
  };
  const teardown = () => {
    for (const callback of teardownCallbackSet) {
      callback();
    }
    teardownCallbackSet.clear();
  };
  const dragEffectCallbackSet = new Set();
  const addDragEffect = (callback) => {
    dragEffectCallbackSet.add(callback);
  };

  const tableCell = mousedownEvent.target.closest("th, td");
  const table = tableCell.closest("table");
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

  update_sticky_elements: {
    // In the table clone we set sticky elements to position: relative
    // because position would not work as the clone is not in a scrollable container
    // but an absolutely positioned element
    const scrollableParent = getScrollableParent(table);
    const scrollLeft = scrollableParent.scrollLeft;
    const scrollTop = scrollableParent.scrollTop;

    // important: only on cells, not on <col> nor <tr>
    const stickyCells = tableClone.querySelectorAll(
      "th[data-sticky-left], td[data-sticky-left], th[data-sticky-top], td[data-sticky-top]",
    );
    stickyCells.forEach((stickyCell) => {
      const hasXSticky = stickyCell.hasAttribute("data-sticky-left");
      const hasYSticky = stickyCell.hasAttribute("data-sticky-top");

      // Use position: relative and calculate offsets to simulate sticky behavior
      stickyCell.style.position = "relative";
      if (hasXSticky) {
        // For horizontal sticky elements, offset left to simulate sticky behavior
        // The element should appear to stick at its original position relative to the scroll
        stickyCell.style.left = `${scrollLeft}px`;
      }
      if (hasYSticky) {
        // For vertical sticky elements, offset top to simulate sticky behavior
        // The element should appear to stick at its original position relative to the scroll
        stickyCell.style.top = `${scrollTop}px`;
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
    const tableCloneCells = tableClone.querySelectorAll("td, th");
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
  const colgroup = table.querySelector("colgroup");
  const colElements = Array.from(colgroup.children);
  const colgroupClone = tableClone.querySelector("colgroup");
  const colClone = colgroupClone.children[columnIndex];
  const dropPreview = createDropPreview();
  const dropPreviewUI = dropPreview.querySelector(
    ".navi_table_column_drop_preview_ui",
  );

  drop_preview: {
    const tableRootRect = getVisualRect(tableRoot, document.body);
    dropPreview.style.setProperty("--table-left", `${tableRootRect.left}px`);
    dropPreview.style.setProperty("--table-top", `${tableRootRect.top}px`);
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
    const dragToMoveGesture = createDragToMoveGesture({
      name: "move-column",
      direction: { x: true },
      onGrab,
      onDrag: (gestureInfo) => {
        for (const dragEffect of dragEffectCallbackSet) {
          dragEffect(gestureInfo);
        }
        onDrag?.(gestureInfo, dropColumnIndex);
      },
      onRelease: (gestureInfo) => {
        onRelease?.(gestureInfo, dropColumnIndex);
      },
    });

    dragToMoveGesture.grabViaMousedown(mousedownEvent, {
      element: table,
      elementToImpact: cloneParent,
      elementVisuallyImpacted: colClone,
    });
    dragToMoveGesture.addTeardown(() => {
      teardown();
    });
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
    const cells = table.querySelectorAll("th, td");
    const cellClones = tableClone.querySelectorAll("th, td");
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
  const cellsToObserve = table.querySelectorAll("th, td");
  cellsToObserve.forEach((cell) => {
    observer.observe(cell, {
      attributes: true,
      attributeOldValue: false,
      subtree: false,
    });
  });

  return observer;
};
