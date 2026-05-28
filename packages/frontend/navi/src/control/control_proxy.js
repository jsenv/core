/**
 * DOM utilities for the proxy control pattern.
 *
 * A proxy is a visible, interactive element that acts on behalf of a hidden
 * real control. The proxy carries `navi-control-proxy-for="<id>"` where `<id>`
 * is the `id` of the real control it represents.
 *
 * This is used when the native input must stay in the DOM for form submission
 * or constraint validation, but cannot be the visible interactive element —
 * e.g. a styled radio/checkbox list item that drives a hidden `<input>`:
 *
 * ```html
 * <div>
 *   <input id="color_red" type="radio" name="color" value="red"  /> ← real control (hidden)
 *   <input type="radio" name="proxy" value="red" />                 ← proxy (visible, interactive)
 * </div>
 * ```
 *
 * When the proxy is interacted with, navi events are forwarded to the real
 * control so validation, state management, and form submission all work
 * through the real input.
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
