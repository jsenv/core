import { getStyle } from "../style_and_attributes.js";
import { isDocumentElement } from "../utils.js";

// note: keep in mind that an element with overflow: 'hidden' is scrollable
// it can be scrolled using keyboard arrows or JavaScript properties such as scrollTop, scrollLeft
// the only overflow that prevents scroll is "visible"
export const isScrollable = (element, { includeHidden }) => {
  if (canHaveVerticalScroll(element, { includeHidden })) {
    return true;
  }
  if (canHaveHorizontalScroll(element, { includeHidden })) {
    return true;
  }
  return false;
};

const canHaveVerticalScroll = (element, { includeHidden }) => {
  const verticalOverflow = getStyle(element, "overflow-y");
  if (verticalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (verticalOverflow === "hidden" || verticalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};
const canHaveHorizontalScroll = (element, { includeHidden }) => {
  const horizontalOverflow = getStyle(element, "overflow-x");
  if (horizontalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (horizontalOverflow === "hidden" || horizontalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    if (isDocumentElement(element)) {
      // browser returns "visible" on documentElement even if it is scrollable
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};

export const getScrollingElement = (document) => {
  const { scrollingElement } = document;
  if (scrollingElement) {
    return scrollingElement;
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
