import {
  dispatchPublicCustomEvent,
  getElementSignature,
  scrollIntoViewScoped,
} from "@jsenv/dom";
import { signal } from "@preact/signals";
import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { Separator } from "../../layout/separator.jsx";
import { useDebugScroll } from "../../navi_debug.jsx";
import { naviI18n } from "../../text/navi_i18n.js";
import { useItemTracker } from "../../utils/item_tracker/use_item_tracker.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import { getUIStateControllerById } from "../controller_registry.js";
import { ListItemHeaderOrFooterResolver } from "./list_item_header_footer.jsx";
import {
  ListItemSelectableResolver,
  ListSelectableResolver,
} from "./list_selectable.jsx";
import { useSearchHighlight } from "./search_highlight.js";

const ListItemTrackerContext = createContext(null);
const GroupItemTrackerContext = createContext(null);
const PendingScrollRefContext = createContext(null);
// Controls how List.Item behaves when match=false (set via List searchNoMatchMode prop):
//   "remove"              — remove from DOM (default)
//   "invisible_and_inert" — keep in DOM, invisible and non-interactive (preserves layout, no content visible)
//   "muted"               — keep in DOM, visible but opacified and still interactive
//   "below"               — keep in DOM, fully visible, pushed below matching items via CSS order
const SearchNoMatchModeContext = createContext("remove");

// When total rendered items exceeds renderBudget, a render window [start, end)
// is activated to cap the number of DOM nodes. Items outside the window return
// null. The window slides as the user scrolls, using actual DOM positions
// (getBoundingClientRect) to find the first visible item — no height estimation.
const RENDER_BUDGET_DEFAULT = 100;

// Attribute used on <li> elements rendered by ListItemReal so the scroll listener
// and filler-height calculation can find real items without matching presentation ones.
const REAL_LIST_ITEM_SELECTOR = `[navi-list-item-real]`;

// Carries the render window {start, end} (or null = render all) from
// List down to each ListItem.
const RenderWindowContext = createContext(null);
// Carries List's own `columns` prop (a grid-template-columns value, e.g.
// "1fr auto auto") down to each ListItem/filler/fallback so they can render
// as a subgrid row instead of a flex row — see ListItem's own use of this
// context, and List's own `columns` doc, for the full rationale (table-like
// column sizing that stays correct across a virtualized, windowed item set).
const ListColumnsContext = createContext(null);
// Carries the separator element/function down to each ListItem so separators
// are only rendered between items that actually mount (post-filter, post-window).
const SeparatorContext = createContext(null);

