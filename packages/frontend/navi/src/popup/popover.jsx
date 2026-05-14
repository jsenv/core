import {
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
  findFocusable,
  getBorderSizes,
  getElementSignature,
  pickPositionRelativeTo,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { createPortal } from "preact/compat";
import { useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { resolveSpacingSize } from "../box/box_style_util.js";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import { useCleanup } from "../utils/use_cleanup.js";

const css = /* css */ `
  .navi_popover_backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: transparent;
  }

  .navi_popover {
    &[data-anchor-hidden] {
      opacity: 0;
      pointer-events: none;
    }
  }
`;

export const Popover = (props) => {
  import.meta.css = css;
  const {
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
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const defaultId = useId();
  const id = rest.id || defaultId;
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();

  const [opened, setOpened] = useState(false);
  const openedRef = useRef(opened);
  openedRef.current = opened;
  const [addCleanup, cleanup] = useCleanup();
  const open = (e, { anchor }) => {
    debugPopup(e, `openPopover()`);
    const popoverEl = ref.current;
    popoverEl.showPopover();
    const firstFocusable = findFocusable(popoverEl);
    if (firstFocusable) {
      debugFocus(
        e,
        `Moving focus to first focusable element in popover: ${getElementSignature(firstFocusable)}.focus({ preventScroll: true })`,
      );
      firstFocusable.focus({ preventScroll: true });
    }
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
      { event: e },
    );
    addCleanup(() => {
      rectEffect.disconnect();
    });
    openedRef.current = true;
    setOpened(true);
    dispatchPublicCustomEvent(popoverEl, "navi_popover_open", {
      event: e,
    });
  };
  const close = (e) => {
    debugPopup(e, `closePopover()`);
    const popoverEl = ref.current;
    popoverEl.hidePopover();
    cleanup();
    openedRef.current = false;
    setOpened(false);
    dispatchPublicCustomEvent(popoverEl, "navi_popover_close", {
      event: e,
    });
  };

  const onRequestOpen = (e, { anchor }) => {
    const popoverEl = ref.current;
    if (!popoverEl) {
      return;
    }
    if (openedRef.current) {
      return;
    }
    open(e, { anchor });
  };
  const onRequestClose = (e) => {
    const popoverEl = ref.current;
    if (!popoverEl) {
      return;
    }
    if (!openedRef.current) {
      return;
    }
    close(e);
  };
  return (
    <>
      {opened &&
        createPortal(
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
              onRequestClose(e);
            }}
          />,
          document.body,
        )}
      <Box
        id={id}
        popover="manual"
        {...rest}
        ref={ref}
        baseClassName="navi_popover"
        pseudoClasses={PopoverPseudoClasses}
        onnavi_popover_request_open={(e) => {
          const { anchor } = e.detail;
          onRequestOpen(e, { anchor });
        }}
        onnavi_popover_request_close={(e) => {
          onRequestClose(e);
        }}
      >
        {children}
      </Box>
    </>
  );
};
const PopoverPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":read-only",
  ":disabled",
];

export const requestPopoverOpen = (popoverElement, { event, anchor }) => {
  return dispatchCustomEvent(popoverElement, "navi_popover_request_open", {
    event,
    anchor,
  });
};
export const requestPopoverClose = (popoverElement, { event } = {}) => {
  return dispatchCustomEvent(popoverElement, "navi_popover_request_close", {
    event,
  });
};
