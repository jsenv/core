import { elementIsFocusable } from "./element_is_focusable.js";

/**
 * Given an element with the `navi-focus-delegate` attribute, returns the first
 * focusable ancestor that should receive focus instead.
 *
 * Elements marked with `navi-focus-delegate` opt out of being focusable
 * themselves (see {@link elementIsFocusable}) and redirect focus upward to
 * their nearest focusable ancestor.
 *
 * Returns `null` when the attribute is absent or no focusable ancestor exists.
 *
 * @param {Element} el
 * @returns {Element|null}
 */
export const findFocusDelegateTarget = (el) => {
  if (!el.hasAttribute("navi-focus-delegate")) {
    return null;
  }
  let ancestor = el.parentElement;
  while (ancestor) {
    if (elementIsFocusable(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
};
