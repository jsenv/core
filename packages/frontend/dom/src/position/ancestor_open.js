// Shared by navi's own use_displayed_layout_effect.js (rich "navi_displayed"
// CustomEvent, open transitions only) and visible_rect.js (needs both
// directions: hide when a container closes, recheck when it reopens) — the
// selector/open-detection/timing primitives are identical for both, only
// what each does with a transition differs.
const ANCESTOR_OPEN_SELECTOR = "dialog, details, [popover], [aria-expanded]";

export const closestOpenableAncestor = (element) => {
  const parentElement = element.parentElement;
  if (!parentElement) {
    return null;
  }
  if (!parentElement.closest) {
    return null;
  }
  return parentElement.closest(ANCESTOR_OPEN_SELECTOR);
};

export const isAncestorOpen = (ancestor) => {
  if (ancestor.tagName === "DIALOG" || ancestor.hasAttribute("popover")) {
    return ancestor.matches(":popover-open, [open]");
  }
  if (ancestor.tagName === "DETAILS") {
    return ancestor.open;
  }
  if (ancestor.hasAttribute("aria-expanded")) {
    return ancestor.getAttribute("aria-expanded") === "true";
  }
  return true;
};

export const getAncestorOpenType = (ancestor) => {
  if (ancestor === document) {
    return "document";
  }
  if (ancestor.tagName === "DIALOG") {
    return "dialog";
  }
  if (ancestor.hasAttribute("popover")) {
    return "popover";
  }
  if (ancestor.tagName === "DETAILS") {
    return "details";
  }
  if (ancestor.hasAttribute("aria-expanded")) {
    return `${ancestor.tagName}[aria-expanded]`;
  }
  return `${ancestor.tagName}`;
};

/**
 * Notifies `callback({ isOpen, ancestor, ancestorType, toggleEvent })` the
 * moment `ancestor`'s open state changes, in either direction — timed to
 * land strictly before the browser's next paint, so a caller reacting to it
 * (measurement, visibility tracking, layout) never flashes the stale state
 * first. Plain object, not a CustomEvent — there's no real DOM event behind
 * most of these transitions (see `toggleEvent` below), so wrapping the info
 * in one would mostly be manufacturing a fake event for no benefit.
 *
 * We deliberately do NOT use the native `toggle` event as the primary
 * signal, even though every <dialog>/<details>/[popover] fires one: per the
 * WHATWG spec it's dispatched via a *queued task* ("queue a popover toggle
 * event task"), not synchronously and not as a microtask. The element's
 * shown state itself (showPopover()/showModal()) still flips synchronously,
 * so the browser can — and does — paint it in its default, uncorrected
 * state before that queued task ever runs. Relying on `toggle` alone means
 * a reaction to it always arrives one paint late.
 *
 * Instead we watch `open`/`aria-expanded` via MutationObserver:
 *   - <dialog>/<details> reflect `open` themselves, natively, synchronously.
 *   - navi's own Popover.jsx sets `aria-expanded` synchronously in the same
 *     call stack as showPopover() (see popover.jsx's own aria-expanded
 *     comments) — not part of any web standard, just that library's own
 *     convention, but reliable for anything built through it.
 * MutationObserver callbacks run as a microtask, strictly before paint —
 * exactly the timing needed, no ambiguity. `toggleEvent` is `undefined` on
 * this path (there's no native event to report — a mutation record isn't
 * one).
 *
 * The `toggle` listener is kept as a fallback, attached ONLY where the
 * MutationObserver above has no chance of ever firing: a bare [popover]
 * element with no `aria-expanded` of its own — i.e. one not built through
 * navi's own Popover.jsx (the only thing that reliably sets it). That's the
 * one case with no other synchronously-observable signal at all. It still
 * arrives a paint late, but a late correction beats none. `toggleEvent` is
 * the real `toggle` event on this path.
 *
 * @param {Element} ancestor
 * @param {(info: { isOpen: boolean, ancestor: Element, ancestorType: string, toggleEvent: Event | undefined }) => void} callback
 * @returns {() => void} cleanup — removes the observer/listener
 */
export const observeAncestorOpenState = (ancestor, callback) => {
  const ancestorType = getAncestorOpenType(ancestor);
  const needsToggleFallback =
    ancestor.hasAttribute("popover") && !ancestor.hasAttribute("aria-expanded");
  if (needsToggleFallback) {
    const onToggle = (toggleEvent) => {
      callback({
        isOpen: isAncestorOpen(ancestor),
        ancestor,
        ancestorType,
        toggleEvent,
      });
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
  // redundant open→open (or close→close) mutation instead of notifying
  // callback a second time for the same state.
  let wasOpen = isAncestorOpen(ancestor);
  const observer = new MutationObserver(() => {
    const isOpen = isAncestorOpen(ancestor);
    if (isOpen === wasOpen) {
      return;
    }
    wasOpen = isOpen;
    callback({
      isOpen,
      ancestor,
      ancestorType,
      toggleEvent: undefined,
    });
  });
  observer.observe(ancestor, {
    attributes: true,
    attributeFilter: ["open", "aria-expanded"],
  });
  return () => {
    observer.disconnect();
  };
};

export const onAncestorReopen = (el, callback) => {
  const nearestOpenableAncestor = closestOpenableAncestor(el);
  if (!nearestOpenableAncestor) {
    return () => {};
  }
  return observeAncestorOpenState(nearestOpenableAncestor, ({ isOpen }) => {
    if (!isOpen) {
      return;
    }
    callback();
  });
};
