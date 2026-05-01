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
 *     the callback every time the ancestor opens (toggle event, newState=open).
 *   - Inside an open ancestor → runs on mount AND every subsequent open.
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

  // Keep a stable ref so the toggle listener always calls the latest callback
  // without needing to be re-registered when deps change.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Run on mount (or when deps change) — but only if the element is visible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const ancestor = el.closest("dialog, details, [popover]");
    if (!ancestor) {
      callbackRef.current(el, new CustomEvent("navi_displayed_on_document"));
      return;
    }
    if (!isAncestorOpen(ancestor)) {
      // Ancestor is closed — skip now; the toggle listener below will fire.
      return;
    }
    callbackRef.current(el, new CustomEvent("navi_displayed_on_document"));
  }, deps);

  // Re-run every time the ancestor opens.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const ancestor = el.closest("dialog, details, [popover]");
    if (!ancestor) {
      return undefined;
    }
    const onToggle = (e) => {
      // <dialog> and [popover] fire toggle with newState; <details> uses the
      // older toggle event without newState — fall back to checking .open.
      const isOpen =
        e.newState !== undefined ? e.newState === "open" : e.target.open;
      if (!isOpen) {
        return;
      }
      callbackRef.current(el, e);
    };
    ancestor.addEventListener("toggle", onToggle);
    return () => {
      ancestor.removeEventListener("toggle", onToggle);
    };
  }, []);
};

const isAncestorOpen = (ancestor) => {
  if (ancestor.tagName === "DIALOG" || ancestor.hasAttribute("popover")) {
    return ancestor.matches(":popover-open, [open]");
  }
  // details
  return ancestor.open;
};
