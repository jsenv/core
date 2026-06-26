import {
  dispatchCustomEvent,
  getElementSignature,
  snapToPixel,
  trapScrollInside,
} from "@jsenv/dom";
import { useRef } from "preact/hooks";

import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import {
  getFocusedBeforeTransfer,
  markAutofocusRestoreOnClose,
  transferFocus,
} from "../utils/focus/focus_transfer.js";
import { useCleanup } from "../utils/use_cleanup.js";

const css = /* css */ `
  .navi_dialog {
    &[open] {
      display: flex;
      /* When centerInVisualViewport is enabled, --dialog-top-inset is set
         dynamically to keep the dialog centered in the visual viewport
         (accounts for the virtual keyboard on mobile). */
      margin-top: var(--dialog-top-inset, auto);
      margin-bottom: auto;
      flex-direction: column;
    }

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
  }
`;

export const Dialog = (props) => {
  import.meta.css = css;
  const {
    children,
    scrollTrap,
    pointerTrap,
    centerInVisualViewport: centerInVisualViewportProp,
    closeRequestHandler,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const autoFocusProps = useAutoFocus(ref, props.autoFocus);

  const openedRef = useRef(false);
  const [addCleanup, cleanup] = useCleanup();
  const open = (e, { anchor }) => {
    const effectiveAnchor = anchor || document.documentElement;
    debugPopup(`"${e.type}" on ${getElementSignature(e.target)} -> openDialog`);
    const dialogEl = ref.current;
    const { width, height } = effectiveAnchor.getBoundingClientRect();
    dialogEl.style.setProperty("--anchor-width", `${snapToPixel(width)}px`);
    dialogEl.style.setProperty("--anchor-height", `${snapToPixel(height)}px`);
    const focusedBeforeOpen = getFocusedBeforeTransfer(e);
    dialogEl.showModal();
    transferFocus(dialogEl, debugFocus, e, focusedBeforeOpen);
    if (scrollTrap) {
      addCleanup(trapScrollInside(dialogEl));
    }
    if (centerInVisualViewportProp && window.visualViewport) {
      const centerInVisualViewport = () => {
        const vv = window.visualViewport;
        const dialogHeight = dialogEl.offsetHeight;
        const availableHeight = vv.height;
        const topOffset = vv.offsetTop;
        const marginTop =
          availableHeight > dialogHeight
            ? topOffset + (availableHeight - dialogHeight) / 2
            : topOffset;
        dialogEl.style.setProperty(
          "--dialog-top-inset",
          `${snapToPixel(marginTop)}px`,
        );
      };
      centerInVisualViewport();
      window.visualViewport.addEventListener("resize", centerInVisualViewport);
      window.visualViewport.addEventListener("scroll", centerInVisualViewport);
      addCleanup(() => {
        window.visualViewport.removeEventListener(
          "resize",
          centerInVisualViewport,
        );
        window.visualViewport.removeEventListener(
          "scroll",
          centerInVisualViewport,
        );
        dialogEl.style.removeProperty("--dialog-top-inset");
      });
    }
    openedRef.current = true;
    dispatchCustomEvent(dialogEl, "navi_open", {
      event: e,
      focusedBeforeOpen,
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

  const onRequestOpen = (e, { anchor }) => {
    const dialogEl = ref.current;
    if (!dialogEl) {
      return;
    }
    if (openedRef.current) {
      return;
    }
    open(e, { anchor });
  };
  const onRequestClose = (e) => {
    const dialogEl = ref.current;
    if (!dialogEl) {
      return;
    }
    if (!openedRef.current) {
      return;
    }
    if (closeRequestHandler) {
      let denied = false;
      const closePermission = {
        deny: () => {
          denied = true;
        },
        allow: () => {
          denied = false;
        },
      };
      closeRequestHandler(e, closePermission);
      if (denied) {
        closePermission.allow = () => {
          close(e);
        };
        return;
      }
    }
    close(e);
  };

  return (
    <Box
      {...rest}
      {...autoFocusProps}
      as="dialog"
      ref={ref}
      baseClassName="navi_dialog"
      pseudoClasses={DIALOG_PSEUDO_CLASSES}
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
        const { anchor } = e.detail;
        onRequestOpen(e, { anchor });
      }}
      onnavi_request_close={(e) => {
        onRequestClose(e);
      }}
    >
      {children}
    </Box>
  );
};

const DIALOG_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];