const css = /* css */ `
  @layer navi {
    .navi_list_container {
      --list-outline-width: 1px;
      --list-border-radius: 4px;
      --list-border-width: 0px;
      --list-border-color: light-dark(#ccc, #555);
      --list-background-color: light-dark(#fff, #1e1e1e);
    }
    .navi_list_item {
      --list-item-padding-x-default: 0px;
      --list-item-padding-y-default: 0px;
      --list-item-color: inherit;
      --list-item-font-weight: inherit;
      --list-item-background-color: transparent;

      /* Highlight (CSS Highlight API match) */
      --list-item-color-highlight: inherit;
      --list-item-background-color-highlight: #ffe066;

      /* Here to be overridable by box layout props such as flex */
      display: inline-block;
    }
  }

  .navi_list_item_group_label {
    --list-group-label-background-color: var(--list-background-color);
  }
  .navi_list_item_header {
    background: var(--list-background-color);
  }
  .navi_list_item_footer {
    background: var(--list-background-color);
  }

  .navi_list_container {
    --x-list-border-radius: var(--list-border-radius);
    --x-list-border-width: var(--list-border-width);
    --x-list-border-color: var(--list-border-color);
    --x-list-background-color: var(--list-background-color);
    /* When typing inside an input browser tries to keep caret visible */
    /* For input within a sticky element inside a scrollable container */
    /* Browser will try to scroll that input into view */
    /* When that scrollable container has a scroll padding it causes scroll on each keystroke */
    /* Even putting a scroll margin on the input won't fix */
    /* The only solution is to use scroll-margins on each item that can scroll */
    /* This is why these props are named list-scroll-spacing-top and applied via scroll-margin on items */
    --x-list-scroll-spacing-top: calc(
      var(--list-header-height, 0px) + var(--list-scroll-padding-top, 0px)
    );
    --x-list-scroll-spacing-bottom: calc(
      var(--list-footer-height, 0px) + var(--list-scroll-padding-bottom, 0px)
    );
    --x-list-scroll-spacing-left: calc(
      var(--list-header-width, 0px) + var(--list-scroll-padding-left, 0px)
    );
    --x-list-scroll-spacing-right: calc(
      var(--list-footer-width, 0px) + var(--list-scroll-padding-right, 0px)
    );

    display: flex;
    min-width: 0;
    /* fit-content by default, but never wider than the parent */
    max-width: 100%;
    flex-direction: column;
    background-color: var(--x-list-background-color);
    border: var(--x-list-border-width) solid var(--x-list-border-color);
    border-radius: var(--x-list-border-radius);

    transition: opacity 0.2s ease;
    /* overflow:hidden is required on the container (not the inner scroll element)
       so that border-radius clips the content correctly. Without it, items near
       the corners would visually overflow the rounded corners during scroll. */
    overflow: hidden;

    .navi_list_scroll_container {
      width: inherit;
      min-width: inherit;
      max-width: var(--list-max-width, inherit);
      max-height: var(--list-max-height, inherit);
      flex-wrap: inherit;
      overflow: auto;
      overscroll-behavior: inherit; /* inherit select behavior */
      scrollbar-width: inherit;
    }

    &[data-expand-x] {
      width: 100%;
    }
    &[data-expand-y] {
      --list-max-height: none;
    }
    &[navi-nothing-to-display] {
      display: none;
    }
    &[popover] {
      position: absolute;
      inset: unset;
      display: none;
      min-width: var(--list-anchor-width, 0px);
      max-width: 95vw;
      margin: 0;
      padding: 0;

      &:popover-open {
        display: flex;
      }
      .navi_list {
        width: 100%;
      }

      &[data-anchor-hidden] {
        opacity: 0;
        pointer-events: none;
      }
    }
  }

  .navi_list {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    flex-wrap: inherit;
    list-style: none;
    outline: none; /* Focus is displayed on the container */
  }

  .navi_list_item {
    --x-list-item-color: var(--list-item-color);
    --x-list-item-background-color: var(--list-item-background-color);
    --x-list-item-font-weight: var(--list-item-font-weight);
    --x-list-item-border-width: var(--list-item-border-width, 0px);
    --x-list-item-border-color: var(--list-item-border-color, black);

    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    padding-top: var(
      --list-item-padding-top,
      var(
        --list-item-padding-y,
        var(--list-item-padding, var(--list-item-padding-y-default))
      )
    );
    padding-right: var(
      --list-item-padding-right,
      var(
        --list-item-padding-x,
        var(--list-item-padding, var(--list-item-padding-x-default))
      )
    );
    padding-bottom: var(
      --list-item-padding-bottom,
      var(
        --list-item-padding-y,
        var(--list-item-padding, var(--list-item-padding-y-default))
      )
    );
    padding-left: var(
      --list-item-padding-left,
      var(
        --list-item-padding-x,
        var(--list-item-padding, var(--list-item-padding-x-default))
      )
    );
    color: var(--x-list-item-color);
    font-weight: var(--x-list-item-font-weight);
    background-color: var(--x-list-item-background-color);
    border: var(--x-list-item-border-width) solid
      var(--x-list-item-border-color);
    border-radius: var(--list-item-border-radius, 0px);
    /*
    CSS impossible d'obtenir un layout qui ferait en gros:
    width = max(min(max-content, 100%), unbreakable-content)
    Donc 3 options:
    - Laisser le contenu overflow
      - moche, background ne suit pas
      -> NOPE
    - Force overflow hidden + ellipsis
      - casse la lisibilité des mots insécables
      - possible d'optin en utilisant maxLines sur le ListItem
      -> Bien mais pas par défaut
    - Forcer le retour a la ligne des mot inécables
      - Aucun des inconvénient ci dessus 
      -> Comportement par défaut
    */
    overflow-wrap: anywhere;
    /* When list has sticky header/footer, put a scroll padding */
    scroll-margin-top: var(--x-list-scroll-spacing-top);
    scroll-margin-right: var(--x-list-scroll-spacing-right);
    scroll-margin-bottom: var(--x-list-scroll-spacing-bottom);
    scroll-margin-left: var(--x-list-scroll-spacing-left);

    &[aria-hidden="true"] {
      opacity: 0;
    }

    &[navi-muted] {
      opacity: 0.35;
    }
  }

  /* Virtual scroll fillers — must remain invisible.
     The browser may briefly flash them during scroll before the render window
     updates, so giving them a visible background would cause visual glitches. */
  .navi_list_virtual_filler {
    display: inline-block;
    height: var(--size-to-fill, 0px);
    flex-shrink: 0; /* prevent eventual flex parent from shrinking fillers */
    list-style: none;
    /* background: pink; */
  }
  &[data-horizontal] {
    --list-max-height: none;

    .navi_list_virtual_filler {
      width: var(--size-to-fill, 0px);
      height: 100%;
    }
  }

  /* List's own columns prop (see ListColumnsContext) sets grid on .navi_list
     itself — Box reflects that as navi-box-flow="grid" (see box.jsx), which
     this keys off directly rather than threading the columns value through
     React just for this. A grid track only ever spans the single column it
     is placed in by default, so without this the filler would collapse into
     just the first column's width instead of reserving height across the
     whole row. */
  .navi_list[navi-box-flow="grid"] > .navi_list_virtual_filler {
    grid-column: 1 / -1;
  }

  /* Same reasoning as the filler rule above, for the separator (the default
     Separator rendered between items when List's own separator prop is
     set): a grid track only ever spans the single column it is placed in
     by default, so without this it would collapse into just the first
     column's width instead of the full row. */
  .navi_list[navi-box-flow="grid"] > .navi_separator {
    grid-column: 1 / -1;
  }

  /* Empty state — hidden by default, shown when no list items are rendered.
     order: 1 pushes fallbacks after all regular items in flex column layout.
     The list children are open-ended (headers, presentation items, real items),
     so we cannot control where the consumer places the fallback nodes in the DOM.
     Using order ensures fallbacks always appear after items regardless of DOM order.
     matchFallback intentionally shares the same order as fallback so it appears
     at the same visual position — after an input if present but before any items
     still displayed (non-matching items remain in DOM, invisible_and_inert or muted):
       1. Input (sticky header, order: -2)
       2. searchFallback (order: -1)
       3. invisible/dim items (regular order, after DOM flow)
       4. HOT FIX OF THE DEAD for bottom filler + preact issue: order: 1
       5. sticky footer (order: 2)
  */
  /* order: 0 keeps the header pinned before fallbacks (order: 1) in flex order,
     ensuring the header (e.g. a search input) always appears above them. */
  .navi_list_item_header {
    position: sticky;
    top: 0;
    left: 0;
    z-index: 1;
    order: -2;
  }
  .navi_list_fallback,
  .navi_list_search_fallback {
    order: -1;
    color: light-dark(#888, #aaa);
    &[navi-default] {
      display: inline;
      padding-top: var(
        --list-item-padding-top,
        var(
          --list-item-padding-y,
          var(--list-item-padding, var(--list-item-padding-y-default))
        )
      );
      padding-right: var(
        --list-item-padding-right,
        var(
          --list-item-padding-x,
          var(--list-item-padding, var(--list-item-padding-x-default))
        )
      );
      padding-bottom: var(
        --list-item-padding-bottom,
        var(
          --list-item-padding-y,
          var(--list-item-padding, var(--list-item-padding-y-default))
        )
      );
      padding-left: var(
        --list-item-padding-left,
        var(
          --list-item-padding-x,
          var(--list-item-padding, var(--list-item-padding-x-default))
        )
      );
      text-align: center;
      user-select: none;
    }
  }
  [navi-virtual-filler="after"] {
    /* for some reason preact ends up puttin this element before the list items in some scenarios
     I've noticed that removing the ItemIndexToScrollOnMountRefContext.Provider
     does fix this issue (I suppose it's because it cause on less render of the list which is the problematic one)
     this order ENSURE that even when preact hallucinates we are still correctly putting the bottom filler
     after the list items */
    order: 1;
  }
  /* order: 2 pins the footer after fallbacks (order: 1) and all items. */
  .navi_list_item_footer {
    position: sticky;
    right: 0;
    bottom: 0;
    z-index: 1;
    order: 2;
  }

  ::highlight(navi-search-match) {
    color: var(--list-item-color-highlight);
    background-color: var(--list-item-background-color-highlight);
  }

  /* Hide groups that have no rendered items. */
  .navi_list_item_group {
    min-width: 100%;

    .navi_list_item_group_label {
      position: sticky;
      top: 0;
      z-index: 1;
      display: block;
      background-color: var(--list-group-label-background-color);
      user-select: none;

      &[navi-default] {
        padding: 4px 12px 2px;
        color: light-dark(#888, #aaa);
        font-weight: 600;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }
    .navi_list_item_group_list {
      display: flex;
      width: max-content;
      min-width: 100%;
      margin: 0;
      padding: 0;
      flex-direction: column;
      list-style: none;

      /* Items inside a group must account for the sticky group label height
         on top of the list's global header/scroll-padding spacing. */
      .navi_list_item {
        scroll-margin-top: calc(
          var(--x-list-scroll-spacing-top) + var(--list-group-label-height, 0px)
        );
        scroll-margin-left: calc(
          var(--x-list-scroll-spacing-left) + var(--list-group-label-width, 0px)
        );
      }
    }

    &[data-hidden-while-empty]:not(:has([navi-list-item-real])) {
      display: none;
    }
  }
`;

const ListUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    renderBudget: renderBudgetProp = RENDER_BUDGET_DEFAULT,
    renderBudgetSkipCheck,
    role,
    fallback,
    searchFallback,
    separator,
    children,
    popover,
    expandX,
    expandY,
    expand,
    onListVisibleItemsChange,
    virtualItemSize,
    lockSize,
    columns,
    searchText,
    searchNoMatchMode = "remove",
    horizontal,
    spacing,
    ...rest
  } = props;
  // Accept a string (e.g. from an HTML attribute: renderBudget="50") the
  // same way a bare number would work — arithmetic below (renderBudget / 2,
  // start + renderBudget, etc.) would silently misbehave on a raw string
  // ("+" concatenates instead of adding).
  let renderBudget = renderBudgetProp;
  if (typeof renderBudget === "string") {
    const parsed = Number(renderBudget);
    renderBudget = Number.isFinite(parsed) ? parsed : RENDER_BUDGET_DEFAULT;
  }
  if (renderBudget < 30 && !renderBudgetSkipCheck) {
    console.warn(
      `List: renderBudget=${renderBudget} is too low. A renderBudget below 30 is not supported: on large screens or when the list grows, items outside the window would appear as blank space instead of rendered content. Use a value of at least 30, or omit the prop to use the default (${RENDER_BUDGET_DEFAULT}).`,
    );
  }

  // lockSize: capture the container's dimensions on first render so filtering
  // cannot collapse the layout. Measurement happens on the initial (unfiltered)
  // state because the parent controls hidden props before any search is applied.
  const sizeLocked = useRef(false);
  useDisplayedLayoutEffect(
    ref,
    (listContainerEl) => {
      if (!lockSize) {
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
    },
    [lockSize],
  );

  const tracker = useItemTracker({
    onChange: () => {
      onListVisibleItemsChange?.(tracker.visibleItemsSignal.peek());
    },
  });

  const {
    virtualItemSizeSignal,
    renderWindow,
    scrollToItem,
    pendingScrollRef,
  } = useListScrollSync({
    ref,
    tracker,
    renderBudget,
    virtualItemSize,
    searchText,
    horizontal,
  });

  const getItemById = (itemId) => {
    return tracker.itemsSignal.peek().find((item) => item.id === itemId);
  };

  const noMatchCount = tracker.noMatchCountSignal.value;
  const itemCount = tracker.countSignal.value;
  const allNoMatch = noMatchCount > 0 && noMatchCount === itemCount;
  const fallbackDisabled = fallback !== undefined && !fallback;
  const searchFallbackDisabled =
    searchFallback !== undefined && !searchFallback;
  const nothingToDisplay =
    (allNoMatch && searchFallbackDisabled && searchNoMatchMode === "remove") ||
    (itemCount === 0 && fallbackDisabled);

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_list_container"
      popover={popover}
      data-horizontal={horizontal ? "" : undefined}
      data-expand-x={expandX || expand ? "" : undefined}
      data-expand-y={expandY || expand ? "" : undefined}
      expandX={expandX}
      expandY={expandY}
      expand={expand}
      navi-zero-match={allNoMatch ? "" : undefined}
      navi-nothing-to-display={nothingToDisplay ? "" : undefined}
      styleCSSVars={LIST_STYLE_CSS_VARS}
      pseudoClasses={LIST_PSEUDO_CLASSES}
      hasChildUsingForwardedProps
      onnavi_request_scroll={(e) => {
        if (!Object.hasOwn(e.detail, "id")) {
          console.warn(
            `navi_request_scroll event is missing the "id" property in its detail.`,
            e,
          );
          return;
        }
        const { id } = e.detail;
        const item = getItemById(id);
        scrollToItem(item, {
          event: e,
          reason: "navi_request_scroll",
        });
      }}
    >
      <ListContent
        role={role}
        fallback={fallback}
        searchFallback={searchFallback}
        searchNoMatchMode={searchNoMatchMode}
        separator={separator}
        expandX={expandX || expand}
        horizontal={horizontal}
        spacing={spacing}
        columns={columns}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemSizeSignal={virtualItemSizeSignal}
        pendingScrollRef={pendingScrollRef}
      >
        {children}
      </ListContent>
    </Box>
  );
};
const ListFirstResolver = (props) => {
  const Next = useNextResolver();
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const idDefault = useId();
  props.id = props.id || idDefault;

  return <Next {...props} />;
};

/**
 * List — generic virtualized scroll container.
 * Items must use <List.Item> to participate in tracking.
 *
 * @type {import("preact").FunctionComponent<{
 *   selectable?: boolean,
 *   action?: (value: any) => void,
 *   uiAction?: (value: any) => void,
 *   popover?: boolean,
 *   renderBudget?: number | string,
 *   virtualItemSize?: number,
 *   fallback?: import("preact").ComponentChildren,
 *   searchFallback?: import("preact").ComponentChildren,
 *   searchText?: string,
 *   searchNoMatchMode?: "remove" | "invisible_and_inert" | "muted" | "below",
 *   separator?: boolean | import("preact").ComponentChildren,
 *   lockSize?: boolean,
 *   horizontal?: boolean,
 *   spacing?: string,
 *   columns?: string,
 *   expandX?: boolean,
 *   expandY?: boolean,
 *   expand?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 */
