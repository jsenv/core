import {
  getScrollContainer,
  pickPositionRelativeTo,
  scrollIntoViewWithStickyAwareness,
  visibleRectEffect,
} from "@jsenv/dom";
import { signal } from "@preact/signals";
import { createContext } from "preact";
import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { useItemTracker } from "../utils/item_tracker/item_tracker.jsx";
import { useIsInsideDropdown } from "./dropdown.jsx";

const ListItemTrackerContext = createContext(null);
const ItemToScrollOnMountRefContext = createContext(null);

export const ListIdContext = createContext();
export const ListWithSearchContext = createContext(false);
// Provided by ListWithSearch so a descendant Input knows it controls this list.
export const useIsInsideListWithSearch = () => {
  return useContext(ListWithSearchContext) === true;
};

// Provided by ListInteractive to give descendants (e.g. Suggestion) access
// to hover/keyboard-pointed/selection state.
const ListMousePointedIndexContext = createContext(-1);
const ListKeyboardPointedIndexContext = createContext(-1);
// Non-null when inside a ListInteractive (used to render data-interactive).
const ListInteractiveContext = createContext(false);

// Module-level shared Highlight instance for navi-search-match.
let naviSearchHighlight = null;
const getNaviSearchHighlight = () => {
  if (!CSS.highlights) {
    return null;
  }
  if (!naviSearchHighlight) {
    naviSearchHighlight = new Highlight();
    CSS.highlights.set("navi-search-match", naviSearchHighlight);
  }
  return naviSearchHighlight;
};

// When total rendered items exceeds renderBudget, a render window [start, end)
// is activated to cap the number of DOM nodes. Items outside the window return
// null. The window slides as the user scrolls, using actual DOM positions
// (getBoundingClientRect) to find the first visible item — no height estimation.
const RENDER_BUDGET_DEFAULT = 100;

// Attribute used on <li> elements rendered by ListItem so the scroll listener
// and filler-height calculation can find them without requiring a specific ARIA role.
const LIST_ITEM_SELECTOR = `.navi_list_item`;

