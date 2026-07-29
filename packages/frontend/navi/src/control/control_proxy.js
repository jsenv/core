/**
 * DOM utilities for the proxy control pattern.
 *
 * Some components need a native `<input>` internally — for form submission,
 * constraint validation, or browser autofill — but the user may not want to
 * display that input at all. In those cases the input is hidden and a separate
 * visible element (the proxy) takes over the visual and interactive role.
 *
 * The typical use case is `SelectableList`: each list item acts as a styled
 * radio button, but an actual `<input type="radio">` lives hidden in the DOM
 * so form submission and validation work natively.  When users DO want to
 * display the input they want full control over its appearance, so they render
 * their own element and link it to the real input via `navi-control-proxy-for`:
 *
 * ```html
 *  <div>
 *   <input id="color_red" type="radio" name="color" value="red"  /> ← real control (hidden, drives form/validation)
 *   <input type="radio" name="proxy" value="red" />                 ← proxy (visible, delegates interactions to real input)
 * </div>
 * ```
 *
 * When the proxy is interacted with, navi events are forwarded to the real
 * control so validation, state management, and form submission all work
 * through the real input.
 *
 * Note: an alternative design would be to require users to always instantiate
 * the input explicitly — e.g. `<Selectable.Input headless />` when they don't
 * want to display it. That would remove the need for the proxy mechanism
 * entirely. For now we keep the proxy pattern.
 */

/**
 * Given a proxy element, returns the real control it represents.
 * Returns `null` when `el` is not a proxy.
 */
export const findControlProxyTarget = (el) => {
  const proxyFor = el.getAttribute("navi-control-proxy-for");
  if (!proxyFor) {
    return null;
  }
  return document.getElementById(proxyFor);
};

/**
 * Given a real control element, returns the proxy that visually represents it.
 *
 * Use when you need to update or recheck the proxy's visual state after the
 * real control's state changes, or when anchoring a callout to the visible
 * element rather than the hidden real input.
 *
 * Returns `null` when no proxy exists for `el`.
 */
export const findControlProxy = (el) => {
  if (!el.id) {
    return null;
  }
  return document.querySelector(
    `[navi-control-proxy-for="${CSS.escape(el.id)}"]`,
  );
};
