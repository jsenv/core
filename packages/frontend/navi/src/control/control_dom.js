/**
 * DOM utilities for navigating the control element hierarchy.
 *
 * A control is a self-contained interactive widget. Its DOM structure can be
 * either flat (host only) or layered (wrapper + host):
 *
 * Flat — the element is both the root and the host:
 * ```html
 * <button navi-control navi-control-host>Click me</button>
 * ```
 *
 * Layered — a visual wrapper surrounds a native input that is the real host:
 * ```html
 * <span navi-control>           ← wrapper: root of the control's DOM subtree
 *   <input navi-control-host /> ← host: holds controlProps, value, UI state, constraints
 * </span>
 * ```
 *
 * Attribute roles:
 *  - `navi-control`           boolean, on the wrapper/root; marks the control boundary
 *  - `navi-control-host`      boolean, on the host; set automatically by `useInteractiveProps`
 *  - `navi-control-proxy-for` on a proxy element; id of the real control it forwards events to
 *
 */

/**
 * Returns the host element inside `el` — the element that holds the control's
 * value, UI state, and constraints (i.e. the element onto which
 * `useInteractiveProps` spreads `controlProps` and its event handlers).
 *
 * Returns `null` when `el` is itself the host (no separate wrapper).
 */
export const findControlHost = (el) => {
  return el.querySelector("[navi-control-host]");
};

/**
 * Returns the nearest ancestor of `el` (exclusive) that has a `[data-action]`
 * attribute.
 *
 * Because [data-action] is set on the host we can use .closest
 *
 * ```html
 * <form data-action="something_else">                      ← found by closest
 *   <span navi-control>                                    ← wrapper, no data-action
 *     <input navi-control-host data-action="something" />  ← el, might have data-action
 *   </span>
 * </form>
 * ```
 */
export const findClosestControlWithAction = (el) => {
  return el.parentNode.closest("[data-action]");
};

/**
 * Returns the closest ancestor control element of `el` — i.e. the nearest
 * `[navi-control]` element that is not the control `el` belongs to.
 *
 * `navi-control` is only on wrapper elements, never on hosts. So
 * `el.closest("[navi-control]")` from a host returns that host's own wrapper,
 * and one more `.parentNode.closest("[navi-control]")` reaches a true ancestor:
 *
 * ```html
 * <button navi-control>              ← outer control  (returned)
 *   <span navi-control>              ← inner wrapper  (skipped via parentNode)
 *     <input navi-control-host />    ← el
 *   </span>
 * </button>
 * ```
 */
export const getParentControl = (el) => {
  const ownControlRoot = el.closest("[navi-control]");
  const parentControlRoot = ownControlRoot.parentNode.closest("[navi-control]");
  return parentControlRoot;
};

/**
 * Returns the control root element of `el` — the nearest `[navi-control]`
 * ancestor-or-self (the wrapper in layered controls, `el` itself in flat ones).
 *
 * Useful when the visual anchor for a callout or tooltip should be the
 * control's visible root rather than the inner host element.
 */
export const getControlRoot = (el) => {
  return el.closest("[navi-control]");
};

export const getControlProxyTarget = (el) => {
  const proxyFor = el.getAttribute("navi-control-proxy-for");
  if (!proxyFor) {
    return null;
  }
  const realControl = document.getElementById(proxyFor);
  return realControl;
};
