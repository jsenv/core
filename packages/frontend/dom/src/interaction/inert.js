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
