import {
  closestOpenableAncestor,
  getAncestorOpenType,
  isAncestorOpen,
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
 *
 * The callback's second argument is always a `navi_displayed` CustomEvent,
 * with `detail: { ancestor, ancestorType }`:
 *   - No <dialog>/<details>/[popover]/[aria-expanded] ancestor at all →
 *     `{ ancestor: document, ancestorType: "document" }`.
 *   - Otherwise → `{ ancestor: <the matched element>, ancestorType: "dialog"
 *     | "popover" | "details" | "aria-expanded" }`.
 * Consumers that only care about a genuine top-level, no-ancestor mount
 * (e.g. use_auto_focus.js — an ancestor opening already has its own
 * transferFocus/openEffect placing focus, so re-running a per-element
 * autofocus for everything it reveals would fight that) can check
 * `event.detail.ancestorType === "document"`.
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

  // Run on mount (or when deps change) — but only if the element is visible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const ancestor = closestOpenableAncestor(el);
    if (!ancestor) {
      callbackRef.current(el, createDisplayedEvent(document));
      return;
    }
    if (!isAncestorOpen(ancestor)) {
      // Ancestor is closed — skip now; the observeAncestorOpenState call
      // below will fire once it opens.
      return;
    }
    callbackRef.current(el, createDisplayedEvent(ancestor));
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
      const lastEl = ref.current;
      callbackRef.current(lastEl, createDisplayedEvent(ancestor));
    });
  }, []);
};

const createDisplayedEvent = (ancestor) => {
  return new CustomEvent("navi_displayed", {
    detail: {
      ancestor,
      ancestorType: getAncestorOpenType(ancestor),
    },
  });
};
