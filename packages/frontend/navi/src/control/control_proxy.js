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

import { findProxyControllers } from "./controller_registry.js";

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
 * Given a real control element, returns every proxy that visually represents
 * it — a control can have more than one (an "enable"/"disable" button pair for
 * one radio, for instance).
 *
 * Answered from the controller registry rather than the document: every proxy
 * declares itself through the `navi-control-proxy-for` prop, so the registry
 * knows them all, while asking the document means walking it in full for each
 * of the (overwhelmingly many) controls that have no proxy at all.
 *
 * Returns an empty array when no proxy exists for `el`.
 */
export const findControlProxies = (el) => {
  if (!el.id) {
    return [];
  }
  const proxyControllerSet = findProxyControllers(el.id);
  if (!proxyControllerSet) {
    return [];
  }
  const proxyElements = [];
  for (const proxyController of proxyControllerSet) {
    const proxyElement = proxyController.ref.current;
    if (proxyElement) {
      proxyElements.push(proxyElement);
    }
  }
  return proxyElements;
};

/**
 * Given a real control element, returns the proxy that visually represents it.
 *
 * Use when you need a single visible stand-in for the real control — anchoring
 * a callout, for instance. Anything notifying proxies of a state change wants
 * `findControlProxies` instead, so a control represented by several of them
 * updates all of them.
 *
 * Returns `null` when no proxy exists for `el`.
 */
export const findControlProxy = (el) => {
  const [firstProxy = null] = findControlProxies(el);
  return firstProxy;
};
