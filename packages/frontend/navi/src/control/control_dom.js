/**
 * DOM utilities for navigating the control element hierarchy.
 *
 * A control is a self-contained interactive widget. Its DOM structure can be
 * either flat (host only) or layered (wrapper + host):
 *
 * Flat — the element is both the root and the host:
 * ```html
 * <button navi-control data-action="submit">Click me</button>
 * ```
 *
 * Layered — a visual wrapper surrounds a native input that is the real host:
 * ```html
 * <span
 *   navi-control                           ← wrapper: root of the control's DOM subtree
 *   navi-control-host=".navi_input"        ← points to the inner host element
 *   data-action="submit"
 * >
 *   <input
 *     class="navi_input"                  ← host: holds controlProps, value, UI state, constraints
 *     navi-control-root="[navi-control]"  ← points back to the wrapper (its root)
 *   />
 * </span>
 * ```
 *
 * Attribute roles:
 *  - `navi-control`             boolean, always on the wrapper/root; marks the control boundary
 *  - `navi-control-host`        on the wrapper; CSS selector that identifies the inner host element
 *  - `navi-control-root`        on the host; CSS selector that identifies the wrapper it belongs to
 *  - `navi-control-proxy-for`   on a proxy element; id of the real control it forwards events to
 */

/**
 * Returns the nearest ancestor of `el` (exclusive) that has a `[data-action]`
 * attribute.
 *
 * Starts from `el.parentNode` to skip `el` itself: `el` is the host and may
 * carry `data-action`, but we want an ancestor's action, not the host's own.
 * The wrapper never has `data-action`, so `closest` reaches the right target:
 *
 * ```html
 * <form data-action="something_else">              ← found by closest
 *   <span navi-control navi-control-host="input">  ← wrapper, no data-action
 *     <input data-action="something" />            ← el (host), might have data-action
 *   </span>
 * </form>
 * ```
 */
export const findClosestControlWithAction = (el) => {
  return el.parentNode.closest("[data-action]");
};

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
 * Returns the closest ancestor control element of `el` — i.e. the nearest
 * `[navi-control]` element that is not the control `el` belongs to.
 *
 * `navi-control` is always on the **wrapper** (the root of a control's DOM
 * subtree), never on the host (the inner element that holds `controlProps`).
 * That means a plain `el.closest("[navi-control]")` from the host would return
 * the host's own wrapper, not a true ancestor control.
 *
 * When `el` carries `navi-control-root` it is a host element nested inside a
 * wrapper; the attribute value is a CSS selector that identifies that wrapper.
 * We jump to the wrapper first, then walk up from there:
 *
 * ```html
 * <button navi-control>                                   ← outer control  (returned)
 *   <span navi-control navi-control-host="input">         ← inner wrapper  (skipped)
 *     <input navi-control-root="[navi-control]" />        ← el (host)
 *   </span>
 * </button>
 * ```
 */
export const getParentControl = (el) => {
  let ancestor;
  const renderedBy = el.getAttribute("navi-control-root");
  if (renderedBy) {
    ancestor = el.closest(renderedBy).parentNode;
  } else {
    ancestor = el.parentNode;
  }
  const closestControl = ancestor.closest("[navi-control]");
  return closestControl;
};

/**
 * When `el` is a host nested inside a wrapper, returns the wrapper element.
 * Otherwise returns `null`.
 *
 * Useful when the visual anchor for a callout or tooltip should be the
 * control's visible root rather than the inner host element.
 */
export const getControlRoot = (el) => {
  const rootSelector = el.getAttribute("navi-control-root");
  if (!rootSelector) {
    return null;
  }
  return el.closest(rootSelector);
};
