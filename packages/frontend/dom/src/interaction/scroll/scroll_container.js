// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container

import { getStyle } from "../../style/dom_styles.js";
import { getScrollingElement, isScrollable } from "./is_scrollable.js";

const { documentElement } =
  typeof document === "object" ? document : { documentElement: null };

export const getScrollContainer = (arg, { includeHidden } = {}) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollContainer first argument must be DOM node");
  }
  const element = arg;
  if (element === document) {
    return null;
  }
  if (element === documentElement) {
    if (isScrollable(element, { includeHidden })) {
      return element;
    }
    return null;
  }
  if (isScrollBoundary(element)) {
    const placeholder = findEngagedPopupGroupPlaceholder(element);
    if (placeholder) {
      return getScrollContainer(placeholder, { includeHidden });
    }
    return getScrollingElement(element.ownerDocument);
  }
  return (
    findScrollContainer(element, { includeHidden }) ||
    getScrollingElement(element.ownerDocument)
  );
};

const findScrollContainer = (element, { includeHidden } = {}) => {
  const position = getStyle(element, "position");
  let parent = element.parentNode;
  // Si l'élément est en position absolute, d'abord trouver le premier parent positionné
  if (position === "absolute") {
    while (parent && parent !== document) {
      if (parent === documentElement) {
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
    // A boundary that scrolls is the scroll container of what it holds — a
    // popup whose own box scrolls, a PopupGroup shown modal where it stands.
    if (isScrollable(parent, { includeHidden })) {
      return parent;
    }
    if (isScrollBoundary(parent)) {
      const placeholder = findEngagedPopupGroupPlaceholder(parent);
      if (placeholder) {
        return findScrollContainer(placeholder, { includeHidden });
      }
      return null;
    }
    parent = parent.parentNode;
  }
  return null;
};

// A popover, a modal dialog or a fixed box is not scrolled by the boxes around
// it: the page is its scroll container, and the parent walk of any element
// inside it stops there too. A scrolling box between that boundary and the
// outer ancestors would otherwise be found, although nothing it scrolls moves
// the element.
const isScrollBoundary = (node) => {
  if (node.nodeType !== 1) {
    return false;
  }
  if (node.hasAttribute("popover")) {
    return true;
  }
  if (node.tagName === "DIALOG" && node.matches(":modal")) {
    return true;
  }
  return getStyle(node, "position") === "fixed";
};

// Except a PopupGroup shown modal (@jsenv/navi's popup_group.jsx): fixed in the
// top layer at the place a placeholder holds for it in the page, it follows
// that place, so what scrolls the placeholder moves the group and what it
// holds. The placeholder is inserted just before it; something rendered
// before the group meanwhile lands in between.
const findEngagedPopupGroupPlaceholder = (node) => {
  if (
    node.tagName !== "DIALOG" ||
    !node.hasAttribute("navi-popup-group") ||
    !node.matches(":modal")
  ) {
    return null;
  }
  let previous = node.previousElementSibling;
  while (previous) {
    if (previous.hasAttribute("navi-popup-group-placeholder")) {
      return previous;
    }
    previous = previous.previousElementSibling;
  }
  return null;
};

export const getSelfAndAncestorScrolls = (element, startOnParent) => {
  let scrollX = 0;
  let scrollY = 0;
  const ancestorScrolls = [];
  const visitElement = (elementOrScrollContainer) => {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (scrollContainer) {
      ancestorScrolls.push({
        element: elementOrScrollContainer,
        scrollContainer,
      });
      scrollX += scrollContainer.scrollLeft;
      scrollY += scrollContainer.scrollTop;
      if (scrollContainer === document.documentElement) {
        return;
      }
      visitElement(scrollContainer);
    }
  };
  if (startOnParent) {
    if (element === documentElement) {
    } else {
      visitElement(element.parentNode);
    }
  } else {
    visitElement(element);
  }
  ancestorScrolls.scrollX = scrollX;
  ancestorScrolls.scrollY = scrollY;
  return ancestorScrolls;
};

// https://github.com/shipshapecode/tether/blob/d6817f8c49a7a26b04c45e55589279dd1b5dd2bf/src/js/utils/parents.js#L1
export const getScrollContainerSet = (element) => {
  const scrollContainerSet = new Set();
  let elementOrScrollContainer = element;
  while (true) {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (!scrollContainer) {
      break;
    }
    scrollContainerSet.add(scrollContainer);
    if (scrollContainer === documentElement) {
      break;
    }
    elementOrScrollContainer = scrollContainer;
  }
  return scrollContainerSet;
};
