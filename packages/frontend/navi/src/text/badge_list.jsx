import { measureWidestChildRow } from "@jsenv/dom";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { BadgeUI } from "./badge.jsx";
import { BadgeListContext, createBadgeRegistry } from "./badge_list_context.js";
import { MaxLinesContext } from "./max_lines_context.js";
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

    /* maxLines renders every badge for one layout, reads where the rows fell,
       then renders again with only what fits. The in-between is hidden rather
       than clipped: the badges that don't make it must leave the DOM, not sit
       there cut in half. Both renders land in the same frame (the second one
       is queued from a layout effect), so nothing shows up half measured. */
    &[navi-badge-list-measuring] {
      visibility: hidden;
    }
  }

  .navi_badge.navi_badge_more {
    white-space: nowrap;
  }
`;

// Groups badges by the row they wrapped onto.
// The signal we look for is horizontal: inside a row each badge starts further
// right than the previous one, at a wrap the next one starts back at the row
// start. Vertical positions can't be used because "align-items: center" gives
// badges of different heights different tops within a single row.
const groupRectsByRow = (elements) => {
  const rows = [];
  let previousLeft = -Infinity;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    if (rows.length === 0 || rect.left <= previousLeft) {
      rows.push([]);
    }
    rows[rows.length - 1].push(rect);
    previousLeft = rect.left;
  }
  return rows;
};

// Reads a list that currently holds every badge plus the "+N" badge and tells
// how many badges fit in maxLines rows.
const measureRowFit = (listEl, maxLines) => {
  const elements = Array.from(listEl.children);
  if (elements.length < 2) {
    return elements.length;
  }
  // The "+N" badge is rendered last. It sits after every badge so it moves none
  // of them, which is what lets it be measured in the same layout it is left
  // out of.
  const moreRect = elements[elements.length - 1].getBoundingClientRect();
  const badgeElements = elements.slice(0, -1);
  const rows = groupRectsByRow(badgeElements);
  if (rows.length <= maxLines) {
    return badgeElements.length;
  }

  const styles = getComputedStyle(listEl);
  const gap = parseFloat(styles.columnGap) || 0;
  const contentRight =
    listEl.getBoundingClientRect().right -
    (parseFloat(styles.paddingRight) || 0) -
    (parseFloat(styles.borderRightWidth) || 0);

  // The "+N" badge lands right after the last kept badge, so it eats into the
  // last visible row: drop badges from that row until it fits. Emptying that
  // row entirely is a valid outcome — the badge then wraps onto it and takes it
  // for itself, which is still within maxLines.
  const rowsKept = rows.slice(0, maxLines);
  const lastRow = rowsKept[rowsKept.length - 1];
  let lastRowCount = lastRow.length;
  while (
    lastRowCount > 0 &&
    lastRow[lastRowCount - 1].right + gap + moreRect.width > contentRight + 0.5
  ) {
    lastRowCount--;
  }
  return (
    rowsKept.slice(0, -1).reduce((count, row) => count + row.length, 0) +
    lastRowCount
  );
};

export const BadgeList = ({
  fallback,
  children,
  shrinkWrap = true,
  max,
  maxLines,
  ...props
}) => {
  import.meta.css = css;
  const measureRef = useRef();
  const visibleRef = useRef();
  // A badge list is often what a <Picker> displays as its value. The picker
  // clamps that value with its own maxLines, which cannot reach flex rows, so
  // it hands the number over instead — see max_lines_context.js.
  const maxLinesFromAbove = useContext(MaxLinesContext);
  const maxLinesResolved =
    maxLines === undefined ? maxLinesFromAbove : maxLines;
  // maxLines needs the list to be as wide as the room it was given; shrinkWrap
  // narrows it down to its widest row, which would re-wrap the badges under it.
  const shrinkWrapEnabled = shrinkWrap && !maxLinesResolved;

  // The badges below hand themselves over as they render instead of being read
  // upfront from the children vnodes: see badge_list_context.js.
  const registryRef = useRef();
  const registry =
    registryRef.current || (registryRef.current = createBadgeRegistry());
  // Whether Preact is about to render the badges again or hand back the ones it
  // already has, which it does when this list re-renders on its own.
  const previousChildrenRef = useRef();
  registry.startPass(previousChildrenRef.current !== children);
  previousChildrenRef.current = children;

  // How many badges fit in maxLinesResolved rows. null means "not measured yet": the
  // list then renders all of them, hidden, for the layout effect to read.
  const [rowFit, setRowFit] = useState(null);
  const measuredRef = useRef({ count: -1, width: -1 });
  const measuring = maxLinesResolved !== undefined && rowFit === null;

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
      if (shrinkWrapEnabled) {
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
  }, [shrinkWrapEnabled, children]);

  // Runs after every render, which is when the badges have registered and the
  // DOM holds whatever this render asked for.
  useLayoutEffect(() => {
    const visibleEl = visibleRef.current;
    if (maxLinesResolved === undefined || !visibleEl) {
      return;
    }
    const count = registry.getEntries().length;
    if (count === 0) {
      return;
    }
    if (rowFit === null) {
      measuredRef.current = {
        count,
        width: visibleEl.getBoundingClientRect().width,
      };
      setRowFit(measureRowFit(visibleEl, maxLinesResolved));
      return;
    }
    if (measuredRef.current.count !== count) {
      // Badges came or went: what was measured no longer describes them.
      setRowFit(null);
    }
  });

  useLayoutEffect(() => {
    const visibleEl = visibleRef.current;
    const outerParent = visibleEl?.parentElement?.parentElement;
    if (maxLinesResolved === undefined || !outerParent) {
      return undefined;
    }
    let rafId;
    const remeasure = () => {
      // Only a width change can move the rows. Height changes are ignored on
      // purpose: cutting badges off changes this list's own height, and
      // reacting to that would loop.
      const width = outerParent.getBoundingClientRect().width;
      if (Math.abs(width - measuredRef.current.width) < 0.5) {
        return;
      }
      measuredRef.current.width = width;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setRowFit(null));
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(outerParent);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, [maxLinesResolved]);

  const sharedProps = {
    inline: true,
    flex: "x",
    alignY: "center",
    spacing: "xs",
    ...props,
  };

  return (
    <Box relative inline flex>
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
      <Box
        baseClassName="navi_badge_list"
        {...sharedProps}
        ref={visibleRef}
        navi-badge-list-measuring={measuring ? "" : undefined}
      >
        {/* Registers the badges, renders nothing */}
        <BadgeListContext.Provider value={registry}>
          {children}
        </BadgeListContext.Provider>
        {/* Renders them, after they all registered */}
        <BadgeListContent
          registry={registry}
          fallback={fallback}
          max={max}
          measuring={measuring}
          rowFit={rowFit}
        />
      </Box>
    </Box>
  );
};

const BadgeListContent = ({ registry, fallback, max, measuring, rowFit }) => {
  const entries = registry.getEntries();
  const count = entries.length;
  if (count === 0) {
    return fallback;
  }

  // The "+N" badge stands among the badges, so it takes one of the max slots
  // when there is a surplus to name. A list of exactly `max` badges has nothing
  // to name and keeps all of them.
  let shownCount = max !== undefined && count > max ? max - 1 : count;
  if (!measuring && rowFit !== null && rowFit < shownCount) {
    shownCount = rowFit;
  }
  // While measuring, everything above is on screen (hidden) along with the "+N"
  // badge, so the layout effect can see where the rows fall and how much room
  // that badge asks for. Its label then reads the worst case — every badge
  // hidden — so the room reserved is never short.
  const hasMore = measuring || shownCount < count;

  return (
    <>
      {entries.slice(0, shownCount).map((badgeProps, index) => (
        // Keyed by position: a badge's own key went to the registering vnode
        // above and doesn't reach here, and badges keep no state worth moving.
        <BadgeUI key={index} {...badgeProps} />
      ))}
      {hasMore && (
        <BadgeUI className="navi_badge_more">
          {naviI18n("badge_list.more", {
            count: measuring ? count : count - shownCount,
          })}
        </BadgeUI>
      )}
    </>
  );
};
