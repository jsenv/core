import { useLayoutEffect, useRef } from "preact/hooks";

/**
 * A variant of useLayoutEffect that accounts for ancestor <dialog>/<details>
 * visibility.
 *
 * Motivation: some effects (auto-scroll, measurement, focus) only make sense
 * when the element is actually presented on screen. A plain useLayoutEffect
 * fires on mount even when the component is inside a closed <dialog> or a
 * collapsed <details>, where scroll and layout operations are no-ops.
 *
 * Behavior:
 *   - No <dialog>/<details> ancestor → runs like a normal useLayoutEffect with
 *     the provided deps (callback is only skipped when the element is not yet
 *     in the DOM, which should not happen).
 *   - Inside a closed <dialog>/<details> → skips the initial run; instead runs
 *     the callback every time the ancestor opens (toggle event, newState=open).
 *   - Inside an open <dialog>/<details> → runs on mount AND every subsequent
 *     time the ancestor opens.
 *
 * Usage:
 *   useVisibleLayoutEffect(ref, () => {
 *     scrollToSelected();
 *   }, []);
 */
export const useDisplayedLayoutEffect = (ref, callback, deps) => {
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
    const ancestor = el.closest("dialog, details");
    if (!ancestor) {
      callbackRef.current(el, new CustomEvent("navi_opened"));
      return;
    }
    if (!ancestor.open) {
      // Ancestor is closed — skip now; the toggle listener below will fire.
      return;
    }
    callbackRef.current(el, new CustomEvent("navi_opened"));
  }, deps);

  // Re-run every time the ancestor opens.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const ancestor = el.closest("dialog, details");
    if (!ancestor) {
      return undefined;
    }
    const onToggle = (e) => {
      const isOpen =
        e.target.tagName === "DIALOG" ? e.newState === "open" : e.target.open;
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
