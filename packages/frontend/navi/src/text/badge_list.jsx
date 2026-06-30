import { measureWidestChildRow } from "@jsenv/dom";
import { toChildArray } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Badge } from "./badge.jsx";
import { naviI18n } from "./navi_i18n.js";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge_list {
    flex-wrap: wrap;

    &[navi-badge-list-clone] {
      position: absolute;
      width: 100%;
      visibility: hidden;
      pointer-events: none;
    }
  }

  .navi_badge.navi_badge_more {
    white-space: nowrap;
  }
`;

export const BadgeList = ({
  fallback,
  children,
  shrinkWrap = true,
  max,
  ...props
}) => {
  import.meta.css = css;
  const measureRef = useRef();
  const visibleRef = useRef();

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    const visibleEl = visibleRef.current;
    if (!measureEl || !visibleEl) {
      return undefined;
    }
    let observer;
    let rafId;

    const measure = () => {
      visibleEl.style.width = "";
      if (shrinkWrap) {
        // Clone the already-rendered DOM nodes instead of letting React/Preact
        // render the children a second time into the ghost: re-rendering would
        // instantiate Badge/Badge.Button a second time, double-registering
        // their controllers (and any other mount side effect) under the same id.
        measureEl.replaceChildren(
          ...Array.from(visibleEl.children, (child) => child.cloneNode(true)),
        );
        const optimalWidth = measureWidestChildRow(measureEl);
        if (optimalWidth !== null) {
          visibleEl.style.width = `${Math.ceil(optimalWidth)}px`;
        }
      }
    };

    measure();
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };
    const outerParent = measureEl.parentElement?.parentElement;
    if (outerParent) {
      observer = new ResizeObserver(onResize);
      observer.observe(outerParent);
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [shrinkWrap, children]);

  const childArray = toChildArray(children);
  const hasMax = max !== undefined && childArray.length > max;
  const visibleChildren = hasMax ? childArray.slice(0, max - 1) : childArray;
  const hiddenCount = hasMax ? childArray.length - (max - 1) : 0;

  const sharedProps = {
    inline: true,
    flex: "x",
    alignY: "center",
    spacing: "xs",
    ...props,
  };

  return (
    <Box relative>
      {/* Measurement ghost: populated by cloning the visible element's DOM
          nodes in the layout effect above — not rendered by React — so the
          children's components are never instantiated twice. */}
      <Box
        baseClassName="navi_badge_list"
        {...sharedProps}
        ref={measureRef}
        aria-hidden="true"
        navi-badge-list-clone=""
      />
      {/* Visible element */}
      <Box baseClassName="navi_badge_list" {...sharedProps} ref={visibleRef}>
        {visibleChildren.length ? visibleChildren : fallback}
        {hiddenCount > 0 && (
          <Badge className="navi_badge_more">
            {naviI18n("badge_list.more", { count: hiddenCount })}
          </Badge>
        )}
      </Box>
    </Box>
  );
};
