import { elementIsVisible } from "../element_is_visible.js";

export const elementIsFocusable = (node) => {
  // only element node can be focused, document, textNodes etc cannot
  if (node.nodeType !== 1) {
    return false;
  }
  const nodeName = node.nodeName.toLowerCase();
  if (nodeName === "input") {
    if (node.type === "hidden") {
      return false;
    }
    return elementIsVisible(node);
  }
  if (
    ["button", "select", "datalist", "iframe", "textarea"].indexOf(nodeName) >
    -1
  ) {
    return elementIsVisible(node);
  }
  if (node.hasAttribute("tabindex") || node.hasAttribute("tabIndex")) {
    return elementIsVisible(node);
  }
  if (node.hasAttribute("draggable")) {
    return elementIsVisible(node);
  }
  if (["a", "area"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("href") === false) {
      return false;
    }
    return elementIsVisible(node);
  }
  if (["audio", "video"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("controls") === false) {
      return false;
    }
    return elementIsVisible(node);
  }
  return false;
};
