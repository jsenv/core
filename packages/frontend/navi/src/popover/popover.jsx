import {
  findFocusable,
  pickPositionRelativeTo,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { createPortal } from "preact/compat";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useDebugPopover } from "../navi_debug.jsx";
import { dispatchPublicCustomEvent } from "../utils/custom_event.js";

const css = /* css */ `
  .navi_popover {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: transparent;

    &[data-anchor-hidden] {
      opacity: 0;
      pointer-events: none;
    }
  }
`;

export const Popover = (props) => {
  import.meta.css = css;
  const {
    disabled,
    scrollTrap,
    children,
    positionPreference = "below",
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const defaultId = useId();
  const id = rest.id || defaultId;
  const debugPopover = useDebugPopover();

  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const expand = () => {
    expandedRef.current = true;
    setExpanded(true);
  };
  const collapse = () => {
    expandedRef.current = false;
    setExpanded(false);
  };

  const cleanupRef = useRef(null);
  const openPopover = (e, { anchor }) => {
    debugPopover(`openPopover("${e.type}")`);
    if (disabled) {
      return;
    }
    if (expandedRef.current) {
      debugPopover("Popover already open, skipping");
      return;
    }
    const popoverEl = ref.current;
    if (!anchor || !popoverEl) {
      return;
    }
    popoverEl.showPopover();
    expand();
    const firstFocusable = findFocusable(popoverEl);
    if (firstFocusable) {
      firstFocusable.focus({ preventScroll: true });
    }
    const positionPopover = (positionEvent) => {
      debugPopover(`positionPopover("${positionEvent.type}")`);
      const anchorRect = anchor.getBoundingClientRect();
      popoverEl.style.setProperty("--anchor-width", `${anchorRect.width}px`);
      const minLeft = 1;
      const { left, top } = pickPositionRelativeTo(popoverEl, anchor, {
        positionPreference,
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

    let cleanupScrollTrap;
    if (scrollTrap) {
      cleanupScrollTrap = trapScrollInside(popoverEl);
    }
    const rectEffect = visibleRectEffect(
      anchor,
      ({ visibilityRatio }, { event }) => {
        if (visibilityRatio <= 0.2) {
          popoverEl.setAttribute("data-anchor-hidden", "");
          return;
        }
        popoverEl.removeAttribute("data-anchor-hidden");
        positionPopover(event);
      },
    );
    cleanupRef.current = () => {
      rectEffect.disconnect();
      cleanupScrollTrap?.();
    };
    dispatchPublicCustomEvent(popoverEl, "navi_popover_open", {
      event: e,
    });
  };
  const closePopover = (e) => {
    if (!expandedRef.current) {
      debugPopover("Popover already closed, skipping");
      return;
    }
    const popoverEl = ref.current;
    debugPopover(`closePopover("${e.type}")`);
    cleanupRef.current?.();
    cleanupRef.current = null;
    popoverEl.hidePopover();
    collapse();
    dispatchPublicCustomEvent(popoverEl, "navi_popover_close", {
      event: e,
    });
  };
  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <>
      {expanded &&
        createPortal(
          <div
            className="navi_popover_backdrop"
            onMouseDown={(e) => {
              if (e.button !== 0) {
                return;
              }
              closePopover(e);
            }}
          />,
          document.body,
        )}
      <Box
        ref={ref}
        id={id}
        popover="manual"
        {...rest}
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
  return popoverElement.dispatchEvent(
    new CustomEvent("navi_popover_request_open", {
      detail: { event, anchor },
    }),
  );
};
export const requestPopoverClose = (popoverElement, { event } = {}) => {
  return popoverElement.dispatchEvent(
    new CustomEvent("navi_popover_request_close", {
      detail: { event },
    }),
  );
};
