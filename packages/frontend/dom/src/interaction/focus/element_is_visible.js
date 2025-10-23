import { getStyle } from "../../style/dom_styles.js";
import {
  elementIsDetails,
  elementIsSummary,
  isDocumentElement,
} from "../../utils.js";

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
    // Check if element is inside a closed details element
    if (elementIsDetails(nodeOrAncestor) && !nodeOrAncestor.open) {
      // Special case: summary elements are visible even when their parent details is closed
      // But only if this details element is the direct parent of the summary
      if (elementIsSummary(node) && node.parentElement === nodeOrAncestor) {
        // Continue checking ancestors, don't return false yet
      } else {
        return false;
      }
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return true;
};
