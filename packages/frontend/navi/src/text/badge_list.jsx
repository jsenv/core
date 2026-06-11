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
  const measureRef = useRef();
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    if (!measureEl) {
      return undefined;
    }
    const visibleEl = measureEl.nextElementSibling;
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
  // Hide one extra child beyond the overflow to guarantee a slot for the
  // "+N more" badge without it wrapping to a new row.
  const extraHidden = hiddenCount > 0 ? 1 : 0;
  const visibleChildren =
    maxRows !== undefined && hiddenCount > 0
      ? childArray.slice(0, childArray.length - hiddenCount - extraHidden)
      : childArray;
  const displayedHiddenCount = hiddenCount + extraHidden;

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
        baseCassName="navi_badge_list"
        {...sharedProps}
        ref={measureRef}
        aria-hidden="true"
        navi-badge-list-clone=""
      >
        {childArray}
      </Box>
      {/* Visible element */}
      <Box baseCassName="navi_badge_list" {...sharedProps}>
        {visibleChildren.length ? visibleChildren : fallback}
        {displayedHiddenCount > 0 && (
          <Badge>+{displayedHiddenCount} more</Badge>
        )}
      </Box>
    </Box>
  );
};
