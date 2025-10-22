import { setAttributes } from "../style_and_attributes.js";
import { getAssociatedElements } from "../utils.js";

/**
 * Isolates user interactions to only the specified elements, making everything else non-interactive.
 *
 * This creates a controlled interaction environment where only the target elements (and their ancestors)
 * can receive user input like clicks, keyboard events, focus, etc. All other DOM elements become
 * non-interactive, preventing conflicting or unwanted interactions during critical operations
 * like drag gestures, modal dialogs, or complex UI states.
 *
 * The function uses the `inert` attribute to achieve this isolation, applying it strategically
 * to parts of the DOM tree while preserving the interactive elements and their ancestor chains.
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
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling isolateInteractions([modal, dropdown]):
 * ```
 * <body>
 *   <header inert>...</header>  ← made inert (no active descendants)
 *   <main> ← not inert because it contains active elements
 *     <div> ← not inert because it contains .modal
 *       <span inert>some content</span> ← made inert selectively
 *       <div class="modal">modal content</div> ← stays active
 *       <span inert>more content</span> ← made inert selectively
 *     </div>
 *     <aside inert>already inert</aside>
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
 *     <aside inert>already inert</aside> ← [inert] preserved
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
  // backdrop elements are meant to control interactions happening at document level
  // and should stay interactive
  const backdropElements = document.querySelectorAll("[data-backdrop]");
  for (const backdropElement of backdropElements) {
    keepSelfAndAncestors(backdropElement);
  }

  const setInert = (el) => {
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

    // Since we put all ancestors in toKeepInteractiveSet, if this element
    // is not in the set, we can check if any of its direct children are.
    // If none of the direct children are in the set, then no descendants are either.
    const children = Array.from(el.children);
    const hasInteractiveChildren = children.some((child) =>
      toKeepInteractiveSet.has(child),
    );

    if (!hasInteractiveChildren) {
      // No interactive descendants, make the entire element inert
      setInert(el);
      return;
    }

    // Some children need to stay interactive, process them selectively
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
