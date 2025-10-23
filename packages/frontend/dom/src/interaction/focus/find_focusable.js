import { findDescendant } from "../../traversal.js";
import { getAssociatedElements } from "../../utils.js";
import { elementIsFocusable } from "./element_is_focusable.js";

export const findFocusable = (element) => {
  const associatedElements = getAssociatedElements(element);
  if (associatedElements) {
    for (const associatedElement of associatedElements) {
      const focusable = findFocusable(associatedElement);
      if (focusable) {
        return focusable;
      }
    }
    return null;
  }
  if (elementIsFocusable(element)) {
    return element;
  }
  const focusableDescendant = findDescendant(element, elementIsFocusable);
  return focusableDescendant;
};
