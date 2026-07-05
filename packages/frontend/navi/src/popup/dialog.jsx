import {
  createPubSub,
  dispatchCustomEvent,
  getElementSignature,
  snapToPixel,
  trapScrollInside,
} from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import {
  getFocusedBeforeTransfer,
  markAutofocusRestoreOnClose,
  transferFocus,
} from "../utils/focus/focus_transfer.js";
import { useOpenController } from "./open_controller.js";
import { buildPopupAnimationCss } from "./popup_animation.js";

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

  ${buildPopupAnimationCss(
    ".navi_dialog",
  )}/* Dialogs aren't anchored the same way popovers are (they're centered in
     the viewport) — scale always animates from the dialog's own center, not
     an anchor's or the pointer's, so no --popup-animation-origin-x/y wiring
     is needed here. */
`;

/**
 * Entry point: picks between an internally-managed open controller
 * (UncontrolledDialog) and one owned by the caller (ControlledDialog, used
 * by picker_custom.jsx) so we don't instantiate a default controller when it
 * would just be thrown away.
 */
export const Dialog = (props) => {
  import.meta.css = css;
  if (props.openController) {
    return <ControlledDialog {...props} />;
  }
  return <UncontrolledDialog {...props} />;
};

// No openController passed: this Dialog is used declaratively (e.g. driven
// by --navi-toggle/--navi-open/--navi-close commands, or by the `open` prop)
// rather than owned by a parent component.
const UncontrolledDialog = (props) => {
  const { open, ...rest } = props;
  const openController = useOpenController(() => undefined);

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

  return (
    <ControlledDialog
      {...rest}
      openController={openController}
      onnavi_request_open={(e) => {
        openController.open(e, {
          anchor: e.detail?.anchor ?? e.detail?.source,
        });
      }}
      onnavi_request_close={(e) => {
        openController.requestClose(e, { isCancel: e.detail?.isCancel });
      }}
    />
  );
};

const ControlledDialog = (props) => {
  const {
    openController,
    anchorRef,
    children,
    scrollTrap,
    pointerTrap,
    animation,
    centerInVisualViewport: centerInVisualViewportProp,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const autoFocusProps = useAutoFocus(ref, props.autoFocus);
  // animation={true} or "auto" always resolves to "scale": dialogs are
  // always centered in the viewport (unlike Popover, they don't track an
  // anchor edge to "grow" out of or a side to "slide" in from).
  const isAutoAnimation = animation === true || animation === "auto";

  // aria-expanded lives on the dialog element itself (not driven through
  // Preact's vdom — openEffect/its cleanup toggle it imperatively in sync
  // with showModal()/close(), see below) so popup_animation.js can key its
  // CSS off a single selector regardless of Popover vs Dialog.
  useLayoutEffect(() => {
    ref.current?.setAttribute("aria-expanded", "false");
  }, []);

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollTrap, etc.). The
  // controller (owned by the caller, or by UncontrolledDialog) decides
  // *when* this runs. openEffect runs outside of render (triggered by
  // openController.open()), so it cannot call hooks — cleanup is a plain
  // pub/sub.
  openController.openEffect = (e) => {
    const dialogEl = ref.current;
    if (!dialogEl) {
      return undefined;
    }
    const [cleanup, addCleanup] = createPubSub(true);
    // anchorRef (set by the parent component) wins; otherwise fall back to
    // the anchor carried by the request (e.g. the button that triggered a
    // --navi-toggle/--navi-open command, forwarded as detail.source).
    const anchor =
      anchorRef?.current ?? e.detail?.anchor ?? e.detail?.source ?? null;
    const effectiveAnchor = anchor || document.documentElement;
    debugPopup(`"${e.type}" on ${getElementSignature(e.target)} -> openDialog`);
    const { width, height } = effectiveAnchor.getBoundingClientRect();
    dialogEl.style.setProperty("--anchor-width", `${snapToPixel(width)}px`);
    dialogEl.style.setProperty("--anchor-height", `${snapToPixel(height)}px`);
    if (isAutoAnimation) {
      dialogEl.setAttribute("navi-animation", "scale");
    }
    const focusedBeforeOpen = getFocusedBeforeTransfer(e);
    dialogEl.showModal();
    dialogEl.setAttribute("aria-expanded", "true");
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
    // Picker's openController.open() reads this back synchronously right
    // after openEffect() returns (see picker_custom.jsx useOpenController).
    e.detail.focusedBeforeOpen = focusedBeforeOpen;

    return () => {
      debugPopup(
        `"${e.type}" on ${getElementSignature(e.target)} -> closeDialog`,
      );
      markAutofocusRestoreOnClose(dialogEl);
      dialogEl.setAttribute("aria-expanded", "false");
      dialogEl.close();
      cleanup();
    };
  };

  return (
    <Box
      {...rest}
      {...autoFocusProps}
      as="dialog"
      ref={ref}
      navi-animation={isAutoAnimation ? undefined : animation}
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
            openController.requestClose(e, { isCancel: true });
          }
        }
      }}
      onCancel={(e) => {
        openController.requestClose(e, { isCancel: true });
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
