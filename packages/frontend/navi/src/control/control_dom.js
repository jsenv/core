export const getControlProxyTarget = (el) => {
  const proxyFor = el.getAttribute("navi-control-proxy-for");
  if (!proxyFor) {
    return null;
  }
  const realControl = document.getElementById(proxyFor);
  return realControl;
};

export const findControlInput = (el) => {
  const naviControlInputAttribute = el.getAttribute("navi-control-input");
  if (!naviControlInputAttribute) {
    return null;
  }
  const inputEl = el.querySelector(naviControlInputAttribute);
  return inputEl;
};

/**
 * Returns the closest parent control element of `el`.
 *
 * When `el` has `navi-control-owner` it is a custom UI element rendered in
 * place of the real input. We first jump to its owner wrapper, then walk up
 * from there so we skip the control that owns this input and reach a true
 * ancestor control.
 *
 * HTML structure:
 * ```html
 * <button navi-control>                              ← outer control (e.g. a Picker button)
 *   <span navi-control navi-control-input="input">   ← inner control wrapper
 *     <input navi-control-owner="[navi-control]" />  ← control input (el), owned by the inner span
 *   </span>
 * </button>
 * ```
 *
 * Cannot simply use `el.closest("[navi-control]")` because when `el` is
 * the control input itself it already sits *inside* the control wrapper — a
 * plain `closest` would return the wrapper the input belongs to, not an
 * ancestor control.
 */
export const getParentControl = (el) => {
  let ancestor;
  const renderedBy = el.getAttribute("navi-control-owner");
  if (renderedBy) {
    ancestor = el.closest(renderedBy).parentNode;
  } else {
    ancestor = el.parentNode;
  }
  const closestControl = ancestor.closest("[navi-control]");
  return closestControl;
};
