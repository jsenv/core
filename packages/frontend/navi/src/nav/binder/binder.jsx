/**
 * A binder: tabs and the page they open, drawn as one shape.
 *
 * Unlike a `Nav`, a binder owns its content — the tab and the page it shows are
 * the same item, declared together:
 *
 *   <Binder>
 *     <Binder.Item value="a" label="Approved">…the page…</Binder.Item>
 *   </Binder>
 *
 * Layers, and why they are what they are:
 * - The outline (tab row + page, with the concave junctions around the current
 *   tab) is a single SVG path — see binder_path.js for why CSS borders cannot
 *   draw it. It covers the whole binder and sits above the inactive tabs but
 *   below the current tab and the page.
 * - The inactive tabs keep plain CSS borders: the path only runs along the
 *   current tab, so the top of an inactive tab is its own to draw. Their border
 *   width matches the path's stroke and lands in the same band, which is what
 *   makes the two read as one continuous line.
 * - Every tab reserves that band on the page side with a margin, so the stroke
 *   never lands on a tab's own edge.
 *
 * Border width participates in layout (it is added to the tab and page
 * padding): a thick border grows the binder rather than eating into the text.
 */

import { toChildArray } from "preact";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { buildBinderPath } from "./binder_path.js";

const css = /* css */ `
  @layer navi {
    .navi_binder {
      --binder-border-width: var(--navi-control-border-width);
      --binder-border-radius: var(--navi-control-border-radius);
      --binder-border-color: var(--navi-control-border-color);
      --binder-background: var(--navi-surface-color);
      /* The tabs that are not open read as the same paper, slightly shaded:
         derived from the border color so one override themes both, in light
         and dark alike. */
      --binder-tab-background: color-mix(
        in srgb,
        var(--binder-border-color) 12%,
        var(--binder-background)
      );
      --binder-tab-border-color: var(--binder-border-color);
      --binder-tab-color: var(--navi-color-secondary);
      --binder-tab-background-hover: color-mix(
        in srgb,
        var(--binder-border-color) 22%,
        var(--binder-background)
      );
      --binder-padding-x: var(--navi-s);
      --binder-padding-y: var(--navi-xs);
      --binder-page-padding: var(--navi-m);
    }
  }

  .navi_binder {
    position: relative;
    display: flex;
    width: fit-content;
    align-items: stretch;

    &[data-tabs-position="top"] {
      flex-direction: column;
    }
    &[data-tabs-position="bottom"] {
      flex-direction: column-reverse;
    }
    &[data-tabs-position="left"] {
      flex-direction: row;
    }
    &[data-tabs-position="right"] {
      flex-direction: row-reverse;
    }
  }

  .navi_binder_outline {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: visible;
  }

  .navi_binder_tabs {
    display: flex;
    /* Tabs of unequal size line up on the page side, so the junction band is
       one straight line whatever their content. */
    .navi_binder[data-tabs-position="top"] & {
      align-items: flex-end;
    }
    .navi_binder[data-tabs-position="bottom"] & {
      align-items: flex-start;
    }
    /* A column of tabs is as wide as its widest one, all of them that wide, so
       the junction band is one straight line here too. */
    .navi_binder[data-tabs-position="left"] &,
    .navi_binder[data-tabs-position="right"] & {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .navi_binder_tab {
    position: relative;
    z-index: 0;
    /* The border is part of the tab's box on every tab, current one included
       (transparent there — the path draws it), so opening a tab never moves
       anything. */
    padding: var(--binder-padding-y) var(--binder-padding-x);
    color: var(--binder-tab-color);
    font: inherit;
    background: var(--binder-tab-background);
    border: var(--binder-border-width) solid var(--binder-tab-border-color);
    cursor: pointer;

    &:hover {
      background: var(--binder-tab-background-hover);
    }
    &[data-current] {
      z-index: 2;
      color: inherit;
      background: transparent;
      border-color: transparent;
      cursor: default;
    }
    /* Adjacent tabs share one line rather than stacking two borders. */
    &:not(:first-child) {
      margin-inline-start: calc(-1 * var(--binder-border-width));
    }

    /* The margin on the page side is the junction band the path draws in; the
       corners away from the page are the ones that round. */
    .navi_binder[data-tabs-position="top"] & {
      margin-bottom: var(--binder-border-width);
      border-bottom: none;
      border-radius: var(--binder-border-radius) var(--binder-border-radius) 0 0;
    }
    .navi_binder[data-tabs-position="bottom"] & {
      margin-top: var(--binder-border-width);
      border-top: none;
      border-radius: 0 0 var(--binder-border-radius) var(--binder-border-radius);
    }
    .navi_binder[data-tabs-position="left"] & {
      margin-right: var(--binder-border-width);
      border-right: none;
      border-radius: var(--binder-border-radius) 0 0 var(--binder-border-radius);
    }
    .navi_binder[data-tabs-position="right"] & {
      margin-left: var(--binder-border-width);
      border-left: none;
      border-radius: 0 var(--binder-border-radius) var(--binder-border-radius) 0;
    }
    /* A column of tabs shares its main axis with the block direction, where
       margin-inline-start would collapse the wrong pair. */
    .navi_binder[data-tabs-position="left"] &:not(:first-child),
    .navi_binder[data-tabs-position="right"] &:not(:first-child) {
      margin-inline-start: 0;
      margin-top: calc(-1 * var(--binder-border-width));
    }
  }

  .navi_binder_page {
    position: relative;
    z-index: 2;
    /* Same reservation as the tabs, on the three sides the path runs along. */
    padding: calc(var(--binder-page-padding) + var(--binder-border-width));
    flex: 1;
    color: inherit;

    .navi_binder[data-tabs-position="top"] & {
      padding-top: var(--binder-page-padding);
    }
    .navi_binder[data-tabs-position="bottom"] & {
      padding-bottom: var(--binder-page-padding);
    }
    .navi_binder[data-tabs-position="left"] & {
      padding-left: var(--binder-page-padding);
    }
    .navi_binder[data-tabs-position="right"] & {
      padding-right: var(--binder-page-padding);
    }
  }
`;

