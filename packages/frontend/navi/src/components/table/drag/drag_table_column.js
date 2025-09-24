import { createDragToMoveGesture, getScrollableParent } from "@jsenv/dom";

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

  const tableCell = mousedownEvent.target.closest("td, th");
  const table = tableCell.closest("table");
  const columnIndex = Array.from(tableCell.parentNode.children).indexOf(
    tableCell,
  );

  const cloneParent = table
    .closest(".navi_table_container")
    .querySelector(".navi_table_drag_clone_positioner");
  const tableClone = table.cloneNode(true);
  // ensure [data-drag-obstacle] inside the table clone are ignored
  tableClone.setAttribute("data-drag-ignore", "");

  update_sticky_elements: {
    // In the table clone we set sticky elements to position: relative
    // because position would not work as the clone is not in a scrollable container
    // but an absolutely positioned element
    const scrollableParent = getScrollableParent(table);
    const scrollLeft = scrollableParent.scrollLeft || 0;
    const scrollTop = scrollableParent.scrollTop || 0;

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

  sync_focus: {
    const cellThatWouldBeFocusedByMousedown = tableCell;

    let focusedElementInClone = null;
    // Build a path from table to activeElement
    const pathToElement = [];
    let current = cellThatWouldBeFocusedByMousedown;
    while (current && current !== table) {
      const parent = current.parentNode;
      if (parent) {
        const siblings = Array.from(parent.children);
        pathToElement.unshift(siblings.indexOf(current));
      }
      current = parent;
    }
    // Follow the same path in the clone to find the corresponding element
    focusedElementInClone = tableClone;
    for (const index of pathToElement) {
      if (focusedElementInClone.children[index]) {
        focusedElementInClone = focusedElementInClone.children[index];
      } else {
        focusedElementInClone = null;
        break;
      }
    }
    focusedElementInClone.focus();
    mousedownEvent.preventDefault(); // let the column clone get the focus (without this browser would naturally focus the <th> received mousedown)
    addTeardown(() => {
      // Restore focus to the original element
      if (!document.body.contains(cellThatWouldBeFocusedByMousedown)) {
        // will happen is re-rendered by preact after drag ends
        // note: we'll fix once we reproduce with real word use case where columns are re-ordered
        return;
      }
      cellThatWouldBeFocusedByMousedown.focus();
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

  init_drag_gesture: {
    const dragToMoveGesture = createDragToMoveGesture({
      name: "move-column",
      direction: { x: true },
      onGrab,
      onDrag,
      onRelease,
    });

    const colgroupClone = tableClone.querySelector("colgroup");
    const colClone = colgroupClone.children[columnIndex];
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
 * @param {HTMLElement} originalTable - The original table element
 * @param {HTMLElement} cloneTable - The cloned table element
 * @returns {MutationObserver} The observer instance with disconnect method
 */
const createTableAttributeSync = (originalTable, cloneTable) => {
  // Create a map to quickly find corresponding elements in the clone
  const createElementMap = () => {
    const map = new Map();
    const originalCells = originalTable.querySelectorAll("td, th");
    const cloneCells = cloneTable.querySelectorAll("td, th");

    for (let i = 0; i < originalCells.length; i++) {
      if (cloneCells[i]) {
        map.set(originalCells[i], cloneCells[i]);
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
  const cellsToObserve = originalTable.querySelectorAll("td, th");
  cellsToObserve.forEach((cell) => {
    observer.observe(cell, {
      attributes: true,
      attributeOldValue: false,
      subtree: false,
    });
  });

  return observer;
};
