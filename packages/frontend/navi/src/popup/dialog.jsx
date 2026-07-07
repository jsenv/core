/**
 * A dialog is always centered in the viewport, with no anchor to grow out of
 * or slide in from — `animation={true}`/`"auto"` resolves to `"scaling"`
 * (see popover.jsx's own top comment for why that reads best), the same kind
 * Popover picks for a dead-center placement. Any other explicit kind
 * (`"fading"`, `"scaling"`, or a literal `"slide-from-{top,bottom,left,
 * right}"` + diagonals) is passed straight through as-is: these are all
 * self-contained CSS selectors in the shared popup_animation.js, so unlike
 * Popover there's no direction to resolve in JS — Dialog never needs to flip
 * anything after measuring, since it's always centered.
 */

import {
  createPubSub,
  dispatchCustomEvent,
  getElementSignature,
  snapToPixel,
  trapScrollInside,
} from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { onNaviCommand } from "@jsenv/navi/src/control/commands.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
import { onRequestInteraction } from "../control/rules/control_interaction.js";
import { useDebugInteraction, useDebugPopup } from "../navi_debug.jsx";
import { useOpenControllerByProps } from "./open_controller.js";
import { popupCss } from "./popup_css.js";

const css = /* css */ `
  @layer navi {
    .navi_dialog {
      /* min gap between dialog edges and viewport */
      /* not named margin because it's not implemented with margins (which are needed for centering) */
      --dialog-viewport-spacing: 3dvw;

      --dialog-maxmax-width: calc(
        var(--navi-vvw) - 2 * var(--dialog-viewport-spacing)
      );
      --dialog-maxmax-height: calc(
        var(--navi-vvh) - 2 * var(--dialog-viewport-spacing)
      );
    }
  }

  .navi_dialog {
    min-width: var(--anchor-width, 0px);
    max-width: min(
      var(--picker-dialog-max-width, var(--picker-dialog-maxmax-width)),
      var(--picker-dialog-maxmax-width)
    );
    max-height: min(
      var(--picker-dialog-max-height, var(--picker-dialog-maxmax-height)),
      var(--picker-dialog-maxmax-height)
    );
    /* When centerInVisualViewport is enabled, --dialog-top-inset is set
         dynamically to keep the dialog centered in the visual viewport
         (accounts for the virtual keyboard on mobile). */
    margin-top: var(--dialog-top-inset, auto);
    margin-bottom: auto;
    flex-direction: column;
    transition: margin-top 0.1s ease-in-out;

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }

    &[open] {
      display: flex;
    }
  }

  ${popupCss}
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
  const openController = useOpenControllerByProps(props);

  return (
    <ControlledDialog
      {...props}
      open={undefined}
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
    // Same shape as Popover's own `anchor` prop (a ref, a DOM element, or
    // "viewport"/"offsetParent") for API parity — but unlike Popover, Dialog
    // never repositions/docks relative to it (always centered regardless),
    // so "viewport"/"offsetParent" are accepted and behave identically to no
    // anchor at all: only a real ref/element actually changes anything (the
    // --anchor-width/--anchor-height vars below).
    anchor: anchorProp,
    children,
    scrollCapture,
    // "none"/"capture" collapse to the same behavior for Dialog: unlike
    // Popover, showModal() already makes the rest of the page inert, so
    // there's nothing for a click to reach behind the backdrop regardless of
    // this prop — only "close" changes anything observable.
    pointerInteractionOutsideEffect = "close",
    animation,
    centerInVisualViewport: centerInVisualViewportProp,
    // Makes the dialog itself a valid focus target so autoFocus="fallback"
    // below has somewhere to land when it contains nothing focusable of its
    // own — -1 keeps it out of the normal Tab order (it's only ever reached
    // programmatically). <dialog> has no default tabindex of its own.
    tabIndex = -1,
    // See use_auto_focus.js's own docs for why this must never reach the DOM
    // as a plain `autofocus` attribute — useAutoFocus below takes over
    // instead, so it's read here rather than left in `rest`.
    autoFocus = "fallback",
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const debugPopup = useDebugPopup();
  const debugInteraction = useDebugInteraction();
  const autoFocusProps = useAutoFocus(ref, autoFocus);
  const isAutoAnimation = animation === true || animation === "auto";
  const resolvedAnimation = isAutoAnimation ? "scaling" : animation;

  // aria-expanded lives on the dialog element itself (not driven through
  // Preact's vdom — openEffect/its cleanup toggle it imperatively in sync
  // with showModal()/close(), see below) so popup_animation.js can key its
  // CSS off a single selector regardless of Popover vs Dialog.
  useLayoutEffect(() => {
    ref.current?.setAttribute("aria-expanded", "false");
  }, []);

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollLock, etc.). The
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
    let anchor;
    if (anchorProp === "viewport" || anchorProp === "offsetParent") {
      // No special handling — see this component's own destructuring
      // comment for why these two are accepted but behave like no anchor.
    } else if (typeof anchorProp === "string") {
      console.warn(
        `Dialog: unknown anchor="${anchorProp}" (expected "viewport", "offsetParent", a ref, or a DOM element)`,
      );
    } else if (anchorProp) {
      // anchor prop is a ref or a DOM element
      anchor = anchorProp.current ?? anchorProp;
    } else if (e.detail.anchor) {
      // e.g. the button that triggered a --navi-toggle/--navi-open command,
      // already resolved from detail.anchor/detail.source by the caller
      // (see UncontrolledDialog's onnavi_request_open).
      anchor = e.detail.anchor;
    }
    const effectiveAnchor = anchor || document.documentElement;
    debugPopup(`"${e.type}" on ${getElementSignature(e.target)} -> openDialog`);
    const { width, height } = effectiveAnchor.getBoundingClientRect();
    dialogEl.style.setProperty("--anchor-width", `${snapToPixel(width)}px`);
    dialogEl.style.setProperty("--anchor-height", `${snapToPixel(height)}px`);
    if (resolvedAnimation) {
      dialogEl.setAttribute("navi-animation", resolvedAnimation);
    } else {
      dialogEl.removeAttribute("navi-animation");
    }
    dialogEl.showModal();
    dialogEl.setAttribute("aria-expanded", "true");
    const restoreFocus = openController.transferFocusOnOpen(dialogEl);
    if (scrollCapture) {
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

    return (closeEvent) => {
      debugPopup(
        `"${closeEvent.type}" on ${getElementSignature(closeEvent.target)} -> closeDialog`,
      );
      dialogEl.setAttribute("aria-expanded", "false");
      dialogEl.close();
      restoreFocus(closeEvent);
      cleanup();
    };
  };

  return (
    <Box
      tabIndex={tabIndex}
      {...rest}
      {...autoFocusProps}
      as="dialog"
      ref={ref}
      styleCSSVars={DIALOG_STYLE_CSS_VARS}
      baseClassName="navi_dialog"
      pseudoClasses={DIALOG_PSEUDO_CLASSES}
      data-pointer-interaction-outside={pointerInteractionOutsideEffect}
      onnavi_command={(e) => {
        onNaviCommand(e);
      }}
      onnavi_request_interaction={(e) => {
        onRequestInteraction(e, { debugInteraction });
      }}
      onMouseDown={(e) => {
        rest.onMouseDown?.(e);
        if (pointerInteractionOutsideEffect !== "close") {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        // Detect backdrop click: the click must land outside the dialog's
        // bounding rect. Checking coordinates is necessary because clicking
        // on the dialog's own padding also sets e.target === ref.current.
        if (e.target !== ref.current) {
          return;
        }
        const rect = ref.current.getBoundingClientRect();
        const isOutside =
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom;
        if (!isOutside) {
          return;
        }
        openController.requestClose(e, { isCancel: true });
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

// Lets consumers pass animationDuration="0.5s" as a regular prop; Box maps
// it to the CSS var for us (see box.jsx's styleCSSVars handling).
const DIALOG_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
};