const BinderStyleCSSVars = {
  borderWidth: "--binder-border-width",
  borderRadius: "--binder-border-radius",
  borderColor: "--binder-border-color",
  background: "--binder-background",
  tabBackground: "--binder-tab-background",
  tabBackgroundHover: "--binder-tab-background-hover",
  tabBorderColor: "--binder-tab-border-color",
  tabColor: "--binder-tab-color",
  paddingX: "--binder-padding-x",
  paddingY: "--binder-padding-y",
  pagePadding: "--binder-page-padding",
};

const TABS_ALIGN_TO_JUSTIFY_CONTENT = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

/**
 * @type {import("preact").FunctionComponent<{
 *   value?: any,
 *   defaultValue?: any,
 *   onChange?: (value: any) => void,
 *   tabsPosition?: "top"|"bottom"|"left"|"right",
 *   tabsAlign?: "start"|"center"|"end"|"stretch",
 *   borderWidth?: string|number,
 *   borderRadius?: string|number,
 *   borderColor?: string,
 *   background?: string,
 *   tabBackground?: string,
 *   tabBackgroundHover?: string,
 *   tabBorderColor?: string,
 *   tabColor?: string,
 *   paddingX?: string|number,
 *   paddingY?: string|number,
 *   pagePadding?: string|number,
 * }>}
 * @param {any} [props.value] - The open item, when the caller keeps that state.
 *   Leave it out for a binder that keeps its own (see `defaultValue`).
 * @param {any} [props.defaultValue] - Which item is open to begin with;
 *   defaults to the first one.
 * @param {"top"|"bottom"|"left"|"right"} [props.tabsPosition="top"] - Which
 *   side of the page the tabs sit on.
 * @param {"start"|"center"|"end"|"stretch"} [props.tabsAlign="stretch"] - How
 *   the tabs spread along that side.
 * @param {string|number} [props.borderWidth] - Thickness of the whole outline,
 *   the inactive tabs included. It is added to the paddings, so a thick border
 *   grows the binder instead of closing in on the text.
 * @param {string} [props.tabBorderColor] - The inactive tabs alone; the rest of
 *   the outline follows `borderColor`.
 * @param {import("preact").ComponentChildren} props.children - `Binder.Item`s.
 */
