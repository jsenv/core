import { findDescendant } from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";

export const findFocusable = (element) => {
  if (element.tagName === "COL") {
    const table = element.closest("table");
    const columnIndex = Array.from(element.parentNode.children).indexOf(
      element,
    );
    const allRows = table.querySelectorAll("tr");
    for (const row of allRows) {
      const cells = row.children;
      const cellInThatColumn = cells[columnIndex];
      if (!cellInThatColumn) {
        continue;
      }
      const focusable = findFocusable(cellInThatColumn);
      if (focusable) {
        return focusable;
      }
    }
    return null;
  }

  if (elementIsFocusable(element)) {
    return element;
  }
  return findDescendant(element, elementIsFocusable);
};
