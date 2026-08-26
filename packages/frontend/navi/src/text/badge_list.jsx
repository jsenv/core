import { measureWidestChildRow } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { stringifySpacingStyle } from "../box/box_style_util.js";
import { BadgeUI } from "./badge.jsx";
import {
  BadgeListContext,
  createBadgeSlotRegistry,
} from "./badge_list_context.js";
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

    /* maxRows: keep the first N flex lines and cut the rest off.
       A flex line is not a line box, so line-clamp/text-overflow can't do this
       (they only ever see inline text); capping the height of N rows is what
       is left. That height needs no measuring: a badge trims its text box down
       to the cap height ("text-box: trim-both cap alphabetic" in badge.jsx) so
       it is exactly 1cap tall at its own font size, plus its vertical padding —
       both restated here as ratios of the list font size. */
    &[data-max-rows] {
      --x-badge-font-size: 0.7;
      --x-badge-padding-y: 0.4;
      --x-row-height: calc(
        1cap * var(--x-badge-font-size) + 2em * var(--x-badge-padding-y) *
          var(--x-badge-font-size)
      );
      /* 1cap is read on the list, whose font-weight is not the badge's bold, so
         the row height lands a fraction of a pixel short. Half a gap of slack
         absorbs it and stays small enough to keep the next row fully out. */
      --x-slack: max(1px, var(--badge-list-gap) / 2);

      max-height: calc(
        var(--badge-list-max-rows) *
          var(--badge-list-row-height, var(--x-row-height)) +
          (var(--badge-list-max-rows) - 1) * var(--badge-list-gap) +
          var(--x-slack)
      );
      /* Rows must pile up from the top: the default "stretch" would spread them
         over the capped height instead of letting the extra ones fall out. */
      align-content: start;
      overflow: clip;
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
  // maxRows caps the height in CSS, which only works while the list is as wide
  // as the room it was given; shrinkWrap narrows it down to its widest row and
  // would re-wrap the badges under the cap.
  const shrinkWrapEnabled = shrinkWrap && !maxRows;

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

  // The badges below report themselves as they render instead of being counted
  // upfront from the children vnodes: see badge_list_context.js. It only holds
  // because BadgeList keeps no state of its own, so it never re-renders alone —
  // it re-renders with its parent, which hands it fresh children vnodes and
  // makes every badge below run again. A badge re-rendering on its own is fine
  // (the registry keeps the slot it already gave it).
  const registryRef = useRef();
  const registry =
    registryRef.current || (registryRef.current = createBadgeSlotRegistry());
  // One slot is always kept for the "+N" badge, so a list of exactly `max`
  // badges shows `max - 1` of them and "+1 more" — still `max` things on screen.
  registry.startPass(max === undefined ? Infinity : max - 1);

  const spacing = props.spacing === undefined ? "xs" : props.spacing;
  const sharedProps = {
    inline: true,
    flex: "x",
    alignY: "center",
    spacing,
    ...props,
  };
  if (maxRows) {
    sharedProps["data-max-rows"] = "";
    sharedProps.style = {
      "--badge-list-max-rows": maxRows,
      // The gap sits between the rows, so the cap has to account for it. It is
      // read back from the prop rather than from the layout.
      "--badge-list-gap": stringifySpacingStyle(spacing, "gap"),
      ...props.style,
    };
  }

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
        <BadgeListContext.Provider value={registry}>
          {children}
        </BadgeListContext.Provider>
        {/* Renders after the badges above — that is what lets it know how many
            there were. Uses BadgeUI so it doesn't take a slot of its own. */}
        <BadgeListTail registry={registry} fallback={fallback} max={max} />
      </Box>
    </Box>
  );
};

const BadgeListTail = ({ registry, fallback, max }) => {
  const count = registry.getCount();
  if (count === 0) {
    return fallback;
  }
  if (max === undefined || count <= max - 1) {
    return null;
  }
  return (
    <BadgeUI className="navi_badge_more">
      {naviI18n("badge_list.more", { count: count - (max - 1) })}
    </BadgeUI>
  );
};
