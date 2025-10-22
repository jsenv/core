import { setAttributes } from "../style_and_attributes.js";

export const makeRestInert = (element) => {
  // Every other nodes in the tree should be inert
  // We have an element all his prev/next siblings should be inert.
  // then we move up the tree to find all ancestor prev/next sibling too
  // once we reach document body we stop

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

  // Traverse up the tree starting from the given element
  let currentElement = element;
  while (currentElement && currentElement !== document.body) {
    const parent = currentElement.parentNode;
    if (!parent) break;

    // Get all siblings of the current element
    const parentChildren = Array.from(parent.children);
    for (const sibling of parentChildren) {
      if (sibling !== currentElement) {
        ensureInert(sibling);
      }
    }

    // Move up to the parent for the next iteration
    currentElement = parent;
  }

  return () => {
    cleanup();
  };
};
