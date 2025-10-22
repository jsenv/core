// https://github.com/davidtheclark/tabbable/blob/master/index.js
export const isDocumentElement = (node) =>
  node === node.ownerDocument.documentElement;

/**
 * elementToOwnerWindow returns the window owning the element.
 * Usually an element window will just be window.
 * But when an element is inside an iframe, the window of that element
 * is iframe.contentWindow
 * It's often important to work with the correct window because
 * element are scoped per iframes.
 */
export const elementToOwnerWindow = (element) => {
  if (elementIsWindow(element)) {
    return element;
  }
  if (elementIsDocument(element)) {
    return element.defaultView;
  }
  return elementToOwnerDocument(element).defaultView;
};
/**
 * elementToOwnerDocument returns the document containing the element.
 * Usually an element document is window.document.
 * But when an element is inside an iframe, the document of that element
 * is iframe.contentWindow.document
 * It's often important to work with the correct document because
 * element are scoped per iframes.
 */
export const elementToOwnerDocument = (element) => {
  if (elementIsWindow(element)) {
    return element.document;
  }
  if (elementIsDocument(element)) {
    return element;
  }
  return element.ownerDocument;
};

export const elementIsWindow = (a) => a.window === a;
export const elementIsDocument = (a) => a.nodeType === 9;
export const elementIsIframe = ({ nodeName }) => nodeName === "IFRAME";
export const elementIsDetails = ({ nodeName }) => nodeName === "DETAILS";
export const elementIsSummary = ({ nodeName }) => nodeName === "SUMMARY";

// should be used ONLY when an element is related to other elements that are not descendants of this element
export const getAssociatedElements = (element) => {
  if (element.tagName === "COL") {
    const columnCells = [];
    const colgroup = element.parentNode;
    const columnIndex = Array.from(colgroup.children).indexOf(element);
    const table = element.closest("table");
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const rowCells = row.children;
      for (const rowCell of rowCells) {
        if (rowCell.cellIndex === columnIndex) {
          columnCells.push(rowCell);
        }
      }
    }
    return columnCells;
  }
  // if (element.tagName === "TR") {
  //   const rowCells = Array.from(element.children);
  //   return rowCells;
  // }
  return null;
};
