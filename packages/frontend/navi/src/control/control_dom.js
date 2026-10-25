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

import { SELF_INTERACTIONS_ATTRIBUTE } from "./self_interactions.js";

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
/**
 * The control this element belongs to, wherever it sits relative to it.
 *
 * `findControlHost` above answers for a control's own DOM (itself, or the native
 * element it wraps). This one is for something that is not part of a control but
 * has to reach one — an interaction declared on a box (see
 * interaction/interactions.js), which may be the control, may sit inside it, or
 * may be a wrapper around exactly one. Nearest wins in that order, and the answer
 * is null when there is no control the box belongs to: not every box lives in
 * one, and a box laying out several controls (a row of badges, a toolbar) is
 * held by none of them — its interactions are its own, and a press on its empty
 * part is not a press on the first control it happens to contain.
 */
export const findNearestControlHost = (el) => {
  // Itself, then upwards — the box is inside a button, or is one.
  const selfOrAncestor = el.closest("[navi-control-host]");
  if (selfOrAncestor) {
    return selfOrAncestor;
  }
  // …then downwards, only when the box wraps a single control. Counted by
  // control, not by host: a picker holds the hosts of its popup content, and a
  // box around that one picker is still around one control.
  let single = null;
  for (const host of el.querySelectorAll("[navi-control-host]")) {
    const controlRoot = host.closest("[navi-control]") || host;
    const controlAbove = controlRoot.parentElement.closest("[navi-control]");
    if (controlAbove && el.contains(controlAbove)) {
      continue;
    }
    if (single && single !== controlRoot) {
      return null;
    }
    single = controlRoot;
  }
  return single ? findControlHost(single) : null;
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
 * **`[navi-control="picker"]` boundary**: a picker is a hard stop for what is
 * inside its popup. Elements in there can reach the picker itself, but nothing
 * above it — an input inside a picker must not submit the form around it. The
 * picker's own trigger is not inside it: a picker pressed as a whole (a confirm
 * picker sending the form around it, see picker_confirm.jsx) stands in that
 * form like any control there, and reaches it.
 *
 * ```html
 * <form data-action="outer">              ← found from the picker's own input,
 *   <button navi-control="picker" data-action="p">  NOT from inside its popup
 *     <input navi-control-host />         ← el (the picker's own input)
 *     <div popover data-picker-content>
 *       <input navi-control-host />       ← el (in picker popover): stops at the picker
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
    if (isPickerBoundaryFor(current, el)) {
      return undefined;
    }
    current = current.parentElement;
  }
  return undefined;
};
const isPickerBoundaryFor = (candidate, el) => {
  if (candidate.getAttribute("navi-control") !== "picker") {
    return false;
  }
  const content = el.closest("[data-picker-content]");
  return Boolean(content) && candidate.contains(content);
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
  if (!ownControlRoot) {
    // In no control at all (a list's root, a plain element): none around it.
    return null;
  }
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

// What a press can be aimed at inside something else: a native control, a
// link, a label, an editable region, a media player's controls, a navi
// control (a wheel is a <div>), and an element claiming its own interactions
// (see self_interactions.js).
const PRESS_TARGET_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "[role='button']",
  "[contenteditable='']",
  "[contenteditable='true']",
  "audio[controls]",
  "video[controls]",
  "[navi-control]",
  "[navi-control-host]",
  `[${SELF_INTERACTIONS_ATTRIBUTE}]`,
].join(", ");

/**
 * Whether `event` was aimed at a control strictly inside `box` — a field, a
 * button, a link, a navi control, an element claiming its own interactions —
 * rather than at the box itself.
 *
 * The question every box that answers a press on its blank space has to ask: a
 * row that folds, a card that opens, a viewer that closes on its background.
 * Bounded by the box, so a list or a dialog around it is never mistaken for
 * what was pressed, and the box being a button itself is not a control inside
 * it.
 *
 * @param {Event} event The press — a click, a pointerdown, an interaction's
 *   `detail.event`.
 * @param {Element} box The element answering it.
 * @returns {boolean}
 */
export const isPressOnControl = (event, box) => {
  const target = event?.target;
  if (!target || target.nodeType !== 1) {
    return false;
  }
  const pressTarget = target.closest(PRESS_TARGET_SELECTOR);
  return (
    Boolean(pressTarget) && pressTarget !== box && box.contains(pressTarget)
  );
};
