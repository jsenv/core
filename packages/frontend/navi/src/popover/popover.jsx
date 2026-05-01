import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createPortal } from "preact/compat";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { useDebugFocus, useDebugPopover } from "../navi_debug.jsx";

const css = /* css */ `
  .navi_select_popover {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: transparent;
  }
`;

export const Popover = (props) => {
  import.meta.css = css;
  const { disabled, children, positionPreference = "below", ...rest } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const defaultId = useId();
  const id = rest.id || defaultId;
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
  const debugFocus = useDebugFocus();
  const cleanupRef = useRef(null);
  const debugPopover = useDebugPopover();

  const openPopover = (e) => {
    debugPopover(`openPopover("${e.type}")`);
    if (disabled) {
      return;
    }
    if (expandedRef.current) {
      debugPopover("Popover already open, skipping");
      return;
    }
    const anchor = ref.current;
    const popoverEl = ref.current;
    if (!anchor || !popoverEl) {
      return;
    }
    popoverEl.showPopover();
    expand();
    const positionPopover = (event) => {
      debugPopover(`positionPopover("${event.type}")`);
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
    const cleanup = visibleRectEffect(
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
    cleanupRef.current = () => cleanup.disconnect();
  };
  const closePopover = (e) => {
    debugPopover(`closePopover("${e.type}")`);
    cleanupRef.current?.();
    cleanupRef.current = null;
    ref.current?.hidePopover();
    collapse();
  };
  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const moveFocusToSelect = (e) => {
    const select = ref.current;
    debugFocus(`moveFocusToSelect("${e.type}")`);
    select.focus({ preventScroll: true, focusVisible: true });
  };

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
              moveFocusToSelect(e);
            }}
          />,
          document.body,
        )}
      <div
        ref={ref}
        id={id}
        className="navi_popover"
        popover="manual"
        {...rest}
        onMouseDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          // mousedown inside popover should not bubble to the select (would re-open it if that mousedown closes it)
          e.stopPropagation();
        }}
        // eslint-disable-next-line react/no-unknown-property
        onnavi_request_open={(e) => {
          openPopover(e.detail.event);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onnavi_request_close={(e) => {
          closePopover(e.detail.event);
        }}
      >
        {children}
      </div>
    </>
  );
};
