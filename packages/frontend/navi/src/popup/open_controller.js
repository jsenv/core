import { chainEvent, findEvent } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { useDebugInteraction } from "@jsenv/navi/src/navi_debug.jsx";
import {
  getFocusedBeforeTransfer,
  markAutofocusRestoreOnClose,
  transferFocus,
} from "../utils/focus/focus_transfer.js";
import { useStableCallback } from "../utils/use_stable_callback.js";

/**
 * Owns open/close decision-making for a popup (Dialog or Popover): guards
 * against duplicate requests and notifies the popup owner's own reactions.
 *
 * `controller.openEffect` is implemented by the controlled element (Dialog or
 * Popover), reassigned on every render so it always closes over the latest
 * props (scrollLock, anchorRef, etc.). It performs whatever DOM side effects
 * are needed to make the element actually open (`showModal()`/`showPopover()`,
 * focus transfer, positioning, traps...) and returns its cleanup —
 * the matching side effects to sync back to closed (`close()`/
 * `hidePopover()`, releasing traps...). That cleanup is kept private to the
 * controller (not exposed as a property) and invoked when the popup actually
 * closes, however that happens.
 *
 * Dialog/Popover also call `openController.requestClose(e, { isCancel })` for
 * their own internal triggers (backdrop click, Escape).
 *
 * `openHandler` is the popup owner's own business logic, passed once to
 * `createOpenController`. Its return value is `{ onRequestClose, onClose }`,
 * in the spirit of CloseWatcher
 * (https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher) but with
 * clearer naming than its cancel/close pair:
 * - `onRequestClose(e)`: about to close — call `e.preventDefault()` to stay
 *   open. Validation lives here.
 * - `onClose(e)`: actually closing, not preventable — final reactions live here.
 *
 * The controller exposes matching action methods:
 * - `open()`: requests opening — runs `openEffect`, then `openHandler`.
 * - `requestClose()`: requests closing — calls `onRequestClose` then `onClose`,
 *   stopping after the first if denied. The popup may choose to stay open.
 * - `close()`: closes for real — calls only `onClose`, skipping
 *   `onRequestClose` entirely. Used when there really is no choice (e.g. the
 *   popup unmounting).
 */
