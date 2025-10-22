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
 * @param {Array[Element]} - Array of element to keep interactive (non inert)
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
    let ancestor = el.parentNode;
    while (ancestor && ancestor !== document.body) {
      toKeepInteractiveSet.add(ancestor);
      ancestor = ancestor.parentNode;
    }
  };
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

  return () => {
    cleanup();
  };
};
