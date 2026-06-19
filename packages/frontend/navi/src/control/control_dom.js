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
 *
 * See control_proxy.js for the `navi-control-proxy-for` pattern.
 */

/**
 * Returns the host element inside `el` — the element that holds the control's
 * value, UI state, and constraints (i.e. the element onto which
 * `useInteractiveProps` spreads `controlProps` and its event handlers).
 *
 * Returns `null` when `el` is itself the host (no separate wrapper).
 */
export const findControlHost = (el) => {
  if (el.hasAttribute("navi-control-host")) {
    return el;
  }
  return el.querySelector("[navi-control-host]");
};
export const isControlRoot = (el) => {
  return el.hasAttribute("navi-control");
};
export const isControlHost = (el) => {
  return el.hasAttribute("navi-control-host");
};
export const isControl = (el) => {
  return isControlRoot(el) || isControlHost(el);
};

/**
 * Returns the nearest ancestor of `el` (exclusive of `el`'s own control) that
 * has a `[data-action]` attribute.
 *
 * The search walks up `parentElement` manually (rather than using `.closest()`)
 * so it can stop at hard boundaries.
 *
 * **`[navi-control="picker"]` boundary**: a picker is a hard stop. Elements inside a picker
 * (including inside its popover content) can reach the picker itself, but nothing above it.
 * This prevents an input inside a picker from accidentally submitting a parent form.
 *
 * ```html
 * <form data-action="outer">              ← NOT found (above picker boundary)
 *   <button navi-control="picker" data-action="p">  ← found and search stops here
 *     <input navi-control-host />         ← el (in picker button area)
 *     <div popover>
 *       <input navi-control-host />       ← el (in picker popover)
 *     </div>
 *   </button>
 * </form>
 * ```
 */
export const findClosestControlWithAction = (el) => {
  let current = el;
  while (current) {
    if (current.hasAttribute("data-action")) {
      return current;
    }
    // Stop at a picker boundary — nothing above the picker is reachable from within.
    if (current.getAttribute("navi-control") === "picker") {
      return undefined;
    }
    current = current.parentElement;
  }
  return undefined;
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
 * Returns the root element of the control that `el` belongs to, or `null` if
 * `el` is not part of a control.
 *
 * Use this when you have an element that may be a host (inner input) and need
 * the visual boundary of its control — e.g. to anchor a callout, track
 * mousedown interactions, or measure the control's bounding box.
 */
export const findControlRoot = (el) => {
  if (el.hasAttribute("navi-control")) {
    return el;
  }
  if (el.hasAttribute("navi-control-host")) {
    return el.closest("[navi-control]");
  }
  return null;
};
