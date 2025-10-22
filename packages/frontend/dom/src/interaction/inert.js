import { setAttributes } from "../style_and_attributes.js";

/**
 * Makes all DOM elements inert except for the specified element and its ancestors.
 *
 * This function applies the `inert` attribute to sibling elements at each level of the DOM tree,
 * starting from the target element and traversing up to document.body.
 *
 * Example DOM structure and inert application:
 *
 * Before calling makeRestInert:
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>...</div>
 *     <aside inert>already inert</aside>
 *     <div class="modal">...</div> ← Will call makeRestInert on this element
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling makeRestInert(document.querySelector(".modal")):
 * ```
 * <body>
 *   <header inert>...</header>
 *   <main>
 *     <div inert>...</div>
 *     <aside inert>already inert</aside>
 *     <div class="modal">...</div> ← still active
 *   </main>
 *   <footer inert>...</footer>
 * </body>
 * ```
 *
 * After calling cleanup():
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>...</div>
 *     <aside inert>already inert</aside> ← [inert] preserved
 *     <div class="modal">...</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * @param {Element} element - The element to keep active (non-inert)
 * @returns {Function} cleanup - Function to restore original inert states
 */
export const makeRestInert = (element) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const ensureInert = (el) => {
    const restoreAttributes = setAttributes(el, {
      inert: "",
    });
    cleanupCallbackSet.add(() => {
      restoreAttributes();
    });
  };

  // Special handling for COL elements
  if (element.tagName === "COL") {
    const table = element.closest("table");
    const colgroup = element.parentNode;
    const columnIndex = Array.from(colgroup.children).indexOf(element);
    const rows = table.querySelectorAll("tr");

    // Apply inert to all table cells outside this column
    for (const row of rows) {
      const rowCells = row.children;
      for (const rowCell of rowCells) {
        if (rowCell.cellIndex !== columnIndex) {
          ensureInert(rowCell);
        }
      }
    }

    // Also apply inert to elements outside the table using normal logic
    const cleanupTableInert = makeRestInert(table);

    return () => {
      cleanup();
      cleanupTableInert();
    };
  }

  // Step 1: Apply inert to direct siblings of the element
  const parent = element.parentNode;
  if (parent) {
    const siblings = Array.from(parent.children);
    for (const sibling of siblings) {
      if (sibling !== element) {
        ensureInert(sibling);
      }
    }
  }

  // Step 2: Traverse up the hierarchy and apply inert to ancestor siblings
  let currentElementAncestor = parent;
  while (currentElementAncestor && currentElementAncestor !== document.body) {
    const ancestorParent = currentElementAncestor.parentNode;
    if (!ancestorParent) break;

    // Get all siblings of the current ancestor
    const ancestorSiblings = Array.from(ancestorParent.children);
    for (const sibling of ancestorSiblings) {
      if (sibling !== currentElementAncestor) {
        ensureInert(sibling);
      }
    }

    // Move up to the next ancestor
    currentElementAncestor = ancestorParent;
  }

  return () => {
    cleanup();
  };
};