export const Binder = ({
  children,
  value,
  defaultValue,
  onChange,
  tabsPosition = "top",
  tabsAlign = "stretch",
  borderWidth,
  borderRadius,
  paddingX,
  paddingY,
  pagePadding,
  ...props
}) => {
  import.meta.css = css;

  const items = toChildArray(children).map((child, index) => ({
    value: child.props.value === undefined ? index : child.props.value,
    label: child.props.label,
    content: child.props.children,
    props: child.props,
  }));

  const [valueOwnState, setValueOwnState] = useState(
    defaultValue === undefined ? items[0]?.value : defaultValue,
  );
  const currentValue = value === undefined ? valueOwnState : value;
  const currentIndex = items.findIndex((item) => item.value === currentValue);
  const currentItem = currentIndex === -1 ? items[0] : items[currentIndex];

  const open = (item) => {
    if (value === undefined) {
      setValueOwnState(item.value);
    }
    onChange?.(item.value);
  };

  const vertical = tabsPosition === "left" || tabsPosition === "right";
  const tabsFirst = tabsPosition === "top" || tabsPosition === "left";

  const rootRef = useRef(null);
  const tabRefs = useRef([]);

  const onKeyDown = (event) => {
    const { key } = event;
    const previousKey = vertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = vertical ? "ArrowDown" : "ArrowRight";
    let nextIndex;
    if (key === previousKey) {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else if (key === nextKey) {
      nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
    } else if (key === "Home") {
      nextIndex = 0;
    } else if (key === "End") {
      nextIndex = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    open(items[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <Box
      ref={rootRef}
      baseClassName="navi_binder"
      data-tabs-position={tabsPosition}
      borderWidth={withPixelUnit(borderWidth)}
      borderRadius={withPixelUnit(borderRadius)}
      paddingX={withPixelUnit(paddingX)}
      paddingY={withPixelUnit(paddingY)}
      pagePadding={withPixelUnit(pagePadding)}
      {...props}
      styleCSSVars={BinderStyleCSSVars}
    >
      <BinderOutline
        rootRef={rootRef}
        currentValue={currentValue}
        tabsPosition={tabsPosition}
        vertical={vertical}
        tabsFirst={tabsFirst}
      />
      <div
        className="navi_binder_tabs"
        role="tablist"
        aria-orientation={vertical ? "vertical" : "horizontal"}
        style={{
          justifyContent: TABS_ALIGN_TO_JUSTIFY_CONTENT[tabsAlign],
        }}
      >
        {items.map((item, index) => {
          const isCurrent = item === currentItem;
          return (
            <button
              key={item.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              className="navi_binder_tab"
              aria-selected={isCurrent}
              tabIndex={isCurrent ? 0 : -1}
              data-current={isCurrent ? "" : undefined}
              style={{ flexGrow: tabsAlign === "stretch" ? 1 : 0 }}
              onClick={() => open(item)}
              onKeyDown={onKeyDown}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="navi_binder_page" role="tabpanel">
        {currentItem?.content}
      </div>
    </Box>
  );
};

/**
 * @param {any} [props.value] - What identifies this item; defaults to its
 *   position among its siblings.
 * @param {import("preact").ComponentChildren} [props.label] - What the tab
 *   shows.
 * @param {import("preact").ComponentChildren} [props.children] - The page.
 */
// Read by Binder, never rendered: an item is a declaration of a tab and its
// page, and the binder needs both before it renders either.
const BinderItem = () => null;
Binder.Item = BinderItem;

const BinderOutline = ({
  rootRef,
  currentValue,
  tabsPosition,
  vertical,
  tabsFirst,
}) => {
  const [drawing, setDrawing] = useState(null);

  const measure = useCallback(() => {
    setDrawing(
      measureDrawing({ rootEl: rootRef.current, vertical, tabsFirst }),
    );
  }, [rootRef, vertical, tabsFirst]);

  useLayoutEffect(() => {
    const rootEl = rootRef.current;
    // The outline is positioned absolutely, so drawing it cannot change any
    // observed size — the observer settles after one pass.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(rootEl);
    for (const tabEl of rootEl.querySelectorAll(".navi_binder_tab")) {
      resizeObserver.observe(tabEl);
    }
    measure();
    return () => resizeObserver.disconnect();
  }, [rootRef, measure, currentValue]);

  if (!drawing) {
    return <svg className="navi_binder_outline" aria-hidden="true" />;
  }
  return (
    <svg
      className="navi_binder_outline"
      aria-hidden="true"
      width={drawing.width}
      height={drawing.height}
    >
      <path
        d={buildBinderPath({ ...drawing.pathParams, tabsPosition })}
        fill={drawing.background}
        stroke={drawing.borderColor}
        stroke-width={drawing.borderWidth}
      />
    </svg>
  );
};

// Everything the path needs, read off the DOM rather than taken from props:
// the shape has to follow the sizes the layout actually produced — text length,
// font, whatever the page contains.
const measureDrawing = ({ rootEl, vertical, tabsFirst }) => {
  const tabEls = rootEl.querySelectorAll(".navi_binder_tab");
  const currentTabEl = rootEl.querySelector(".navi_binder_tab[data-current]");
  if (!currentTabEl) {
    return null;
  }

  const rootComputedStyle = getComputedStyle(rootEl);
  const readVar = (name) => rootComputedStyle.getPropertyValue(name).trim();
  const borderWidth = parseFloat(readVar("--binder-border-width")) || 0;
  const cornerRadius = parseFloat(readVar("--binder-border-radius")) || 0;

  // Path space: the main axis runs along the tab row, the cross axis goes from
  // the tabs toward the page.
  const mainSizeOf = (el) => (vertical ? el.offsetHeight : el.offsetWidth);
  const mainStartOf = (el) => {
    let start = vertical ? el.offsetTop : el.offsetLeft;
    let offsetParent = el.offsetParent;
    while (offsetParent && offsetParent !== rootEl) {
      start += vertical ? offsetParent.offsetTop : offsetParent.offsetLeft;
      offsetParent = offsetParent.offsetParent;
    }
    return start;
  };
  const crossStartOf = (el) => {
    let start = vertical ? el.offsetLeft : el.offsetTop;
    let offsetParent = el.offsetParent;
    while (offsetParent && offsetParent !== rootEl) {
      start += vertical ? offsetParent.offsetLeft : offsetParent.offsetTop;
      offsetParent = offsetParent.offsetParent;
    }
    return start;
  };
  const crossSizeOf = (el) => (vertical ? el.offsetWidth : el.offsetHeight);

  const mainSize = vertical ? rootEl.offsetHeight : rootEl.offsetWidth;
  const crossSize = vertical ? rootEl.offsetWidth : rootEl.offsetHeight;
  const currentTabCrossStart = crossStartOf(currentTabEl);

  // The junction line lands in the margin every tab keeps on the page side —
  // right against the tab boxes, so it continues the CSS borders drawn inside
  // them instead of covering their last row of pixels.
  let tabRowHeight;
  let panelHeight;
  if (tabsFirst) {
    tabRowHeight =
      currentTabCrossStart + crossSizeOf(currentTabEl) + borderWidth;
    panelHeight = crossSize - tabRowHeight;
  } else {
    panelHeight = currentTabCrossStart;
    tabRowHeight = crossSize - panelHeight;
  }

  const firstTabEl = tabEls[0];
  const lastTabEl = tabEls[tabEls.length - 1];
  return {
    width: vertical ? crossSize : mainSize,
    height: vertical ? mainSize : crossSize,
    borderWidth,
    borderColor: readVar("--binder-border-color"),
    background: readVar("--binder-background"),
    pathParams: {
      tabX: mainStartOf(currentTabEl),
      tabWidth: mainSizeOf(currentTabEl),
      tabRowHeight,
      panelWidth: mainSize,
      panelHeight,
      borderWidth,
      cornerRadius,
      gapBeforeTabs: mainStartOf(firstTabEl),
      gapAfterTabs: mainSize - (mainStartOf(lastTabEl) + mainSizeOf(lastTabEl)),
    },
  };
};

// A bare number in a CSS var stays a bare number and the declaration is
// dropped; every length prop here is in pixels when it is not spelled out.
const withPixelUnit = (value) => {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return value;
};
