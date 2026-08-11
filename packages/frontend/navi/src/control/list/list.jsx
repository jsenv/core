import {
  dispatchPublicCustomEvent,
  getElementSignature,
  scrollIntoViewScoped,
} from "@jsenv/dom";
import { signal } from "@preact/signals";
import { cloneElement, createContext } from "preact";
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
import { LoadingIndicator } from "../../graphic/loading/loading_indicator.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { openCallout } from "../rules/callout/callout.js";
import { Separator } from "../../layout/separator.jsx";
import { useDebugScroll } from "../../navi_debug.jsx";
import { naviI18n } from "../../text/navi_i18n.js";
import { Text } from "../../text/text.jsx";
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
// Set by <List itemTransition>: each row then gets a view-transition-name of
// its own, so a change wrapped in a view transition animates row by row.
const ItemTransitionContext = createContext(false);

const css = /* css */ `
  @layer navi {
    .navi_list_container {
      --list-outline-width: 1px;
      --list-border-radius: 4px;
      --list-border-width: 0px;
      --list-border-color: light-dark(#ccc, #555);
      --list-background-color: light-dark(#fff, #1e1e1e);
      /* Air above and below a skeleton bar, so a run of them reads as several
         rows rather than one block. */
      --list-skeleton-bar-gap: 5px;
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

    /* scroller="parent": the list does not scroll, the ancestor it lives in
       does. Its own scroll box must then be transparent to layout — otherwise
       it would cap the list at a height of its own and start a second, nested
       scroll inside the page's. */
    &[data-scroller="parent"] {
      max-height: none;
      overflow: visible;

      .navi_list_scroll_container {
        max-height: none;
        overflow: visible;
      }
    }

    &[data-expand-x] {
      width: 100%;
    }
    &[data-expand-y] {
      --list-max-height: none;

      /* expandY grows the container to fill its parent (flex-grow, applied by
         Box). The scroll container must then fill that grown height and take
         over the internal scroll — flex:1 fills it, min-height:0 lets it shrink
         below its content so overflow:auto scrolls instead of the content
         pushing past the container (which overflow:hidden would just clip). */
      .navi_list_scroll_container {
        min-height: 0;
        flex: 1;
      }
    }
    /* :not(:has(...)) — a header or a footer is content of its own (a title, a
       count, an "add" call to action) and is often most useful exactly when the
       items are gone, so a list carrying one is never "nothing to display".
       nothingToDisplay only ever counts items, which is right for it: this is
       the one place that knows the chrome is there too. */
    &[navi-nothing-to-display]:not(
        :has(.navi_list_item_header, .navi_list_item_footer)
      ) {
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

    /* The "invisible_and_inert" search no-match mode keeps items in the DOM
       (to preserve layout) but hides them — it sets BOTH aria-hidden and inert.
       Scope to that pair so the presentation placeholders that are only
       aria-hidden (skeleton rows, the loader) stay visible. */
    &[aria-hidden="true"][inert] {
      opacity: 0;
    }

    &[navi-muted] {
      opacity: 0.35;
    }

    /* A row that cannot be acted on right now (see ListItemReal): it says so
       by dimming, and stops taking clicks — including on the buttons it holds,
       which is the whole point (the row is what is read-only, not one of its
       parts). Positioned so the loading outline it may draw has a box to sit
       on. */
    /* Same inline callout as the list's own error (.navi_list_error), scoped to
       one row. The message takes the room, the way out sits at the end. */
    .navi_list_item_error_message {
      flex: 1;
    }
    .navi_list_item_error_dismiss {
      padding: 2px 8px;
      flex: none;
      color: inherit;
      font: inherit;
      background: transparent;
      border: 1px solid currentColor;
      border-radius: 4px;
      opacity: 0.8;
      cursor: pointer;

      &:hover {
        opacity: 1;
      }
    }

    &[navi-error] {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: light-dark(#b91c1c, #fca5a5);
      background: light-dark(#fef2f2, rgba(127, 29, 29, 0.25));
    }

    &[navi-readonly] {
      position: relative;
      opacity: 0.6;
      cursor: default;
      /* NOT pointer-events: none — the press has to reach the row so it can
         say why it does nothing (see ListItemReal). What the row holds is
         neutralized by the capture-phase handlers there instead. */
      user-select: none;
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
  /* Room held for rows that were never loaded (see List's own count): unlike
     the rows that are merely windowed out, these are not one scroll event away
     from being drawn — something has to be fetched first, and saying so is the
     whole point. One bar per row, at the rhythm of a row, so scrolling into
     them reads as content on its way. The mask cuts the shimmer into bars;
     painting them as a repeating background instead would need a second layer
     to hold the animation. */
  .navi_list_virtual_filler[navi-virtual-filler-unloaded] {
    background-image: linear-gradient(
      90deg,
      #e0e0e0 25%,
      #f0f0f0 50%,
      #e0e0e0 75%
    );
    background-size: 200% 100%;
    mask-image: repeating-linear-gradient(
      to bottom,
      transparent 0 var(--list-skeleton-bar-gap),
      black var(--list-skeleton-bar-gap)
        calc(var(--virtual-item-size) - var(--list-skeleton-bar-gap)),
      transparent calc(var(--virtual-item-size) - var(--list-skeleton-bar-gap))
        var(--virtual-item-size)
    );
    animation: navi_list_skeleton_shimmer 1.5s infinite;
  }
  &[data-horizontal] {
    --list-max-height: none;

    .navi_list_virtual_filler {
      width: var(--size-to-fill, 0px);
      height: 100%;
    }
    .navi_list_virtual_filler[navi-virtual-filler-unloaded] {
      mask-image: repeating-linear-gradient(
        to right,
        transparent 0 var(--list-skeleton-bar-gap),
        black var(--list-skeleton-bar-gap)
          calc(var(--virtual-item-size) - var(--list-skeleton-bar-gap)),
        transparent
          calc(var(--virtual-item-size) - var(--list-skeleton-bar-gap))
          var(--virtual-item-size)
      );
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
  /* Loading placeholders (see List's loading / loadingFallback / loadingSkeletonTemplate).
     A skeleton row reuses <Text loading> for the shimmer bar; the loader row
     centers a spinner; a custom loadingFallback is only given a row to live in,
     its own markup does the layout. */
  .navi_list_item_skeleton {
    pointer-events: none;
  }
  .navi_list_loader {
    display: flex;
    padding: 12px;
    align-items: center;
    justify-content: center;
    color: light-dark(#888, #aaa);
  }
  .navi_list_loading_fallback {
    display: flex;
  }
  /* Error state (List error prop): an inline callout describing why the list
     failed to load, shown in place of the items. */
  .navi_list_error {
    display: flex;
    margin: 8px;
    padding: 10px 12px;
    align-items: flex-start;
    gap: 8px;
    color: light-dark(#b91c1c, #fca5a5);
    font-size: 0.9em;
    line-height: 1.4;
    background: light-dark(#fef2f2, rgba(127, 29, 29, 0.25));
    border: 1px solid light-dark(#fecaca, rgba(248, 113, 113, 0.4));
    border-radius: 6px;
  }
  .navi_list_error_icon {
    flex: none;
    font-size: 1em;
    line-height: 1.4;
  }
  [navi-virtual-filler="after"] {
    /* for some reason preact ends up puttin this element before the list items in some scenarios
     I've noticed that removing the ItemIndexToScrollOnMountRefContext.Provider
     does fix this issue (I suppose it's because it cause on less render of the list which is the problematic one)
     this order ENSURE that even when preact hallucinates we are still correctly putting the bottom filler
     after the list items */
    order: 1;
  }
  /* A control that IS the row — a direct child of the item, so it spans it —
     must keep its loading outline within its own box: the scroll container is
     overflow:auto, and the couple pixels the outline normally draws outside
     the control are enough to make it scrollable, so a scrollbar would appear
     and disappear as things load. Targeted on the outline itself rather than
     inherited from the item, so a control nested deeper (which has room around
     it, and does not reach the edges) keeps the outline it asked for. */
  .navi_list_item > .navi_loading_outline_wrapper,
  .navi_list_item > * > .navi_loading_outline_wrapper,
  .navi_list_item_header > * > .navi_loading_outline_wrapper,
  .navi_list_item_footer > * > .navi_loading_outline_wrapper {
    --loading-outline-min-inset: 0px;
  }

  /* order: 2 pins the footer after fallbacks (order: 1) and all items. */
  .navi_list_item_footer {
    position: sticky;
    right: 0;
    bottom: 0;
    z-index: 1;
    order: 2;
  }

  @keyframes navi_list_skeleton_shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
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
    itemTransition,
    children,
    popover,
    expandX,
    expandY,
    expand,
    onListVisibleItemsChange,
    virtualItemSize,
    count,
    onItemsMissing,
    loadMargin = 5,
    initialScrollToItem,
    scroller = "self",
    lockSize,
    columns,
    searchText,
    searchNoMatchMode = "remove",
    loading,
    loadingFallback = "skeleton",
    loadingSkeletonTemplate,
    error,
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
    count,
    onItemsMissing,
    loadMargin,
    initialScrollToItem,
    scroller,
    searchText,
    horizontal,
  });

  const getItemById = (itemId) => {
    return tracker.itemsSignal.peek().find((item) => item.id === itemId);
  };

  const noMatchCount = tracker.noMatchCountSignal.value;
  const itemCount = tracker.countSignal.value;
  const allNoMatch = noMatchCount > 0 && noMatchCount === itemCount;
  const searching = Boolean(searchText);
  const fallbackDisabled = fallback !== undefined && !fallback;
  const searchFallbackDisabled =
    searchFallback !== undefined && !searchFallback;
  // No item is visible when the list is empty (filtering may happen outside the
  // list, dropping itemCount to 0) or when a search removed them all — only the
  // "remove" mode empties the view; "muted"/"below"/… keep items on screen.
  const noVisibleItems =
    itemCount === 0 || (allNoMatch && searchNoMatchMode === "remove");
  // Which fallback message actually renders (mirrors SearchFallback / Fallback
  // below): during a search an empty/no-match result is a "no match" state (the
  // search fallback), otherwise an empty list is the "empty" state.
  const searchFallbackShown =
    (allNoMatch || (searching && itemCount === 0)) && !searchFallbackDisabled;
  const emptyFallbackShown = !searching && itemCount === 0 && !fallbackDisabled;
  // Hide the whole list — border included — when there is genuinely nothing to
  // show: no visible items AND no fallback message. Never while loading or in
  // error (the placeholder / error message ARE the content to display).
  const nothingToDisplay =
    !loading &&
    !error &&
    noVisibleItems &&
    !searchFallbackShown &&
    !emptyFallbackShown;

  // Placeholder content replaces the real children: an error message when the
  // load failed (takes precedence), otherwise — while loading — whatever
  // loadingFallback asks for.
  let content = children;
  if (error) {
    content = (
      <ListItem
        role="presentation"
        baseClassName="navi_list_item navi_list_error"
      >
        <span className="navi_list_error_icon" aria-hidden="true">
          ⚠
        </span>
        <span>{error === true ? "Something went wrong." : error}</span>
      </ListItem>
    );
  } else if (loading && loadingFallback) {
    if (loadingFallback === "skeleton") {
      // Skeleton rows draw their own separators: they never reach ListItemUI
      // (where real items get theirs from SeparatorContext), and without them
      // the list would visibly gain its dividers only once loaded.
      const template = loadingSkeletonTemplate ?? <ListItem skeleton />;
      const skeletons = [];
      let skeletonIndex = 0;
      while (skeletonIndex < resolveSkeletonCount(count, renderBudget)) {
        if (separator && skeletonIndex > 0) {
          skeletons.push(
            cloneElement(resolveSeparatorVnode(separator, skeletonIndex - 1), {
              key: `navi-list-skeleton-separator-${skeletonIndex}`,
            }),
          );
        }
        skeletons.push(
          cloneElement(template, {
            key: `navi-list-skeleton-${skeletonIndex}`,
          }),
        );
        skeletonIndex++;
      }
      content = skeletons;
    } else if (loadingFallback === "loader") {
      content = (
        <ListItem
          role="presentation"
          aria-hidden="true"
          baseClassName="navi_list_item navi_list_loader"
        >
          <LoadingIndicator />
        </ListItem>
      );
    } else {
      // Custom content is not aria-hidden (unlike the bare spinner): it usually
      // carries a message worth announcing.
      content = (
        <ListItem
          role="presentation"
          baseClassName="navi_list_item navi_list_loading_fallback"
        >
          {loadingFallback}
        </ListItem>
      );
    }
  }

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_list_container"
      popover={popover}
      data-horizontal={horizontal ? "" : undefined}
      data-scroller={scroller === "parent" ? "parent" : undefined}
      data-expand-x={expandX || expand ? "" : undefined}
      data-expand-y={expandY || expand ? "" : undefined}
      expandX={expandX}
      expandY={expandY}
      expand={expand}
      navi-zero-match={allNoMatch ? "" : undefined}
      navi-nothing-to-display={nothingToDisplay ? "" : undefined}
      navi-loading={loading ? "" : undefined}
      navi-error={error ? "" : undefined}
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
        searching={searching}
        loading={loading}
        error={error}
        searchNoMatchMode={searchNoMatchMode}
        separator={separator}
        itemTransition={itemTransition}
        expandX={expandX || expand}
        horizontal={horizontal}
        spacing={spacing}
        columns={columns}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemSizeSignal={virtualItemSizeSignal}
        count={count}
        pendingScrollRef={pendingScrollRef}
      >
        {content}
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
 *   count?: number,
 *   onItemsMissing?: (detail: {start: number, end: number, count: number}) => void | Promise<any>,
 *   loadMargin?: number | string,
 *   initialScrollToItem?: string | {id: string, block?: "start" | "center" | "end" | "nearest"},
 *   scroller?: "self" | "parent",
 *   fallback?: import("preact").ComponentChildren,
 *   searchFallback?: import("preact").ComponentChildren,
 *   searchText?: string,
 *   searchNoMatchMode?: "remove" | "invisible_and_inert" | "muted" | "below",
 *   loading?: boolean,
 *   loadingFallback?: "skeleton" | "loader" | import("preact").ComponentChildren,
 *   loadingSkeletonTemplate?: import("preact").ComponentChildren,
 *   error?: boolean | import("preact").ComponentChildren,
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
 * @param {"skeleton"|"loader"|import("preact").ComponentChildren} [props.loadingFallback="skeleton"]
 *   What to display in place of the items while `loading`: `"skeleton"` renders
 *   `count` placeholder rows (look: `loadingSkeletonTemplate`), `"loader"` a
 *   single centered spinner, and anything else is rendered as-is in a row of
 *   its own. A falsy value displays nothing.
 * @param {number} [props.count]
 *   How many items the collection holds in total — not how many are passed as
 *   children. Give it when the children are only a slice of a larger whole
 *   (infinite scroll, paginated backend) and each item carries its ABSOLUTE
 *   `index` in that whole: the list then knows where the slice sits, reserves
 *   the room of what is missing on either side (so the scrollbar tells the
 *   truth and one can scroll into what is not loaded), and reports what it
 *   lacks through `onItemsMissing`. While `loading` it is also how many
 *   skeleton rows are drawn. Defaults to what is rendered.
 * @param {(detail: {start: number, end: number, count: number}) => void|Promise<any>} [props.onItemsMissing]
 *   The user is about to look at rows the list does not have: `start` and
 *   `end` are the absolute indexes of that range (inclusive), so this fires
 *   just as well on reaching an edge as on jumping the scrollbar into the
 *   middle of a region that was never loaded. Returning a promise holds the
 *   next call until it settles; one range at a time, and the same range is
 *   never asked for twice in a row while nothing has been loaded.
 * @param {number|string} [props.loadMargin=5]
 *   How far outside the visible band `onItemsMissing` looks ahead: a number of
 *   rows, or an explicit distance (`"300px"`).
 * @param {string|{id: string, block?: string}} [props.initialScrollToItem]
 *   The row to open the list on, the first time it is displayed (the frontier
 *   between past and future in a timeline, for instance). Works on a row that
 *   is outside the initial render window: the window moves there first.
 * @param {"self"|"parent"} [props.scroller="self"]
 *   Which box scrolls. `"self"` gives the list a scroll box of its own;
 *   `"parent"` makes it virtualize against the scrollable ancestor it lives in
 *   (the page, a panel) — no scroll box nested inside another one, no height
 *   to compute.
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
  searching,
  loading,
  error,
  searchNoMatchMode,
  separator,
  itemTransition,
  expandX,
  horizontal,
  spacing,
  columns,
  tracker,
  renderWindow,
  virtualItemSizeSignal,
  count,
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
        searching={searching}
        loading={loading}
        error={error}
        searchNoMatchMode={searchNoMatchMode}
        separator={separator}
        itemTransition={itemTransition}
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
        count={count}
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
  count,
  onItemsMissing,
  loadMargin,
  initialScrollToItem,
  scroller,
  searchText,
  horizontal,
}) => {
  const debugScroll = useDebugScroll();
  const virtualItemSizeSignal = useVirtualItemSizeSignal(
    ref,
    virtualItemSize,
    horizontal,
  );
  const getScroller = () => getScrollerEl(ref.current, scroller, horizontal);
  const getListEl = () => ref.current.querySelector(".navi_list");
  // Where the loaded rows sit in the whole collection, read at the moment it is
  // needed rather than threaded through: it changes on every commit while the
  // scroll listener is installed once.
  const countRef = useRef(null);
  countRef.current = count;
  const getVirtualBounds = () =>
    getVirtualBoundsOf(tracker.visibleItemsSignal.peek(), countRef.current);

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
  const scrollToItem = (item, { event, reason, block: blockRequested }) => {
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
      const block =
        blockRequested ||
        (event.type === "navi_displayed" ? "center" : "nearest");
      const scrollToItemCall = `${getElementSignature(itemEl)}.scrollIntoView({ block: "${block}", container: "nearest" })`;
      debugScroll(`${trigger} -> ${scrollToItemCall}`);
      scrollIntoViewScoped(itemEl, {
        container: getScroller(),
        block,
      });
      const listEl = getListEl();
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
    const scrollerEl = getScroller();
    const currentScrollLeft = scrollerEl.scrollLeft;
    const currentScrollTop = scrollerEl.scrollTop;
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
      // Opening on a precise row (a timeline opening on the frontier between
      // past and future, for instance) wins over the selected-item default:
      // the caller named the row it wants to land on.
      if (initialScrollToItem) {
        const { id, block = "start" } =
          typeof initialScrollToItem === "string"
            ? { id: initialScrollToItem }
            : initialScrollToItem;
        const initialItem = items.find((i) => i.id === id);
        if (initialItem) {
          const scrollToInitialItem = () => {
            scrollToItem(initialItem, {
              event: new CustomEvent("navi_displayed", {
                detail: { originalEvent: openEvent },
              }),
              reason: "initialScrollToItem",
              block,
            });
          };
          scrollToInitialItem();
          // The room held for the rows around the loaded ones only takes its
          // size once a row has been measured — one render later — and the
          // fillers growing move everything below them. Asking again once that
          // has happened is what actually lands on the row; a microtask still
          // runs before the frame is painted, so nothing of the intermediate
          // state is ever seen.
          queueMicrotask(() => {
            scrollToInitialItem();
            checkMissingItems();
          });
          return;
        }
      }
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
    const listScrollContainerEl = ref.current ? getScroller() : null;
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
        const { item } = getScrollInfo({
          scrollValues: savedScroll,
          scrollerEl: listScrollContainerEl,
          listEl: getListEl(),
          tracker,
          virtualItemSizeSignal,
          renderWindowRef,
          horizontal,
          placeholderCountStart: getVirtualBounds().before,
        });
        listScrollContainerEl.scrollTo({
          left: savedScroll.left,
          top: savedScroll.top,
        });
        const listEl = getListEl();
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

  // What the user is about to look at and the list does not hold. Told in
  // absolute indexes, because that is the only thing the caller can act on: the
  // rows it has are a slice of a larger whole, and which slice is missing is
  // not always "the one after the last" — dragging the scrollbar lands in the
  // middle of a region that was never loaded just as easily.
  const missingStateRef = useRef({ busy: false, range: null, boundsKey: null });
  const missingRef = useRef(null);
  missingRef.current = { onItemsMissing, loadMargin };
  const requestItems = (start, end, boundsKey) => {
    const state = missingStateRef.current;
    if (state.busy) {
      return;
    }
    // A range already asked for while the list held exactly what it holds now
    // can only produce the same answer — and a single flick of the wheel fires
    // dozens of scroll events, a source with nothing left to send changes
    // nothing at all.
    const asked = state.range;
    if (
      asked &&
      state.boundsKey === boundsKey &&
      start >= asked.start &&
      end <= asked.end
    ) {
      return;
    }
    state.range = { start, end };
    state.boundsKey = boundsKey;
    state.busy = true;
    debugScroll(`items missing: [${start}, ${end}]`);
    const release = () => {
      state.busy = false;
    };
    const result = missingRef.current.onItemsMissing({
      start,
      end,
      count: countRef.current,
    });
    if (result && typeof result.then === "function") {
      result.then(release, release);
    } else {
      release();
    }
  };
  const checkMissingItems = () => {
    const { onItemsMissing, loadMargin } = missingRef.current;
    if (!onItemsMissing || !ref.current) {
      return;
    }
    const count = countRef.current;
    if (count === undefined) {
      return;
    }
    const visibleItems = tracker.visibleItemsSignal.peek();
    const loadedCount = visibleItems.length;
    if (loadedCount === 0) {
      // Nothing on screen to measure against — not even a row height. The
      // first row is the one thing we can name; asking for it is what gets
      // the list started.
      if (count > 0) {
        requestItems(0, 0, "empty");
      }
      return;
    }
    const virtualItemSize = virtualItemSizeSignal.peek();
    if (virtualItemSize === 0) {
      return;
    }
    const firstIndex = visibleItems[0].index;
    const lastIndex = visibleItems[loadedCount - 1].index;
    const { before, after } = getVirtualBounds();
    const viewportRect = getScrollerViewportRect(getScroller());
    const listRect = getListEl().getBoundingClientRect();
    const margin = resolveLoadMargin(loadMargin, virtualItemSize);
    // The band the loaded rows occupy on screen, and the band the user is
    // about to look at. Everything outside the first and inside the second is
    // what has to be fetched.
    const loadedFrom =
      (horizontal ? listRect.left : listRect.top) + before * virtualItemSize;
    const loadedTo =
      (horizontal ? listRect.right : listRect.bottom) - after * virtualItemSize;
    const wantedFrom =
      (horizontal ? viewportRect.left : viewportRect.top) - margin;
    const wantedTo =
      (horizontal ? viewportRect.right : viewportRect.bottom) + margin;
    // A position outside the loaded band falls on a reserved row: how many rows
    // away it is, is the distance divided by the room one row is given.
    const rowIndexAt = (pos) => {
      if (pos < loadedFrom) {
        return firstIndex - Math.ceil((loadedFrom - pos) / virtualItemSize);
      }
      if (pos > loadedTo) {
        return lastIndex + Math.ceil((pos - loadedTo) / virtualItemSize);
      }
      return null;
    };
    const wantedFromIndex = rowIndexAt(wantedFrom);
    const wantedToIndex = rowIndexAt(wantedTo);
    const boundsKey = `${firstIndex}:${lastIndex}:${loadedCount}`;
    if (wantedFromIndex !== null && wantedFromIndex < firstIndex) {
      const start = wantedFromIndex < 0 ? 0 : wantedFromIndex;
      const end =
        wantedToIndex !== null && wantedToIndex < firstIndex
          ? wantedToIndex
          : firstIndex - 1;
      if (end >= start) {
        requestItems(start, end, boundsKey);
        return;
      }
    }
    if (wantedToIndex !== null && wantedToIndex > lastIndex) {
      const start =
        wantedFromIndex !== null && wantedFromIndex > lastIndex
          ? wantedFromIndex
          : lastIndex + 1;
      const end = wantedToIndex > count - 1 ? count - 1 : wantedToIndex;
      if (end >= start) {
        requestItems(start, end, boundsKey);
      }
    }
  };
  // A list that fits in its scroller never emits a scroll event, so nothing
  // would ever ask for the rest. Only while it does not overflow: as soon as
  // it does, scrolling takes over.
  useLayoutEffect(() => {
    if (!ref.current || !onItemsMissing) {
      return;
    }
    const scrollerEl = getScroller();
    const scrollSize = horizontal
      ? scrollerEl.scrollWidth
      : scrollerEl.scrollHeight;
    const clientSize = horizontal
      ? scrollerEl.clientWidth
      : scrollerEl.clientHeight;
    if (scrollSize > clientSize) {
      return;
    }
    checkMissingItems();
  });

  // Inserting rows above what the user is looking at must not move it by a
  // single pixel. The browser will not do it for us — overflow-anchor gives up
  // on changes it attributes to a scroll, and the fillers resize in the very
  // same commit — so the row at the top of the viewport is measured before the
  // commit and put back at the same offset after it.
  const itemCount = tracker.countSignal.peek();
  const anchoringApplies = count !== undefined || itemCount > renderBudget;
  const anchorRef = useRef(null);
  if (
    anchoringApplies &&
    !searchText &&
    !anchorRef.current &&
    !pendingScrollRef.current &&
    ref.current
  ) {
    anchorRef.current = captureScrollAnchor({
      scrollerEl: getScroller(),
      listEl: getListEl(),
      visibleItems: tracker.visibleItemsSignal.peek(),
      horizontal,
    });
  }
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !ref.current) {
      anchorRef.current = null;
      return;
    }
    const visibleItems = tracker.visibleItemsSignal.peek();
    const indexNow = visibleItems.findIndex((i) => i.id === anchor.id);
    if (indexNow === -1) {
      anchorRef.current = null;
      return;
    }
    const indexShift = indexNow - anchor.index;
    if (indexShift !== 0) {
      // The render window addresses items by index: rows inserted before the
      // anchor renumbered everything after them, so the window must follow or
      // it would frame a different slice of the list entirely. The anchor is
      // kept — where it must land does not change — but its index is now the
      // new one, so the commit that follows compares against it and moves on
      // to the scroll correction.
      anchor.index = indexNow;
      const { start, end } = renderWindowRef.current;
      const windowSize = end - start;
      const startShifted = start + indexShift;
      let startWanted = startShifted < 0 ? 0 : startShifted;
      // Same normalization as the scroll listener: a window running past the
      // last item slides back instead of framing fewer items than its budget
      // allows — every item that fits in it must stay rendered.
      if (startWanted + windowSize > visibleItems.length) {
        startWanted = visibleItems.length - windowSize;
        if (startWanted < 0) {
          startWanted = 0;
        }
      }
      const endWanted = startWanted + windowSize;
      if (startWanted !== start || endWanted !== end) {
        updateRenderWindow(
          startWanted,
          endWanted,
          `${indexShift} item(s) inserted before the anchored item`,
        );
        return;
      }
    }
    anchorRef.current = null;
    const anchorEl = document.getElementById(anchor.id);
    if (!anchorEl) {
      return;
    }
    const scrollerEl = getScroller();
    const viewportRect = getScrollerViewportRect(scrollerEl);
    const anchorRect = anchorEl.getBoundingClientRect();
    const offsetNow = horizontal
      ? anchorRect.left - viewportRect.left
      : anchorRect.top - viewportRect.top;
    const drift = offsetNow - anchor.offset;
    if (drift === 0) {
      return;
    }
    debugScroll(
      `anchored item drifted by ${Math.round(drift)}px, compensating scroll`,
    );
    if (horizontal) {
      scrollerEl.scrollLeft += drift;
    } else {
      scrollerEl.scrollTop += drift;
    }
  });

  // Scroll listener — slides the window as the user scrolls.
  useLayoutEffect(() => {
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return undefined;
    }
    const scrollerEl = getScroller();
    const listEl = getListEl();
    const onScroll = () => {
      updateCurrentScroll();
      checkMissingItems();
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
      const scrollInfo = getScrollInfo({
        scrollValues: {
          left: scrollerEl.scrollLeft,
          top: scrollerEl.scrollTop,
        },
        scrollerEl,
        listEl,
        tracker,
        virtualItemSizeSignal,
        renderWindowRef,
        horizontal,
        placeholderCountStart: getVirtualBounds().before,
      });
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
    // A page-level scroller does not emit "scroll" on the element itself
    // (document.scrollingElement); the document does.
    const scrollEventTarget =
      scrollerEl === document.scrollingElement ? document : scrollerEl;
    scrollEventTarget.addEventListener("scroll", onScroll, {
      passive: true,
    });
    return () => {
      scrollEventTarget.removeEventListener("scroll", onScroll);
    };
  }, [renderBudget, scroller]);

  return {
    virtualItemSizeSignal,
    renderWindow,
    pendingScrollRef,
    scrollToItem,
  };
};
// The band of the scroller the user actually sees. A page-level scroller is
// the viewport itself — its own box is the whole document, which says nothing
// about what is on screen.
const getScrollerViewportRect = (scrollerEl) => {
  if (scrollerEl === document.scrollingElement) {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    return { top: 0, left: 0, right: width, bottom: height, width, height };
  }
  return scrollerEl.getBoundingClientRect();
};
// scroller="parent": the list virtualizes against the scroll box it lives in
// instead of one of its own.
const getScrollerEl = (listContainerEl, scroller, horizontal) => {
  if (scroller !== "parent") {
    return listContainerEl.querySelector(`.navi_list_scroll_container`);
  }
  let ancestor = listContainerEl.parentElement;
  while (ancestor) {
    const style = window.getComputedStyle(ancestor);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return document.scrollingElement;
};
// loadMargin is a number of rows ("look 5 rows past what is on screen") or an
// explicit distance ("300px").
const LOAD_MARGIN_ITEM_SIZE_FALLBACK = 40;
const resolveLoadMargin = (loadMargin, virtualItemSize) => {
  if (typeof loadMargin === "string") {
    const parsed = parseFloat(loadMargin);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const itemSize = virtualItemSize || LOAD_MARGIN_ITEM_SIZE_FALLBACK;
  return loadMargin * itemSize;
};
// How many rows of the collection are missing on either side of the loaded
// ones. Each item knows its own place in the whole (its `index`), so the room
// to reserve before them is where the first one sits, and the room after them
// is whatever `count` says is left. Without a count, nothing is missing after
// the last one — a list that was given everything is the common case.
const getVirtualBoundsOf = (items, count) => {
  const loadedCount = items.length;
  if (loadedCount === 0) {
    return { before: 0, after: count === undefined ? 0 : count };
  }
  const firstIndex = items[0].index;
  const lastIndex = items[loadedCount - 1].index;
  if (!Number.isFinite(firstIndex) || !Number.isFinite(lastIndex)) {
    return { before: 0, after: 0 };
  }
  const after = count === undefined ? 0 : count - 1 - lastIndex;
  return {
    before: firstIndex > 0 ? firstIndex : 0,
    after: after > 0 ? after : 0,
  };
};
// While loading, one skeleton row per item to come — but never more than the
// list would render at once, since the rest would be windowed out anyway.
const LOADING_SKELETON_COUNT_DEFAULT = 3;
const resolveSkeletonCount = (count, renderBudget) => {
  if (count === undefined) {
    return LOADING_SKELETON_COUNT_DEFAULT;
  }
  return count > renderBudget ? renderBudget : count;
};
// The row the user is looking at, and where it sits: what must not move when
// the list is rebuilt around it.
const captureScrollAnchor = ({
  scrollerEl,
  listEl,
  visibleItems,
  horizontal,
}) => {
  if (!scrollerEl || !listEl) {
    return null;
  }
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const listRect = listEl.getBoundingClientRect();
  const scanRange = getListVisibleScanRange(viewportRect, listRect, horizontal);
  if (!scanRange) {
    return null;
  }
  for (let pos = scanRange.from + 1; pos < scanRange.to; pos += 8) {
    const x = horizontal ? pos : scanRange.crossPos;
    const y = horizontal ? scanRange.crossPos : pos;
    const el = document.elementFromPoint(x, y);
    if (!el || !listEl.contains(el)) {
      continue;
    }
    const itemEl = el.closest(REAL_LIST_ITEM_SELECTOR);
    if (!itemEl) {
      continue;
    }
    const index = visibleItems.findIndex((i) => i.id === itemEl.id);
    if (index === -1) {
      continue;
    }
    const itemRect = itemEl.getBoundingClientRect();
    return {
      id: itemEl.id,
      index,
      offset: horizontal
        ? itemRect.left - viewportRect.left
        : itemRect.top - viewportRect.top,
    };
  }
  return null;
};
// The part of the list that is on screen, along the scrolling axis. Both edges
// matter: the scroller may be larger than the list (scroller="parent") as well
// as smaller (the list scrolls inside its own box).
const getListVisibleScanRange = (viewportRect, listRect, horizontal) => {
  const viewportFrom = horizontal ? viewportRect.left : viewportRect.top;
  const viewportTo = horizontal ? viewportRect.right : viewportRect.bottom;
  const listFrom = horizontal ? listRect.left : listRect.top;
  const listTo = horizontal ? listRect.right : listRect.bottom;
  const from = listFrom > viewportFrom ? listFrom : viewportFrom;
  const to = listTo < viewportTo ? listTo : viewportTo;
  if (to - from < 2) {
    return null;
  }
  // Where to put the probe on the other axis: inside the list, inside the
  // viewport.
  const crossFrom = horizontal ? listRect.top : listRect.left;
  const crossViewportFrom = horizontal ? viewportRect.top : viewportRect.left;
  const crossPos =
    (crossFrom > crossViewportFrom ? crossFrom : crossViewportFrom) + 1;
  return { from, to, crossPos };
};

// Returns the item located at the current scroll position of a list container.
// Uses DOM hit-testing to find visible items/fillers; falls back to index
// estimation via virtualItemSize or renderWindow.start.
// Returns { index, item, reason } or null if nothing can be determined.
const getScrollInfo = ({
  scrollValues,
  scrollerEl,
  listEl,
  tracker,
  virtualItemSizeSignal,
  renderWindowRef,
  horizontal,
  placeholderCountStart = 0,
}) => {
  const items = tracker.itemsSignal.peek();
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const listRect = listEl.getBoundingClientRect();
  let hitEl = null;
  let hitFiller = null;
  const scanRange = getListVisibleScanRange(viewportRect, listRect, horizontal);
  if (!scanRange) {
    return null;
  }
  // Start scanning from the center of the visible part of the list along the
  // main axis. The render window places half its budget before and half after
  // the hit index. Anchoring to the center maximises how many rendered items
  // fall within the visible area.
  const scanStart = (scanRange.from + scanRange.to) / 2;
  const scanEnd = scanRange.to;
  for (let pos = scanStart; pos < scanEnd; pos += 4) {
    const x = horizontal ? pos : scanRange.crossPos;
    const y = horizontal ? scanRange.crossPos : pos;
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
  // Shared by the "hit a filler" and "hit nothing at all" cases below: both
  // mean we don't know the real on-screen index, only the scroll position,
  // so estimate from it rather than assume nothing changed.
  const estimateFromScrollPos = (reasonPrefix) => {
    const virtualItemSize = virtualItemSizeSignal.peek();
    if (virtualItemSize === 0) {
      return null;
    }
    // How much of the list is above (or left of) the top of the viewport — the
    // list is not necessarily flush against the top of the scroller, and the
    // placeholders before it stand for rows that are not tracked items.
    const listOffsetInViewport =
      (horizontal ? viewportRect.left : viewportRect.top) -
      (horizontal ? listRect.left : listRect.top);
    // scrollValues may describe a position the scroller is not at yet (a scroll
    // about to be restored): the difference is what the rects cannot show.
    const scrollNow = horizontal ? scrollerEl.scrollLeft : scrollerEl.scrollTop;
    const scrollAsked = horizontal ? scrollValues.left : scrollValues.top;
    const positionInItems =
      (listOffsetInViewport + (scrollAsked - scrollNow)) / virtualItemSize;
    const estimatedIndex = Math.floor(positionInItems) - placeholderCountStart;
    const index = Math.min(
      items.length - 1,
      estimatedIndex < 0 ? 0 : estimatedIndex,
    );
    return {
      item: items[index],
      index,
      reason: `${reasonPrefix}, estimated at ${index} (${items[index]?.value})`,
    };
  };
  if (hitFiller) {
    return estimateFromScrollPos("hit filler");
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
  // Neither a real item nor a filler was hit within listEl — e.g. part of
  // the scan range fell outside the page's actually reachable viewport
  // (docked devtools shrinks it, for one). Keeping the stale renderWindow
  // here (as this used to do) means the DOM never gets asked to catch up
  // with a scrollTop that may have jumped far away — the user ends up
  // staring at filler space. Same estimate as the hitFiller case is a safe
  // fallback: it only needs the scroll position, not a successful hit-test.
  const estimated = estimateFromScrollPos("no hit");
  if (estimated) {
    return estimated;
  }
  const fallbackIndex = renderWindowRef.current.start;
  return {
    item: items[fallbackIndex],
    index: fallbackIndex,
    reason: "no hit, no virtualItemSize yet",
  };
};

// Rows are not all the same height (a card grows with its content, a month
// header slips in between), so the size the fillers reserve is an average of
// what has actually been rendered so far. It moves by a fraction of the
// difference at a time: a filler that resized to the full new estimate on every
// window slide would make the scrollbar jump under the thumb.
const VIRTUAL_ITEM_SIZE_SMOOTHING = 0.25;
// Under this, rewriting the size would churn the fillers for a sub-pixel gain.
const VIRTUAL_ITEM_SIZE_EPSILON = 0.5;
// Measures the rows currently in the DOM, edge to edge: what a filler stands in
// for is the room a run of rows takes together — separators and group labels
// included — not the height of one <li>.
const measureItemSize = (listEl, horizontal) => {
  const itemEls = listEl.querySelectorAll(REAL_LIST_ITEM_SELECTOR);
  if (itemEls.length === 0) {
    return 0;
  }
  const firstRect = itemEls[0].getBoundingClientRect();
  const lastRect = itemEls[itemEls.length - 1].getBoundingClientRect();
  const span = horizontal
    ? lastRect.right - firstRect.left
    : lastRect.bottom - firstRect.top;
  return span / itemEls.length;
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
  // Re-measured during render, not in a layout effect: the fillers read this
  // signal while rendering just below, so the new size lands in the same commit
  // as the rows it was measured on. Written from a layout effect it would
  // resize them one commit later — after the scroll anchoring of that commit
  // had already run, which is exactly the jump anchoring exists to prevent.
  const sizeAlreadyKnown = virtualSizeSignal.peek() !== 0;
  if (!virtualItemSizeProp && sizeAlreadyKnown && ref.current) {
    const listEl = ref.current.querySelector(".navi_list");
    const sample = listEl ? measureItemSize(listEl, horizontal) : 0;
    if (sample > 0) {
      const current = virtualSizeSignal.peek();
      const next = current + (sample - current) * VIRTUAL_ITEM_SIZE_SMOOTHING;
      if (Math.abs(next - current) > VIRTUAL_ITEM_SIZE_EPSILON) {
        virtualSizeSignal.value = next;
      }
    }
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
    const measuredSize = measureItemSize(listEl, horizontal);
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
  count,
  fallback,
  searchFallback,
  searching,
  loading,
  error,
  searchNoMatchMode,
  separator,
  itemTransition,
  horizontal,
  spacing,
  columns,
  children,
  ...rest
}) => {
  // No empty/no-match message while loading or in error — the placeholder /
  // error message is the content, even though no items are tracked yet.
  const suppressFallback = loading || Boolean(error);

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
        tracker={tracker}
        count={count}
      />
      {!suppressFallback && (
        <SearchFallback
          searchFallback={searchFallback}
          searching={searching}
          tracker={tracker}
        />
      )}
      {!suppressFallback && (
        <Fallback fallback={fallback} searching={searching} tracker={tracker} />
      )}
      <SearchNoMatchModeContext.Provider value={searchNoMatchMode}>
        <RenderWindowContext.Provider value={renderWindow}>
          <SeparatorContext.Provider value={separator ?? null}>
            <ItemTransitionContext.Provider value={Boolean(itemTransition)}>
              <ListItemTrackerContext.Provider value={tracker}>
                <ListColumnsContext.Provider value={columns || null}>
                  {children}
                </ListColumnsContext.Provider>
              </ListItemTrackerContext.Provider>
            </ItemTransitionContext.Provider>
          </SeparatorContext.Provider>
        </RenderWindowContext.Provider>
      </SearchNoMatchModeContext.Provider>
      <AfterFiller
        virtualItemSizeSignal={virtualItemSizeSignal}
        renderWindowEnd={renderWindow.end}
        tracker={tracker}
        count={count}
      />
    </Box>
  );
};

// The "no match" message. Shown when a search left nothing to display: either
// every matchable item has match=false (in-list filtering), or the list is empty
// during an active search (filtering done outside the list, so itemCount is 0).
const SearchFallback = ({ tracker, searchFallback, searching }) => {
  const itemCount = tracker.countSignal.value;
  const noMatchCount = tracker.noMatchCountSignal.value;
  const allNoMatch = noMatchCount > 0 && noMatchCount === itemCount;
  const showMatchFallback = allNoMatch || (searching && itemCount === 0);

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
// The "empty list" message. Not shown during a search — an empty search result
// is a "no match" state (SearchFallback), not an empty-list state.
const Fallback = ({ tracker, fallback, searching }) => {
  const itemCount = tracker.countSignal.value;
  const showFallback = itemCount === 0 && !searching;
  if (fallback === undefined) {
    fallback = naviI18n("list.empty");
  }
  if (!fallback) {
    // explicitely disabled by user (<List fallback={false|null|''}>)
    return null;
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
// Two reservations, never one: rows that exist but are windowed out are blank
// space (they are one scroll event away from being drawn), while rows that were
// never loaded wear the skeleton — the user scrolling into them must see
// content on its way, not a hole. They are kept as separate elements because
// they say different things, and because the unloaded ones always come first
// (they are the lower indexes).
const BeforeFiller = ({
  virtualItemSizeSignal,
  renderWindowStart,
  tracker,
  count,
}) => {
  const virtualItemSize = virtualItemSizeSignal.value;
  const { before } = getVirtualBoundsOf(
    tracker.visibleItemsSignal.value,
    count,
  );
  return (
    <>
      <VirtualFiller
        edge="before"
        unloaded
        itemCount={before}
        virtualItemSize={virtualItemSize}
      />
      <VirtualFiller
        edge="before"
        itemCount={renderWindowStart}
        virtualItemSize={virtualItemSize}
      />
    </>
  );
};
const AfterFiller = ({
  virtualItemSizeSignal,
  renderWindowEnd,
  tracker,
  count,
}) => {
  const visibleItems = tracker.visibleItemsSignal.value;
  const virtualItemSize = virtualItemSizeSignal.value;
  const { after } = getVirtualBoundsOf(visibleItems, count);
  const itemsAfterWindow = visibleItems.length - renderWindowEnd;
  return (
    <>
      <VirtualFiller
        edge="after"
        itemCount={itemsAfterWindow > 0 ? itemsAfterWindow : 0}
        virtualItemSize={virtualItemSize}
      />
      <VirtualFiller
        edge="after"
        unloaded
        itemCount={after}
        virtualItemSize={virtualItemSize}
      />
    </>
  );
};
const VirtualFiller = ({ edge, unloaded, itemCount, virtualItemSize }) => {
  const sizeToFill = itemCount * virtualItemSize;
  if (!sizeToFill) {
    return null;
  }
  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler={edge}
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler-unloaded={unloaded ? "" : undefined}
      aria-hidden
      style={{
        "--size-to-fill": `${sizeToFill}px`,
        "--virtual-item-size": `${virtualItemSize}px`,
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
// A <List.Item skeleton> — a non-interactive placeholder row shown while a list
// is loading. It is presentation-only (not tracked, not selectable, aria-hidden)
// and reuses <Text loading> for the shimmer. Box layout props (padding, spacing…)
// pass through so a loadingSkeletonTemplate can match the real items' metrics; and when
// children are provided they render as-is, so a template can reproduce a
// multi-part item (e.g. title + subtitle) out of several <Text loading> bars.
const ListItemSkeletonResolver = (props) => {
  const Next = useNextResolver();
  if (props.skeleton) {
    return <ListItemSkeleton {...props} />;
  }
  return <Next {...props} />;
};
const ListItemSkeleton = (props) => {
  // Without vertical padding the bars of consecutive rows touch and read as one
  // block; "s" is enough air for them to be seen as separate rows.
  // eslint-disable-next-line no-unused-vars
  const { skeleton, children, paddingY = "s", ...rest } = props;
  const columnsOverrideProps = useListItemColumnsOverrideProps(rest.style);

  return (
    <Box
      as="li"
      role="presentation"
      aria-hidden="true"
      paddingY={paddingY}
      {...rest}
      {...columnsOverrideProps}
      baseClassName="navi_list_item navi_list_item_skeleton"
    >
      {children ?? <Text loading />}
    </Box>
  );
};
const ListItemUI = (props) => {
  // A stable id/index only matters when the item's identity must survive
  // reordering — i.e. it is selectable (selected/pointed state) or participates
  // in a matching system (search reorders items). A purely presentational,
  // static list doesn't need either, so don't nag about them there.
  const identityMatters =
    props.selectable || Boolean(props.matchInfo) || props.value !== undefined;
  if (identityMatters && props.id === undefined) {
    console.warn(
      "ListItem is missing an explicit id prop. Provide a stable id so pointed/selected state survives search reordering.",
    );
  }
  if (identityMatters && props.index === undefined) {
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
  // Expose match on the tracked item: the tracker counts non-matching items via
  // `item.match === false` (drives noMatchCount → allNoMatch → the searchFallback
  // / hide-when-empty behavior). Without this a matchInfo-based search would
  // filter items out but never register them as "no match".
  if (matchInfo) {
    props.match = matchInfo.match;
  }
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

  const separatorVnode = resolveSeparatorVnode(separator, separatorIndex - 1);
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
  const {
    ref,
    id,
    hidden,
    muted,
    loading,
    readOnly,
    error,
    onErrorDismiss,
    matchInfo,
    children,
    ...rest
  } = props;
  // A row that failed says so in place of its content, and — when the caller
  // gave it somewhere to go — carries the way out with the message: the row
  // stands for something that never happened, so acknowledging the failure is
  // what makes it leave. Making it leave is the CALLER's move, not this one's:
  // the row it stands for is the caller's, and so is whatever animates its
  // departure (navi starts no view transition of its own — the browser has to
  // see the state change, which only the caller can arrange).
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
  // <List itemTransition>: the row is named, so a change wrapped in a view
  // transition animates it rather than cross-fading the list. Through the Box
  // prop and not through style, because Box turns the name off again while the
  // row is only partly visible (see usePartiallyHidden) — a row half-scrolled
  // out of its container would otherwise animate from a clipped snapshot.
  const itemTransition = useContext(ItemTransitionContext);

  // Pressing a row that is busy or read-only must say why nothing happens,
  // where the press happened — a control does this through its own interaction
  // gate, and a list row has none (same situation as picker_spin's way-out
  // buttons). Caught in the capture phase so the buttons the row contains never
  // see the press either: it is the ROW that is unavailable, not one of its
  // parts.
  const blocked = loading || readOnly;
  // The primary button only: a right (or middle) click asks the browser for its
  // own menu — copying the row's text, opening a link it holds in a tab — and
  // none of that acts on the row, so a busy row has no reason to swallow it.
  // What is layered OVER the row is not part of it: the callout explaining why
  // the row is blocked is parented to the row (that is how it is anchored), so
  // a capture-phase block would swallow the press on its own close button — the
  // callout could then never be dismissed. Anything inside a popover is someone
  // else's business.
  const isOverlaidOnRow = (event) =>
    event.target.closest && event.target.closest("[popover]");
  const blockInteraction = (event) => {
    if (event.button !== 0 || isOverlaidOnRow(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  // Whether the click about to arrive belongs to a press that started on this
  // row. A click can be delivered here without one: dismissing the callout
  // presses its close button, the callout goes away, and the click that follows
  // is delivered to whatever is now under the pointer — this row.
  const pressStartedHereRef = useRef(false);

  const calloutRef = useRef(null);
  const explainBlockedInteraction = (event) => {
    if (event.button !== 0 || isOverlaidOnRow(event)) {
      return;
    }
    blockInteraction(event);
    pressStartedHereRef.current = true;
    // One at a time, and not the one that just dismissed it (see the refs).
    if (calloutRef.current && calloutRef.current.opened) {
      return;
    }
    calloutRef.current = openCallout(blockedMessage(loading, readOnly, props), {
      anchorElement: event.currentTarget,
      status: "info",
      openingEvent: event,
    });
  };
  useLayoutEffect(() => {
    if (blocked) {
      return;
    }
    // The wait is over, so the sentence explaining it has nothing left to say.
    const callout = calloutRef.current;
    if (callout && callout.opened) {
      callout.close();
    }
    calloutRef.current = null;
  }, [blocked]);

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
      // A row of a list is edited row by row — created, saved, deleted — so
      // waiting on a server and being untouchable are states of the ROW, not
      // only of a control inside it. Loading implies read-only: a row whose
      // fate is in flight must not take another order in the meantime.
      navi-loading={loading ? (loading === true ? "" : loading) : undefined}
      navi-readonly={readOnly || loading ? "" : undefined}
      aria-busy={loading ? "true" : undefined}
      aria-readonly={readOnly ? "true" : undefined}
      navi-error={error ? "" : undefined}
      viewTransitionName={
        itemTransition ? `navi_list_item_${id}` : rest.viewTransitionName
      }
      viewTransitionClass={
        itemTransition ? "navi_list_item" : rest.viewTransitionClass
      }
      onPointerDownCapture={blocked ? explainBlockedInteraction : undefined}
      onClickCapture={
        blocked
          ? (event) => {
              if (!pressStartedHereRef.current) {
                return;
              }
              pressStartedHereRef.current = false;
              blockInteraction(event);
            }
          : undefined
      }
      ref={ref}
    >
      {/* The error IS the row's content: what the row stood for did not
          happen, so showing it as if it had would be a lie — same choice as
          the list's own error, one row down. */}
      {error ? (
        <>
          <span className="navi_list_error_icon" aria-hidden="true">
            ⚠
          </span>
          <span className="navi_list_item_error_message">
            {error === true ? "Something went wrong." : error}
          </span>
          {onErrorDismiss && (
            <button
              type="button"
              className="navi_list_item_error_dismiss"
              onClick={onErrorDismiss}
            >
              {naviI18n("button.close", props)}
            </button>
          )}
        </>
      ) : (
        children
      )}
      {/* Drawn on top of the row, taking no space: the row keeps whatever
          layout it was given (a flex row, a grid of columns…) while it waits. */}
      {loading && (
        <LoadingOutline loading color="var(--navi-loader-color)" inset={-1} />
      )}
    </Box>
  );
};
// Why the row cannot be acted on, in the row's own terms. `loading` may say
// what it is waiting for ("adding", "removing"): a row being created is not
// simply "busy", and saying which one it is tells the user what to expect.
const blockedMessage = (loading, readOnly, props) => {
  if (!loading) {
    return naviI18n("constraint.readonly.item", props);
  }
  if (loading === "adding" || loading === "removing") {
    return naviI18n(`constraint.busy.item.${loading}`, props);
  }
  return naviI18n("constraint.busy.item", props);
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
 *   index     — 0-based position in the collection the item belongs to. Required
 *               for virtualization to work correctly. Pass the array map index
 *               — or, when the rendered items are only a slice of a larger
 *               whole (see List's own `count`), the item's absolute position in
 *               that whole: this is how the list knows which part of the
 *               collection it is showing and what is missing around it.
 *   selectable — when true, the item participates in selection (radio or checkbox
 *               depending on whether the parent List has `multiple`). Requires
 *               `value` and typically a <SelectableInput /> child.
 *   skeleton  — render a non-interactive placeholder row (a shimmering bar)
 *               instead of a real item. Used as the List `loadingSkeletonTemplate`
 *               while `loading`; Box layout props (padding…) pass through so the
 *               placeholder can match the real items' metrics.
 *   value     — the JS value emitted by the list's action/uiAction when this item
 *               is selected. Can be any type (string, number, object…).
 *   selected  — controlled selected state. Pass `selected === value` (single) or
 *               `selected.includes(value)` (multiple) from parent state.
 *   itemId    — internal stable string id for tracker bookkeeping (auto-generated
 *               if omitted; prefer `id` for external addressing).
 *   error     — what this row stood for failed: the message replaces its
 *               content, styled like the list's own error. `true` shows a
 *               generic sentence.
 *   loading   — the row is waiting on something: it draws a loading outline and,
 *               like readOnly, stops taking clicks. Works on any item, not only
 *               a selectable one — a list is edited row by row. Pass "adding" or
 *               "removing" rather than true to say WHAT it is waiting for, which
 *               is what a press on it then answers.
 *   readOnly  — the row cannot be acted on: dimmed and click-through-proof,
 *               buttons inside it included.
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
  ListItemSkeletonResolver,
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

// The `separator` prop accepts `true` (the default divider), a vnode, or a
// function receiving the gap index — this turns any of them into the vnode to
// render at that gap.
const resolveSeparatorVnode = (separator, gapIndex) => {
  if (separator === true) {
    return <Separator margin="0" />;
  }
  if (typeof separator === "function") {
    return separator(gapIndex);
  }
  return separator;
};
