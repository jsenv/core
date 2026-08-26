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

const BADGE_LIST_PROPS = {
  inline: true,
  flex: "x",
  alignY: "center",
  spacing: "xs",
};

// The badges hand themselves over as they render instead of being read upfront
// from the children vnodes: see badge_list_context.js. Only worth it when the
// list has something to decide — how many to show, or whether there is none at
// all. Otherwise the badges render themselves and nothing has to be collected.
const useBadgeRegistry = (children, enabled) => {
  const registryRef = useRef();
  const previousChildrenRef = useRef();
  if (!enabled) {
    return null;
  }
  const registry =
    registryRef.current || (registryRef.current = createBadgeRegistry());
  // Whether Preact is about to render the badges again or hand back the ones it
  // already has, which it does when the list re-renders on its own.
  registry.startPass(previousChildrenRef.current !== children);
  previousChildrenRef.current = children;
  return registry;
};

/**
 * A row of badges that wraps.
 *
 * Four shapes behind one name, because what the list has to do at runtime is
 * not the same in each. Nothing is set up for a case that cannot happen: a
 * plain list is one element holding its children as-is — no registry, no
 * effect —, a capped one collects its badges but measures nothing, and only
 * shrinkWrap ever builds the measurement ghost.
 *
 * @param {import("preact").ComponentChildren} [fallback]
 *   Rendered in place of the badges when there is none.
 * @param {boolean} [shrinkWrap]
 *   Narrows the list down to its widest row so the last row isn't ragged.
 *   Defaults to true inside a <Picker> — the trigger draws a border around the
 *   list, so the ragged edge shows — and false elsewhere, where the work would
 *   often go unseen: opt in where an edge is visible. Ignored when maxLines is
 *   in play, which needs the full width to know where the rows fall.
 * @param {number} [max]
 *   Caps how many badges are rendered; the surplus becomes a "+N" badge, which
 *   takes one of the max slots.
 * @param {number} [maxLines]
 *   Caps how many rows are shown, measured. Falls back to what the surrounding
 *   component grants (a <Picker>, see max_lines_context.js).
 */
export const BadgeList = (props) => {
  import.meta.css = css;
  const { maxLines, max, fallback } = props;
  const maxLinesFromAbove = useContext(MaxLinesContext);
  const maxLinesResolved =
    maxLines === undefined ? maxLinesFromAbove : maxLines;
  // Granted lines mean a clamping container — a <Picker> — whose border makes
  // the ragged last row show; nothing of the sort around us, and shrink
  // wrapping is work nobody sees unless asked for.
  const { shrinkWrap = maxLinesFromAbove !== undefined } = props;

  if (maxLinesResolved !== undefined) {
    // shrinkWrap is dropped on purpose: it narrows the list down to its widest
    // row, which would re-wrap the badges under the cap just measured.
    return <BadgeListMaxLines {...props} maxLines={maxLinesResolved} />;
  }
  if (shrinkWrap) {
    return <BadgeListShrinkWrap {...props} />;
  }
  if (max !== undefined || fallback !== undefined) {
    return <BadgeListCounted {...props} />;
  }
  return <BadgeListPlain {...props} />;
};

// Nothing to measure, cap, or count: the badges render themselves — no
// registry, no context, no effect, one element.
const BadgeListPlain = (props) => {
  return (
    <Box baseClassName="navi_badge_list" {...BADGE_LIST_PROPS} {...props}>
      {props.children}
    </Box>
  );
};

// max/fallback need the badge count, so the badges are collected — but nothing
// is measured and no DOM is watched.
const BadgeListCounted = (props) => {
  const { fallback, children, max } = props;
  const registry = useBadgeRegistry(children, true);

  return (
    <Box baseClassName="navi_badge_list" {...BADGE_LIST_PROPS} {...props}>
      <BadgeListChildren registry={registry} max={max} fallback={fallback}>
        {children}
      </BadgeListChildren>
    </Box>
  );
};