export const createOpenController = (
  openHandler,
  { debugInteraction } = {},
) => {
  let closeHandlers = null; // { onRequestClose, onClose } returned by openHandler
  let openEffectCleanup = null; // function returned by openEffect, undoes its DOM side effects

  // Set true while we're waiting to see whether the click that follows a
  // mousedown-close will land back on whatever would reopen us — see
  // armSuppressNextOpenRequest below.
  let suppressNextOpenRequest = false;
  let disarmSuppressNextOpenRequest = null;

  // When the popup closes because of a mousedown (e.g. clicking the
  // backdrop), the browser still dispatches the matching "click" afterward.
  // If that click lands back on the element that triggers open() (e.g. the
  // picker button), it would immediately reopen the popup. We cannot
  // preventDefault/stopPropagation the mousedown to stop that — the browser
  // dispatches the click regardless.
  //
  // Instead: arm a capture-phase "click" listener on document. Capture fires
  // before the click reaches its target, so by the time any bubble-phase
  // click handler (e.g. the trigger button's onClick, which calls
  // controller.open()) runs, `suppressNextOpenRequest` is already true and
  // open() ignores the request — no need to know *which* element triggers
  // it. A bubble-phase listener (runs after everything else, once the click
  // reaches document) clears the flag if nothing consumed it, meaning this
  // click never resulted in an open() call. A microtask is a last-resort
  // safety net in case the click never reaches document at all (e.g. some
  // ancestor called stopPropagation()).
  const armSuppressNextOpenRequest = () => {
    disarmSuppressNextOpenRequest?.();
    const onCaptureClick = () => {
      document.removeEventListener("click", onCaptureClick, {
        capture: true,
      });
      suppressNextOpenRequest = true;
      document.addEventListener("click", onBubbleClick);
      queueMicrotask(() => {
        suppressNextOpenRequest = false;
      });
    };
    const onBubbleClick = () => {
      document.removeEventListener("click", onBubbleClick);
      suppressNextOpenRequest = false;
    };
    disarmSuppressNextOpenRequest = () => {
      document.removeEventListener("click", onCaptureClick, {
        capture: true,
      });
      document.removeEventListener("click", onBubbleClick);
    };
    document.addEventListener("click", onCaptureClick, { capture: true });
  };

  const performClose = (closeEvent) => {
    controller.opened = false;

    prevent_reopen: {
      const mousedownEvent = findEvent(closeEvent, "mousedown");
      if (mousedownEvent) {
        debugInteraction(
          closeEvent,
          `closed by mousedown -> ignore next click`,
        );
        armSuppressNextOpenRequest();
        break prevent_reopen;
      }

      const spaceEvent = findEvent(
        closeEvent,
        (e) => e.type === "keydown" && e.key === " ",
      );
      if (spaceEvent) {
        // space would trigger a click on the picker button causing it to re-open immediatly after closing
        debugInteraction(
          closeEvent,
          `closed by space key -> prevent browser click (spaceEvent.preventDefault())`,
        );
        // browser won't try to dispatch click
        // and our "space_to_open" will see e.defaultPrevented too and won't try to open picker
        spaceEvent.preventDefault();
        break prevent_reopen;
      }
    }

    // Sync the DOM closed first (releasing the focus trap) — only then run
    // the owner's own reaction (onClose may restore focus to an element
    // outside the popup, which the focus trap would otherwise fight while
    // still active).
    openEffectCleanup?.(closeEvent);
    openEffectCleanup = null;
    closeHandlers?.onClose?.(closeEvent);
    closeHandlers = null;
  };
  const controller = {
    opened: false,
    openEffect: null,
    open: (e, detail) => {
      if (controller.opened || !controller.openEffect) {
        return;
      }
      if (suppressNextOpenRequest) {
        suppressNextOpenRequest = false;
        return;
      }
      const requestOpenEvent = new CustomEvent("navi_request_open", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestOpenEvent, e);
      controller.opened = true;
      // openEffect may populate requestOpenEvent.detail (e.g. focusedBeforeOpen)
      // by mutating it — openHandler reads it right after, synchronously.
      controller.transferFocusOnOpen = (el) => {
        const focusedBeforeOpen = getFocusedBeforeTransfer(e);
        // Picker's openController.open() reads this back synchronously right
        // after openEffect() returns (see picker_custom.jsx useOpenController).
        e.detail.focusedBeforeOpen = focusedBeforeOpen;
        transferFocus(el, debugInteraction, e, focusedBeforeOpen);
        return (closeEvent) => {
          markAutofocusRestoreOnClose(el);
          const focusoutEvent = findEvent(closeEvent, "focusout");
          if (focusoutEvent) {
            debugInteraction(
              closeEvent,
              `closed by focusout -> let focus go away`,
            );
          } else {
            const mousedownEvent = findEvent(closeEvent, "mousedown");
            if (mousedownEvent) {
              debugInteraction(
                closeEvent,
                "closed by mousedown -> prevent browser focus (mousedown.preventDefault())",
              );
              mousedownEvent.preventDefault();
            }
            debugInteraction(
              closeEvent,
              `restore focus to previously focused element`,
              focusedBeforeOpen,
            );
            focusedBeforeOpen.focus({ preventScroll: true });
          }
        };
      };
      const openEffectReturnValue =
        controller.openEffect(requestOpenEvent) || null;
      openEffectCleanup = (closeEvent) => {
        openEffectReturnValue?.(closeEvent);
      };
      closeHandlers = openHandler(requestOpenEvent) || null;
    },
    requestClose: (
      e = new CustomEvent("programmatic", { detail: {} }),
      detail,
    ) => {
      if (!controller.opened) {
        return;
      }
      const requestCloseEvent = new CustomEvent("navi_request_close", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestCloseEvent, e);
      closeHandlers?.onRequestClose?.(requestCloseEvent);
      if (requestCloseEvent.defaultPrevented) {
        // The native <dialog> "cancel" event (Escape key) closes the dialog
        // by default; prevent that default so denial actually keeps it open.
        const nativeCancelEvent = findEvent(requestCloseEvent, "cancel");
        if (nativeCancelEvent) {
          nativeCancelEvent.preventDefault();
        }
        return;
      }
      performClose(requestCloseEvent);
    },
    close: (e = new CustomEvent("programmatic", { detail: {} }), detail) => {
      if (!controller.opened) {
        return;
      }
      const closeEvent = new CustomEvent("navi_close", {
        detail: { event: e, ...detail },
      });
      chainEvent(closeEvent, e);
      // Skips onRequestClose entirely — there is no choice here.
      performClose(closeEvent);
    },
  };
  return controller;
};

// Created once per popup instance: openHandler is wrapped in a stable callback
// so the controller identity never changes across renders, even though
// Dialog/Popover read fresh closures (scrollTrap, etc.) via
// openController.openEffect on every render.
export const useOpenController = (openHandler) => {
  const debugInteraction = useDebugInteraction();
  const stableOpenHandler = useStableCallback(openHandler);
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createOpenController(stableOpenHandler, {
      debugInteraction,
    });
  }
  // Unmount safety net: if Dialog/Popover unmounts while still open (parent
  // removes it from the tree without going through requestClose()), there is
  // no choice to leave open — close it for real.
  useLayoutEffect(() => {
    return () => {
      controllerRef.current.close();
    };
  }, []);
  return controllerRef.current;
};

export const useOpenControllerByProps = (props) => {
  const openController = useOpenController(() => undefined);
  const { open } = props;

  useLayoutEffect(() => {
    if (open === undefined) {
      return;
    }
    if (open === openController.opened) {
      return;
    }
    if (open) {
      openController.open(new CustomEvent("open_by_prop", { detail: {} }));
    } else {
      openController.requestClose(
        new CustomEvent("close_by_prop", { detail: {} }),
        { isCancel: true },
      );
    }
  }, [open]);

  return openController;
};
