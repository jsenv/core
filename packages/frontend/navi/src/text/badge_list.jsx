import { measureWidestChildRow } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

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

  .navi_badge_more {
    display: none;
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
  const visibleRef = useRef();
  const moreBadgeRef = useRef();
  if (maxRows === undefined) {
    maxRows = maxRowsFromContext;
  }

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    const visibleEl = visibleRef.current;
    const moreBadgeEl = moreBadgeRef.current;
    if (!measureEl || !visibleEl || !moreBadgeEl) {
      return undefined;
    }
    let observer;
    let rafId;

    const measure = () => {
      // Reset: show all visible children, hide more badge
      moreBadgeEl.style.display = "none";
      const visibleChildren = Array.from(visibleEl.children).filter(
        (c) => c !== moreBadgeEl,
      );
      for (const child of visibleChildren) {
        child.style.display = "";
      }
      visibleEl.style.width = "";

      if (shrinkWrap) {
        const optimalWidth = measureWidestChildRow(measureEl);
        if (optimalWidth !== null) {
          visibleEl.style.width = `${Math.ceil(optimalWidth)}px`;
        }
      }

      if (maxRows === undefined) {
        return;
      }

      const containerRect = measureEl.getBoundingClientRect();
      const top = containerRect.top;
      const rowTops = [];
      for (const child of measureEl.children) {
        const childTop = Math.round(child.getBoundingClientRect().top - top);
        if (!rowTops.includes(childTop)) {
          rowTops.push(childTop);
        }
      }
      if (rowTops.length <= maxRows) {
        return;
      }

      const allowedTops = new Set(rowTops.slice(0, maxRows));
      const ghostChildren = Array.from(measureEl.children);
      let overflowCount = 0;
      for (const child of ghostChildren) {
        const childTop = Math.round(child.getBoundingClientRect().top - top);
        if (!allowedTops.has(childTop)) {
          overflowCount++;
        }
      }

      // Hide overflow + 1 extra children to free a slot for the more badge
      const hideCount = overflowCount + 1;
      const hideFrom = visibleChildren.length - hideCount;
      for (let i = hideFrom; i < visibleChildren.length; i++) {
        if (visibleChildren[i]) {
          visibleChildren[i].style.display = "none";
        }
      }

      // Compute max-width for the more badge from the last visible ghost child
      const lastVisibleGhostIndex = ghostChildren.length - hideCount - 1;
      const lastVisibleGhostChild = ghostChildren[lastVisibleGhostIndex];
      if (lastVisibleGhostChild) {
        const spacing = parseFloat(getComputedStyle(measureEl).gap || "0");
        const lastRight = lastVisibleGhostChild.getBoundingClientRect().right;
        const remainingWidth = Math.floor(
          containerRect.right - lastRight - spacing,
        );
        moreBadgeEl.style.maxWidth = `${remainingWidth - 1}px`;
      }

      moreBadgeEl.textContent = naviI18n("badge_list.more", {
        count: hideCount,
      });
      moreBadgeEl.style.display = "";
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
      {/* Visible element: all children always in DOM, overflow toggled via display:none */}
      <Box baseClassName="navi_badge_list" {...sharedProps} ref={visibleRef}>
        {childArray.length ? childArray : fallback}
        {/* More badge: always in DOM, shown/hidden and updated directly in the effect */}
        <MoreBadge ref={moreBadgeRef} />
      </Box>
    </Box>
  );
};

const MoreBadge = (props) => {
  return <Badge aria-hidden="true" className="navi_badge_more" {...props} />;
};