const BadgeListShrinkWrap = (props) => {
  const { fallback, children, max } = props;
  const registry = useBadgeRegistry(
    children,
    max !== undefined || fallback !== undefined,
  );
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
      // Clone the already-rendered DOM nodes instead of letting React/Preact
      // render the children a second time into the ghost: re-rendering would
      // instantiate Badge/Badge.Button a second time, double-registering their
      // controllers (and any other mount side effect) under the same id.
      measureEl.replaceChildren(
        ...Array.from(visibleEl.children, (child) => child.cloneNode(true)),
      );
      const optimalWidth = measureWidestChildRow(measureEl);
      if (optimalWidth !== null) {
        visibleEl.style.width = `${Math.ceil(optimalWidth)}px`;
      }
    };

    // A single badge is a single row, and a single row is already the widest
    // one: there is nothing to narrow, and no width the list could be given
    // that would change that.
    if (visibleEl.children.length < 2) {
      visibleEl.style.width = "";
      measureEl.replaceChildren();
      return undefined;
    }

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
  }, [children]);

  const boxProps = { ...BADGE_LIST_PROPS, ...props };
  return (
    // inline flex, not a plain block: the wrapper must sit on the line the way
    // the list itself would, otherwise the list lands a pixel low in some
    // containers.
    <Box relative inline flex="x">
      {/* Measurement ghost, filled by the layout effect above */}
      <Box
        baseClassName="navi_badge_list"
        {...boxProps}
        ref={measureRef}
        aria-hidden="true"
        navi-badge-list-clone=""
      />
      <Box baseClassName="navi_badge_list" {...boxProps} ref={visibleRef}>
        <BadgeListChildren registry={registry} max={max} fallback={fallback}>
          {children}
        </BadgeListChildren>
      </Box>
    </Box>
  );
};

const BadgeListMaxLines = (props) => {
  const { fallback, children, max, maxLines } = props;
  const registry = useBadgeRegistry(children, true);
  const visibleRef = useRef();

  // What the measure found: how many badges there were and how many of them fit
  // in maxLines rows. null means "not measured yet": the list then renders them
  // all, hidden, for the layout effect to read.
  const [fit, setFit] = useState(null);
  // The two widths this list gives whatever is around it: the one it takes with
  // every badge rendered, and the one it settles on once the surplus is gone.
  // Neither is a reason to measure again — see the resize watch below.
  const selfWidthsRef = useRef({ full: -1, settled: -1 });
  const measuring = fit === null;
  // A single badge is a single row whatever the width, so nothing can move it
  // out of the cap and nothing has to be watched.
  const watchesResize = fit !== null && fit.count > 1;

  // Runs after every render, which is when the badges have registered and the
  // DOM holds whatever this render asked for.
  useLayoutEffect(() => {
    const visibleEl = visibleRef.current;
    if (!visibleEl) {
      return;
    }
    const count = registry.getEntries().length;
    const width = visibleEl.parentElement?.getBoundingClientRect().width ?? -1;
    if (fit === null) {
      selfWidthsRef.current.full = width;
      setFit({
        count,
        shown: count < 2 ? count : measureRowFit(visibleEl, maxLines),
      });
      return;
    }
    selfWidthsRef.current.settled = width;
    if (fit.count !== count) {
      // Badges came or went: what was measured no longer describes them.
      setFit(null);
    }
  });

  useLayoutEffect(() => {
    const outerParent = visibleRef.current?.parentElement;
    if (!watchesResize || !outerParent) {
      return undefined;
    }
    let rafId;
    const remeasure = () => {
      // Only a width change can move the rows — a height change is this list
      // growing or shrinking, never the room it was given.
      //
      // And not every width change either. Nothing guarantees an ancestor whose
      // width does not follow its content (a column with align-items: start
      // sizes every row to what is inside it), so rendering every badge widens
      // what is being watched and dropping the surplus narrows it right back.
      // Those two widths are this list talking to itself; measuring again on
      // them never ends. Any other width is the room around it changing.
      const width = outerParent.getBoundingClientRect().width;
      const { full, settled } = selfWidthsRef.current;
      if (Math.abs(width - full) < 0.5 || Math.abs(width - settled) < 0.5) {
        return;
      }
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setFit(null));
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(outerParent);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, [watchesResize, maxLines]);

  return (
    <Box
      baseClassName="navi_badge_list"
      {...BADGE_LIST_PROPS}
      {...props}
      ref={visibleRef}
      navi-badge-list-measuring={measuring ? "" : undefined}
    >
      <BadgeListChildren
        registry={registry}
        max={max}
        fallback={fallback}
        measuring={measuring}
        rowFit={fit?.shown ?? null}
      >
        {children}
      </BadgeListChildren>
    </Box>
  );
};

const BadgeListChildren = ({
  registry,
  children,
  fallback,
  max,
  measuring,
  rowFit,
}) => {
  if (!registry) {
    // The badges are on their own: nothing here decides which of them render.
    return children;
  }
  return (
    <>
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
    </>
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
  if (
    !measuring &&
    rowFit !== null &&
    rowFit !== undefined &&
    rowFit < shownCount
  ) {
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
