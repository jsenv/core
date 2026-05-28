export const getControlProxyTarget = (el) => {
  const proxyFor = el.getAttribute("navi-control-proxy-for");
  if (!proxyFor) {
    return null;
  }
  const realControl = document.getElementById(proxyFor);
  return realControl;
};

/**
 * Returns the host element inside `el` — the element that holds the control's
 * value, UI state, and constraints (i.e. the element onto which
 * `useInteractiveProps` spreads `controlProps` and its event handlers).
 *
 * When a control is composed of a visual wrapper and a native input, the
 * wrapper gets `remainingProps` (layout, CSS vars, …) while the inner input
 * gets `controlProps` — including all the navi event handlers
 * (`onnavi_request_action`, `onnavi_cancel`, etc.).  To dispatch a navi event
 * that the control will actually handle, you must target that inner element,
 * not the wrapper.
 *
 * The wrapper signals which element is the host via the
 * `navi-control-host` attribute whose value is a CSS selector:
 * ```html
 * <span navi-control navi-control-host=".navi_control_input">  ← wrapper
 *   <input class="navi_control_input" />                       ← host element (value, state, constraints)
 * </span>
 * ```
 *
 * Returns `null` when `el` is itself the host (no separate inner element).
 * Callers that need "the right target regardless" should use
 * {@link getControlHostEl} instead.
 */
export const findControlHost = (el) => {
  const naviControlHostAttribute = el.getAttribute("navi-control-host");
  if (!naviControlHostAttribute) {
    return null;
  }
  const hostEl = el.querySelector(naviControlHostAttribute);
  return hostEl;
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
 *   <span navi-control navi-control-host="input">   ← inner control wrapper
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
