import { getStyle, setStyles } from "./style_and_attributes.js";
import { isDocumentElement } from "./utils.js";

export const getScrollLeftAndTop = (element) => {
  return [element.scrollLeft, element.scrollTop];
};

export const trapScrollInside = (element) => {
  const cleanupCallbackSet = new Set();
  const lockScroll = (el) => {
    const [scrollbarWidth, scrollbarHeight] = mesureScrollbar(el);
    // scrollbar-gutter would work but would display an empty blank space
    const paddingRight = parseInt(getStyle(el, "padding-right"), 0);
    const paddingTop = parseInt(getStyle(el, "padding-top"), 0);
    const removeScrollLockStyles = setStyles(el, {
      "padding-right": `${paddingRight + scrollbarWidth}px`,
      "padding-top": `${paddingTop + scrollbarHeight}px`,
      "overflow": "hidden",
    });
    cleanupCallbackSet.add(() => {
      removeScrollLockStyles();
    });
  };
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1) {
      if (isScrollable(previous)) {
        lockScroll(previous);
      }
    }
    previous = previous.previousSibling;
  }

  const ancestorScrolls = getAncestorScrolls(element);
  for (const ancestorScroll of ancestorScrolls) {
    const elementToScrollLock = ancestorScroll.scrollableParent;
    lockScroll(elementToScrollLock);
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};

// https://davidwalsh.name/detect-scrollbar-width
export const mesureScrollbar = (scrollableElement) => {
  const hasXScrollbar =
    scrollableElement.scrollHeight > scrollableElement.clientHeight;
  const hasYScrollbar =
    scrollableElement.scrollWidth > scrollableElement.clientWidth;
  if (!hasXScrollbar && !hasYScrollbar) {
    return [0, 0];
  }
  const scrollDiv = document.createElement("div");
  scrollDiv.style.cssText = `position: absolute; width: 100px; height: 100px; overflow: scroll; pointer-events: none; visibility: hidden;`;
  scrollableElement.appendChild(scrollDiv);
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  const scrollbarHeight = scrollDiv.offsetHeight - scrollDiv.clientHeight;
  scrollableElement.removeChild(scrollDiv);
  return [
    hasXScrollbar ? scrollbarWidth : 0,
    hasYScrollbar ? scrollbarHeight : 0,
  ];
};

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

const getScrollableParent = (arg) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollableParent first argument must be DOM node");
  }
  const element = arg;
  if (element === document.documentElement) {
    return null;
  }
  const position = getStyle(element, "position");

  if (position === "fixed") {
    return getScrollingElement(element.ownerDocument);
  }
  return (
    findScrollableParent(element) || getScrollingElement(element.ownerDocument)
  );
};

const getScrollingElement = (document) => {
  if ("scrollingElement" in document) {
    return document.scrollingElement;
  }

  if (isCompliant(document)) {
    return document.documentElement;
  }

  const body = document.body;
  const isFrameset = body && !/body/i.test(body.tagName);
  const possiblyScrollingElement = isFrameset ? getNextBodyElement(body) : body;

  // If `body` is itself scrollable, it is not the `scrollingElement`.
  return possiblyScrollingElement && bodyIsScrollable(possiblyScrollingElement)
    ? null
    : possiblyScrollingElement;
};

const getNextBodyElement = (frameset) => {
  // We use this function to be correct per spec in case `document.body` is
  // a `frameset` but there exists a later `body`. Since `document.body` is
  // a `frameset`, we know the root is an `html`, and there was no `body`
  // before the `frameset`, so we just need to look at siblings after the
  // `frameset`.
  let current = frameset;
  while ((current = current.nextSibling)) {
    if (current.nodeType === 1 && isBodyElement(current)) {
      return current;
    }
  }
  return null;
};

const isBodyElement = (element) => element.ownerDocument.body === element;

const bodyIsScrollable = (body) => {
  // a body element is scrollable if body and html are scrollable and rendered
  if (!isScrollable(body)) {
    return false;
  }
  if (isHidden(body)) {
    return false;
  }

  const documentElement = body.ownerDocument.documentElement;
  if (!isScrollable(documentElement)) {
    return false;
  }
  if (isHidden(documentElement)) {
    return false;
  }

  return true;
};

const isHidden = (element) => {
  const display = getStyle(element, "display");
  if (display === "none") {
    return false;
  }

  if (
    display === "table-row" ||
    display === "table-group" ||
    display === "table-column"
  ) {
    return getStyle(element, "visibility") !== "collapsed";
  }

  return true;
};

const isCompliant = (document) => {
  // Note: document.compatMode can be toggle at runtime by document.write
  const isStandardsMode = /^CSS1/.test(document.compatMode);
  if (isStandardsMode) {
    return testScrollCompliance(document);
  }
  return false;
};

const testScrollCompliance = (document) => {
  const iframe = document.createElement("iframe");
  iframe.style.height = "1px";
  const parentNode = document.body || document.documentElement || document;
  parentNode.appendChild(iframe);
  const iframeDocument = iframe.contentWindow.document;
  iframeDocument.write('<!DOCTYPE html><div style="height:9999em">x</div>');
  iframeDocument.close();
  const scrollComplianceResult =
    iframeDocument.documentElement.scrollHeight >
    iframeDocument.body.scrollHeight;
  iframe.parentNode.removeChild(iframe);
  return scrollComplianceResult;
};

const isScrollable = (element) => {
  // note: keep in mind that an element with overflow: 'hidden' is scrollable
  // it can be scrolled using keyboard arrows or JavaScript properties such as scrollTop, scrollLeft
  if (!verticalOverflowIsVisible(element)) {
    return true;
  }

  if (!horizontalOverflowIsVisible(element)) {
    return true;
  }

  return false;
};

const verticalOverflowIsVisible = (element) => {
  const verticalOverflow = getStyle(element, "overflow-x");
  if (verticalOverflow === "visible") {
    return true;
  }

  const overflow = getStyle(element, "overflow");
  return overflow === "visible";
};

const horizontalOverflowIsVisible = (element) => {
  const horizontalOverflow = getStyle(element, "overflow-y");
  if (horizontalOverflow === "visible") {
    return true;
  }
  const overflow = getStyle(element, "overflow");
  return overflow === "visible";
};

const findScrollableParent = (element) => {
  if (element === document.documentElement) return null;

  const position = getStyle(element, "position");
  let parent = element.parentNode;
  while (parent) {
    if (isDocumentElement(parent)) {
      return null;
    }
    if (position === "absolute" && getStyle(parent, "position") === "static") {
      parent = parent.parentNode;
      continue;
    }
    if (isScrollable(parent)) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
};
