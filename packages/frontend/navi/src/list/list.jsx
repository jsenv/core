import { getScrollContainer } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { createItemTracker } from "../utils/item_tracker/item_tracker.jsx";

// When total rendered items exceeds renderBudget, a render window [start, end)
// is activated to cap the number of DOM nodes. Items outside the window return
// null. The window slides as the user scrolls, using actual DOM positions
// (getBoundingClientRect) to find the first visible item — no height estimation.
const RENDER_BUDGET_DEFAULT = 100;

// Attribute used on <li> elements rendered by ListItem so the scroll listener
// and filler-height calculation can find them without requiring a specific ARIA role.
const LIST_ITEM_SELECTOR = `.navi_list_item`;

const [useListItemTrackerProvider, useTrackListItem] = createItemTracker({
  filter: (data) => !data.hidden,
});

// Carries the render window {start, end} (or null = render all) from
// List down to each ListItem.
export const RenderWindowContext = createContext(null);
// Carries the separator element/function down to each ListItem so separators
// are only rendered between items that actually mount (post-filter, post-window).
export const SeparatorContext = createContext(null);

const css = /* css */ `
  @layer navi {
    .navi_list_container {
      --list-border-radius: 4px;
      --list-border-width: 1px;
      --list-border-color: light-dark(#ccc, #555);
      --list-border-style: solid;
      --list-background-color: light-dark(#fff, #1e1e1e);
      --list-max-height: 220px;
    }
    .navi_list_item {
      --list-item-padding: 8px 12px;
      --list-item-color: inherit;
      --list-item-font-weight: inherit;

      /* Hover (mouse) */
      --list-item-color-hover: var(--list-item-color);
      --list-item-background-color-hover: light-dark(#f5f5f5, #2a2a2a);

      /* Pointed (keyboard navigation position) */
      --list-item-color-pointed: var(--list-item-color);
      --list-item-background-color-pointed: light-dark(#c2d7fc, #1a4a9e);

      /* Selected */
      --list-item-color-selected: light-dark(#1a73e8, #7baaf7);
      --list-item-background-color-selected: light-dark(#e8f0fe, #1c3a6e);
      --list-item-font-weight-selected: 500;
      --list-item-color-pointed-selected: var(--list-item-color-selected);
      --list-item-background-color-pointed-selected: light-dark(
        #d2e3fc,
        #174ea6
      );

      /* Highlight (CSS Highlight API match) */
      --list-item-color-highlight: inherit;
      --list-item-background-color-highlight: #ffe066;
    }
    .navi_list_item_group_label {
      --list-group-label-background-color: var(--list-background-color);
    }
  }

  .navi_list_container {
    --x-border-radius: var(--list-border-radius);
    --x-border-width: var(--list-border-width);
    --x-border-color: var(--list-border-color);
    --x-border-style: var(--list-border-style);
    --x-background-color: var(--list-background-color);
    width: fit-content;
    max-width: 100%;
    max-height: var(--list-max-height);
    background-color: var(--x-background-color);
    border: var(--x-border-width) var(--x-border-style) var(--x-border-color);
    border-radius: var(--x-border-radius);
    transition: opacity 0.2s ease;
    overflow: auto;

    &[data-expand-x] {
      width: 100%;
    }
  }

  .navi_list {
    box-sizing: border-box;
    width: max-content;
    min-width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .navi_list_item {
    --x-color: var(--list-item-color);
    --x-background-color: var(--list-item-background-color);
    --x-font-weight: var(--list-item-font-weight);
    display: flex;
    box-sizing: border-box;
    min-width: 100%;
    padding: var(--list-item-padding);
    color: var(--x-color);
    font-weight: var(--x-font-weight);
    background-color: var(--x-background-color);
    cursor: pointer;
    user-select: none;

    &:hover {
      --x-color: var(--list-item-color-hover);
      --x-background-color: var(--list-item-background-color-hover);
    }
    &[data-pointed] {
      --x-color: var(--list-item-color-pointed);
      --x-background-color: var(--list-item-background-color-pointed);
    }
    &[data-selected] {
      --x-color: var(--list-item-color-selected);
      --x-background-color: var(--list-item-background-color-selected);
      --x-font-weight: var(--list-item-font-weight-selected);
    }
    &[data-pointed][data-selected] {
      --x-color: var(--list-item-color-pointed-selected);
      --x-background-color: var(--list-item-background-color-pointed-selected);
    }
    &[hidden] {
      display: none;
    }
  }

  .navi_list_item_group_label {
    position: sticky;
    top: 0;
    z-index: 1;
    display: block;
    background-color: var(--list-group-label-background-color);
    user-select: none;

    &[data-default-label] {
      padding: 4px 12px 2px;
      color: light-dark(#888, #aaa);
      font-weight: 600;
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }

  /* Virtual scroll fillers — must remain invisible.
     The browser may briefly flash them during scroll before the render window
     updates, so giving them a visible background would cause visual glitches. */
  .navi_list_virtual_filler {
    height: 0px;
    list-style: none;
    /* background: pink; */
  }

  /* Empty state — hidden by default, shown when no list items are rendered. */
  .navi_list_empty {
    display: none;
    padding: var(--list-item-padding);
    color: light-dark(#888, #aaa);
    font-size: 0.9em;
    text-align: center;
    user-select: none;
  }
  .navi_list:not(:has([navi-list-item])) {
    .navi_list_empty {
      display: block;
    }
  }

  /* Hide groups that have no rendered items. */
  li[role="presentation"]:not(:has([navi-list-item])) {
    display: none;
  }
`;