export const List = createComponentResolver([
  ListFirstResolver,
  ListSelectableResolver,
  ListUI,
]);
const ListContent = ({
  role,
  fallback,
  searchFallback,
  searchNoMatchMode,
  separator,
  expandX,
  horizontal,
  spacing,
  columns,
  tracker,
  renderWindow,
  virtualItemSizeSignal,
  pendingScrollRef,
  children,
}) => {
  const listProps = useContext(BoxForwardedPropsContext);
  return (
    <div className="navi_list_scroll_container">
      <UnorderedList
        role={role}
        fallback={fallback}
        searchFallback={searchFallback}
        searchNoMatchMode={searchNoMatchMode}
        separator={separator === true ? <Separator margin="0" /> : separator}
        expandX={expandX}
        // Deliberately not expandY here (unlike expandX above): the outer
        // .navi_list_container already gets its own expandY treatment (see
        // ListUI's own Box above) to fill whatever space its *own* parent
        // gives it (e.g. a flex-column ancestor's flex-grow) — the <ul>
        // itself must stay auto-height regardless, or it gets capped to
        // match .navi_list_scroll_container's own (possibly much smaller)
        // flex-resolved height instead of its real content height. That
        // breaks two things at once: virtual scroll's own filler sizing
        // (nothing to overflow into the scroll container in the first
        // place) and any sticky List.Item header/footer inside it (their
        // sticky "containing block" — the <ul>'s own box — would be
        // artificially small, so they run out of room to stay stuck well
        // before the user has actually scrolled through all the content).
        horizontal={horizontal}
        spacing={spacing}
        columns={columns}
        {...listProps}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemSizeSignal={virtualItemSizeSignal}
      >
        <PendingScrollRefContext.Provider value={pendingScrollRef}>
          {children}
        </PendingScrollRefContext.Provider>
      </UnorderedList>
    </div>
  );
};
const LIST_STYLE_CSS_VARS = {
  maxHeight: "--list-max-height",
  maxWidth: "--list-max-width",
  borderColor: "--list-border-color",
  borderRadius: "--list-border-radius",
  borderWidth: "--list-border-width",
  backgroundColor: "--list-background-color",
};
const LIST_PSEUDO_CLASSES = [
  ":hover",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":read-only",
  ":disabled",
  ":-navi-void",
  ":-navi-expanded",
];
const useListScrollSync = ({
  ref,
  tracker,
  renderBudget,
  virtualItemSize,
  searchText,
  horizontal,
}) => {
  const debugScroll = useDebugScroll();
  const virtualItemSizeSignal = useVirtualItemSizeSignal(
    ref,
    virtualItemSize,
    horizontal,
  );

  const [renderWindow, setRenderWindow] = useState({
    start: 0,
    end: renderBudget,
  });
  const renderWindowRef = useRef(null);
  renderWindowRef.current = renderWindow;
  const updateRenderWindow = (newStart, newEnd, reason) => {
    const { start, end } = renderWindowRef.current;
    if (newStart === start && newEnd === end) {
      return;
    }
    debugScroll(`updateRenderWindow(${newStart}, ${newEnd}, "${reason}")`);
    const renderWindow = { start: newStart, end: newEnd };
    renderWindowRef.current = renderWindow;
    setRenderWindow(renderWindow);
  };

  const pendingScrollRef = useRef();
  const scrollToItem = (item, { event, reason }) => {
    if (!item) {
      return;
    }
    const items = tracker.itemsSignal.peek();
    const itemCount = items.length;
    if (itemCount === 0) {
      return;
    }
    let index = items.findIndex((i) => i.id === item.id);
    if (index === -1) {
      return;
    }
    if (index >= itemCount) {
      index = itemCount - 1;
    }

    const scrollItemIntoView = (itemEl) => {
      const trigger = `"${event.type}" on ${getElementSignature(event.target)} (${reason})`;
      // When we display the list we prefer to have selected item at the center
      // otherwise, usually when focused by arrow nav, we want to keep it into view close to the nearest edge
      const block = event.type === "navi_displayed" ? "center" : "nearest";
      const scrollToItemCall = `${getElementSignature(itemEl)}.scrollIntoView({ block: "${block}", container: "nearest" })`;
      const listScrollContainerEl = ref.current.querySelector(
        `.navi_list_scroll_container`,
      );
      debugScroll(`${trigger} -> ${scrollToItemCall}`);
      scrollIntoViewScoped(itemEl, {
        container: listScrollContainerEl,
        block,
      });
      const listEl = ref.current.querySelector(".navi_list");
      dispatchPublicCustomEvent(listEl, "navi_scroll", {
        event,
        item,
      });
    };

    const { start, end } = renderWindowRef.current;
    const isInWindow = index >= start && index < end;
    if (isInWindow) {
      const itemEl = document.getElementById(item.id);
      if (itemEl) {
        scrollItemIntoView(itemEl);
        return;
      }
    }
    // Not in DOM — shift the render window. The item will read
    // pendingScrollRef on mount and scroll into view.
    pendingScrollRef.current = {
      id: item.id,
      resolve: (itemEl) => {
        pendingScrollRef.current = null;
        scrollItemIntoView(itemEl);
      },
    };
    const half = Math.floor(renderBudget / 2);
    const newStart = Math.max(0, index - half);
    const newEnd = newStart + renderBudget;
    updateRenderWindow(
      newStart,
      newEnd,
      `item to scroll (at ${index}) is out of render window`,
    );
  };

  const currentScrollRef = useRef(null);
  const updateCurrentScroll = () => {
    const listScrollContainerEl = ref.current.querySelector(
      `.navi_list_scroll_container`,
    );
    const currentScrollLeft = listScrollContainerEl.scrollLeft;
    const currentScrollTop = listScrollContainerEl.scrollTop;
    const renderWindow = renderWindowRef.current;
    currentScrollRef.current = {
      left: currentScrollLeft,
      top: currentScrollTop,
      renderWindow: { ...renderWindow },
    };
    debugScroll(
      `store currentScroll: scrollTop=${currentScrollTop}, renderWindow=[${renderWindow.start}, ${renderWindow.end})`,
    );
  };

  const searchTextRef = useRef();
  let searchTextBecomesActive = false;
  if (searchTextRef.current === undefined) {
    searchTextRef.current = searchText;
  } else {
    const searchTextPrevious = searchTextRef.current;
    searchTextRef.current = searchText;
    if (!searchTextPrevious && searchText) {
      searchTextBecomesActive = true;
    }
  }
  // Scroll to the selected item only the FIRST time the list is presented on screen,
  // so the user can see what's selected on initial open. On subsequent re-displays
  // (e.g. reopening a popover containing the list), we intentionally keep the previous
  // scroll position — it's less disruptive UX to land where the user last was, even
  // if that means the selected item isn't currently visible.
  // Skipped when inside a closed <dialog>/<details> (scrollIntoView is a no-op
  // on hidden elements); re-runs automatically every time the ancestor opens.
  const hasBeenDisplayedRef = useRef(false);
  useDisplayedLayoutEffect(
    ref,
    (el, openEvent) => {
      updateCurrentScroll();
      if (hasBeenDisplayedRef.current) {
        return;
      }
      hasBeenDisplayedRef.current = true;
      const items = tracker.itemsSignal.peek();
      const firstSelected = items.find((i) => {
        if (i.selected) {
          return true;
        }
        const inputController = getUIStateControllerById(`${i.id}_input`);
        return inputController ? inputController.uiStateSignal.peek() : false;
      });
      if (firstSelected) {
        scrollToItem(firstSelected, {
          event: new CustomEvent("navi_displayed", {
            detail: { originalEvent: openEvent },
          }),
          reason: "scroll to selected",
        });
      } else {
        scrollToItem(items[0], {
          event: new CustomEvent("navi_displayed", {
            detail: { originalEvent: openEvent },
          }),
          reason: "scroll to top (no selected item)",
        });
      }
    },
    [],
  );
  // Watch scores of the top renderBudget items.
  // When scores change during an active search, scroll to top to reveal the most relevant items.
  // When search becomes empty, restore the scroll position from before the search started.
  // We save the first-visible item ID so restoration is item-precise
  // and survives render-window shifts or item reordering.

  // NOTE POUR LE JOUR OU ON A LE MULTISELECT:
  // Lorsqu'on selectionne quelque chose pendant une recherche, alors ensuite meme si on clear
  // on veut pas revenir a la position scroll précédente car on veut garde l'item qu'on a selectionné visible
  // (pour l'instant pas grave car on travaille pour le mode select qui fermera le dialog au select)
  const savedScrollRef = useRef(null);
  const topMatchScoresKeyRef = useRef("");
  const restoreScrollRafRef = useRef(null);
  useLayoutEffect(() => {
    const listScrollContainerEl = ref.current?.querySelector(
      `.navi_list_scroll_container`,
    );
    if (!listScrollContainerEl) {
      return undefined;
    }
    if (!searchText) {
      // no search -> try to restore scroll position
      topMatchScoresKeyRef.current = "";
      const savedScroll = savedScrollRef.current;
      if (!savedScroll) {
        // nothing to restore
        return undefined;
      }
      savedScrollRef.current = null;
      debugScroll("Restoring scroll to", savedScroll);
      updateRenderWindow(
        savedScroll.renderWindow.start,
        savedScroll.renderWindow.end,
        "restore scroll window",
      );
      // Tracked in a ref rather than cancelled via this effect's own cleanup:
      // updateRenderWindow above triggers a re-render, which re-runs this
      // effect (it has no dependency array — it needs to reactively poll
      // tracker state on every render) *before* the RAF below fires. That
      // second invocation sees savedScrollRef.current already nulled and
      // bails out early — if the RAF were tied to this invocation's cleanup,
      // it would get cancelled right there with nothing to replace it,
      // silently dropping the scroll restore (renderWindow ends up correct,
      // but scrollTop stays wherever it was, showing blank filler space).
      if (restoreScrollRafRef.current) {
        cancelAnimationFrame(restoreScrollRafRef.current);
      }
      restoreScrollRafRef.current = requestAnimationFrame(() => {
        restoreScrollRafRef.current = null;
        const left = savedScroll.left;
        const top = savedScroll.top;
        // use scrollTo to respect eventual css scroll-behavior: smooth;
        debugScroll(
          `restore scroll: ${getElementSignature(listScrollContainerEl)}.scrollTo({ left: ${left}, top: ${top} })`,
        );
        // The reliable way to restore scroll is to use scrollTop because otherwise we will estimate the item to scroll
        // based on virtual item height which can wrongly restore the scroll.
        // However we have a contract with outside to inside which item is scrolled
        // (used by keyboard nav to enable anchoring the item for list item nav with arrow keys)
        // so we do our best to give that item back
        const { item } = getScrollInfo(
          savedScroll,
          listScrollContainerEl,
          tracker,
          virtualItemSizeSignal,
          renderWindowRef,
          horizontal,
        );
        listScrollContainerEl.scrollTo({
          left: savedScroll.left,
          top: savedScroll.top,
        });
        const listEl = ref.current.querySelector(".navi_list");
        dispatchPublicCustomEvent(listEl, "navi_scroll", {
          item,
          event: new CustomEvent("navi_scroll_restore"),
        });
      });
      return undefined;
    }
    const visibleItems = tracker.visibleItemsSignal.peek();
    const topItems = visibleItems.slice(0, renderBudget);
    const topMatchScoresKey = topItems
      .map((i) => `${i.id}:${i.matchInfo?.matchScore ?? ""}`)
      .join(",");
    const currentTopMatchScore = topMatchScoresKeyRef.current;
    if (topMatchScoresKey === currentTopMatchScore) {
      // no changes in top matches -> no need to scroll
      return undefined;
    }
    // n items are now more important to see, scrollTop to show them
    topMatchScoresKeyRef.current = topMatchScoresKey;
    if (searchTextBecomesActive) {
      // search just started -> save the currently scrolled item id to restore later
      const currentScroll = currentScrollRef.current;
      savedScrollRef.current = currentScroll;
      debugScroll(
        `Saving scroll: { top: ${currentScroll.top}, renderWindowStart: ${currentScroll.renderWindow.start}, renderWindowEnd: ${currentScroll.renderWindow.end} }`,
      );
    }
    // -> scroll to the top
    scrollToItem(visibleItems[0], {
      event: new CustomEvent("navi_list_top_match_change"),
    });
    return undefined;
  });

  // Scroll listener — slides the window as the user scrolls.
  useLayoutEffect(() => {
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return undefined;
    }
    const listScrollContainerEl = listContainerEl.querySelector(
      `.navi_list_scroll_container`,
    );
    const listEl = listContainerEl.querySelector(".navi_list");
    const onScroll = () => {
      updateCurrentScroll();
      const visibleItemCount = tracker.visibleCountSignal.peek();
      if (visibleItemCount <= renderBudget) {
        return;
      }
      const oneRealListItemInDom = Boolean(
        listEl.querySelector(REAL_LIST_ITEM_SELECTOR),
      );
      if (!oneRealListItemInDom) {
        return;
      }
      let reason = "";
      const scrollInfo = getScrollInfo(
        {
          left: listScrollContainerEl.scrollLeft,
          top: listScrollContainerEl.scrollTop,
        },
        listScrollContainerEl,
        tracker,
        virtualItemSizeSignal,
        renderWindowRef,
        horizontal,
      );
      if (!scrollInfo) {
        return;
      }
      const { index, reason: hitReason } = scrollInfo;
      reason = hitReason;
      const half = Math.floor(renderBudget / 2);
      let newStart = Math.max(0, index - half);
      let newEnd = Math.min(visibleItemCount, newStart + renderBudget);
      if (newEnd === visibleItemCount) {
        newStart = Math.max(0, visibleItemCount - renderBudget);
      }
      updateRenderWindow(newStart, newEnd, reason);
    };
    listScrollContainerEl.addEventListener("scroll", onScroll, {
      passive: true,
    });
    return () => {
      listScrollContainerEl.removeEventListener("scroll", onScroll);
    };
  }, [renderBudget]);

  return {
    virtualItemSizeSignal,
    renderWindow,
    pendingScrollRef,
    scrollToItem,
  };
};
// Returns the item located at the current scroll position of a list container.
// Uses DOM hit-testing to find visible items/fillers; falls back to index
// estimation via virtualItemSize or renderWindow.start.
// Returns { index, item, reason } or null if nothing can be determined.
const getScrollInfo = (
  scrollValues,
  listScrollContainerEl,
  tracker,
  virtualItemSizeSignal,
  renderWindowRef,
  horizontal,
) => {
  const listEl = listScrollContainerEl.querySelector(".navi_list");
  const items = tracker.itemsSignal.peek();
  const containerRect = listScrollContainerEl.getBoundingClientRect();
  let hitEl = null;
  let hitFiller = null;
  const scrollPos = horizontal ? scrollValues.left : scrollValues.top;
  // Start scanning from the center of the viewport along the main axis.
  // The render window places half its budget before and half after the hit index.
  // Anchoring to the center maximises how many rendered items fall within the
  // visible area.
  const scanStart = horizontal
    ? (containerRect.left + containerRect.right) / 2
    : (containerRect.top + containerRect.bottom) / 2;
  const scanEnd = horizontal ? containerRect.right : containerRect.bottom;
  for (let pos = scanStart; pos < scanEnd; pos += 4) {
    const x = horizontal ? pos : containerRect.left + 1;
    const y = horizontal ? containerRect.top + 1 : pos;
    const el = document.elementFromPoint(x, y);
    if (!el || !listEl.contains(el)) {
      continue;
    }
    const realItem = el.closest(REAL_LIST_ITEM_SELECTOR);
    if (realItem) {
      hitEl = realItem;
      break;
    }
    const filler = el.closest("[navi-virtual-filler]");
    if (filler) {
      hitFiller = filler;
      break;
    }
  }
  if (hitFiller) {
    const virtualItemSize = virtualItemSizeSignal.peek();
    if (virtualItemSize === 0) {
      return null;
    }
    const estimatedIndex = Math.floor(scrollPos / virtualItemSize);
    const index = Math.min(items.length - 1, estimatedIndex);
    return {
      item: items[index],
      index,
      reason: `hit filler, estimated at ${index} (${items[index]?.value})`,
    };
  }
  if (hitEl) {
    const hitId = hitEl.id;
    const index = items.findIndex((i) => i.id === hitId);
    if (index === -1) {
      return null;
    }
    return {
      item: items[index],
      index,
      reason: `hit item at ${index} (${items[index].value})`,
    };
  }
  const fallbackIndex = renderWindowRef.current.start;
  return {
    item: items[fallbackIndex],
    index: fallbackIndex,
    reason: "no hit",
  };
};

