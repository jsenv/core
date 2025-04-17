import { getStyle } from "./style_and_attributes.js";
import { isDocumentElement } from "./utils.js";

export const elementIsVisible = (node) => {
  if (isDocumentElement(node)) {
    return true;
  }
  if (getStyle(node, "visibility") === "hidden") {
    return false;
  }
  let nodeOrAncestor = node;
  while (nodeOrAncestor) {
    if (isDocumentElement(nodeOrAncestor)) {
      break;
    }
    if (getStyle(nodeOrAncestor, "display") === "none") {
      return false;
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return true;
};
