import {
  findFocusable,
  getElementSignature,
  pickPositionRelativeTo,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { createPortal } from "preact/compat";
import { useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useDebugFocus, useDebugPopover } from "../navi_debug.jsx";
import {
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
} from "../utils/custom_event.js";
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
    positionTry = "bottom",
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const defaultId = useId();
  const id = rest.id || defaultId;
  const debugPopover = useDebugPopover();
  const debugFocus = useDebugFocus();

  const [opened, setOpened] = useState(false);
  const openedRef = useRef(opened);
  openedRef.current = opened;
  const [addCleanup, cleanup] = useCleanup();
  const open = (e, { anchor }) => {
    debugPopover(`openPopover("${e.type}")`);
    const popoverEl = ref.current;
    popoverEl.showPopover();
    const firstFocusable = findFocusable(popoverEl);
    if (firstFocusable) {
      debugFocus(
        `Moving focus to first focusable element in popover: ${getElementSignature(firstFocusable)}.focus({ preventScroll: true })`,
      );
      firstFocusable.focus({ preventScroll: true });
    }
    const effectiveAnchor = anchor || document.documentElement;
    const positionPopover = (positionEvent) => {
      debugPopover(`positionPopover("${positionEvent.type}")`);
      popoverEl.style.setProperty(
        "--anchor-width",
        `${effectiveAnchor.getBoundingClientRect().width}px`,
      );
      const minLeft = 1;
      const effectivePositionTry = anchor ? positionTry : "center";
      const { left, top } = pickPositionRelativeTo(popoverEl, effectiveAnchor, {
        positionTry: effectivePositionTry,
        minLeft,
      });
      popoverEl.style.top = `${top}px`;
      const popoverRect = popoverEl.getBoundingClientRect();
      const maxWidth = parseFloat(getComputedStyle(popoverEl).maxWidth);
      if (!isNaN(maxWidth) && popoverRect.width >= maxWidth - 1) {
        const viewportWidth = document.documentElement.clientWidth;
        const centeredLeft = (viewportWidth - popoverRect.width) / 2;
        popoverEl.style.left = `${Math.max(centeredLeft, minLeft)}px`;
      } else {
        popoverEl.style.left = `${Math.max(left, minLeft)}px`;
      }
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
    debugPopover(`closePopover("${e.type}")`);
    const popoverEl = ref.current;
    popoverEl.hidePopover();
    cleanup();
    openedRef.current = false;
    setOpened(false);
    dispatchPublicCustomEvent(popoverEl, "navi_popover_close", {
      event: e,
    });
  };

  const openPopover = (e, { anchor }) => {
    const popoverEl = ref.current;
    if (!popoverEl) {
      return;
    }
    if (openedRef.current) {
      return;
    }
    open(e, { anchor });
  };
  const closePopover = (e) => {
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
            onMouseDown={(e) => {
              if (e.button !== 0) {
                return;
              }
              if (pointerTrap) {
                return;
              }
              closePopover(e);
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
        onnavi_popover_request_open={(e) => {
          const { event = e, anchor } = e.detail;
          openPopover(event, { anchor });
        }}
        onnavi_popover_request_close={(e) => {
          const { event = e } = e.detail;
          closePopover(event);
        }}
      >
        {children}
      </Box>
    </>
  );
};

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
