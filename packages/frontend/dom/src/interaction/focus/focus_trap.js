import { findDescendant } from "../../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { performTabNavigation } from "./tab_navigation.js";

/**
 * Traps keyboard focus and mouse clicks inside `element`.
 *
 * Once active:
 * - **Tab / Shift+Tab** cycle through focusable descendants of `element`,
 *   wrapping from last → first and first → last — *unless* `boundaryElement`
 *   is a real container (not `document`), in which case Tab escapes the
 *   whole container instead of wrapping (see `boundaryElement`'s own doc).
 *   If no focusable element exists, the default browser Tab action is
 *   suppressed so focus cannot escape.
 * - **Mouse clicks** outside `element` are only blocked when `pointerTrap`
 *   is `true`. Backdrop clicks (on `<dialog>` elements) still propagate even
 *   then, so the dialog can close itself.
 * - **Focus entering `boundaryElement` from outside it** (e.g. a `focus()`
 *   call, or Tab arriving from further out in the document) always lands on
 *   `element`'s own first focusable descendant — never on some other
 *   focusable sibling `boundaryElement` happens to also contain. Only
 *   relevant when `boundaryElement` isn't `document` (see below).
 *
 * Multiple traps can be stacked. When a new trap is activated the previous
 * one is paused; when the new trap is released the previous one resumes.
 * Traps must be released in LIFO order (the reverse of activation order).
 *
 * @param {HTMLElement} element - The root element to trap focus inside.
 * @param {object} [options]
 * @param {boolean} [options.pointerTrap=false] - When true, mouse clicks outside `element`
 *   are cancelled so the user cannot move focus away by clicking the backdrop.
 *   Backdrop clicks (target is a `<dialog>` element) only receive `preventDefault`
 *   and still propagate, allowing the dialog to react to them (e.g. close itself).
 * @param {Function} [options.debug] - Optional debug logger passed to tab navigation.
 * @param {Document|HTMLElement} [options.boundaryElement=document] - Where the
 *   mousedown/keydown/focusin listeners are attached. Defaults to `document`
 *   (a genuinely page-wide modal — the usual case, where none of the
 *   container-specific behavior below applies). Pass a specific container
 *   element instead for a trap that should only apply *within* that
 *   container: a Tab press or click occurring entirely outside it never
 *   reaches a listener attached there at all (events only bubble through
 *   their own ancestor chain), so the rest of the page keeps its normal tab
 *   order/interactions untouched. Inside the container, `element` behaves
 *   as if it were the *only* focusable thing `boundaryElement` contains:
 *   Tab reaching either edge of `element` skips over any other focusable
 *   sibling sharing the container, exiting the container entirely (not
 *   wrapping back into `element`), and focus arriving at some other
 *   focusable sibling inside the container gets redirected into `element`'s
 *   own first focusable descendant instead. Used by Dialog's own
 *   `layer="local"` renderer, which is only meant to be modal within its
 *   own positioned ancestor, not the whole document — a case where that
 *   ancestor can genuinely contain other, unrelated focusable content
 *   (e.g. a trigger button placed right next to it).
 * @returns {() => void} Cleanup function — call it to release the trap.
 */
export const trapFocusInside = (
  element,
  { debug, pointerTrap = false, boundaryElement = document } = {},
) => {
  if (element.nodeType === 3) {
    console.warn("cannot trap focus inside a text node");
    return () => {};
  }

  const trappedElement = activeTraps.find(
    (activeTrap) => activeTrap.element === element,
  );
  if (trappedElement) {
    console.warn("focus already trapped inside this element");
    return () => {};
  }

  const isEventOutside = (event) => {
    if (event.target === element) {
      return false;
    }
    if (element.contains(event.target)) {
      return false;
    }
    return true;
  };

  // A real container (not document) — element must behave as the only
  // focusable thing boundaryElement contains, see this file's own doc.
  const escapeRoot = boundaryElement === document ? null : boundaryElement;

  const lock = () => {
    const onmousedown = pointerTrap
      ? (event) => {
          if (!isEventOutside(event)) {
            return;
          }
          event.preventDefault();
          // Backdrop clicks (e.g. clicking a <dialog>'s ::backdrop) must still
          // propagate so the dialog/popover can react to them (e.g. close itself).
          // A backdrop click is detected when the target is a <dialog> element —
          // the ::backdrop pseudo-element is not in the DOM, so the event target
          // becomes the dialog element itself when its content area is not hit.
          const isBackdropClick =
            event.target.tagName === "DIALOG" ||
            event.target.className.includes("backdrop");
          if (!isBackdropClick) {
            event.stopImmediatePropagation();
          }
        }
      : null;

    const onkeydown = (event) => {
      if (isTabEvent(event)) {
        const handled = performTabNavigation(event, {
          rootElement: element,
          debug,
          escapeRoot,
        });
        if (!handled) {
          // No focusable target found — prevent the browser from moving focus outside the trap.
          event.preventDefault();
        }
      }
    };

    // Focus landing on some other focusable sibling boundaryElement also
    // contains (not element itself) gets redirected into element's own
    // first focusable descendant — e.g. a direct .focus() call, or Tab
    // arriving from further out in the document. Click-driven focus theft
    // is already prevented above by onmousedown (when pointerTrap is on);
    // this covers the rest (keyboard-driven entry, programmatic focus()).
    const onfocusin = escapeRoot
      ? (event) => {
          const target = event.target;
          if (target === element || element.contains(target)) {
            return;
          }
          const firstFocusable = findDescendant(element, (node) =>
            elementIsFocusable(node),
          );
          firstFocusable?.focus();
        }
      : null;

    if (onmousedown) {
      boundaryElement.addEventListener("mousedown", onmousedown, {
        capture: true,
        passive: false,
      });
    }
    boundaryElement.addEventListener("keydown", onkeydown, {
      capture: true,
      passive: false,
    });
    if (onfocusin) {
      boundaryElement.addEventListener("focusin", onfocusin);
    }

    return () => {
      if (onmousedown) {
        boundaryElement.removeEventListener("mousedown", onmousedown, {
          capture: true,
          passive: false,
        });
      }
      if (onfocusin) {
        boundaryElement.removeEventListener("focusin", onfocusin);
      }
      boundaryElement.removeEventListener("keydown", onkeydown, {
        capture: true,
        passive: false,
      });
    };
  };

  const deactivate = activate({
    // element
    lock,
  });

  const untrap = () => {
    deactivate();
  };

  return untrap;
};

const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const activeTraps = [];
const activate = ({ lock }) => {
  // unlock any trap currently activated
  let previousTrap;
  if (activeTraps.length > 0) {
    previousTrap = activeTraps[activeTraps.length - 1];
    previousTrap.unlock();
  }

  // store trap methods to lock/unlock as traps are acivated/deactivated
  const trap = { lock, unlock: lock() };
  activeTraps.push(trap);

  return () => {
    if (activeTraps.length === 0) {
      console.warn("cannot deactivate an already deactivated trap");
      return;
    }
    const lastTrap = activeTraps[activeTraps.length - 1];
    if (trap !== lastTrap) {
      // TODO: investigate this and maybe remove this requirment
      console.warn(
        "you must deactivate trap in the same order they were activated",
      );
      return;
    }
    activeTraps.pop();
    trap.unlock();
    // if any,reactivate the previous trap
    if (previousTrap) {
      previousTrap.unlock = previousTrap.lock();
    }
  };
};
