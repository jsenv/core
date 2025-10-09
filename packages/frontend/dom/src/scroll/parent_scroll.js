import { getStyle } from "../style_and_attributes.js";
import { getScrollingElement, isScrollable } from "./is_scrollable.js";

export const getAncestorScrolls = (element) => {
  let scrollX = 0;
  let scrollY = 0;
  const ancestorScrolls = [];
  const visitElement = (elementOrScrollableParent) => {
    const scrollableParent = getScrollableParent(elementOrScrollableParent);
    if (scrollableParent) {
      ancestorScrolls.push({
        element: elementOrScrollableParent,
        scrollableParent,
      });
      scrollX += scrollableParent.scrollLeft;
      scrollY += scrollableParent.scrollTop;
      if (scrollableParent === document) {
        return;
      }
      visitElement(scrollableParent);
    }
  };
  visitElement(element);
  ancestorScrolls.scrollX = scrollX;
  ancestorScrolls.scrollY = scrollY;
  return ancestorScrolls;
};

// https://github.com/shipshapecode/tether/blob/d6817f8c49a7a26b04c45e55589279dd1b5dd2bf/src/js/utils/parents.js#L1
export const getScrollableParentSet = (element) => {
  const scrollableParentSet = new Set();
  let elementOrScrollableParent = element;
  while (true) {
    const scrollableParent = getScrollableParent(elementOrScrollableParent);
    if (!scrollableParent) {
      break;
    }
    scrollableParentSet.add(scrollableParent);
    if (
      scrollableParent === document ||
      scrollableParent === document.documentElement
    ) {
      break;
    }
    elementOrScrollableParent = scrollableParent;
  }
  return scrollableParentSet;
};

export const getScrollableParent = (arg, { includeHidden } = {}) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollableParent first argument must be DOM node");
  }
  const element = arg;
  if (element === document) {
    return null;
  }
  if (element === document.documentElement) {
    if (isScrollable(element, { includeHidden })) {
      return element;
    }
    return null;
  }
  const position = getStyle(element, "position");
  if (position === "fixed") {
    return getScrollingElement(element.ownerDocument);
  }
  return (
    findScrollableParent(element, { includeHidden }) ||
    getScrollingElement(element.ownerDocument)
  );
};

const findScrollableParent = (element, { includeHidden } = {}) => {
  const position = getStyle(element, "position");
  let parent = element.parentNode;
  // Si l'élément est en position absolute, d'abord trouver le premier parent positionné
  if (position === "absolute") {
    while (parent && parent !== document) {
      if (parent === document.documentElement) {
        break; // documentElement est considéré comme positionné
      }
      const parentPosition = getStyle(parent, "position");
      if (parentPosition !== "static") {
        break; // Trouvé le premier parent positionné
      }
      parent = parent.parentNode;
    }
  }

  // Maintenant chercher le premier parent scrollable à partir du parent positionné
  while (parent) {
    if (parent === document) {
      return null;
    }
    if (isScrollable(parent, { includeHidden })) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
};
