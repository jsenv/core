import {
  dispatchCustomEvent,
  getBorderSizes,
  pickPositionRelativeTo,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { useId, useLayoutEffect, useRef } from "preact/hooks";

import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
import { resolveSpacingSize } from "../box/box_style_util.js";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import {
  getFocusedBeforeTransfer,
  markAutofocusRestoreOnClose,
  transferFocus,
} from "../utils/focus/focus_transfer.js";
import { useCleanup } from "../utils/use_cleanup.js";

const css = /* css */ `
  .navi_popover {
    &[data-anchor-hidden] {
      opacity: 0;
      pointer-events: none;
    }

    .navi_popover_backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      background: transparent;
      pointer-events: none;
    }

    &:popover-open {
      .navi_popover_backdrop {
        pointer-events: auto;
      }
    }
  }
`;

export const Popover = (props) => {
  import.meta.css = css;
  const {
    open: openProp = false,
    anchorRef,
    scrollTrap,
    pointerTrap,
    focusTrap,
    children,
    positionX,
    positionY,
    positionXFixed,
    positionYFixed,
    spacing = 0,
    viewportSpacing = 0,
    closeRequestHandler,
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const defaultId = useId();
  const id = rest.id || defaultId;
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const autoFocusProps = useAutoFocus(ref, props.autoFocus);

  const openedRef = useRef(openProp);
  openedRef.current = openProp;
  const [addCleanup, cleanup] = useCleanup();
  const open = (e) => {
    debugPopup(e, `openPopover()`);
    const popoverEl = ref.current;
    const focusedBeforeOpen = getFocusedBeforeTransfer(e);
    popoverEl.showPopover();
    transferFocus(popoverEl, debugFocus, e, focusedBeforeOpen);
    const anchor = anchorRef?.current ?? null;
    const effectiveAnchor = anchor || document.documentElement;
    const positionPopover = (positionEvent) => {
      const { width, height } = effectiveAnchor.getBoundingClientRect();
      const {
        left: borderLeft,
        right: borderRight,
        top: borderTop,
        bottom: borderBottom,
      } = getBorderSizes(effectiveAnchor);
      popoverEl.style.setProperty("--anchor-width", `${snapToPixel(width)}px`);
      popoverEl.style.setProperty(
        "--anchor-height",
        `${snapToPixel(height)}px`,
      );
      popoverEl.style.setProperty(
        "--anchor-inner-width",
        `${snapToPixel(width - borderLeft - borderRight)}px`,
      );
      popoverEl.style.setProperty(
        "--anchor-inner-height",
        `${snapToPixel(height - borderTop - borderBottom)}px`,
      );
      const minLeft = 1;
      const effectivePositionX = anchor ? positionX : "center";
      // Remove max-height constraint so pickPositionRelativeTo measures the natural
      // (unconstrained) height of the popover. This ensures the 60% flip threshold
      // compares against the real content height, not the already-truncated one.
      popoverEl.style.removeProperty("--space-available");
      const {
        left,
        top,
        positionY: finalPositionY,
        spaceAbove,
        spaceBelow,
      } = pickPositionRelativeTo(popoverEl, effectiveAnchor, {
        positionX: effectivePositionX,
        positionY,
        positionXFixed,
        positionYFixed,
        spacing: resolveSpacingSize(spacing),
        viewportSpacing: resolveSpacingSize(viewportSpacing),
        minLeft,
      });
      const spaceAvailable =
        finalPositionY === "above" || finalPositionY === "above-overlap"
          ? spaceAbove
          : spaceBelow;
      popoverEl.style.setProperty("--space-available", `${spaceAvailable}px`);
      debugPopup(
        positionEvent,
        `positionPopover() -> left: ${left}, top: ${top}`,
      );
      popoverEl.style.top = `${top}px`;
      popoverEl.style.left = `${Math.max(left, minLeft)}px`;
    };

    if (scrollTrap) {
      addCleanup(trapScrollInside(popoverEl));
    }
    if (focusTrap) {
      addCleanup(trapFocusInside(popoverEl, { debug: debugFocus }));
    }
    const rectEffect = visibleRectEffect(
      effectiveAnchor,
      ({ visibilityRatio }, { event }) => {
        if (visibilityRatio <= 0.2) {
          popoverEl.setAttribute("data-anchor-hidden", "");
          return;
        }
        popoverEl.removeAttribute("data-anchor-hidden");
        positionPopover(event);
      },
      {
        event: e,
        // it's ok for the popover to become unsync with the anchor size
        // (we could even argue it's a feature as it helps to keep the popover position stable)
        skipElementResize: true,
      },
    );
    addCleanup(() => {
      rectEffect.disconnect();
    });
    openedRef.current = true;
    dispatchCustomEvent(popoverEl, "navi_open", {
      event: e,
      focusedBeforeOpen,
    });
  };
  const close = (e, detail = {}) => {
    debugPopup(e, `closePopover()`);
    const popoverEl = ref.current;
    markAutofocusRestoreOnClose(popoverEl);
    popoverEl.hidePopover();
    cleanup();
    openedRef.current = false;
    dispatchCustomEvent(popoverEl, "navi_close", {
      event: e,
      ...detail,
    });
  };

  const onRequestOpen = (e) => {
    const popoverEl = ref.current;
    if (!popoverEl) {
      return;
    }
    if (openedRef.current) {
      return;
    }
    open(e);
  };
  const onRequestClose = (e, detail = {}) => {
    const popoverEl = ref.current;
    if (!popoverEl) {
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

  useLayoutEffect(() => {
    if (openProp === undefined) {
      return;
    }
    // Skip when the popover is already in the desired state.
    // This avoids a feedback loop: our own close/open dispatches navi_close/navi_open,
    // the parent updates the prop, and the effect would fire again for a change we
    // already handled. Comparing against openedRef is the authoritative check because
    // it reflects the actual DOM state, not the React render cycle.
    if (openProp === openedRef.current) {
      return;
    }
    const e = new CustomEvent("open_prop_change");
    if (openProp) {
      onRequestOpen(e);
    } else {
      onRequestClose(e);
    }
  }, [openProp]);

  return (
    <Box
      id={id}
      popover="manual"
      {...rest}
      {...autoFocusProps}
      ref={ref}
      baseClassName="navi_popover"
      pseudoClasses={POPOVER_PSEUDO_CLASSES}
      onnavi_request_open={(e) => {
        onRequestOpen(e);
      }}
      onnavi_request_close={(e) => {
        onRequestClose(e);
      }}
    >
      {/*
        The backdrop is placed inside the popover element rather than appended to
        document.body (which would require createPortal).

        Keeping it inside the popover avoids:
        - Polluting the root DOM with one extra element per popover instance.
        - The need for createPortal, which adds conceptual overhead.
        - Any z-index juggling: because the popover is in the browser top layer,
          all its children are automatically painted above normal page content.

        "position: fixed; inset: 0" still covers the full visual viewport when the
        element lives inside a top-layer popover, because the top layer establishes
        its own stacking context that is not affected by ancestor transforms, clips,
        or overflow. No known limitation prevents the backdrop from covering the
        whole document in this configuration.

        ---

        The backdrop is kept in the DOM at all times and toggled via pointer-events
        (CSS :popover-open) rather than mounted/unmounted.

        Why this matters: when the popover closes on a mousedown (e.g. clicking
        outside), the browser records the target element of that mousedown. If the
        same element is still in the DOM at mouseup, the browser dispatches a
        "click" event — targeting document.body because the backdrop has
        pointer-events:none by then and is no longer "hittable".

        If we removed the backdrop from the DOM between mousedown and mouseup,
        the browser would see that the recorded target is gone and would NOT
        dispatch a click at all.

        That silent missing click is a problem: we use a "disableNextClick" guard
        to prevent the picker from immediately re-opening after the backdrop
        close. That guard arms itself on mousedown, then waits for the click to
        disarm. If no click ever comes, the guard stays armed and swallows the
        very next intentional user click instead.
      */}
      <div
        className="navi_popover_backdrop"
        aria-hidden="true"
        onMouseDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          if (pointerTrap) {
            e.preventDefault();
            return;
          }
          onRequestClose(e, { isClickOutside: true });
        }}
      />
      {children}
    </Box>
  );
};

const POPOVER_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];
