import { findFocusable, getElementSignature } from "@jsenv/dom";

/**
 * Mirrors what browsers do when navigating to a page:
 * 1. Focus the first element with [navi-autofocus] (but not [navi-autofocus="fallback"]) inside the container
 * 2. Fall back to the first focusable element
 * 3. Fall back to the first element with [navi-autofocus="fallback"]
 * Does nothing if no candidate is found.
 */
export const focusFirstAutofocusOrFocusable = (containerEl, debugFocus, e) => {
  let target;
  const naviAutoFocus = containerEl.querySelector(
    "[navi-autofocus]:not([navi-autofocus='fallback'])",
  );
  target = naviAutoFocus;
  if (!target) {
    const focusable = findFocusable(containerEl);
    target = focusable;
  }
  if (!target) {
    const naviAutoFocusFallback = containerEl.querySelector(
      "[navi-autofocus='fallback']",
    );
    target = naviAutoFocusFallback;
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
