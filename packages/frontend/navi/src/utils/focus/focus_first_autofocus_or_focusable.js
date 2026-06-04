import { findFocusable, getElementSignature } from "@jsenv/dom";

/**
 * Mirrors what browsers do when navigating to a page:
 * 1. Focus the first element with [navi-autofocus] (but not [navi-autofocus="fallback"]) inside the container
 * 2. Fall back to the first focusable element
 * 3. Fall back to the first element with [navi-autofocus="fallback"]
 * Does nothing if no candidate is found.
 */
export const focusFirstAutofocusOrFocusable = (containerEl, debugFocus, e) => {
  let target = containerEl.querySelector(
    "[navi-autofocus]:not([navi-autofocus='fallback'])",
  );
  if (!target) {
    target = findFocusable(containerEl);
  }
  if (!target) {
    target = containerEl.querySelector("[navi-autofocus='fallback']");
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
