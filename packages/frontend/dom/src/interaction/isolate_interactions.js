import { setAttributes } from "../style_and_attributes.js";
import { getAssociatedElements } from "../utils.js";

/**
 * Makes all DOM elements inert except for the specified elements and their ancestors.
 *
 * This function applies the `inert` attribute to sibling elements at each level of the DOM tree,
 * starting from the target elements and traversing up to document.body.
 *
 * Example DOM structure and inert application:
 *
 * Before calling isolateInteractions:
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside>sidebar</aside>
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling isolateInteractions([modal, dropdown]):
 * ```
 * <body>
 *   <header inert>...</header>
 *   <main> ← not inert because it contains active elements
 *     <div> ← not inert because it contains .modal
 *       <span inert>some content</span> ← made inert selectively
 *       <div class="modal">modal content</div> ← stays active
 *       <span inert>more content</span> ← made inert selectively
 *     </div>
 *     <aside inert>sidebar</aside> ← made inert (no active descendants)
 *     <div class="dropdown">dropdown menu</div> ← stays active
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
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside>sidebar</aside>
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * @param {Array<Element>} elements - Array of elements to keep interactive (non-inert)
 * @returns {Function} cleanup - Function to restore original inert states
 */
export const isolateInteractions = (elements) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const toKeepInteractiveSet = new Set();
  const keepSelfAndAncestors = (el) => {
    // Add the element itself
    toKeepInteractiveSet.add(el);
    // Add all its ancestors up to document.body
    let ancestor = el.parentNode;
    while (ancestor && ancestor !== document.body) {
      toKeepInteractiveSet.add(ancestor);
      ancestor = ancestor.parentNode;
    }
  };

  // Build set of elements to keep interactive
  for (const element of elements) {
    keepSelfAndAncestors(element);
    const associatedElements = getAssociatedElements(element);
    if (associatedElements) {
      for (const associatedElement of associatedElements) {
        keepSelfAndAncestors(associatedElement);
      }
    }
  }

  const setInert = (el) => {
    if (el.hasAttribute("data-backdrop")) {
      // backdrop elements are meant to control interactions happening at document level
      // and should stay interactive
      return;
    }
    if (toKeepInteractiveSet.has(el)) {
      // element should stay interactive
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
    // If this element should stay interactive, keep it active
    if (toKeepInteractiveSet.has(el)) {
      return;
    }

    // Check if any descendant should stay interactive
    const hasInteractiveDescendants = Array.from(el.querySelectorAll("*")).some(
      (descendant) => toKeepInteractiveSet.has(descendant),
    );

    if (!hasInteractiveDescendants) {
      // No interactive descendants, make the entire element inert
      setInert(el);
      return;
    }

    // Make this element's children selectively inert
    const children = Array.from(el.children);
    for (const child of children) {
      makeElementInertSelectivelyOrCompletely(child);
    }
  };

  // Apply inert to all top-level elements that aren't in our keep-interactive set
  const bodyChildren = Array.from(document.body.children);
  for (const child of bodyChildren) {
    makeElementInertSelectivelyOrCompletely(child);
  }

  return () => {
    cleanup();
  };
};
