import { findDescendant } from "../../traversal.js";
import { getAssociatedElements } from "../../utils.js";
import { elementIsFocusable } from "./element_is_focusable.js";

export const findFocusable = (element, { exclude } = {}) => {
  const associatedElements = getAssociatedElements(element);
  if (associatedElements) {
    for (const associatedElement of associatedElements) {
      const focusable = findFocusable(associatedElement, { exclude });
      if (focusable) {
        return focusable;
      }
    }
    return null;
  }
  const isFocusable = (node) => {
    if (!elementIsFocusable(node)) {
      return false;
    }
    if (exclude && exclude(node)) {
      return false;
    }
    return true;
  };
  if (isFocusable(element)) {
    return element;
  }
  const focusableDescendant = findDescendant(element, isFocusable);
  if (focusableDescendant) {
    // If the first focusable is an unchecked radio/checkbox, prefer the checked
    // sibling in the same group (mirrors native browser radio focus behavior
    // and gives focus to the selected item in a selectable list).
    const { tagName, type, name } = focusableDescendant;
    if (
      tagName === "INPUT" &&
      (type === "radio" || type === "checkbox") &&
      !focusableDescendant.checked &&
      name
    ) {
      const groupContainer = focusableDescendant.form || document;
      const checkedInput = groupContainer.querySelector(
        `input[type="${type}"][name="${CSS.escape(name)}"]:checked`,
      );
      if (checkedInput) {
        return checkedInput;
      }
    }
  }
  return focusableDescendant;
};