/**
 * List — generic virtualized scroll container.
 *
 * Renders children inside a scrollable container with an optional render budget
 * for virtual scrolling. Items must use <ListItem> to participate in tracking.
 *
 * Props:
 *   renderBudget         — max items in DOM at once (default 100, virtual scroll when exceeded)
 *   itemHeightEstimation — fixed px height for uniform items (skips DOM measurement)
 *   itemHeightIsVariable — set false for uniform-height items (faster scroll math)
 *   fallback           — content shown when no items are visible
 *   separator            — element or function(index) inserted between visible items
 *   ...rest              — forwarded to the outer scroll container <Box>
 */
export const List = ({
  renderBudget = RENDER_BUDGET_DEFAULT,
  itemsRef,
  itemHeightEstimation,
  itemHeightIsVariable = true,
  fallback,
  separator,
  children,
  tabIndex,
  popover,
  expandX,
  ...rest
}) => {
  import.meta.css = css;

  const refDefault = useRef(null);
  const ref = rest.ref || refDefault;

  const ItemTrackerProvider = useListItemTrackerProvider();

  const [renderWindow, setRenderWindow] = useState(null);
  const renderWindowRef = useRef(null);
  renderWindowRef.current = renderWindow;

  const topFillerRef = useRef(null);
  const bottomFillerRef = useRef(null);
  const measuredItemHeightRef = useRef(itemHeightEstimation ?? 0);

  // After every render, update filler heights to reflect the current window.
  useLayoutEffect(() => {
    if (itemsRef) {
      itemsRef.current = ItemTrackerProvider.items;
    }
    const totalItems = ItemTrackerProvider.items.length;
    const current = renderWindowRef.current;
    if (!current || totalItems <= renderBudget) {
      if (topFillerRef.current) {
        topFillerRef.current.style.height = "0px";
      }
      if (bottomFillerRef.current) {
        bottomFillerRef.current.style.height = "0px";
      }
      return;
    }
    const listEl = ref.current;
    if (!listEl) {
      return;
    }
    const items = listEl.querySelectorAll(LIST_ITEM_SELECTOR);
    if (items.length === 0) {
      return;
    }
    if (!itemHeightEstimation) {
      measuredItemHeightRef.current = items[0].getBoundingClientRect().height;
    }
    const itemHeight = measuredItemHeightRef.current;
    if (topFillerRef.current) {
      topFillerRef.current.style.height = `${current.start * itemHeight}px`;
    }
    if (bottomFillerRef.current) {
      bottomFillerRef.current.style.height = `${(totalItems - current.end) * itemHeight}px`;
    }
  });

  // Activate or deactivate the render window depending on item count.
  useLayoutEffect(() => {
    const totalItems = ItemTrackerProvider.items.length;
    if (totalItems > renderBudget) {
      const current = renderWindowRef.current;
      if (current === null) {
        setRenderWindow({ start: 0, end: renderBudget });
      } else if (current.start >= totalItems) {
        // Window is entirely out of range (e.g. after filtering) — reset to start.
        setRenderWindow({ start: 0, end: renderBudget });
      }
    } else if (renderWindowRef.current !== null) {
      setRenderWindow(null);
    }
  });

  // Scroll listener — slides the window as the user scrolls.
  useLayoutEffect(() => {
    const listEl = ref.current;
    if (!listEl) {
      return undefined;
    }
    const scrollContainer = getScrollContainer(listEl);
    const onScroll = () => {
      const totalItems = ItemTrackerProvider.items.length;
      if (totalItems <= renderBudget) {
        return;
      }
      const current = renderWindowRef.current;
      if (!current) {
        return;
      }
      const scrollTop = scrollContainer.scrollTop;

      let firstVisibleIndex;
      if (itemHeightIsVariable) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const items = Array.from(listEl.querySelectorAll(LIST_ITEM_SELECTOR));
        if (items.length === 0) {
          return;
        }
        let hitEl = null;
        let hitFiller = null;
        for (let y = containerRect.top + 1; y < containerRect.bottom; y += 4) {
          const el = document.elementFromPoint(containerRect.left + 1, y);
          if (!el || !listEl.contains(el)) {
            continue;
          }
          const item = el.closest(LIST_ITEM_SELECTOR);
          if (item) {
            hitEl = item;
            break;
          }
          const filler = el.closest("li[aria-hidden]");
          if (filler) {
            hitFiller = filler;
            break;
          }
        }
        if (hitFiller) {
          const itemHeight = measuredItemHeightRef.current;
          if (itemHeight === 0) {
            return;
          }
          firstVisibleIndex = Math.floor(scrollTop / itemHeight);
        } else {
          const relIndex = hitEl ? items.indexOf(hitEl) : 0;
          firstVisibleIndex = current.start + (relIndex === -1 ? 0 : relIndex);
        }
      } else {
        const itemHeight = measuredItemHeightRef.current;
        if (itemHeight === 0) {
          return;
        }
        firstVisibleIndex = Math.floor(scrollTop / itemHeight);
      }

      const half = Math.floor(renderBudget / 2);
      let newStart = Math.max(0, firstVisibleIndex - half);
      let newEnd = Math.min(totalItems, newStart + renderBudget);
      if (newEnd === totalItems) {
        newStart = Math.max(0, totalItems - renderBudget);
      }

      if (current.start === newStart && current.end === newEnd) {
        return;
      }
      setRenderWindow({ start: newStart, end: newEnd });
    };
    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
    };
  }, [renderBudget]);

  return (
    <div
      className="navi_list_container"
      tabIndex={tabIndex}
      popover={popover}
      data-expand-x={expandX ? "" : undefined}
    >
      <UnorderedList
        ref={ref}
        ItemTrackerProvider={ItemTrackerProvider}
        renderWindow={renderWindow}
        topFillerRef={topFillerRef}
        bottomFillerRef={bottomFillerRef}
        fallback={fallback}
        separator={separator}
        expandX={expandX}
        {...rest}
      >
        {children}
      </UnorderedList>
    </div>
  );
};