const useVirtualItemSizeSignal = (ref, virtualItemSizeProp = 0, horizontal) => {
  const virtualSizeSignalRef = useRef(null);
  if (!virtualSizeSignalRef.current) {
    virtualSizeSignalRef.current = signal(virtualItemSizeProp);
  }
  const virtualSizeSignal = virtualSizeSignalRef.current;
  // propagate prop changes to the signal
  if (virtualItemSizeProp && virtualSizeSignal.peek() !== virtualItemSizeProp) {
    virtualSizeSignal.value = virtualItemSizeProp;
  }
  useLayoutEffect(() => {
    if (virtualSizeSignal.peek() !== 0) {
      return undefined;
    }
    const listEl = ref.current?.querySelector(".navi_list");
    if (!listEl) {
      return undefined;
    }
    const firstListItem = listEl.querySelector(REAL_LIST_ITEM_SELECTOR);
    if (!firstListItem) {
      return undefined;
    }
    const rect = firstListItem.getBoundingClientRect();
    const measuredSize = horizontal ? rect.width : rect.height;
    if (measuredSize > 0) {
      virtualSizeSignal.value = measuredSize;
      return undefined;
    }
    // A real, mounted item never legitimately measures zero — this means
    // it isn't actually visible yet (e.g. still inside a SidePanel/Popover/
    // Dialog that hasn't finished opening), not that it's genuinely
    // zero-height. Left as 0, this would otherwise latch permanently: the
    // ancestor becoming visible is often a plain imperative DOM mutation
    // (removing a hidden attribute), not a Preact re-render, so nothing
    // would ever give this effect another chance to run. A ResizeObserver
    // re-measures the moment it actually gets a real size instead.
    const observer = new ResizeObserver(() => {
      const rect = firstListItem.getBoundingClientRect();
      const measuredSize = horizontal ? rect.width : rect.height;
      if (measuredSize > 0) {
        virtualSizeSignal.value = measuredSize;
        observer.disconnect();
      }
    });
    observer.observe(firstListItem);
    return () => {
      observer.disconnect();
    };
  });
  return virtualSizeSignal;
};

