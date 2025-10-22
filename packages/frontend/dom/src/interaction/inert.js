import { setAttributes } from "../style_and_attributes.js";
import { getAssociatedElements } from "../utils.js";

/**
 * Makes all DOM elements inert except for the specified element and its ancestors.
 *
 * This function applies the `inert` attribute to sibling elements at each level of the DOM tree,
 * starting from the target element and traversing up to document.body.
 *
 * When a sibling contains elements matching the shouldStayActiveSelector, only the parts
 * of that sibling that don't contain matching elements will be made inert.
 *
 * Example DOM structure and inert application:
 *
 * Before calling makeRestInert:
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div data-droppable>drop zone</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="modal">...</div> ← Will call makeRestInert on this element
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling makeRestInert(document.querySelector(".modal"), "[data-droppable]"):
 * ```
 * <body>
 *   <header inert>...</header>
 *   <main>
 *     <div> ← not inert because it contains [data-droppable]
 *       <span inert>some content</span> ← made inert selectively
 *       <div data-droppable>drop zone</div> ← stays active
 *       <span inert>more content</span> ← made inert selectively
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="modal">...</div> ← still active
 *   </main>
 *   <footer inert>...</footer>
 * </body>
 * ```
 *
 * @param {Element} element - The element to keep active (non-inert)
 * @param {string} [shouldStayActiveSelector] - Optional CSS selector for elements that should stay active
 * @returns {Function} cleanup - Function to restore original inert states
 */
export const makeRestInert = (element, shouldStayActiveSelector) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  // Build exclusion list: associated elements + their ancestors
  const excludedNodeSet = new Set();
  const associatedElements = getAssociatedElements(element);
  if (associatedElements) {
    for (const associatedElement of associatedElements) {
      // Add the associated element itself
      excludedNodeSet.add(associatedElement);
      // Add all its ancestors up to document.body
      let ancestor = associatedElement.parentNode;
      while (ancestor && ancestor !== document.body) {
        excludedNodeSet.add(ancestor);
        ancestor = ancestor.parentNode;
      }
    }
  }

  const setInert = (el) => {
    if (el.hasAttribute("data-backdrop")) {
      // backdrop elements are meant to control interactions happening at document level
      // and should stay interactive
      return;
    }
    if (excludedNodeSet.has(el)) {
      // element is associated or ancestor of associated element, keep it active
      return;
    }
    const restoreAttributes = setAttributes(el, {
      inert: "",
    });
    cleanupCallbackSet.add(() => {
      restoreAttributes();
    });
  };

  const makeElementInertSelectivelyOrCompletely = (el) => {
    // If this element is excluded (associated or ancestor of associated), keep it active
    if (excludedNodeSet.has(el)) {
      return;
    }

    // If this element itself matches the selector, keep it active
    if (shouldStayActiveSelector && el.matches(shouldStayActiveSelector)) {
      return;
    }

    const hasActiveDescendants =
      shouldStayActiveSelector && el.querySelector(shouldStayActiveSelector);
    if (!hasActiveDescendants) {
      // No active descendants, make the entire element inert
      setInert(el);
      return;
    }
    // Make this element's children selectively inert
    const children = Array.from(el.children);
    for (const child of children) {
      makeElementInertSelectivelyOrCompletely(child);
    }
  };

  // Step 1: Apply inert to direct siblings of the element
  const parent = element.parentNode;
  if (parent) {
    const siblings = Array.from(parent.children);
    for (const sibling of siblings) {
      if (sibling !== element) {
        makeElementInertSelectivelyOrCompletely(sibling);
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
        makeElementInertSelectivelyOrCompletely(sibling);
      }
    }

    // Move up to the next ancestor
    currentElementAncestor = ancestorParent;
  }

  return () => {
    cleanup();
  };
};