// Inner <ul> — hosts the fillers + items.
const UnorderedList = ({
  ItemTrackerProvider,
  renderWindow,
  topFillerRef,
  bottomFillerRef,
  fallback,
  separator,
  children,
  ...rest
}) => {
  return (
    <Box as="ul" {...rest} baseClassName="navi_list">
      <li
        ref={topFillerRef}
        className="navi_list_virtual_filler"
        // eslint-disable-next-line react/no-unknown-property
        navi-virtual-filler="top"
        aria-hidden
      />
      <RenderWindowContext.Provider value={renderWindow}>
        <SeparatorContext.Provider value={separator ?? null}>
          <ItemTrackerProvider>{children}</ItemTrackerProvider>
        </SeparatorContext.Provider>
      </RenderWindowContext.Provider>
      <li
        ref={bottomFillerRef}
        className="navi_list_virtual_filler"
        // eslint-disable-next-line react/no-unknown-property
        navi-virtual-filler="bottom"
        aria-hidden
      />
      {fallback && (
        <ListItemPresentation className="navi_list_empty">
          {fallback}
        </ListItemPresentation>
      )}
    </Box>
  );
};

/**
 * ListItem — a trackable item that participates in virtualization.
 *
 * Must be used inside <List>. Handles:
 * - Registration with item tracker (always runs, even when hidden)
 * - Early return when outside the render window
 * - Separator rendering between visible items
 *
 * Props:
 *   itemId  — stable string id for tracking (auto-generated if omitted)
 *   hidden  — when true, item is excluded from the visible count and not rendered
 *   ...rest — forwarded to the rendered <li> element
 */
