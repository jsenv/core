import { measureWidestChildRow } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Badge } from "./badge.jsx";
import { naviI18n } from "./navi_i18n.js";

export const BadgeListMaxRowsContext = createContext();

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

  .navi_badge.navi_more_badge {
    max-width: var(--more-badge-max-width, none);
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
  const maxRowsFromContext = useContext(BadgeListMaxRowsContext);
  const measureRef = useRef();
  const [hiddenCount, setHiddenCount] = useState(0);
  if (maxRows === undefined) {
    maxRows = maxRowsFromContext;
  }

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

      // Constrain ghost to the parent's available width so flex-wrap behaves
      // the same as the visible element.
      if (shrinkWrap) {
        const optimalWidth = measureWidestChildRow(measureEl);
        if (optimalWidth !== null) {
          visibleEl.style.width = `${Math.ceil(optimalWidth)}px`;
        } else {
          visibleEl.style.width = "";
        }
      }

      if (maxRows !== undefined) {
        const containerRect = measureEl.getBoundingClientRect();
        const top = containerRect.top;
        const rowTops = [];
        for (const child of measureEl.children) {
          const childTop = Math.round(child.getBoundingClientRect().top - top);
          if (!rowTops.includes(childTop)) {
            rowTops.push(childTop);
          }
        }
        if (rowTops.length > maxRows) {
          const allowedTops = new Set(rowTops.slice(0, maxRows));
          const ghostChildren = Array.from(measureEl.children);
          for (const child of ghostChildren) {
            const childTop = Math.round(
              child.getBoundingClientRect().top - top,
            );
            if (!allowedTops.has(childTop)) {
              nextHiddenCount++;
            }
          }
          // The visible list will show ghostChildren.length - nextHiddenCount - 1 badges
          // (one extra freed for the "+N more" badge). Find the right edge of the
          // last visible badge in the ghost to compute the remaining width precisely.
          const lastVisibleIndex =
            ghostChildren.length - nextHiddenCount - 1 - 1;
          const lastVisibleChild = ghostChildren[lastVisibleIndex];
          if (lastVisibleChild) {
            const spacing = parseFloat(getComputedStyle(measureEl).gap || "0");
            const lastVisibleRight =
              lastVisibleChild.getBoundingClientRect().right;
            const remainingWidth = Math.floor(
              containerRect.right - lastVisibleRight - spacing,
            );
            visibleEl.style.setProperty(
              "--more-badge-max-width",
              `${remainingWidth}px`,
            );
          }
        } else {
          visibleEl.style.removeProperty("--more-badge-max-width");
        }
      }

      setHiddenCount(nextHiddenCount);
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
        baseClassName="navi_badge_list"
        {...sharedProps}
        ref={measureRef}
        aria-hidden="true"
        navi-badge-list-clone=""
      >
        {childArray}
      </Box>
      {/* Visible element */}
      <Box baseClassName="navi_badge_list" {...sharedProps}>
        {visibleChildren.length ? visibleChildren : fallback}
        {displayedHiddenCount > 0 && <MoreBadge count={displayedHiddenCount} />}
      </Box>
    </Box>
  );
};

const MoreBadge = ({ count }) => {
  const label = naviI18n("badge_list.more", { count });
  return <Badge className="navi_more_badge">{label}</Badge>;
};
