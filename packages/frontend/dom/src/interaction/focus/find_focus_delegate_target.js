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
  const naviFocusDelegate = el.getAttribute("navi-focus-delegate");
  if (naviFocusDelegate === null || naviFocusDelegate === undefined) {
    return null;
  }
  if (naviFocusDelegate) {
    const delegateTarget = document.getElementById(naviFocusDelegate);
    if (delegateTarget && elementIsFocusable(delegateTarget)) {
      return delegateTarget;
    }
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