// Inner <ul> — hosts the fillers + items.
// Creates a virtualItemSize signal so BeforeFiller and AfterFiller can
// subscribe to it independently. When virtualItemSize is passed as a prop it
// initialises the signal directly; otherwise UnorderedList measures a rendered
// item after each commit and writes to the signal, causing only the fillers to
// re-render.
const UnorderedList = ({
  tracker,
  renderWindow,
  virtualItemSizeSignal,
  fallback,
  searchFallback,
  searchNoMatchMode,
  separator,
  horizontal,
  spacing,
  columns,
  children,
  ...rest
}) => {
  return (
    <Box
      as="ul"
      flex={columns ? undefined : horizontal ? "x" : "y"}
      grid={columns ? true : undefined}
      gridTemplateColumns={columns}
      {...rest}
      spacing={spacing}
      baseClassName="navi_list"
    >
      <BeforeFiller
        virtualItemSizeSignal={virtualItemSizeSignal}
        renderWindowStart={renderWindow.start}
      />
      <SearchFallback searchFallback={searchFallback} tracker={tracker} />
      <Fallback fallback={fallback} tracker={tracker} />
      <SearchNoMatchModeContext.Provider value={searchNoMatchMode}>
        <RenderWindowContext.Provider value={renderWindow}>
          <SeparatorContext.Provider value={separator ?? null}>
            <ListItemTrackerContext.Provider value={tracker}>
              <ListColumnsContext.Provider value={columns || null}>
                {children}
              </ListColumnsContext.Provider>
            </ListItemTrackerContext.Provider>
          </SeparatorContext.Provider>
        </RenderWindowContext.Provider>
      </SearchNoMatchModeContext.Provider>
      <AfterFiller
        virtualItemSizeSignal={virtualItemSizeSignal}
        renderWindowEnd={renderWindow.end}
        tracker={tracker}
      />
    </Box>
  );
};

