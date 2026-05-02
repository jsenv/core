import {
  findFocusable,
  getElementSignature,
  trapScrollInside,
} from "@jsenv/dom";
import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useDebugFocus, useDebugPopover } from "../navi_debug.jsx";
import {
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
} from "../utils/custom_event.js";
import { useCleanup } from "../utils/use_cleanup.js";

const css = /* css */ `
  .navi_dialog {
    &[open] {
      display: flex;
      flex-direction: column;
    }

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
  }
`;

export const Dialog = (props) => {
  import.meta.css = css;
  const { children, scrollTrap, pointerTrap, ...rest } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const debugPopover = useDebugPopover();
  const debugFocus = useDebugFocus();
  const openedRef = useRef(false);
  const [addCleanup, cleanup] = useCleanup();
  const open = (e) => {
    debugPopover(`openDialog("${e.type}")`);
    const dialogEl = ref.current;
    dialogEl.showModal();
    const firstFocusable = findFocusable(dialogEl);
    if (firstFocusable) {
      debugFocus(
        `Moving focus to first focusable element in dialog: ${getElementSignature(firstFocusable)}.focus({ preventScroll: true })`,
      );
      firstFocusable.focus({ preventScroll: true });
    }
    if (scrollTrap) {
      addCleanup(trapScrollInside(dialogEl));
    }
    openedRef.current = true;
    dispatchPublicCustomEvent(dialogEl, "navi_dialog_open", {
      event: e,
    });
  };
  const close = (e) => {
    debugPopover(`closeDialog("${e.type}")`);
    const dialogEl = ref.current;
    dialogEl.close();
    cleanup();
    openedRef.current = false;
    dispatchPublicCustomEvent(dialogEl, "navi_dialog_close", {
      event: e,
    });
  };

  const onRequestOpen = (e) => {
    const dialogEl = ref.current;
    if (!dialogEl) {
      return;
    }
    if (openedRef.current) {
      return;
    }
    open(e);
  };
  const onRequestClose = (e) => {
    const dialogEl = ref.current;
    if (!dialogEl) {
      return;
    }
    if (!openedRef.current) {
      return;
    }
    close(e);
  };

  return (
    <Box
      {...rest}
      as="dialog"
      ref={ref}
      baseClassName="navi_dialog"
      onPointerDown={(e) => {
        rest.onMouseDown?.(e);
        // The <dialog> element covers the full viewport; clicking the backdrop
        // hits the dialog itself (not any child). Close when that happens.
        if (!pointerTrap && e.target === ref.current) {
          onRequestClose(e);
        }
      }}
      onnavi_dialog_request_open={(e) => {
        const { event = e } = e.detail;
        onRequestOpen(event);
      }}
      onnavi_dialog_request_close={(e) => {
        const { event = e } = e.detail;
        onRequestClose(event);
      }}
    >
      {children}
    </Box>
  );
};

export const requestDialogOpen = (popoverElement, { event }) => {
  return dispatchCustomEvent(popoverElement, "navi_dialog_request_open", {
    event,
  });
};
export const requestDialogClose = (popoverElement, { event } = {}) => {
  return dispatchCustomEvent(popoverElement, "navi_dialog_request_close", {
    event,
  });
};