// Carries the render window {start, end} (or null = render all) from
// List down to each ListItem.
const RenderWindowContext = createContext(null);
// Carries the separator element/function down to each ListItem so separators
// are only rendered between items that actually mount (post-filter, post-window).
const SeparatorContext = createContext(null);

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

      /* Disabled */
      --list-item-color-disabled: light-dark(#aaa, #555);
      --list-item-background-color-disabled: var(--list-item-background-color);

      /* Highlight (CSS Highlight API match) */
      --list-item-color-highlight: inherit;
      --list-item-background-color-highlight: #ffe066;
    }
    .navi_list_item_group_label {
      --list-group-label-background-color: var(--list-background-color);
    }
    .navi_list_item_header {
      background: var(--list-background-color);
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
    &[popover] {
      position: absolute;
      inset: unset;
      min-width: var(--list-anchor-width, 0px);
      max-width: 95vw;
      margin: 0;
      padding: 0;
    }
    &[data-anchor-hidden] {
      opacity: 0;
      pointer-events: none;
    }
  }

  .navi_list {
    display: flex;
    box-sizing: border-box;
    width: max-content;
    min-width: 100%;
    margin: 0;
    padding: 0;
    flex-direction: column;
    list-style: none;

    /* Would create scrollbars, for now just hide the loader here */
    .navi_input {
      .navi_loading_rectangle_wrapper {
        display: none;
      }
    }
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

    &[data-interactive] {
      cursor: pointer;
      user-select: none;
      /* &:hover {
        --x-color: var(--list-item-color-hover);
        --x-background-color: var(--list-item-background-color-hover);
      } */
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
    &[data-disabled] {
      --x-color: var(--list-item-color-disabled);
      --x-background-color: var(--list-item-background-color-disabled);
      cursor: not-allowed;
      pointer-events: none;
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
  /* could also use [data-void] */
  .navi_list:not(:has([navi-list-item])) {
    .navi_list_empty {
      display: block;
    }
  }

  /* Hide groups that have no rendered items. */
  .navi_list_item_group[data-hidden-while-empty]:not(:has([navi-list-item])) {
    display: none;
  }

  .navi_list_item_header {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  ::highlight(navi-search-match) {
    color: var(--list-item-color-highlight);
    background-color: var(--list-item-background-color-highlight);
  }
`;

/**
 * List — generic virtualized scroll container.
 *
 * Renders children inside a scrollable container with an optional render budget
 * for virtual scrolling. Items must use <ListItem> to participate in tracking.
 *
 * Props:
 *   keyboardInteractions  — when true, attaches arrow/enter/escape keyboard shortcuts
 *                          that dispatch navi_list_nav / navi_list_confirm / navi_list_clear
 *                          to the list container. Pair with uiAction for a full keyboard-
 *                          navigable list.
 *   uiAction             — called with the selected value on confirm. When provided
 *                          the list becomes interactive: tracks hover and keyboard-
 *                          pointed state, handles navi_list_nav / navi_list_clear /
 *                          navi_list_confirm custom events via ListInteractionContext.
 *   popover              — when true, renders as a managed popover positioned near
 *                          an anchor element via navi_list_open / navi_list_close events.
 *   renderBudget         — max items in DOM at once (default 100, virtual scroll when exceeded)
 *   virtualItemHeight    — fixed px height per item when all items have the same height.
 *                          Enables precise virtual-scroll filler sizing without a DOM
 *                          measurement pass. Required when renderBudget is active and
 *                          item height is known up-front.
 *   fallback             — content shown when no items are visible
 *   separator            — element or function(index) inserted between visible items
 *   lockSize             — when true, captures the container's dimensions on first render
 *                          (always in unfiltered state). Those values become min-width/
 *                          min-height so filtering cannot collapse the layout.
 *   ...rest              — forwarded to the outer scroll container <Box>
 */
export const List = (props) => {
  // withSearch must come first: it forces keyboardInteractions=false before any
  // other variant inspects the props (the Input handles keyboard nav instead of
  // the list itself). It also provides SetSearchTextContext and ListboxIdContext
  // before re-rendering List with withSearch removed.
  if (props.withSearch) {
    return <ListWithSearch {...props} />;
  }
  // Each of the variants below strips its own triggering prop and re-renders
  // List, so remaining variants are still picked up correctly on the next pass.
  // The order only matters in cases where one variant should suppress another —
  // currently only withSearch has that role (see above).
  if (props.uiAction) {
    return <ListInteractive {...props} />;
  }
  if (props.popover === true) {
    return <ListWithPopover {...props} />;
  }
  if (props.keyboardInteractions) {
    return <ListWithKeyboardInteractions {...props} />;
  }
  return <ListPresentation {...props} />;
};

// withSearch variant: provides ListIdContext so a descendant Input knows it
// controls this list (aria-controls) and can forward keyboard events to it.
// Also disables keyboardInteractions — the Input handles keyboard navigation.
const ListWithSearch = (props) => {
  const listIdDefault = useId();
  const listId = props.listId || listIdDefault;
  return (
    <ListWithSearchContext.Provider value={true}>
      <ListIdContext.Provider value={listId}>
        <List
          {...props}
          listId={listId}
          keyboardInteractions={false}
          withSearch={undefined}
        />
      </ListIdContext.Provider>
    </ListWithSearchContext.Provider>
  );
};

// Popover variant: handles open/close/positioning events and forwards
// navigate/confirm/clear to the underlying list.
const ListWithPopover = (props) => {
  const cleanupRef = useRef();

  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <List
      {...props}
      popover="manual"
      onnavi_list_request_open={(e) => {
        const listContainerEl = e.currentTarget;
        const anchor = e.detail?.anchor;
        listContainerEl.showPopover();
        const positionPopover = () => {
          const anchorRect = anchor.getBoundingClientRect();
          listContainerEl.style.setProperty(
            "--list-anchor-width",
            `${anchorRect.width}px`,
          );
          const minLeft = 1;
          const { left, top } = pickPositionRelativeTo(
            listContainerEl,
            anchor,
            {
              positionPreference: "below",
              minLeft,
            },
          );
          listContainerEl.style.top = `${top}px`;
          const popoverRect = listContainerEl.getBoundingClientRect();
          const maxWidth = parseFloat(
            getComputedStyle(listContainerEl).maxWidth,
          );
          if (!isNaN(maxWidth) && popoverRect.width >= maxWidth - 1) {
            const viewportWidth = document.documentElement.clientWidth;
            const centeredLeft = (viewportWidth - popoverRect.width) / 2;
            listContainerEl.style.left = `${Math.max(centeredLeft, minLeft)}px`;
          } else {
            listContainerEl.style.left = `${Math.max(left, minLeft)}px`;
          }
        };
        const cleanup = visibleRectEffect(anchor, ({ visibilityRatio }) => {
          if (visibilityRatio <= 0.2) {
            listContainerEl.setAttribute("data-anchor-hidden", "");
            return;
          }
          listContainerEl.removeAttribute("data-anchor-hidden");
          positionPopover();
        });
        cleanupRef.current = () => cleanup.disconnect();
        dispatchCustomEvent(e, "navi_list_open");
      }}
      onnavi_list_request_close={(e) => {
        const listContainerEl = e.currentTarget;
        cleanupRef.current?.();
        listContainerEl.removeAttribute("data-anchor-hidden");
        listContainerEl.hidePopover();
        dispatchCustomEvent(e, "navi_list_close");
      }}
    />
  );
};

// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol, then delegates rendering to ListControlled.
const ListInteractive = (props) => {
  const { uiAction } = props;
  const [mousePointedIndex, setMousePointedIndex] = useState(-1);
  const [keyboardPointedIndex, setKeyboardPointedIndex] = useState(-1);
  const anchorIndexRef = useRef(-1);
  const setAnchorIndex = (value) => {
    anchorIndexRef.current = value;
  };

  const itemsRef = useRef([]);

  const getValueByIndex = (index) => {
    if (index === -1) {
      return undefined;
    }
    const items = itemsRef.current;
    const item = items[index];
    const value = item?.value;
    return value;
  };

  return (
    <ListInteractiveContext.Provider value={true}>
      <ListMousePointedIndexContext.Provider value={mousePointedIndex}>
        <ListKeyboardPointedIndexContext.Provider value={keyboardPointedIndex}>
          <List
            keyboardInteractions
            {...props}
            uiAction={undefined}
            onListItemsChange={(items, meta) => {
              props.onListItemsChange?.(items, meta);
              itemsRef.current = items;
              if (meta.isInit) {
                setAnchorIndex(meta.firstSelectedIndex);
              }
            }}
            onnavi_list_request_hover={(e) => {
              const { index } = e.detail;
              setMousePointedIndex(index);
            }}
            onnavi_list_request_nav={(e) => {
              const { direction, event = e } = e.detail;
              const items = itemsRef.current;
              const itemCount = items.length;
              if (itemCount === 0) {
                return;
              }
              const anchorIndex = anchorIndexRef.current;
              const isDisabledIndex = (i) => Boolean(items[i]?.disabled);
              const resolveIndex = (direction) => {
                if (direction === "down") {
                  if (anchorIndex === -1) {
                    let i = 0;
                    while (i < itemCount && isDisabledIndex(i)) {
                      i++;
                    }
                    return i < itemCount ? i : anchorIndex;
                  }
                  let belowIndex = anchorIndex + 1;
                  while (
                    belowIndex < itemCount &&
                    isDisabledIndex(belowIndex)
                  ) {
                    belowIndex++;
                  }
                  return belowIndex < itemCount ? belowIndex : anchorIndex;
                }
                if (direction === "up") {
                  if (anchorIndex === -1) {
                    let i = itemCount - 1;
                    while (i >= 0 && isDisabledIndex(i)) {
                      i--;
                    }
                    return i >= 0 ? i : anchorIndex;
                  }
                  let aboveIndex = anchorIndex - 1;
                  while (aboveIndex >= 0 && isDisabledIndex(aboveIndex)) {
                    aboveIndex--;
                  }
                  return aboveIndex >= 0 ? aboveIndex : anchorIndex;
                }
                if (direction === "first") {
                  let i = 0;
                  while (i < itemCount && isDisabledIndex(i)) {
                    i++;
                  }
                  return i < itemCount ? i : anchorIndex;
                }
                if (direction === "last") {
                  let i = itemCount - 1;
                  while (i >= 0 && isDisabledIndex(i)) {
                    i--;
                  }
                  return i >= 0 ? i : anchorIndex;
                }
                return anchorIndex;
              };
              const index = resolveIndex(direction);
              if (index === anchorIndex) {
                return;
              }
              if (event.type === "keydown") {
                event.preventDefault();
              }
              dispatchCustomEvent(e, "navi_list_request_scroll_at", { index });
              dispatchCustomEvent(e, "navi_list_request_nav_at", { index });
            }}
            onnavi_list_request_clear={() => {
              setAnchorIndex(-1);
              setKeyboardPointedIndex(-1);
              setMousePointedIndex(-1);
            }}
            onnavi_list_request_select={(e) => {
              const index = anchorIndexRef.current;
              dispatchCustomEvent(e, "navi_list_request_select_at", { index });
            }}
            onnavi_list_nav={(e) => {
              const { index, event } = e.detail;
              setAnchorIndex(index);
              if (event.type === "keydown") {
                setKeyboardPointedIndex(index);
              } else {
                setKeyboardPointedIndex(-1);
              }
            }}
            onnavi_list_select={(e) => {
              const { index, event } = e.detail;
              setAnchorIndex(index);
              if (event.type === "keydown") {
                setKeyboardPointedIndex(index);
              } else {
                setKeyboardPointedIndex(-1);
              }
              const value = getValueByIndex(index);
              uiAction(value, event);
            }}
          />
        </ListKeyboardPointedIndexContext.Provider>
      </ListMousePointedIndexContext.Provider>
    </ListInteractiveContext.Provider>
  );
};

const ListWithKeyboardInteractions = (props) => {
  const onKeyDownForShortcuts = createOnKeyDownForShortcuts([
    {
      key: "arrowdown",
      description: "Point to next item",
      handler: (e) => {
        return dispatchCustomEvent(e, "navi_list_request_nav", {
          direction: "down",
        });
      },
    },
    {
      key: "arrowup",
      description: "Point to previous item",
      handler: (e) => {
        return dispatchCustomEvent(e, "navi_list_request_nav", {
          direction: "up",
        });
      },
    },
    {
      key: "home",
      description: "Point to first item",
      handler: (e) => {
        return dispatchCustomEvent(e, "navi_list_request_nav", {
          direction: "first",
        });
      },
    },
    {
      key: "end",
      description: "Point to last item",
      handler: (e) => {
        return dispatchCustomEvent(e, "navi_list_request_nav", {
          direction: "last",
        });
      },
    },
    {
      key: "enter",
      description: "Confirm pointed item",
      handler: (e) => {
        return dispatchCustomEvent(e, "navi_list_request_select");
      },
    },
    {
      key: "escape",
      description: "Clear pointed item",
      handler: (e) => {
        return dispatchCustomEvent(e, "navi_list_request_clear");
      },
    },
  ]);

  return (
    <List
      {...props}
      keyboardInteractions={undefined}
      tabIndex="0"
      onKeyDown={(e) => {
        onKeyDownForShortcuts(e);
        props.onKeyDown?.(e);
      }}
    />
  );
};

// Presentation-only variant: no interaction state, no navi event handling.
const ListPresentation = (props) => {
  return <ListControlled {...props} />;
};

// Internal renderer shared by ListInteractive, ListPresentation, and ListWithPopover.
const ListControlled = ({
  renderBudget = RENDER_BUDGET_DEFAULT,
  listId,
  listRole,
  fallback,
  separator,
  children,
  tabIndex,
  popover,
  expandX,
  maxHeight,
  onListItemsChange,
  virtualItemHeight,
  lockSize,
  searchText,
  ...rest
}) => {
  import.meta.css = css;

  // Default lockSize to true when rendered inside a Dropdown.
  const isInsideDropdown = useIsInsideDropdown();
  if (lockSize === undefined && isInsideDropdown) {
    lockSize = true;
  }

  const refDefault = useRef(null);
  const ref = rest.ref || refDefault;

  const ulRef = useRef(null);
  const virtualItemHeightSignal = useVirtualItemHeightSignal(
    ulRef,
    virtualItemHeight,
  );

  // lockSize: capture the container's dimensions on first render so filtering
  // cannot collapse the layout. Measurement happens on the initial (unfiltered)
  // state because the parent controls hidden props before any search is applied.
  const sizeLocked = useRef(false);
  useLayoutEffect(() => {
    if (!lockSize) {
      return undefined;
    }
    if (sizeLocked.current) {
      return undefined;
    }
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      // Use borderBoxSize (outer width) not contentRect (which excludes the
      // scrollbar width). If we used contentRect, min-width would be set to
      // outerWidth − scrollbarWidth, and the container would shrink by exactly
      // the scrollbar width when the scrollbar disappears.
      const borderBoxEntry = entry.borderBoxSize
        ? entry.borderBoxSize[0]
        : null;
      const width = borderBoxEntry
        ? borderBoxEntry.inlineSize
        : entry.contentRect.width;
      const height = borderBoxEntry
        ? borderBoxEntry.blockSize
        : entry.contentRect.height;
      if (width === 0 && height === 0) {
        return;
      }
      listContainerEl.style.minWidth = `${width}px`;
      listContainerEl.style.minHeight = `${height}px`;
      sizeLocked.current = true;
      observer.disconnect();
    });
    observer.observe(listContainerEl);
    return () => {
      observer.disconnect();
    };
  }, [lockSize]);

  const [renderWindow, setRenderWindow] = useState({
    start: 0,
    end: renderBudget,
  });
  const renderWindowRef = useRef(null);
  renderWindowRef.current = renderWindow;
  const updateRenderWindow = (newStart, newEnd) => {
    const { start, end } = renderWindowRef.current;
    if (newStart === start && newEnd === end) {
      return;
    }
    setRenderWindow({ start: newStart, end: newEnd });
  };

  const isInitRef = useRef(true);
  const itemsRef = useRef([]);
  const itemToScrollOnMountRef = useRef(null);
  const scrollToIndex = (index) => {
    const items = itemsRef.current;
    const { start, end } = renderWindowRef.current;
    const isInWindow = index >= start && index < end;
    if (isInWindow) {
      const item = items[index];
      const itemEl = document.getElementById(item.id);
      if (itemEl) {
        scrollIntoViewWithStickyAwareness(itemEl);
        return;
      }
    }
    // Not in DOM — shift the render window. The item will read
    // itemToScrollOnMountRef on mount and call scrollIntoViewWithStickyAwareness.
    itemToScrollOnMountRef.current = index;
    const half = Math.floor(renderBudget / 2);
    const newStart = Math.max(0, index - half);
    updateRenderWindow(newStart, newStart + renderBudget);
  };
  const windowMatchScoresKeyRef = useRef("");
  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const tracker = useItemTracker({
    onChange: (items) => {
      itemsRef.current = items;
      // When item count changes (e.g. after filtering), check if the render
      // window is still in range. If not, reset to start.
      const itemCount = items.length;
      const isInit = isInitRef.current;
      let firstSelectedIndex;
      if (itemCount > 0) {
        // When list is initiliazed (first render but not only, like every time a dialog opens for instance)
        // -> we want to scroll selected item into view
        if (isInit) {
          isInitRef.current = false;
          firstSelectedIndex = items.findIndex((i) => i.selected);
          if (firstSelectedIndex !== -1) {
            scrollToIndex(firstSelectedIndex);
          }
        } else {
          const current = renderWindowRef.current;
          const currentSearchText = searchTextRef.current;
          const isSearchActive =
            currentSearchText !== undefined &&
            currentSearchText !== null &&
            currentSearchText !== "";
          if (current.start >= itemCount) {
            // Render window is out of range (e.g. filter reduced the list) — reset to top.
            updateRenderWindow(0, renderBudget);
            scrollToIndex(0);
          } else if (!isSearchActive) {
            // Search was cleared — scroll back to the selected item so it's visible.
            const selectedIndex = items.findIndex((i) => i.selected);
            if (selectedIndex !== -1) {
              scrollToIndex(selectedIndex);
            }
            windowMatchScoresKeyRef.current = "";
          } else {
            // Check whether the matchScores of items in the current render window changed.
            // If they did, something sorted/filtered the visible area — scroll to top so
            // the most relevant items are visible.
            const windowItems = items.slice(current.start, current.end);
            const windowMatchScoresKey = windowItems
              .map((i) => `${i.id}:${i.matchScore ?? ""}`)
              .join(",");
            if (windowMatchScoresKey !== windowMatchScoresKeyRef.current) {
              updateRenderWindow(0, renderBudget);
              scrollToIndex(0);
            }
            windowMatchScoresKeyRef.current = windowMatchScoresKey;
          }
        }
      }
      onListItemsChange(items, { isInit, firstSelectedIndex });
    },
  });
  // Scroll listener — slides the window as the user scrolls.
  useLayoutEffect(() => {
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return undefined;
    }
    const listEl = listContainerEl.querySelector(".navi_list");
    const scrollContainer = getScrollContainer(listEl);
    const onScroll = () => {
      const totalItems = tracker.countSignal.peek();
      if (totalItems <= renderBudget) {
        return;
      }
      const current = renderWindowRef.current;
      const scrollTop = scrollContainer.scrollTop;

      let firstVisibleIndex;
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
        const measuredItemHeight = parseFloat(
          hitFiller.dataset.itemHeight || "0",
        );
        if (measuredItemHeight === 0) {
          return;
        }
        firstVisibleIndex = Math.floor(scrollTop / measuredItemHeight);
      }
      // Map the hit DOM element to its visual index via itemsRef
      // (DOM order and visual order diverge when items have CSS `order`).
      else if (hitEl) {
        const hitId = hitEl.id;
        const visualIndex = itemsRef.current.findIndex(
          (item) => item.id === hitId,
        );
        firstVisibleIndex = visualIndex === -1 ? current.start : visualIndex;
      } else {
        firstVisibleIndex = current.start;
      }

      const half = Math.floor(renderBudget / 2);
      let newStart = Math.max(0, firstVisibleIndex - half);
      let newEnd = Math.min(totalItems, newStart + renderBudget);
      if (newEnd === totalItems) {
        newStart = Math.max(0, totalItems - renderBudget);
      }
      updateRenderWindow(newStart, newEnd);
    };
    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
    };
  }, [renderBudget]);

  const renderList = (listProps) => {
    return (
      <UnorderedList
        ref={ulRef}
        id={listId}
        role={listRole}
        fallback={fallback}
        separator={separator}
        expandX={expandX}
        {...listProps}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemHeightSignal={virtualItemHeightSignal}
      >
        <ItemToScrollOnMountRefContext.Provider value={itemToScrollOnMountRef}>
          <ListIdContext.Provider value={listId}>
            {children}
          </ListIdContext.Provider>
        </ItemToScrollOnMountRefContext.Provider>
      </UnorderedList>
    );
  };
  const renderListMemoized = useCallback(renderList, [
    listId,
    listRole,
    fallback,
    separator,
    expandX,
    children,
    renderWindow,
    virtualItemHeight,
  ]);

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_list_container"
      tabIndex={tabIndex}
      popover={popover}
      data-expand-x={expandX ? "" : undefined}
      expandX={expandX}
      maxHeight={maxHeight}
      visualSelector=".navi_list"
      styleCSSVars={LIST_STYLE_CSS_VARS}
      pseudoClasses={LIST_PSEUDO_CLASSES}
      hasChildFunction
      onnavi_list_request_scroll_at={(e) => {
        const { index } = e.detail;
        scrollToIndex(index, e.detail.event);
      }}
      onnavi_list_request_nav_at={(e) => {
        const items = itemsRef.current;
        if (items.length === 0) {
          return;
        }
        const { index } = e.detail;
        dispatchCustomEvent(e, "navi_list_nav", { index });
      }}
      onnavi_list_request_select_at={(e) => {
        const { index } = e.detail;
        if (index < 0) {
          return;
        }
        dispatchCustomEvent(e, "navi_list_select", { index });
      }}
    >
      {renderListMemoized}
    </Box>
  );
};
const LIST_STYLE_CSS_VARS = {
  maxHeight: "--list-max-height",
};
const LIST_PSEUDO_CLASSES = [":-navi-void"];
// Inner <ul> — hosts the fillers + items.
// Creates a virtualItemHeight signal so TopFiller and BottomFiller can
// subscribe to it independently. When virtualItemHeight is passed as a prop it
// initialises the signal directly; otherwise UnorderedList measures a rendered
// item after each commit and writes to the signal, causing only the fillers to
// re-render.
const UnorderedList = ({
  tracker,
  renderWindow,
  virtualItemHeightSignal,
  fallback,
  separator,
  children,
  ...rest
}) => {
  return (
    <Box as="ul" {...rest} baseClassName="navi_list">
      <TopFiller
        virtualItemHeightSignal={virtualItemHeightSignal}
        renderWindowStart={renderWindow.start}
      />
      <RenderWindowContext.Provider value={renderWindow}>
        <SeparatorContext.Provider value={separator ?? null}>
          <ListItemTrackerContext.Provider value={tracker}>
            {children}
            {fallback && (
              <ListItem role="presentation" className="navi_list_empty">
                {fallback}
              </ListItem>
            )}
          </ListItemTrackerContext.Provider>
        </SeparatorContext.Provider>
      </RenderWindowContext.Provider>
      <BottomFiller
        virtualItemHeightSignal={virtualItemHeightSignal}
        renderWindowEnd={renderWindow.end}
        tracker={tracker}
      />
    </Box>
  );
};
const useVirtualItemHeightSignal = (ulRef, virtualItemHeightProp = 0) => {
  const virtualHeightSignalRef = useRef(null);
  if (!virtualHeightSignalRef.current) {
    virtualHeightSignalRef.current = signal(virtualItemHeightProp);
  }
  const virtualHeightSignal = virtualHeightSignalRef.current;
  // propagate prop changes to the signal
  if (
    virtualItemHeightProp &&
    virtualHeightSignal.peek() !== virtualItemHeightProp
  ) {
    virtualHeightSignal.value = virtualItemHeightProp;
  }
  useLayoutEffect(() => {
    if (virtualHeightSignal.peek() !== 0) {
      return;
    }
    const ulEl = ulRef.current;
    if (!ulEl) {
      return;
    }
    const firstListItem = ulEl.querySelector(LIST_ITEM_SELECTOR);
    if (!firstListItem) {
      return;
    }
    const measuredHeight = firstListItem.getBoundingClientRect().height;
    virtualHeightSignal.value = measuredHeight;
  });
  return virtualHeightSignal;
};
const TopFiller = ({ virtualItemHeightSignal, renderWindowStart }) => {
  const virtualItemHeight = virtualItemHeightSignal.value;
  const numberOfItemsAbove = renderWindowStart;
  const heightToFillAbove = numberOfItemsAbove * virtualItemHeight;

  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler="top"
      aria-hidden
      data-item-height={virtualItemHeight}
      style={{
        height: `${heightToFillAbove}px`,
      }}
    />
  );
};
const BottomFiller = ({
  virtualItemHeightSignal,
  renderWindowEnd,
  tracker,
}) => {
  const itemCount = tracker.useItemCount();
  const virtualItemHeight = virtualItemHeightSignal.value;
  const numberOfItemsBelow = Math.max(itemCount - renderWindowEnd, 0);
  const heightToFillBelow = numberOfItemsBelow * virtualItemHeight;

  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler="bottom"
      aria-hidden
      data-item-height={virtualItemHeight}
      style={{
        height: `${heightToFillBelow}px`,
      }}
    />
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
 *   itemId    — stable string id for tracking (auto-generated if omitted)
 *   hidden    — when true, item is excluded from the visible count and not rendered
 *   highlight — array of [start, end] ranges to highlight via CSS Highlight API
 *   ...rest   — forwarded to the rendered <li> element
 */
export const ListItem = (props) => {
  if (props.role === "presentation") {
    return <ListItemPresentation {...props} />;
  }
  return <ListItemRealOrVoid {...props} />;
};
const ListItemPresentation = (props) => {
  return <Box as="li" {...props} />;
};
const ListItemRealOrVoid = (props) => {
  let { id, value, hidden, selected, matchScore, disabled, ...rest } = props;
  const idDefault = useId();
  id = id || idDefault;
  const renderWindow = useContext(RenderWindowContext);
  const tracker = useContext(ListItemTrackerContext);
  const index = tracker.useTrackItem(id, {
    id,
    hidden,
    value,
    selected,
    matchScore,
    disabled,
  });
  const separator = useContext(SeparatorContext);

  if (hidden) {
    return null;
  }
  if (index === -1) {
    return null;
  }
  if (index < renderWindow.start || index >= renderWindow.end) {
    return <ListItemVoid />;
  }
  const listItemVnode = (
    <ListItemReal
      id={id}
      value={value}
      index={index}
      selected={selected}
      disabled={disabled}
      {...rest}
    />
  );
  if (!separator || index === 0) {
    return listItemVnode;
  }
  const separatorVnode =
    typeof separator === "function" ? separator(index - 1) : separator;
  return (
    <>
      {separatorVnode}
      {listItemVnode}
    </>
  );
};
// When an item is outside the render window it cannot render a DOM node.
// If it wants to scroll into view it sets scrollTop so the scroll event
// shifts the window; once the item mounts as ListItemReal its layout effect
// calls scrollIntoViewWithStickyAwareness to fine-tune the position.
const ListItemVoid = () => {
  return null;
};
const ListItemReal = ({
  value,
  hidden,
  highlight,
  selected,
  disabled,
  index,
  pointed,
  children,
  ...rest
}) => {
  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;
  const isInteractive = useContext(ListInteractiveContext);
  const mousePointedIndex = useContext(ListMousePointedIndexContext);
  const keyboardPointedIndex = useContext(ListKeyboardPointedIndexContext);
  const itemToScrollOnMountRef = useContext(ItemToScrollOnMountRefContext);

  const isPointedByMouse = index === mousePointedIndex;
  const isPointedByKeyboard = index === keyboardPointedIndex;
  const isPointedByProxy = Boolean(pointed);
  const isPointed = isPointedByMouse || isPointedByKeyboard || isPointedByProxy;

  useLayoutEffect(() => {
    if (itemToScrollOnMountRef.current !== index) {
      return;
    }
    const itemEl = ref.current;
    if (!itemEl) {
      return;
    }
    itemToScrollOnMountRef.current = null;
    scrollIntoViewWithStickyAwareness(itemEl);
  }, []);

  // CSS Highlight API: mark matching text ranges when highlight prop is set.
  useLayoutEffect(() => {
    const hl = getNaviSearchHighlight();
    if (!hl) {
      return undefined;
    }
    const itemEl = ref.current;
    if (!itemEl || !highlight || highlight.length === 0) {
      return undefined;
    }
    const valueStr = String(value);
    const ownRanges = [];
    for (const [start, end] of highlight) {
      const matchText = valueStr.slice(start, end).toLowerCase();
      if (!matchText) {
        continue;
      }
      const walker = document.createTreeWalker(itemEl, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const lowerText = node.textContent.toLowerCase();
        let idx = lowerText.indexOf(matchText);
        while (idx !== -1) {
          const range = new Range();
          range.setStart(node, idx);
          range.setEnd(node, idx + matchText.length);
          hl.add(range);
          ownRanges.push(range);
          idx = lowerText.indexOf(matchText, idx + 1);
        }
      }
    }
    return () => {
      for (const range of ownRanges) {
        hl.delete(range);
      }
    };
  }, [highlight, children, hidden]);

  return (
    <Box
      as="li"
      baseClassName="navi_list_item"
      styleCSSVars={LIST_ITEM_STYLE_CSS_VARS}
      pseudoClasses={LIST_ITEM_PSEUDO_CLASSES}
      pseudoElements={LIST_ITEM_PSEUDO_ELEMENTS}
      aria-hidden={hidden ? true : undefined}
      aria-selected={selected}
      aria-disabled={disabled ? true : undefined}
      navi-list-item=""
      data-interactive={isInteractive ? "" : undefined}
      data-anchor={isPointedByKeyboard ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      onMouseEnter={(e) => {
        if (disabled) {
          return;
        }
        dispatchBubblingEvent(e, "navi_list_request_hover", { index });
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (disabled) {
          return;
        }
        dispatchBubblingEvent(e, "navi_list_request_hover", { index: -1 });
        rest.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        if (disabled) {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        dispatchBubblingEvent(e, "navi_list_request_select_at", { index });
        rest.onMouseDown?.(e);
      }}
      {...rest}
      ref={ref}
      basePseudoState={{
        ":-navi-pointed": isPointed,
        ":-navi-pointed-by-mouse": isPointedByMouse,
        ":-navi-pointed-by-keyboard": isPointedByKeyboard,
        ":-navi-pointed-by-proxy": isPointedByProxy,
        ":-navi-selected": selected,
        ":disabled": Boolean(disabled),
        ...rest.basePseudoState,
      }}
    >
      {children}
    </Box>
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
  ":disabled": {
    color: "--list-item-color-disabled",
    backgroundColor: "--list-item-background-color-disabled",
  },
  "::highlight": {
    color: "--suggestion-color-highlight",
    backgroundColor: "--suggestion-background-color-highlight",
  },
};
const LIST_ITEM_PSEUDO_CLASSES = [
  ":-navi-pointed",
  ":-navi-pointed-by-mouse",
  ":-navi-pointed-by-keyboard",
  ":-navi-pointed-by-proxy",
  ":-navi-selected",
  ":disabled",
];
const LIST_ITEM_PSEUDO_ELEMENTS = ["::highlight"];

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
export const ListItemGroup = ({
  label,
  hiddenWhileEmpty,
  children,
  ...rest
}) => {
  const groupId = useId();
  return (
    <ListItem
      {...rest}
      role="presentation"
      baseClassName="navi_list_item_group"
      data-hidden-while-empty={hiddenWhileEmpty ? "" : undefined}
    >
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
    </ListItem>
  );
};

export const ListItemHeader = (props) => {
  return (
    <ListItem
      {...props}
      role="presentation"
      baseClassName="navi_list_item_header"
    />
  );
};

const dispatchCustomEvent = (e, customEventName, customEventDetail) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: { event: e, ...e.detail, ...customEventDetail },
    cancelable: true,
  });
  return e.currentTarget.dispatchEvent(customEvent);
};
const dispatchBubblingEvent = (e, customEventName, customEventDetail) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: { event: e, ...e.detail, ...customEventDetail },
    bubbles: true,
  });
  return e.currentTarget.dispatchEvent(customEvent);
};
