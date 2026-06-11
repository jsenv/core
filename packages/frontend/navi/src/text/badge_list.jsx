import { measureWidestChildRow } from "@jsenv/dom";
import { toChildArray } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Badge } from "./badge.jsx";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge_list {
    flex-wrap: wrap;

    &[navi-badge-list-clone] {
      position: absolute;
      visibility: hidden;
      pointer-events: none;
    }
  }
`;

export const BadgeList = ({
  fallback,
  children,
  shrinkWrap = true,
  maxRows,
  ...props
}) => {
  import.meta.css = css;
  const visibleRef = useRef();
  const measureRef = useRef();
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    const visibleEl = visibleRef.current;
    if (!measureEl || !visibleEl) {
      return undefined;
    }
    let observer;
    let rafId;

    const measure = () => {
      let nextHiddenCount = 0;

      if (shrinkWrap) {
        const optimalWidth = measureWidestChildRow(measureEl);
        if (optimalWidth !== null) {
          visibleEl.style.width = `${Math.ceil(optimalWidth)}px`;
        } else {
          visibleEl.style.width = "";
        }
      }

      if (maxRows !== undefined) {
        const top = measureEl.getBoundingClientRect().top;
        const rowTops = [];
        for (const child of measureEl.children) {
          const childTop = Math.round(child.getBoundingClientRect().top - top);
          if (!rowTops.includes(childTop)) {
            rowTops.push(childTop);
          }
        }
        if (rowTops.length > maxRows) {
          const allowedTops = new Set(rowTops.slice(0, maxRows));
          for (const child of measureEl.children) {
            const childTop = Math.round(
              child.getBoundingClientRect().top - top,
            );
            if (!allowedTops.has(childTop)) {
              nextHiddenCount++;
            }
          }
        }
      }

      setHiddenCount(nextHiddenCount);
    };

    measure();
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };
    const parent = measureEl.parentElement;
    if (parent) {
      observer = new ResizeObserver(onResize);
      observer.observe(parent);
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [shrinkWrap, maxRows, children]);

  const childArray = toChildArray(children);
  const visibleChildren =
    maxRows !== undefined && hiddenCount > 0
      ? childArray.slice(0, childArray.length - hiddenCount)
      : childArray;

  const sharedProps = {
    inline: true,
    flex: "x",
    alignY: "center",
    spacing: "xs",
  };

  return (
    <Box relative>
      {/* Measurement ghost: all children, invisible, out-of-flow */}
      <Box
        {...sharedProps}
        ref={measureRef}
        aria-hidden="true"
        className="navi_badge_list"
        navi-badge-list-clone=""
      >
        {childArray}
      </Box>
      {/* Visible element */}
      <Box
        {...sharedProps}
        ref={visibleRef}
        className="navi_badge_list"
        {...props}
      >
        {visibleChildren.length ? visibleChildren : fallback}
        {hiddenCount > 0 && <Badge>+{hiddenCount} more</Badge>}
      </Box>
    </Box>
  );
};
