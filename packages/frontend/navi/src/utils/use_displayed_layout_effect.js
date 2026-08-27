import {
  closestOpenableAncestor,
  getAncestorOpenType,
  isAncestorOpen,
  isDisplayedDespiteClosedAncestor,
  observeAncestorOpenState,
} from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

/**
 * A variant of useLayoutEffect that accounts for ancestor <dialog>/<details>
 * or popover visibility.
 *
 * Motivation: some effects (auto-scroll, measurement, focus) only make sense
 * when the element is actually presented on screen. A plain useLayoutEffect
 * fires on mount even when the component is inside a closed <dialog>, a
 * collapsed <details>, or a hidden popover, where scroll and layout operations
 * are no-ops.
 *
 * Behavior:
 *   - No <dialog>/<details>/[popover] ancestor → runs like a normal
 *     useLayoutEffect with the provided deps.
 *   - Inside a closed/hidden ancestor → skips the initial run; instead runs
 *     the callback once the ancestor opens — see @jsenv/dom's own
 *     observeAncestorOpenState for exactly how that's detected, and why it
 *     matters that it happens before the browser paints.
 *   - Inside an open ancestor → runs on mount AND every subsequent open.
 *   - Inside the always-on-screen part of a *closed* one — a picker's façade,
 *     an expandable's header, a <summary>: those elements are displayed the
 *     whole time their ancestor reads as closed (aria-expanded on a trigger
 *     describes the popup it controls, not its own contents). They run on
 *     mount like anything else on screen, and the ancestor opening later
 *     reveals nothing about them, so it does not re-run them either. See
 *     isDisplayedDespiteClosedAncestor in @jsenv/dom.
 *
 * The callback's second argument is always a `navi_displayed` CustomEvent,
 * with `detail: { ancestor, ancestorType, becauseAncestorOpened }`:
 *   - No <dialog>/<details>/[popover]/[aria-expanded] ancestor at all →
 *     `{ ancestor: document, ancestorType: "document" }`.
 *   - Otherwise → `{ ancestor: <the matched element>, ancestorType: "dialog"
 *     | "popover" | "details" | "aria-expanded" }`.
 * `becauseAncestorOpened` distinguishes the two ways of coming on screen:
 *   - true — the element was already mounted and the ancestor just opened,
 *     revealing it along with everything else it holds. The opening has an
 *     owner (the ancestor's own transferFocus/openEffect), and what it reveals
 *     should defer to it — see use_auto_focus.js.
 *   - false — the element was mounted just now, into a surface already on
 *     screen (or into the plain document). Nothing else owns this appearance:
 *     what the element says about itself (an autofocus, a measurement) is the
 *     only word there is.
 *
 * Usage:
 *   useDisplayedLayoutEffect(ref, () => {
 *     scrollToSelected();
 *   }, []);
 */
export const useDisplayedLayoutEffect = (ref, callback, deps) => {
  if (typeof callback !== "function") {
    throw new TypeError("useDisplayedLayoutEffect: callback is not a function");
  }

  // Keep a stable ref so the open listener always calls the latest callback
  // without needing to be re-registered when deps change.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Set by the mount effect below for an element that lives in its openable
  // ancestor's façade rather than in what that ancestor opens.
  const displayedWhileAncestorClosedRef = useRef(false);

  // Run on mount (or when deps change) — but only if the element is visible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const ancestor = closestOpenableAncestor(el);
    if (!ancestor) {
      callbackRef.current(el, createDisplayedEvent(document, false));
      return;
    }
    if (!isAncestorOpen(ancestor)) {
      if (!isDisplayedDespiteClosedAncestor(el)) {
        // Ancestor is closed and took this element off screen with it — skip
        // now; the observeAncestorOpenState call below will fire once it
        // opens.
        return;
      }
      // Closed, yet on screen: the ancestor is the trigger of what is
      // closed, not the thing itself, and this element belongs to the façade
      // it keeps showing.
      displayedWhileAncestorClosedRef.current = true;
    }
    callbackRef.current(el, createDisplayedEvent(ancestor, false));
  }, deps);

  // Re-run every time the ancestor opens.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const ancestor = closestOpenableAncestor(el);
    if (!ancestor) {
      return undefined;
    }
    return observeAncestorOpenState(ancestor, ({ isOpen }) => {
      if (!isOpen) {
        return;
      }
      if (displayedWhileAncestorClosedRef.current) {
        // Façade content: on screen the whole time, so this opening reveals
        // nothing here — and `becauseAncestorOpened: true` about it would be
        // false in a way consumers act on (see use_auto_focus.js).
        return;
      }
      const lastEl = ref.current;
      callbackRef.current(lastEl, createDisplayedEvent(ancestor, true));
    });
  }, []);
};

const createDisplayedEvent = (ancestor, becauseAncestorOpened) => {
  return new CustomEvent("navi_displayed", {
    detail: {
      ancestor,
      ancestorType: getAncestorOpenType(ancestor),
      becauseAncestorOpened,
    },
  });
};
