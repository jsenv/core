import { getStyle } from "../../style/dom_styles.js";
import {
  elementIsDetails,
  elementIsSummary,
  isDocumentElement,
} from "../../utils.js";

export const elementIsVisibleForFocus = (node) => {
  return getFocusVisibilityInfo(node).visible;
};
export const getFocusVisibilityInfo = (node) => {
  if (isDocumentElement(node)) {
    return { visible: true, reason: "is document" };
  }
  if (node.hasAttribute("hidden")) {
    return { visible: false, reason: "has hidden attribute" };
  }
  if (getStyle(node, "visibility") === "hidden") {
    return { visible: false, reason: "uses visiblity: hidden" };
  }
  if (node.tagName === "INPUT" && node.type === "hidden") {
    return { visible: false, reason: "input type hidden" };
  }
  let nodeOrAncestor = node;
  while (nodeOrAncestor) {
    if (isDocumentElement(nodeOrAncestor)) {
      break;
    }
    if (getStyle(nodeOrAncestor, "display") === "none") {
      return { visible: false, reason: "ancestor uses display: none" };
    }
    // Check if element is inside a closed details element
    if (elementIsDetails(nodeOrAncestor) && !nodeOrAncestor.open) {
      // Special case: summary elements are visible even when their parent details is closed
      // But only if this details element is the direct parent of the summary
      if (!elementIsSummary(node) || node.parentElement !== nodeOrAncestor) {
        return { visible: false, reason: "inside closed details element" };
      }
      // Continue checking ancestors
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return { visible: true, reason: "no reason to be hidden" };
};

export const elementIsVisuallyVisible = (node, options = {}) => {
  return getVisuallyVisibleInfo(node, options).visible;
};
export const getVisuallyVisibleInfo = (
  node,
  { countOffscreenAsVisible = false } = {},
) => {
  // First check all the focusable visibility conditions
  const focusVisibilityInfo = getFocusVisibilityInfo(node);
  if (!focusVisibilityInfo.visible) {
    return focusVisibilityInfo;
  }

  // Additional visual visibility checks
  if (getStyle(node, "opacity") === "0") {
    return { visible: false, reason: "uses opacity: 0" };
  }

  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return { visible: false, reason: "has zero dimensions" };
  }

  // Check for clipping
  const clipStyle = getStyle(node, "clip");
  if (clipStyle && clipStyle !== "auto" && clipStyle.includes("rect(0")) {
    return { visible: false, reason: "clipped with clip property" };
  }

  const clipPathStyle = getStyle(node, "clip-path");
  if (clipPathStyle && clipPathStyle.includes("inset(100%")) {
    return { visible: false, reason: "clipped with clip-path" };
  }

  // Check if positioned off-screen (unless option says to count as visible)
  if (!countOffscreenAsVisible) {
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return { visible: false, reason: "positioned off-screen" };
    }
  }

  // Check for transform scale(0)
  const transformStyle = getStyle(node, "transform");
  if (transformStyle && transformStyle.includes("scale(0")) {
    return { visible: false, reason: "scaled to zero with transform" };
  }

  return { visible: true, reason: "visually visible" };
};
export const getFirstVisuallyVisibleAncestor = (node, options = {}) => {
  let currentNode = node;

  while (currentNode) {
    const visibilityInfo = getVisuallyVisibleInfo(currentNode, options);
    if (visibilityInfo.visible) {
      return {
        element: currentNode,
        visibilityInfo,
      };
    }
    currentNode = currentNode.parentElement;
  }

  // This shouldn't happen in normal cases since document element is always visible
  return null;
};