// Show when all matchable items (those with a match prop) are non-matching.
// The match prop on List.Item signals participation in a matching system
// (search, filter, etc.). searchFallback appears when every such item has match=false.
const SearchFallback = ({ tracker, searchFallback }) => {
  const itemCount = tracker.countSignal.value;
  const noMatchCount = tracker.noMatchCountSignal.value;
  const showMatchFallback = noMatchCount > 0 && noMatchCount === itemCount;

  if (searchFallback === undefined) {
    searchFallback = naviI18n("list.no_match");
  }
  if (!searchFallback) {
    // explicitely disabled by user (<List searchFallback={false|null|''}>)
    return null;
  }
  if (!showMatchFallback) {
    return null;
  }
  return (
    <ListItem
      role="presentation"
      className="navi_list_item navi_list_search_fallback"
      hidden={!showMatchFallback}
      navi-default={typeof searchFallback === "string" ? "" : undefined}
    >
      {searchFallback}
    </ListItem>
  );
};
const Fallback = ({ tracker, fallback }) => {
  const itemCount = tracker.countSignal.value;
  const showFallback = itemCount === 0;
  if (fallback === undefined) {
    fallback = naviI18n("list.empty");
  }

  if (!showFallback) {
    return null;
  }
  return (
    <ListItem
      role="presentation"
      className="navi_list_item navi_list_fallback"
      hidden={!showFallback}
      navi-default={typeof fallback === "string" ? "" : undefined}
    >
      {fallback}
    </ListItem>
  );
};
const BeforeFiller = ({ virtualItemSizeSignal, renderWindowStart }) => {
  const virtualItemSize = virtualItemSizeSignal.value;
  const numberOfItemsBefore = renderWindowStart;
  const sizeToFillBefore = numberOfItemsBefore * virtualItemSize;

  if (!sizeToFillBefore) {
    return null;
  }
  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler="before"
      aria-hidden
      style={{
        "--size-to-fill": `${sizeToFillBefore}px`,
      }}
    />
  );
};
const AfterFiller = ({ virtualItemSizeSignal, renderWindowEnd, tracker }) => {
  const visibleItemCount = tracker.visibleCountSignal.value;
  const virtualItemSize = virtualItemSizeSignal.value;
  const numberOfItemsAfter = Math.max(visibleItemCount - renderWindowEnd, 0);
  const sizeToFillAfter = numberOfItemsAfter * virtualItemSize;

  if (!sizeToFillAfter) {
    return null;
  }
  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler="after"
      aria-hidden
      style={{
        "--size-to-fill": `${sizeToFillAfter}px`,
      }}
    />
  );
};

