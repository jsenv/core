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
  maxRows,
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
      {/* Measurement ghost: all children, invisible, out-of-flow */}
      <Box
        baseClassName="navi_badge_list"
        {...sharedProps}
        ref={measureRef}
        aria-hidden="true"
        navi-badge-list-clone=""
      >
        {childArray}
      </Box>
      {/* Visible element */}
      <Box
        baseClassName="navi_badge_list"
        {...sharedProps}
        ref={visibleRef}
        lineClamp={maxRows}
      >
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
