import {
  dispatchCustomEvent,
  getElementSignature,
  snapToPixel,
  trapScrollInside,
} from "@jsenv/dom";
import { useEffect, useRef } from "preact/hooks";

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
      transition: margin-top 0.1s ease-in-out;
    }

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
  }
`;

export const Dialog = (props) => {
  import.meta.css = css;
  const {
    open: openProp = false,
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

  const openedRef = useRef(openProp);
  openedRef.current = openProp;
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
      const updatePosition = () => {
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
        dispatchCustomEvent(dialogEl, "navi_position_change");
      };
      const onScroll = () => {
        updatePosition();
      };
      let resizeTimeout;
      const cancelDelayedUpdatePosition = () => {
        clearTimeout(resizeTimeout);
      };
      const onResize = () => {
        // On mobile, tapping from one input to another triggers a resize because
        // the virtual keyboard briefly starts to close before the new input receives
        // focus and the keyboard reopens. Debouncing prevents repositioning the
        // dialog during that transient state, which would cause a visible flicker.
        cancelDelayedUpdatePosition();
        resizeTimeout = setTimeout(updatePosition, 100);
      };

      updatePosition();
      window.visualViewport.addEventListener("resize", onResize);
      window.visualViewport.addEventListener("scroll", onScroll);
      addCleanup(() => {
        cancelDelayedUpdatePosition();
        window.visualViewport.removeEventListener("resize", onResize);
        window.visualViewport.removeEventListener("scroll", onScroll);
        dialogEl.style.removeProperty("--dialog-top-inset");
      });
    }
    openedRef.current = true;
    dispatchCustomEvent(dialogEl, "navi_open", {
      event: e,
      focusedBeforeOpen,
    });
  };
  const close = (e, detail = {}) => {
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
      ...detail,
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
  const onRequestClose = (e, detail = {}) => {
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
      closeRequestHandler(e, closePermission, detail);
      if (denied) {
        closePermission.allow = () => {
          close(e, detail);
        };
        return;
      }
    }
    close(e, detail);
  };

  useEffect(() => {
    if (openProp === undefined) return;
    const e = new CustomEvent("open_prop_change");
    if (openProp) {
      onRequestOpen(e, { anchor: null });
    } else {
      onRequestClose(e);
    }
  }, [openProp]);

  return (
    <Box
      {...rest}
      {...autoFocusProps}
      anchorRef={undefined}
      as="dialog"
      ref={ref}
      baseClassName="navi_dialog"
      pseudoClasses={DIALOG_PSEUDO_CLASSES}
      onMouseDown={(e) => {
        rest.onMouseDown?.(e);
        // Detect backdrop click: the click must land outside the dialog's
        // bounding rect. Checking coordinates is necessary because clicking
        // on the dialog's own padding also sets e.target === ref.current.
        if (!pointerTrap && e.button === 0 && e.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          const isBackdrop =
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom;
          if (isBackdrop) {
            onRequestClose(e, { isClickOutside: true });
          }
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