export const ListItem = ({ id, value, hidden, children, ...rest }) => {
  const idDefault = useId();
  id = id || idDefault;
  const index = useTrackListItem(id, { id, hidden, value });
  const renderWindow = useContext(RenderWindowContext);
  const separator = useContext(SeparatorContext);

  if (hidden) {
    return null;
  }
  if (renderWindow !== null) {
    if (
      index === -1 ||
      index < renderWindow.start ||
      index >= renderWindow.end
    ) {
      return null;
    }
  }
  const separatorElement =
    separator && index > 0
      ? typeof separator === "function"
        ? separator(index - 1)
        : separator
      : null;
  return (
    <>
      {separatorElement}
      <Box
        as="li"
        baseClassName="navi_list_item"
        styleCSSVars={LIST_ITEM_STYLE_CSS_VARS}
        pseudoClasses={LIST_ITEM_PSEUDO_CLASSES}
        pseudoElements={LIST_ITEM_PSEUDO_ELEMENTS}
        aria-hidden={hidden ? true : undefined}
        navi-list-item=""
        {...rest}
      >
        {children}
      </Box>
    </>
  );
};
const LIST_ITEM_STYLE_CSS_VARS = {
  "padding": "--list-item-padding",
  "color": "--list-item-color",
  "backgroundColor": "--list-item-background-color",
  "fontWeight": "--list-item-font-weight",
  ":-navi-pointed": {
    color: "--list-item-color-pointed",
    backgroundColor: "--list-item-background-color-pointed",
  },
  ":hover": {
    color: "--list-item-color-hover",
    backgroundColor: "--list-item-background-color-hover",
  },
  ":-navi-selected": {
    color: "--list-item-color-selected",
    backgroundColor: "--list-item-background-color-selected",
    fontWeight: "--list-item-font-weight-selected",
  },
  "::highlight": {
    color: "--suggestion-color-highlight",
    backgroundColor: "--suggestion-background-color-highlight",
  },
};
const LIST_ITEM_PSEUDO_CLASSES = [":-navi-pointed", ":-navi-selected"];
const LIST_ITEM_PSEUDO_ELEMENTS = ["::highlight"];

/**
 * ListItemPresentation — a non-tracked <li role="presentation"> for arbitrary
 * content inside the list (sticky headers, group labels, etc.).
 */
export const ListItemPresentation = ({ children, ...rest }) => {
  return (
    <li role="presentation" {...rest}>
      {children}
    </li>
  );
};
/**
 * ListGroup — a labeled group of list items.
 *
 * Renders a <li role="presentation"> wrapper containing a label span
 * (accessible via aria-labelledby) and a <ul role="group"> for the items.
 *
 * Props:
 *   label      — group label content
 *   labelProps — props forwarded to the label <span>
 *   ...rest    — forwarded to the outer <li role="presentation">
 */
export const ListItemGroup = ({ label, children, ...rest }) => {
  const groupId = useId();
  return (
    <ListItemPresentation {...rest}>
      <span
        id={groupId}
        role="presentation"
        aria-hidden="true"
        style={{ display: "contents" }}
      >
        <span
          className="navi_list_item_group_label"
          data-default-label={typeof label === "string" ? "" : undefined}
        >
          {label}
        </span>
      </span>
      <ul
        role="group"
        aria-labelledby={groupId}
        style={{ margin: 0, padding: 0, listStyle: "none" }}
      >
        {children}
      </ul>
    </ListItemPresentation>
  );
};
