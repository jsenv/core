import {
  dispatchCustomEvent,
  getElementSignature,
  trapScrollInside,
} from "@jsenv/dom";
import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import {
  focusFirstAutofocusOrFocusable,
  markAutofocusRestoreOnClose,
} from "../utils/focus/focus_first_autofocus_or_focusable.js";
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
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const openedRef = useRef(false);
  const [addCleanup, cleanup] = useCleanup();
  const open = (e) => {
    debugPopup(`"${e.type}" on ${getElementSignature(e.target)} -> openDialog`);
    const dialogEl = ref.current;
    dialogEl.showModal();
    focusFirstAutofocusOrFocusable(dialogEl, debugFocus, e);
    if (scrollTrap) {
      addCleanup(trapScrollInside(dialogEl));
    }
    openedRef.current = true;
    dispatchCustomEvent(dialogEl, "navi_open", {
      event: e,
    });
  };
  const close = (e) => {
    debugPopup(
      `"${e.type}" on ${getElementSignature(e.target)} -> closeDialog`,
    );
    const dialogEl = ref.current;
    markAutofocusRestoreOnClose(dialogEl);
    dialogEl.close();
    cleanup();
    openedRef.current = false;
    dispatchCustomEvent(dialogEl, "navi_close", {
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
      onMouseDown={(e) => {
        rest.onMouseDown?.(e);
        // The <dialog> element covers the full viewport; clicking the backdrop
        // hits the dialog itself (not any child). Close when that happens.
        if (!pointerTrap && e.button === 0 && e.target === ref.current) {
          onRequestClose(e);
        }
      }}
      onCancel={(e) => {
        // The browser fires "cancel" (then closes the dialog) when the user presses Escape.
        // Prevent the native close so we control the close flow and dispatch navi_dialog_close.
        e.preventDefault();
        onRequestClose(e);
      }}
      onnavi_request_open={(e) => {
        onRequestOpen(e);
      }}
      onnavi_request_close={(e) => {
        onRequestClose(e);
      }}
    >
      {children}
    </Box>
  );
};
