import { chainEvent, findEvent } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { useStableCallback } from "../utils/use_stable_callback.js";

/**
 * Owns open/close decision-making for a popup (Dialog or Popover): guards
 * against duplicate requests and notifies the popup owner's own reactions.
 *
 * `controller.openEffect` is implemented by the controlled element (Dialog or
 * Popover), reassigned on every render so it always closes over the latest
 * props (scrollTrap, anchorRef, etc.). It performs whatever DOM side effects
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
export const createOpenController = (openHandler) => {
  let closeHandlers = null; // { onRequestClose, onClose } returned by openHandler
  let openEffectCleanup = null; // function returned by openEffect, undoes its DOM side effects
  const performClose = (closeEvent) => {
    controller.opened = false;
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
      const requestOpenEvent = new CustomEvent("navi_request_open", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestOpenEvent, e);
      controller.opened = true;
      // openEffect may populate requestOpenEvent.detail (e.g. focusedBeforeOpen)
      // by mutating it — openHandler reads it right after, synchronously.
      openEffectCleanup = controller.openEffect(requestOpenEvent) || null;
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
  const stableOpenHandler = useStableCallback(openHandler);
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createOpenController(stableOpenHandler);
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
