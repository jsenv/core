import { elementIsVisibleForFocus } from "./element_visibility.js";

/**
 * Returns whether a node can receive focus, combining structural visibility
 * (via {@link elementIsVisibleForFocus}) with interaction capability checks
 * (disabled, inert) and element-type-specific focusability rules.
 *
 * @param {Node} node
 * @param {{ excludeAriaHidden?: boolean }} [options]
 *   - `excludeAriaHidden`: when true, elements inside an `aria-hidden="true"`
 *     subtree are considered non-focusable (matching screen reader behaviour).
 * @returns {boolean}
 */
export const elementIsFocusable = (node, { excludeAriaHidden } = {}) => {
  // only element node can be focused, document, textNodes etc cannot
  if (node.nodeType !== 1) {
    return false;
  }
  if (node.hasAttribute("navi-focus-delegate")) {
    return false;
  }
  if (!canInteract(node)) {
    return false;
  }
  const canFocus = (node) =>
    elementIsVisibleForFocus(node, { excludeAriaHidden });

  const nodeName = node.nodeName.toLowerCase();
  if (nodeName === "input") {
    if (node.type === "hidden") {
      return false;
    }
    return canFocus(node);
  }
  if (FOCUSABLE_NODE_NAME_SET.has(nodeName)) {
    return canFocus(node);
  }
  if (["a", "area"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("href") === false) {
      return false;
    }
    return canFocus(node);
  }
  if (["audio", "video"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("controls") === false) {
      return false;
    }
    return canFocus(node);
  }
  if (nodeName === "summary") {
    return canFocus(node);
  }
  if (node.hasAttribute("tabindex") || node.hasAttribute("tabIndex")) {
    return canFocus(node);
  }
  if (node.hasAttribute("draggable")) {
    return canFocus(node);
  }
  return false;
};
const FOCUSABLE_NODE_NAME_SET = new Set([
  "button",
  "select",
  "datalist",
  "dialog",
  "iframe",
  "textarea",
]);

const canInteract = (element) => {
  if (element.disabled) {
    return false;
  }
  if (element.hasAttribute("inert")) {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert
    return false;
  }
  return true;
};
