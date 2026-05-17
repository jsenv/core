import { findFocusable, getElementSignature } from "@jsenv/dom";

/**
 * Mirrors what browsers do when navigating to a page:
 * 1. Focus the first element with [navi-autofocus] inside the container
 * 2. Fall back to the first focusable element
 * Does nothing if no candidate is found.
 */
export const focusFirstAutofocusOrFocusable = (containerEl, debugFocus, e) => {
  let target = containerEl.querySelector("[navi-autofocus]");
  if (!target) {
    target = findFocusable(containerEl);
  }
  if (!target) {
    return;
  }
  debugFocus(
    e,
    `Moving focus to ${getElementSignature(target)}.focus({ preventScroll: true })`,
  );
  target.focus({ preventScroll: true });
};
