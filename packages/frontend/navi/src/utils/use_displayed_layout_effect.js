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
 *     the callback once the ancestor opens — see addToggleBeforePaintCallback
 *     below for exactly how that's detected, and why it matters that it
 *     happens before the browser paints.
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
    const ancestor = el.closest("dialog, details, [popover], [aria-expanded]");
    if (!ancestor) {
      callbackRef.current(el, new CustomEvent("navi_displayed_on_document"));
      return;
    }
    if (!isAncestorOpen(ancestor)) {
      // Ancestor is closed — skip now; addToggleBeforePaintCallback below
      // will fire once it opens.
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
    const ancestor = el.closest("dialog, details, [popover], [aria-expanded]");
    if (!ancestor) {
      return undefined;
    }
    return addBeforePaintOpenCallback(ancestor, (event) => {
      const lastEl = ref.current;
      callbackRef.current(lastEl, event);
    });
  }, []);
};

const isAncestorOpen = (ancestor) => {
  if (ancestor.tagName === "DIALOG" || ancestor.hasAttribute("popover")) {
    return ancestor.matches(":popover-open, [open]");
  }
  if (ancestor.tagName === "DETAILS") {
    return ancestor.open;
  }
  return ancestor.getAttribute("aria-expanded") === "true";
};

/**
 * Notifies `callback` the moment `ancestor` opens — timed to land strictly
 * before the browser's next paint, so a caller doing layout/measurement work
 * in response (e.g. text_anchor.jsx repositioning a badge) never flashes the
 * still-closed state first.
 *
 * We deliberately do NOT use the native `toggle` event as the primary
 * signal, even though every <dialog>/<details>/[popover] fires one: per the
 * WHATWG spec it's dispatched via a *queued task* ("queue a popover toggle
 * event task"), not synchronously and not as a microtask. The element's
 * shown state itself (showPopover()/showModal()) still flips synchronously,
 * so the browser can — and does — paint it in its default, uncorrected
 * position before that queued task ever runs. Relying on `toggle` alone
 * means the correction always arrives one paint late.
 *
 * Instead we watch `open`/`aria-expanded` via MutationObserver:
 *   - <dialog>/<details> reflect `open` themselves, natively, synchronously.
 *   - This codebase's own Popover.jsx sets `aria-expanded` synchronously in
 *     the same call stack as showPopover() (see popover.jsx's own
 *     aria-expanded comments) — not part of any web standard, just this
 *     library's own convention, but reliable for anything built through it.
 * MutationObserver callbacks run as a microtask, strictly before paint —
 * exactly the timing we need, no ambiguity.
 *
 * The `toggle` listener is kept as a fallback, attached ONLY where the
 * MutationObserver above has no chance of ever firing: a bare [popover]
 * element with no `aria-expanded` of its own — i.e. one not built through
 * this codebase's own Popover.jsx (the only thing that reliably sets it).
 * That's the one case this file's author could think of with no other
 * synchronously-observable signal at all. It still arrives a paint late,
 * but a late correction beats none.
 *
 * This relies on `aria-expanded` genuinely being present on a navi Popover
 * by the time this code runs — see popover.jsx's own comments on why it
 * sets that attribute the way it does.
 *
 * @param {Element} ancestor
 * @param {(event: Event) => void} callback
 * @returns {() => void} cleanup — removes the observer/listener
 */
const addBeforePaintOpenCallback = (ancestor, callback) => {
  const needsToggleFallback =
    ancestor.hasAttribute("popover") && !ancestor.hasAttribute("aria-expanded");
  if (needsToggleFallback) {
    const onToggle = (e) => {
      if (!isAncestorOpen(ancestor)) {
        return;
      }
      callback(e);
    };
    ancestor.addEventListener("toggle", onToggle);
    return () => {
      ancestor.removeEventListener("toggle", onToggle);
    };
  }

  // Edge-triggered on purpose: some consumers (e.g. Popover.jsx) set
  // aria-expanded both imperatively (in their own openEffect, for precise
  // ordering relative to forced reflows/transitions) AND declaratively via a
  // JSX prop derived from the same open state — the latter is a deliberate
  // "always reflect current truth" prop, but Preact diffs against its own
  // previous *rendered* value, not the live DOM, so any later re-render that
  // happens to occur while already open re-applies the same "true" value as
  // a genuinely new attribute mutation. Tracking wasOpen here collapses that
  // redundant open→open mutation instead of re-running callback (and
  // therefore autofocus) a second time for the same open.
  let wasOpen = isAncestorOpen(ancestor);
  const observer = new MutationObserver(() => {
    const isOpen = isAncestorOpen(ancestor);
    if (isOpen === wasOpen) {
      return;
    }
    wasOpen = isOpen;
    if (!isOpen) {
      return;
    }
    callback(new CustomEvent("navi_displayed_on_document"));
  });
  observer.observe(ancestor, {
    attributes: true,
    attributeFilter: ["open", "aria-expanded"],
  });
  return () => {
    observer.disconnect();
  };
};