// List's own `columns` prop (see ListColumnsContext) turns a list item into
// a subgrid row instead of a flex row: its own children become direct grid
// items of List's own <ul>, so column widths are computed from whichever
// rows are actually in the DOM (the currently-windowed items plus the
// always-mounted header/footer) — real grid/table column sizing, not a
// hand-picked width. Shared by both ListItemReal (regular tracked items)
// and ListItemPresentation (header/footer/fallback items — these skip
// ListItemReal entirely via ListItemPresentationResolver below, so without
// this they'd silently stay flex rows and break column alignment against
// the rest of the grid). `flex` is force-cleared here because Box picks
// flex over grid when both are set (see box.jsx's own boxFlow resolution),
// so a caller-provided `flex` prop (leftover from a non-columns usage)
// would otherwise silently win over this.
const useListItemColumnsOverrideProps = (callerStyle) => {
  const columns = useContext(ListColumnsContext);
  if (!columns) {
    return undefined;
  }
  return {
    flex: undefined,
    grid: true,
    gridTemplateColumns: "subgrid",
    style: { gridColumn: "1 / -1", ...callerStyle },
  };
};
const ListItemFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  return <Next {...props} />;
};
const ListItemPresentationResolver = (props) => {
  const Next = useNextResolver();

  if (props.role === "presentation") {
    return <ListItemPresentation {...props} />;
  }
  return <Next {...props} />;
};
const ListItemPresentation = (props) => {
  const columnsOverrideProps = useListItemColumnsOverrideProps(props.style);

  return <Box as="li" {...props} {...columnsOverrideProps} />;
};
const ListItemUI = (props) => {
  if (props.id === undefined) {
    console.warn(
      "ListItem is missing an explicit id prop. Provide a stable id so pointed/selected state survives search reordering.",
    );
  }
  if (props.index === undefined) {
    console.warn(
      "ListItem is missing an explicit index prop. Provide an index so item ordering is stable regardless of render order.",
    );
  }
  const idDefault = useId();
  props.id = props.id || idDefault;
  const renderWindow = useContext(RenderWindowContext);
  const tracker = useContext(ListItemTrackerContext);
  const searchNoMatchMode = useContext(SearchNoMatchModeContext);
  // There is no standalone match/matchScore/highlight prop — participation
  // in a matching system (search, filter…) only goes through `matchInfo`
  // (e.g. useSearchText's getItemMatchInfo(item): { match, matchScore,
  // matchRanges }), so there is exactly one way to wire it up.
  const matchInfo = props.matchInfo;
  // Derive filtered/hidden/muted from matchInfo.match + searchNoMatchMode context.
  if (matchInfo?.match === false) {
    if (searchNoMatchMode === "remove") {
      props.filtered = true;
    } else if (searchNoMatchMode === "invisible_and_inert") {
      props.hidden = true;
    } else if (searchNoMatchMode === "muted") {
      props.muted = true;
    }
  }
  const item = props;
  const visibleIndex = tracker.useTrackItem(item);
  const groupTracker = useContext(GroupItemTrackerContext);
  const groupVisibleIndex = groupTracker
    ? groupTracker.useTrackItem(item)
    : null;
  const separator = useContext(SeparatorContext);

  if (props.filtered) {
    return null;
  }
  // html-hidden items: excluded from virtual scroll accounting but always in DOM
  if (props.hidden) {
    return <ListItemReal {...props} />;
  }
  if (visibleIndex === -1) {
    return null;
  }
  if (visibleIndex < renderWindow.start || visibleIndex >= renderWindow.end) {
    return <ListItemVoid />;
  }
  const listItemVnode = <ListItemReal {...props} />;
  // For separator decision, we need to know "am I the first visible item?".
  // We deliberately do NOT use tracker's visibleIndex here because, during a
  // reorder render pass (e.g. items resorted by search score), other items
  // still have stale keyToExplicitOrder values — the binary search reads
  // those stale values and computes wrong indices. The result is that no
  // item gets visibleIndex === 0 and a spurious <hr> appears at the top.
  //
  // Instead we use the parent-provided index, which is race-free:
  //   - global list: props.index === 0 means "first by explicit order"
  //     (parent passes sequential indices starting at 0; filtered items
  //     are already pushed to the end by useSearchText)
  //   - inside a group: each group has its own item tracker and group
  //     items don't reorder, so groupVisibleIndex is reliable
  const isFirstInList =
    groupVisibleIndex === null ? props.index === 0 : groupVisibleIndex === 0;
  if (!separator || isFirstInList) {
    return listItemVnode;
  }
  // separatorIndex is only used as the function-form argument (gap index)
  const separatorIndex =
    groupVisibleIndex === null ? visibleIndex : groupVisibleIndex;

  const separatorVnode =
    typeof separator === "function" ? separator(separatorIndex - 1) : separator;
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
const ListItemReal = (props) => {
  const { ref, id, hidden, muted, matchInfo, children, ...rest } = props;
  const pendingScrollRef = useContext(PendingScrollRefContext);
  const pendingScroll = pendingScrollRef.current;
  const needScrollOnMount = pendingScroll && pendingScroll.id === id;
  useLayoutEffect(() => {
    if (!needScrollOnMount) {
      return;
    }
    const itemEl = ref.current;
    if (!itemEl) {
      return;
    }
    pendingScroll.resolve(itemEl);
  }, [needScrollOnMount]);

  // CSS Highlight API: mark matching text ranges from matchInfo.matchRanges,
  // if any (there is no standalone highlight prop — see ListItem's own doc).
  useSearchHighlight(ref, matchInfo?.matchRanges, [children, hidden]);

  const columnsOverrideProps = useListItemColumnsOverrideProps(rest.style);

  return (
    <Box
      as="li"
      baseClassName="navi_list_item"
      styleCSSVars={LIST_ITEM_STYLE_CSS_VARS}
      pseudoClasses={LIST_ITEM_PSEUDO_CLASSES}
      pseudoElements={LIST_ITEM_PSEUDO_ELEMENTS}
      id={id}
      navi-list-item-real=""
      {...rest}
      {...columnsOverrideProps}
      index={undefined}
      selected={undefined}
      // We use aria-hidden and not hidden because hidden would be forced to
      // display: none while here we want to keep it in the DOM to avoid layout shift
      // but visually hidden
      aria-hidden={hidden}
      inert={hidden ? true : undefined}
      navi-muted={muted ? "" : undefined}
      ref={ref}
    >
      {children}
    </Box>
  );
};
const LIST_ITEM_STYLE_CSS_VARS = {
  "borderRadius": "--list-item-border-radius",
  "borderWidth": "--list-item-border-width",
  "padding": "--list-item-padding",
  "paddingX": "--list-item-padding-x",
  "paddingY": "--list-item-padding-y",
  "paddingTop": "--list-item-padding-top",
  "paddingRight": "--list-item-padding-right",
  "paddingBottom": "--list-item-padding-bottom",
  "paddingLeft": "--list-item-padding-left",
  "color": "--list-item-color",
  "backgroundColor": "--list-item-background-color",
  "fontWeight": "--list-item-font-weight",
  "borderColor": "--list-item-border-color",
  ":-navi-pointed": {
    color: "--list-item-color-keyboard-pointed",
    backgroundColor: "--list-item-background-color-keyboard-pointed",
  },
  ":hover": {
    color: "--list-item-color-hover",
    backgroundColor: "--list-item-background-color-hover",
  },
  ":-navi-selected": {
    color: "--list-item-color-selected",
    backgroundColor: "--list-item-background-color-selected",
    borderColor: "--list-item-border-color-selected",
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
const LIST_ITEM_PSEUDO_CLASSES = [];
const LIST_ITEM_PSEUDO_ELEMENTS = ["::highlight"];

/**
 * ListItem — a trackable item that participates in virtualization.
 *
 * Must be used inside <List>. Handles:
 * - Registration with item tracker (always runs, even when hidden)
 * - Early return when outside the render window
 * - Separator rendering between visible items
 *
 * Props:
 *   id        — HTML element id AND the stable identifier used by external commands
 *               (--navi-select, --navi-unselect, --navi-scroll, --navi-update).
 *               Required when items need to be targeted programmatically from
 *               outside the list. Auto-generated internally if omitted.
 *   index     — 0-based position in the list. Required for virtualization to work
 *               correctly. Pass the array map index.
 *   selectable — when true, the item participates in selection (radio or checkbox
 *               depending on whether the parent List has `multiple`). Requires
 *               `value` and typically a <SelectableInput /> child.
 *   value     — the JS value emitted by the list's action/uiAction when this item
 *               is selected. Can be any type (string, number, object…).
 *   selected  — controlled selected state. Pass `selected === value` (single) or
 *               `selected.includes(value)` (multiple) from parent state.
 *   itemId    — internal stable string id for tracker bookkeeping (auto-generated
 *               if omitted; prefer `id` for external addressing).
 *   filtered  — when true, item is excluded from visible count and removed from DOM entirely
 *   hidden    — when true, item is excluded from visible count (no virtual scroll height)
 *               but stays in DOM with the native HTML hidden attribute
 *   matchInfo — participation in a matching system (search, filter…): the
 *               object useSearchText's getItemMatchInfo(item) returns
 *               (or any object shaped the same way):
 *                 <ListItem matchInfo={getItemMatchInfo(item)} />
 *               There is no standalone match/matchScore/highlight prop —
 *               matchInfo is the only way to wire this up:
 *                 match       — false is interpreted per the List's own
 *                               searchNoMatchMode ("remove" -> filtered,
 *                               "invisible_and_inert" -> hidden,
 *                               "muted" -> muted).
 *                 matchScore  — this item's search relevance score (higher =
 *                               more relevant). Only read for search-driven
 *                               scroll-to-top-match behavior.
 *                 matchRanges — array of [start, end] ranges to highlight via
 *                               CSS Highlight API.
 *   ...rest   — forwarded to the rendered <li> element
 */
export const ListItem = createComponentResolver([
  ListItemFirstResolver,
  ListItemSelectableResolver,
  ListItemHeaderOrFooterResolver,
  ListItemPresentationResolver,
  ListItemUI,
]);
List.Item = ListItem;

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
  const groupTracker = useItemTracker();
  const groupRef = useRef(null);
  const labelRef = useRef(null);
  useDisplayedLayoutEffect(
    labelRef,
    (labelEl) => {
      const groupEl = groupRef.current;
      if (!groupEl) {
        return;
      }
      const rect = labelEl.getBoundingClientRect();
      groupEl.style.setProperty(
        "--list-group-label-height",
        `${rect.height}px`,
      );
      groupEl.style.setProperty("--list-group-label-width", `${rect.width}px`);
    },
    [],
  );

  return (
    <ListItem
      {...rest}
      ref={groupRef}
      baseClassName="navi_list_item_group"
      role="presentation"
      data-hidden-while-empty={hiddenWhileEmpty ? "" : undefined}
    >
      <span
        ref={labelRef}
        id={groupId}
        className="navi_list_item_group_label"
        role="presentation"
        // eslint-disable-next-line react/no-unknown-property
        navi-default={typeof label === "string" ? "" : undefined}
      >
        {label}
      </span>
      <ul
        className="navi_list_item_group_list"
        role="group"
        aria-labelledby={groupId}
      >
        <GroupItemTrackerContext.Provider value={groupTracker}>
          {children}
        </GroupItemTrackerContext.Provider>
      </ul>
    </ListItem>
  );
};
