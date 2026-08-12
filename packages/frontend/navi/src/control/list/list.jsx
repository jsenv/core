import {
  dispatchPublicCustomEvent,
  getElementSignature,
  scrollIntoViewScoped,
} from "@jsenv/dom";
import { signal } from "@preact/signals";
import { cloneElement, createContext, Fragment } from "preact";
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
// Rows standing in for content that has not arrived (see List's renderSkeleton).
const SKELETON_LIST_ITEM_CLASS = "navi_list_item_skeleton";

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
// What the list knows about the collection as a whole: how many rows it has,
// which of them it actually holds, and where each child's rows start. Filled in
// by the children as they render (see createListVirtual), read by everything
// that must reserve room for what is not rendered.
const ListVirtualContext = createContext(null);
// Set around each row a run of items renders (see ListItems): which row of the
// collection it is, and where it stands among the rows the list holds. Carried
// by context rather than injected into whatever vnode renderItem returned, so
// that returning a component of one's own — instead of a bare <List.Item> —
// works the same way.
const ListRowContext = createContext(null);

const css = /* css */ `
  @layer navi {
    .navi_list_container {
      --list-outline-width: 1px;
      --list-border-radius: 4px;
      /* A list is a box with rows in it: it says where it starts and where it
         ends. The default is on the -default var, not on --list-border-width
         itself, so that the borderWidth prop (which writes the latter inline)
         wins wherever a default is put in its way — see the popup case. */
      --list-border-width-default: 1px;
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

  /* A list that IS the content of a popup draws no border of its own: the popup
     already drew it, and two frames around the same rows read as a box in a box
     (the Picker's list, a select's suggestions). Only the default is dropped —
     a borderWidth asked for explicitly still applies. */
  :where([popover], dialog) > .navi_list_container,
  .navi_list_container[popover] {
    --list-border-width-default: 0px;
  }

  .navi_list_container {
    --x-list-border-radius: var(--list-border-radius);
    --x-list-border-width: var(
      --list-border-width,
      var(--list-border-width-default)
    );
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
      /* The list keeps its own rows still (see the scroll anchoring in
         list.jsx): two of them doing it at once compensate for each other's
         compensation, and the browser's own is blind to the fillers resizing
         under it anyway. */
      overflow-anchor: none;
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
  /* Loading placeholders (see List's loading / loadingFallback / renderSkeleton).
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
  /* The room of rows that were asked for and never came (see List.Items). It
     keeps their height — the scrollbar has no reason to move because a fetch
     failed — and what it says is stuck to the top of it, so it is on screen for
     as long as the hole is. */
  .navi_list_failed_rows {
    display: block;
    height: var(--size-to-fill, 0px);
    flex-shrink: 0;
    list-style: none;

    > * {
      position: sticky;
      top: 0;
    }
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
      width: 100%;
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
    scrolled,
    defaultScrolled = "start",
    onScrolledChange,
    scroller = "self",
    lockSize,
    columns,
    searchText,
    searchNoMatchMode = "remove",
    loading,
    loadingFallback = "skeleton",
    loadingSkeletonCount = 3,
    renderSkeleton,
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
  // A new pass every time the list renders: its children are about to say
  // again, in order, which rows of the collection they stand for.
  const virtualRef = useRef(null);
  if (!virtualRef.current) {
    virtualRef.current = createListVirtual();
  }
  const virtual = virtualRef.current;
  virtual.openPass(renderBudget, scrolled ?? defaultScrolled);

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
    virtual,
    scrolled,
    defaultScrolled,
    onScrolledChange,
    scroller,
    searchText,
    horizontal,
  });

  virtual.virtualItemSizeSignal = virtualItemSizeSignal;
  virtual.horizontal = Boolean(horizontal);
  virtual.renderSkeleton = renderSkeleton;

  const getItemById = (itemId) => {
    return tracker.itemsSignal.peek().find((item) => item.id === itemId);
  };

  const noMatchCount = tracker.noMatchCountSignal.value;
  // What the list stands for, which is not always what it holds: a run saying
  // it covers 60 rows is not an empty list while it waits for the first of
  // them (see List.Items).
  // eslint-disable-next-line no-unused-expressions
  virtual.pagesSignal.value;
  const itemCount = tracker.countSignal.value || virtual.totalSignal.value;
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
      const skeletons = [];
      let skeletonIndex = 0;
      while (skeletonIndex < loadingSkeletonCount) {
        if (separator && skeletonIndex > 0) {
          skeletons.push(
            cloneElement(resolveSeparatorVnode(separator, skeletonIndex - 1), {
              key: `navi-list-skeleton-separator-${skeletonIndex}`,
            }),
          );
        }
        skeletons.push(
          <Fragment key={`navi-list-skeleton-${skeletonIndex}`}>
            {renderSkeleton ? (
              renderSkeleton(skeletonIndex)
            ) : (
              <ListItem skeleton />
            )}
          </Fragment>,
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
        virtual={virtual}
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
 *   scrolled?: "start" | "end" | number | {id: string, offset?: number},
 *   defaultScrolled?: "start" | "end" | number | {id: string, offset?: number},
 *   onScrolledChange?: (scrolled: {id: string, index: number, offset: number}) => void,
 *   scroller?: "self" | "parent",
 *   fallback?: import("preact").ComponentChildren,
 *   searchFallback?: import("preact").ComponentChildren,
 *   searchText?: string,
 *   searchNoMatchMode?: "remove" | "invisible_and_inert" | "muted" | "below",
 *   loading?: boolean,
 *   loadingFallback?: "skeleton" | "loader" | import("preact").ComponentChildren,
 *   loadingSkeletonCount?: number,
 *   renderSkeleton?: false | ((index: number) => import("preact").ComponentChildren),
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
 * @param {false|((index: number) => any)} [props.renderSkeleton]
 *   What a row on its way looks like — a row of the shape the real ones will
 *   have, so nothing moves when they arrive. Used for the rows a `<List.Items>`
 *   stands for and does not hold yet, and for the placeholder rows drawn while
 *   the whole list is `loading`. Defaults to a bare `<List.Item skeleton>`.
 * @param {"skeleton"|"loader"|import("preact").ComponentChildren} [props.loadingFallback="skeleton"]
 *   What to display in place of the items while `loading` — that is, while
 *   there is nothing to show at all: `"skeleton"` renders
 *   `loadingSkeletonCount` placeholder rows (look:
 *   `renderSkeleton`), `"loader"` a single centered spinner, and
 *   anything else is rendered as-is in a row of its own. A falsy value
 *   displays nothing. A list that knows how many rows it will have has no use
 *   for this — see `<List.Items count>`, whose not-yet-loaded rows are drawn
 *   as skeletons in place, one per row, virtualized like the rest.
 * @param {"start"|"end"|number|{id: string, offset?: number}} [props.defaultScrolled="start"]
 *   Where the list opens, after which the user owns the scroll. `"end"` is a
 *   thread read backwards — the last rows are the ones to show, and the ones
 *   asked for first. A number opens on that row of the collection. `{id,
 *   offset}` — what `onScrolledChange` hands out — opens on a NAMED row,
 *   `offset` pixels below the top of the view: the row is asked for by name
 *   (see the range's own `around`), then put back by MEASURING it, so it lands
 *   where it was even if rows were inserted before it, and whatever the screen
 *   it was saved on.
 * @param {"start"|"end"|number|{id: string, offset?: number}} [props.scrolled]
 *   The same, but held: the list goes back there every time this changes, even
 *   after the user has scrolled — the caller owns where the list is (see
 *   `defaultScrolled` for the uncontrolled form, and `open`/`defaultOpen`
 *   elsewhere in navi for the same pair). When the named row turns out not to
 *   exist — a message deleted since — the list opens at `defaultScrolled`
 *   instead.
 *
 *   In every form the list holds itself there while it is still finding out
 *   how many rows there are and how tall one is, and lets go the moment the
 *   user reaches for the list.
 * @param {(scrolled: {id: string, index: number, offset: number}) => void} [props.onScrolledChange]
 *   Where the list is, as the user scrolls: the row at the top of the view and
 *   how far below the top of the view it starts. Keep it to come back to it
 *   later through `scrolled`/`defaultScrolled` — an index would not do, since
 *   rows get inserted while a list is being read.
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
  virtual,
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
        virtual={virtual}
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
  virtual,
  scrolled,
  defaultScrolled,
  onScrolledChange,
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

  const [renderWindow, setRenderWindow] = useState(() => {
    // Opening somewhere else than the beginning starts by framing there: the
    // rows the list will draw are the rows it will ask for.
    const openAt = scrolled ?? defaultScrolled;
    const start =
      typeof openAt === "number" ? openAt - Math.floor(renderBudget / 2) : 0;
    const startClamped = start < 0 ? 0 : start;
    return { start: startClamped, end: startClamped + renderBudget };
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

  // While the list is held somewhere, its window is not free state: it is
  // around that place. Deriving it rather than waiting for the scroll listener
  // to catch up is what keeps a list opening on its last rows from asking for
  // its first ones — it would have drawn them, for the one commit before it
  // jumped.
  const holdWindow = () => {
    if (startPlaceRef.current.userTookOver) {
      virtual.holdPending = false;
      return;
    }
    // Held somewhere it has not reached yet: what the window frames right now
    // is not what it will frame, so nothing should be fetched for it.
    virtual.holdPending =
      scrolledWanted !== "start" && scrolledWanted !== undefined;
    const total = virtual.totalSignal.peek();
    if (total <= renderBudget) {
      return;
    }
    const half = Math.floor(renderBudget / 2);
    let wantedStart = null;
    if (scrolledWanted === "end") {
      wantedStart = total - renderBudget;
    } else if (typeof scrolledWanted === "number") {
      wantedStart = scrolledWanted - half;
    } else if (scrolledWanted && scrolledWanted.id !== undefined) {
      const rowIndex = virtual.locateRow(scrolledWanted.id);
      if (rowIndex !== null) {
        wantedStart = rowIndex - half;
      }
    }
    if (wantedStart === null) {
      return;
    }
    if (wantedStart < 0) {
      wantedStart = 0;
    }
    if (wantedStart + renderBudget > total) {
      wantedStart = total - renderBudget;
    }
    const { start, end } = renderWindowRef.current;
    if (wantedStart === start && end - start === renderBudget) {
      virtual.holdPending = false;
      return;
    }
    renderWindowRef.current = {
      start: wantedStart,
      end: wantedStart + renderBudget,
    };
    virtual.holdPending = false;
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
    const index = item.index;
    if (index === undefined) {
      return;
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
      const itemEl = findRowElement(getListEl(), item.id);
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

  // Where the list must be: what the caller holds it at (`scrolled`), or where
  // it opens and then lets go (`defaultScrolled`). A `scrolled` that changes is
  // the caller moving the list, so the hold is armed again — that is what makes
  // it controlled.
  // Nothing to hold it at (a position not saved yet) is not a position: the
  // list opens where it opens.
  const scrolledWanted = scrolled ?? defaultScrolled;
  const scrolledFallback =
    scrolled === undefined || scrolled === null
      ? "start"
      : (defaultScrolled ?? "start");
  const startPlaceRef = useRef({ userTookOver: false, wanted: scrolledWanted });
  if (startPlaceRef.current.wanted !== scrolledWanted) {
    startPlaceRef.current.wanted = scrolledWanted;
    startPlaceRef.current.userTookOver = false;
  }
  // Only one thing owns the scroll at a time: while the list is holding itself
  // somewhere, the anchoring stays out of it (holding a row still is precisely
  // not being at the end anymore once what is above it shrinks).
  const heldSomewhere =
    !startPlaceRef.current.userTookOver &&
    scrolledWanted !== "start" &&
    scrolledWanted !== undefined;
  if (heldSomewhere) {
    // Subscribing on purpose: the row size is measured by this list but read
    // by the runs, so a size that settles re-renders THEM — their fillers grow,
    // the end of the list moves, and nothing would tell this list to aim at it
    // again.
    // eslint-disable-next-line no-unused-expressions
    virtualItemSizeSignal.value;
  }
  // The row the scroll is held onto across a commit (see the anchoring below).
  // A deliberate move — opening the list somewhere, coming back to a row — is
  // the list saying where it wants to be: whatever it was holding onto before
  // no longer applies, or the correction would undo the move.
  const anchorRef = useRef(null);
  // Set around a scroll the list performs itself. What it protects against is
  // not the scroll event as such, but what the listener would conclude from it:
  // the position it is about to read was chosen to keep the rows where they
  // are, so re-deriving the window from it — through an estimate that is
  // precisely what needed compensating — would send the window somewhere the
  // user never asked to go.
  const scrolledByListRef = useRef(false);
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

  // Where the list opens when it has no reason to be anywhere else: at the end
  // for a thread one reads backwards, on a named row when one is coming back
  // to where they were, at the start otherwise.
  //
  // Held until the user takes over rather than done once: where that place is
  // keeps moving while the list is still finding out how many rows it has and
  // how tall one is, so landing there once would land next to it. What ends the
  // hold is the user reaching for the list — a wheel, a finger, a key, a hand
  // on the scrollbar — and not the scroll event itself, which the list provokes
  // as much as the user does.
  const placeWhereHeld = () => {
    if (
      scrolledWanted === "start" ||
      scrolledWanted === undefined ||
      startPlaceRef.current.userTookOver ||
      !ref.current
    ) {
      return;
    }
    if (
      virtual.totalSignal.peek() === 0 ||
      virtualItemSizeSignal.peek() === 0
    ) {
      return;
    }
    // Coming back to a named row: it has to be on screen to be put back where
    // it was — measured, not computed from an estimate, which is what makes
    // the position exact whatever the rows in between turn out to weigh. Until
    // it is drawn, the most this can do is aim the window at it.
    let openAt = scrolledWanted;
    if (typeof scrolledWanted === "object" && scrolledWanted.id !== undefined) {
      // Only whoever holds the rows can say where that one sits: the list
      // itself knows the rows it has drawn, and this one is precisely the one
      // it has not drawn yet.
      const rowIndex = virtual.locateRow(scrolledWanted.id);
      if (rowIndex === null) {
        // A page has come back and that row is not in it: it is gone (a
        // message deleted, a game cancelled). Waiting for it forever would
        // leave the list wherever the first page landed, which is nowhere in
        // particular — open where the caller said to open when that happens.
        if (virtual.pagesSignal.peek() === 0) {
          return;
        }
        openAt = scrolledFallback;
        if (openAt === "start" || openAt === undefined) {
          startPlaceRef.current.userTookOver = true;
          return;
        }
      } else {
        const { start, end } = renderWindowRef.current;
        if (rowIndex < start || rowIndex >= end) {
          const half = Math.floor((end - start) / 2);
          const wantedStart = rowIndex - half < 0 ? 0 : rowIndex - half;
          updateRenderWindow(
            wantedStart,
            wantedStart + (end - start),
            `opening on row ${scrolledWanted.id}`,
          );
          return;
        }
      }
    }
    const scrollerEl = getScroller();
    if (openAt === "end") {
      anchorRef.current = null;
      console.info(
        `[place] before write: scrollHeight=${Math.round(scrollerEl.scrollHeight)} client=${Math.round(scrollerEl.clientHeight)} top=${Math.round(scrollerEl.scrollTop)}`,
      );
      if (horizontal) {
        scrollerEl.scrollLeft = scrollerEl.scrollWidth;
      } else {
        scrollerEl.scrollTop = scrollerEl.scrollHeight;
      }
      console.info(
        `[place] after write: top=${Math.round(scrollerEl.scrollTop)} max=${Math.round(scrollerEl.scrollHeight - scrollerEl.clientHeight)}`,
      );
      return;
    }
    if (typeof openAt === "object" && openAt.id !== undefined) {
      const rowEl = findRowElement(getListEl(), openAt.id);
      if (!rowEl) {
        return;
      }
      const viewportRect = getScrollerViewportRect(scrollerEl);
      const rowRect = rowEl.getBoundingClientRect();
      const offsetWanted = resolveOpenOffset(
        openAt.offset || 0,
        horizontal ? viewportRect.width : viewportRect.height,
        horizontal ? rowRect.width : rowRect.height,
      );
      const offsetNow = horizontal
        ? rowRect.left - viewportRect.left
        : rowRect.top - viewportRect.top;
      const delta = offsetNow - offsetWanted;
      if (delta > -0.5 && delta < 0.5) {
        return;
      }
      anchorRef.current = null;
      if (horizontal) {
        scrollerEl.scrollLeft += delta;
      } else {
        scrollerEl.scrollTop += delta;
      }
      return;
    }
    const rowPosition = openAt * virtualItemSizeSignal.peek();
    anchorRef.current = null;
    if (horizontal) {
      scrollerEl.scrollLeft = rowPosition;
    } else {
      scrollerEl.scrollTop = rowPosition;
    }
  };
  useLayoutEffect(placeWhereHeld);
  // What to do when the list's own geometry moves under it, kept fresh for the
  // observer below (which is installed once).
  const onGeometryChangeRef = useRef(null);
  onGeometryChangeRef.current = () => {
    if (heldSomewhere) {
      placeWhereHeld();
      return true;
    }
    return false;
  };
  useLayoutEffect(() => {
    if (
      scrolledWanted === "start" ||
      scrolledWanted === undefined ||
      !ref.current
    ) {
      return undefined;
    }
    const scrollerEl = getScroller();
    const takeOver = () => {
      startPlaceRef.current.userTookOver = true;
    };
    const takeOverEvents = ["wheel", "touchstart", "pointerdown", "keydown"];
    for (const type of takeOverEvents) {
      scrollerEl.addEventListener(type, takeOver, { passive: true });
    }
    return () => {
      for (const type of takeOverEvents) {
        scrollerEl.removeEventListener(type, takeOver);
      }
    };
  }, [scrolledWanted, scroller]);

  // Where the list is, said the way it can be given back to it: the row at the
  // top of what is on screen, and how far above the fold it sits. An index
  // would not do — rows get inserted while a list is being read, and the row
  // one was looking at is then somewhere else.
  const onScrolledChangeRef = useRef(null);
  onScrolledChangeRef.current = onScrolledChange;
  // Where the list was at the last thing that moved it. Kept whether anyone
  // asked for it or not: it is what a resize needs to put things back.
  const positionRef = useRef(null);
  const reportPosition = () => {
    if (!ref.current) {
      return;
    }
    const position = captureScrollAnchor({
      scrollerEl: getScroller(),
      listEl: getListEl(),
      items: tracker.visibleItemsSignal.peek(),
      horizontal,
    });
    if (!position) {
      return;
    }
    positionRef.current = position;
    onScrolledChangeRef.current?.({
      id: position.id,
      index: position.index,
      offset: position.offset,
    });
  };

  // A list that gets narrower rewraps every row it holds, so everything below
  // moves and the reader loses their place — the very thing scrolling a long
  // list is supposed to protect. The row that was at the top goes back to
  // where it was, measured on the new layout.
  useLayoutEffect(() => {
    if (!ref.current) {
      return undefined;
    }
    const scrollerEl = getScroller();
    const observer = new ResizeObserver(() => {
      // Held somewhere: its own height changing is the end of the list moving,
      // so it aims at it again. Nothing else can tell it — the size of a row is
      // measured here but read by the runs, so a size that settles re-renders
      // THEM, not this.
      if (onGeometryChangeRef.current()) {
        return;
      }
      const position = positionRef.current;
      if (!position) {
        return;
      }
      const rowEl = findRowElement(getListEl(), position.id);
      if (!rowEl) {
        return;
      }
      const viewportRect = getScrollerViewportRect(scrollerEl);
      const rowRect = rowEl.getBoundingClientRect();
      const offsetNow = horizontal
        ? rowRect.left - viewportRect.left
        : rowRect.top - viewportRect.top;
      const delta =
        offsetNow -
        resolveOpenOffset(
          position.offset,
          horizontal ? viewportRect.width : viewportRect.height,
          horizontal ? rowRect.width : rowRect.height,
        );
      if (delta > -0.5 && delta < 0.5) {
        return;
      }
      anchorRef.current = null;
      if (horizontal) {
        scrollerEl.scrollLeft += delta;
      } else {
        scrollerEl.scrollTop += delta;
      }
    });
    observer.observe(scrollerEl);
    observer.observe(getListEl());
    return () => {
      observer.disconnect();
    };
  }, [scroller]);

  // Inserting rows above what the user is looking at must not move it by a
  // single pixel. The browser will not do it for us — overflow-anchor gives up
  // on changes it attributes to a scroll, and the fillers resize in the very
  // same commit — so the row at the top of the viewport is measured before the
  // commit and put back at the same offset after it.
  if (
    !heldSomewhere &&
    !searchText &&
    !anchorRef.current &&
    !pendingScrollRef.current &&
    ref.current
  ) {
    anchorRef.current = captureScrollAnchor({
      scrollerEl: getScroller(),
      listEl: getListEl(),
      items: tracker.visibleItemsSignal.peek(),
      horizontal,
    });
  }
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !ref.current || heldSomewhere) {
      anchorRef.current = null;
      return;
    }
    const items = tracker.visibleItemsSignal.peek();
    const itemNow = items.find((i) => i.id === anchor.id);
    if (!itemNow) {
      anchorRef.current = null;
      return;
    }
    const indexShift = itemNow.index - anchor.index;
    if (indexShift !== 0) {
      // The render window addresses rows by their place in the collection:
      // rows inserted before the anchor renumbered everything after them, so
      // the window must follow or it would frame a different part of the list
      // entirely. The anchor is kept — where it must land does not change —
      // but its index is now the new one, so the commit that follows compares
      // against it and moves on to the scroll correction.
      anchor.index = itemNow.index;
      const { start, end } = renderWindowRef.current;
      const windowSize = end - start;
      const startShifted = start + indexShift;
      let startWanted = startShifted < 0 ? 0 : startShifted;
      const total = virtual.totalSignal.peek();
      // Same normalization as the scroll listener: a window running past the
      // last row slides back instead of framing fewer rows than its budget
      // allows — every row that fits in it must stay rendered.
      if (startWanted + windowSize > total) {
        startWanted = total - windowSize;
        if (startWanted < 0) {
          startWanted = 0;
        }
      }
      const endWanted = startWanted + windowSize;
      if (startWanted !== start || endWanted !== end) {
        updateRenderWindow(
          startWanted,
          endWanted,
          `${indexShift} row(s) inserted before the anchored row`,
        );
        return;
      }
    }
    anchorRef.current = null;
    const anchorEl = findRowElement(getListEl(), anchor.id);
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
      `anchored row ${anchor.id} drifted by ${Math.round(drift)}px, compensating scroll`,
    );
    scrolledByListRef.current = true;
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
      if (scrolledByListRef.current) {
        // The window stays where it is — the position it would be re-derived
        // from was chosen to keep the rows still — but where the list is has
        // genuinely changed, and whoever keeps that position must hear it.
        scrolledByListRef.current = false;
        reportPosition();
        return;
      }
      reportPosition();
      const total = virtual.totalSignal.peek();
      if (total <= renderBudget) {
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
      });
      if (!scrollInfo) {
        return;
      }
      const { index, reason: hitReason } = scrollInfo;
      virtual.visibleIndex = index;
      reason = hitReason;
      // Recentering on every row crossed would rebuild the whole window a few
      // times a second, and a window rebuilt is every row of it rendered
      // again. It only moves once what is on screen comes near one of its
      // edges — until then, it already holds what has to be drawn.
      const { start, end } = renderWindowRef.current;
      const margin = Math.floor(renderBudget / 4);
      const farFromStart = index - start >= margin || start === 0;
      const farFromEnd = end - index > margin || end === total;
      if (farFromStart && farFromEnd) {
        return;
      }
      const half = Math.floor(renderBudget / 2);
      let newStart = Math.max(0, index - half);
      let newEnd = Math.min(total, newStart + renderBudget);
      if (newEnd === total) {
        newStart = Math.max(0, total - renderBudget);
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

  holdWindow();
  return {
    virtualItemSizeSignal,
    renderWindow: renderWindowRef.current,
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
// A row must be worth looking at once put back where it was. The offset comes
// from wherever the position was taken — another screen, another window size,
// rows that wrap differently — so it is not necessarily a place this view has:
// keep enough of the row on screen for it to be the answer to "take me back
// there".
const OPEN_ROW_MIN_VISIBLE = 24;
const resolveOpenOffset = (offset, viewportSize, rowSize) => {
  const lowest = -rowSize + OPEN_ROW_MIN_VISIBLE;
  const highest = viewportSize - OPEN_ROW_MIN_VISIBLE;
  if (offset < lowest) {
    return lowest < 0 ? lowest : 0;
  }
  if (offset > highest) {
    return highest < 0 ? 0 : highest;
  }
  return offset;
};

// The row with that id, IN THIS LIST. Not document.getElementById: an id is
// only ever unique within a list — two lists on the same page can be showing
// the same collection — and a list acting on a row that belongs to another one
// is a spectacular kind of wrong (it scrolls to hold still something it is not
// even showing).
const findRowElement = (listEl, id) => {
  return listEl.querySelector(`[id="${CSS.escape(id)}"]`);
};

// The row the user is looking at, and where it sits: what must not move when
// the list is rebuilt around it.
const captureScrollAnchor = ({ scrollerEl, listEl, items, horizontal }) => {
  if (!scrollerEl || !listEl) {
    return null;
  }
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const listRect = listEl.getBoundingClientRect();
  const scanRange = getListVisibleScanRange(viewportRect, listRect, horizontal);
  if (!scanRange) {
    return null;
  }
  let fallbackAnchor = null;
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
    const item = items.find((i) => i.id === itemEl.id);
    if (!item) {
      continue;
    }
    const itemRect = itemEl.getBoundingClientRect();
    const offset = horizontal
      ? itemRect.left - viewportRect.left
      : itemRect.top - viewportRect.top;
    const anchor = { id: item.id, index: item.index, offset };
    if (offset >= 0) {
      return anchor;
    }
    // The row under the top of the view starts above it. Good enough to hold
    // the list still, but as a position to hand out and come back to, the row
    // that STARTS in the view says it better — "this row, that far below the
    // top" reads, and can be drawn. Keep looking; this one is the fallback.
    if (!fallbackAnchor) {
      fallbackAnchor = anchor;
    }
  }
  return fallbackAnchor;
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

// Which row of the collection sits at the current scroll position. Uses DOM
// hit-testing when a real row is there to be hit, and the row size when what is
// on screen is only reserved room.
// Returns { index, item, reason } or null if nothing can be determined.
const getScrollInfo = ({
  scrollValues,
  scrollerEl,
  listEl,
  tracker,
  virtualItemSizeSignal,
  renderWindowRef,
  horizontal,
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
    // list is not necessarily flush against the top of the scroller.
    const listOffsetInViewport =
      (horizontal ? viewportRect.left : viewportRect.top) -
      (horizontal ? listRect.left : listRect.top);
    // scrollValues may describe a position the scroller is not at yet (a scroll
    // about to be restored): the difference is what the rects cannot show.
    const scrollNow = horizontal ? scrollerEl.scrollLeft : scrollerEl.scrollTop;
    const scrollAsked = horizontal ? scrollValues.left : scrollValues.top;
    const positionInItems =
      (listOffsetInViewport + (scrollAsked - scrollNow)) / virtualItemSize;
    const estimatedIndex = Math.floor(positionInItems);
    const index = estimatedIndex < 0 ? 0 : estimatedIndex;
    return {
      item: items.find((i) => i.index === index),
      index,
      reason: `${reasonPrefix}, estimated at ${index}`,
    };
  };
  if (hitFiller) {
    return estimateFromScrollPos("hit filler");
  }
  if (hitEl) {
    const hitId = hitEl.id;
    const item = items.find((i) => i.id === hitId);
    if (!item) {
      return null;
    }
    return {
      item,
      index: item.index,
      reason: `hit item at ${item.index} (${item.value})`,
    };
  }
  // Neither a real item nor a filler was hit within listEl — e.g. part of
  // the scan range fell outside the page's actually reachable viewport
  // (docked devtools shrinks it, for one). Keeping the stale renderWindow
  // here means the DOM never gets asked to catch up with a scrollTop that may
  // have jumped far away — the user ends up staring at filler space. Same
  // estimate as the hitFiller case is a safe fallback: it only needs the
  // scroll position, not a successful hit-test.
  const estimated = estimateFromScrollPos("no hit");
  if (estimated) {
    return estimated;
  }
  const fallbackIndex = renderWindowRef.current.start;
  return {
    item: items.find((i) => i.index === fallbackIndex),
    index: fallbackIndex,
    reason: "no hit, no virtualItemSize yet",
  };
};

// Under this, rewriting the size would churn the fillers for a sub-pixel gain.
const VIRTUAL_ITEM_SIZE_EPSILON = 0.5;
// Measures the rows currently in the DOM, edge to edge: what a filler stands in
// for is the room a run of rows takes together — separators and group labels
// included — not the height of one <li>.
const measureItemSize = (listEl, horizontal) => {
  let fromSkeletons = false;
  let itemEls = listEl.querySelectorAll(REAL_LIST_ITEM_SELECTOR);
  if (itemEls.length === 0) {
    fromSkeletons = true;
    // Nothing real yet: a list that knows how many rows it has draws them as
    // skeletons before it holds any of them, and their height is what it can
    // reserve room with — a list arriving at its full height rather than
    // growing into it. They are only ever measured while no real row is there
    // to be measured instead; once one is, they take the size they are given
    // (see ListItems) and cannot drag the average.
    itemEls = listEl.querySelectorAll(`.${SKELETON_LIST_ITEM_CLASS}`);
  }
  if (itemEls.length === 0) {
    return null;
  }
  const firstRect = itemEls[0].getBoundingClientRect();
  const lastRect = itemEls[itemEls.length - 1].getBoundingClientRect();
  const span = horizontal
    ? lastRect.right - firstRect.left
    : lastRect.bottom - firstRect.top;
  if (span <= 0) {
    return null;
  }
  return {
    size: span / itemEls.length,
    rowCount: itemEls.length,
    fromSkeletons,
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
  // Every row ever measured has a say, and an equal one. An average over a
  // growing sample settles; a running average of the last window measured
  // chases it, and since the fillers hold (total - window) rows, a moving
  // average moves the whole scrollbar every time the window slides over rows
  // that are a little taller than usual.
  const samplesRef = useRef(null);
  if (!samplesRef.current) {
    samplesRef.current = { sum: 0, count: 0, fromSkeletons: true };
  }
  const feedSample = (measure) => {
    const samples = samplesRef.current;
    if (samples.fromSkeletons && !measure.fromSkeletons) {
      // What a row on its way looks like was a stand-in for what a row looks
      // like. The first real ones settle the question.
      samples.sum = 0;
      samples.count = 0;
      samples.fromSkeletons = false;
    } else if (!samples.fromSkeletons && measure.fromSkeletons) {
      return;
    }
    samples.sum += measure.size * measure.rowCount;
    samples.count += measure.rowCount;
    const next = samples.sum / samples.count;
    const current = virtualSizeSignal.peek();
    if (Math.abs(next - current) > VIRTUAL_ITEM_SIZE_EPSILON) {
      virtualSizeSignal.value = next;
    }
  };
  // Re-measured during render, not in a layout effect: the fillers read this
  // signal while rendering just below, so the new size lands in the same commit
  // as the rows it was measured on. Written from a layout effect it would
  // resize them one commit later — after the scroll anchoring of that commit
  // had already run, which is exactly the jump anchoring exists to prevent.
  const sizeAlreadyKnown = virtualSizeSignal.peek() !== 0;
  if (!virtualItemSizeProp && sizeAlreadyKnown && ref.current) {
    const listEl = ref.current.querySelector(".navi_list");
    const measure = listEl ? measureItemSize(listEl, horizontal) : null;
    if (measure) {
      feedSample(measure);
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
    const measure = measureItemSize(listEl, horizontal);
    if (measure) {
      const samples = samplesRef.current;
      samples.sum = measure.size * measure.rowCount;
      samples.count = measure.rowCount;
      samples.fromSkeletons = measure.fromSkeletons;
      virtualSizeSignal.value = measure.size;
      return undefined;
    }
    const firstListItem =
      listEl.querySelector(REAL_LIST_ITEM_SELECTOR) ||
      listEl.querySelector(`.${SKELETON_LIST_ITEM_CLASS}`);
    if (!firstListItem) {
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
  virtual,
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
      {!suppressFallback && (
        <SearchFallback
          searchFallback={searchFallback}
          searching={searching}
          tracker={tracker}
          virtual={virtual}
        />
      )}
      {!suppressFallback && (
        <Fallback
          fallback={fallback}
          searching={searching}
          tracker={tracker}
          virtual={virtual}
        />
      )}
      <SearchNoMatchModeContext.Provider value={searchNoMatchMode}>
        <RenderWindowContext.Provider value={renderWindow}>
          <SeparatorContext.Provider value={separator ?? null}>
            <ItemTransitionContext.Provider value={Boolean(itemTransition)}>
              <ListItemTrackerContext.Provider value={tracker}>
                <ListVirtualContext.Provider value={virtual}>
                  <ListRowContext.Provider value={null}>
                    <ListColumnsContext.Provider value={columns || null}>
                      {children}
                    </ListColumnsContext.Provider>
                  </ListRowContext.Provider>
                </ListVirtualContext.Provider>
              </ListItemTrackerContext.Provider>
            </ItemTransitionContext.Provider>
          </SeparatorContext.Provider>
        </RenderWindowContext.Provider>
      </SearchNoMatchModeContext.Provider>
    </Box>
  );
};

// The "no match" message. Shown when a search left nothing to display: either
// every matchable item has match=false (in-list filtering), or the list is empty
// during an active search (filtering done outside the list, so itemCount is 0).
const SearchFallback = ({ tracker, virtual, searchFallback, searching }) => {
  // eslint-disable-next-line no-unused-expressions
  virtual.pagesSignal.value;
  const itemCount = tracker.countSignal.value || virtual.totalSignal.value;
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
const Fallback = ({ tracker, virtual, fallback, searching }) => {
  // eslint-disable-next-line no-unused-expressions
  virtual.pagesSignal.value;
  const itemCount = tracker.countSignal.value || virtual.totalSignal.value;
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
const VirtualFiller = ({ edge, itemCount, virtualItemSize }) => {
  const sizeToFill = itemCount * virtualItemSize;
  if (!sizeToFill) {
    return null;
  }
  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler={edge}
      aria-hidden
      style={{
        "--size-to-fill": `${sizeToFill}px`,
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
// A row produced by <List.Items> is given its identity here rather than by the
// caller: the run knows which row of the collection this is. It has to happen
// before the rest of the chain, since what comes next derives from the id (a
// selectable row names its input after it, keyboard navigation addresses rows
// by it).
const ListItemRowResolver = (props) => {
  const Next = useNextResolver();
  const row = useContext(ListRowContext);
  if (!row) {
    return <Next {...props} />;
  }
  // eslint-disable-next-line no-unused-vars
  const { id, index, item, rowMinHeight, rowMinWidth, ...rowProps } = row;
  return (
    <Next
      {...rowProps}
      {...props}
      id={props.id || row.id}
      index={row.index}
      minHeight={props.minHeight === undefined ? rowMinHeight : props.minHeight}
      minWidth={props.minWidth === undefined ? rowMinWidth : props.minWidth}
    />
  );
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
// pass through so a renderSkeleton row can match the real items' metrics; and when
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
      baseClassName={`navi_list_item ${SKELETON_LIST_ITEM_CLASS}`}
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
  const idDefault = useId();
  props.id = props.id || idDefault;
  const tracker = useContext(ListItemTrackerContext);
  const virtual = useContext(ListVirtualContext);
  const searchNoMatchMode = useContext(SearchNoMatchModeContext);
  // The run this row belongs to, when it comes from one (see ListItems): it
  // registered the row, decided it is inside the render window, and placed its
  // separator. All that is left here is to draw it.
  const row = useContext(ListRowContext);
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
  // Where a row sits is where it was declared, full stop: a list is written in
  // the order it reads. Nothing to pass, nothing to keep in sync — a search
  // that reorders rows reorders the rows it declares. A row drawn by a run
  // already knows its place; the run gave it.
  if (!row && !props.filtered) {
    props.index = virtual.take(props.id, 1);
  }
  // Every row that is drawn registers itself, whether it was declared one by
  // one or drawn by a run: what it says about itself (its value, whether it is
  // selected) is written where it is drawn, in one place.
  const item = props;
  tracker.useTrackItem(item);
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
  if (row) {
    return <ListItemReal {...props} />;
  }
  const index = props.index;
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
    groupVisibleIndex === null ? index === 0 : groupVisibleIndex === 0;
  if (!separator || isFirstInList) {
    return listItemVnode;
  }
  // separatorIndex is only used as the function-form argument (gap index)
  const separatorIndex = groupVisibleIndex === null ? index : groupVisibleIndex;

  const separatorVnode = resolveSeparatorVnode(separator, separatorIndex - 1);
  return (
    <>
      {separatorVnode}
      {listItemVnode}
    </>
  );
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
 * ListItem — one row of a list.
 *
 * Must be used inside <List>. Declared one by one, its place is where it is
 * declared; drawn by a <List.Items>, the run gives it its place and its id.
 * Either way the row registers itself with the list, which is what makes what
 * it says about itself (its value, whether it is selected) the one description
 * of it.
 *
 * Props:
 *   id        — HTML element id AND the stable identifier used by external commands
 *               (--navi-select, --navi-unselect, --navi-scroll, --navi-update).
 *               Required when items need to be targeted programmatically from
 *               outside the list. Auto-generated internally if omitted.
 *   selectable — when true, the item participates in selection (radio or checkbox
 *               depending on whether the parent List has `multiple`). Requires
 *               `value` and typically a <SelectableInput /> child.
 *   skeleton  — render a non-interactive placeholder row (a shimmering bar)
 *               instead of a real item. This is what a `renderSkeleton` returns
 *               for a row on its way; Box layout props (padding…) pass through
 *               so the placeholder can match the real items' metrics.
 *   value     — the JS value emitted by the list's action/uiAction when this item
 *               is selected. Can be any type (string, number, object…).
 *   selected  — controlled selected state. Pass `selected === value` (single) or
 *               `selected.includes(value)` (multiple) from parent state.
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
 *                 matchScore  — this row's search relevance score (higher =
 *                               more relevant). Only read for search-driven
 *                               scroll-to-top-match behavior.
 *                 matchRanges — array of [start, end] ranges to highlight via
 *                               CSS Highlight API.
 *   ...rest   — forwarded to the rendered <li> element
 */
export const ListItem = createComponentResolver([
  ListItemFirstResolver,
  ListItemRowResolver,
  ListItemSkeletonResolver,
  ListItemSelectableResolver,
  ListItemHeaderOrFooterResolver,
  ListItemPresentationResolver,
  ListItemUI,
]);
List.Item = ListItem;

// Everything the list knows about the collection while its children are being
// rendered: how many rows it has in total, which of them are actually held, and
// where each child's rows start.
//
// A child knows how many rows it stands for but not what was declared before
// it, so the list hands out the places as its children render — in order, which
// is the only thing needed to place them. A child re-rendering ON ITS OWN (its
// own state changed, the list did not render) keeps the place it was given:
// nothing before it moved. Hence the pass — only a render of the list itself
// opens a new one, and within a pass a child takes its place exactly once.
const createListVirtual = () => {
  const totalSignal = signal(0);
  // Bumped whenever a run takes in rows. The list itself has to hear about it:
  // rows arriving outside the render window change nothing it can see (nothing
  // registers, nothing is drawn), and yet they are what it may have been
  // waiting for — the row it was told to open on, for one.
  const pagesSignal = signal(0);
  const placeByOwner = new Map();
  const locatorByOwner = new Map();
  let passId = 0;
  let nextIndex = 0;

  const virtual = {
    totalSignal,
    pagesSignal,
    // What a run needs to know about the list it lives in: how many rows the
    // list is willing to draw at once, which end it opens on, and how much
    // room one row is given — a row whose content has not arrived must take
    // exactly that, or the rows drawn would not reach where the list says they
    // are.
    renderBudget: 0,
    scrolled: "start",
    // The list is on its way somewhere: what the window frames is not what it
    // is about to frame, so a run must not fetch for it (see holdWindow).
    holdPending: false,
    horizontal: false,
    virtualItemSizeSignal: null,
    renderSkeleton: undefined,
    // The row at the top of what is on screen, as the scroll last saw it.
    // What a run needs it for: to put a sentence about missing rows where it
    // will be read, rather than at the top of a range that may be well above
    // the fold.
    visibleIndex: 0,
    openPass: (renderBudget, scrolled) => {
      virtual.renderBudget = renderBudget;
      virtual.scrolled = scrolled;
      passId++;
      nextIndex = 0;
    },
    setRowLocator: (ownerId, locate) => {
      locatorByOwner.set(ownerId, locate);
    },
    dropRowLocator: (ownerId) => {
      locatorByOwner.delete(ownerId);
    },
    // Where the row named by that id sits, asked of whoever holds it.
    locateRow: (id) => {
      for (const locate of locatorByOwner.values()) {
        const index = locate(id);
        if (index !== null) {
          return index;
        }
      }
      return null;
    },
    take: (ownerId, rowCount, indexStart) => {
      const placeTaken = placeByOwner.get(ownerId);
      if (placeTaken && placeTaken.passId === passId) {
        return placeTaken.index;
      }
      const index = indexStart === undefined ? nextIndex : indexStart;
      placeByOwner.set(ownerId, { passId, index });
      nextIndex = index + rowCount;
      totalSignal.value = nextIndex;
      return index;
    },
  };
  return virtual;
};

const SKELETON_HIDDEN_STYLE = { visibility: "hidden" };

/**
 * List.Items — a run of rows given as data rather than as one component each.
 *
 * The list renders `renderItem` only for the rows inside its render window; the
 * others cost nothing but their place. A run that stands for more rows than it
 * holds draws the rest as skeletons the moment they enter the window, and asks
 * for them — which is what makes an infinitely scrolled list nothing more than
 * a list that says how many rows it has.
 *
 * The rows come from `itemsAction(range)`: the run asks for what it is about to
 * draw and keeps what it gets. The range says the same thing three ways, so a
 * source can read it however it paginates — `{ start, end }` (places in the
 * collection, a negative `start` counting back from the end like
 * `Range: items=-25`, which is what a list opening on its last rows asks for
 * before it knows how many there are), `limit` (how many rows), and
 * `before`/`after`/`around` (the id of a row to count from, for a source
 * paginating by cursor). Answer with the rows (an array — that is all of
 * them), or with a page the way a Content-Range does: `{ items, start, count }`
 * — these rows, at this place, out of that many. May be async.
 *
 * A collection held in memory answers synchronously: `itemsAction={() => rows}`.
 * What it gives back is kept, so a collection that changes as a whole (a search
 * reordering it) is a different collection: give the run a `key` that changes
 * with it, the way one does for anything else that is not the same thing
 * anymore.
 *
 * A row says what it is where it is drawn: `renderItem` returns a
 * `<List.Item>` carrying its own props (`selectable`, `value`, `selected`…),
 * and the row registers itself with the list from there — there is no second
 * place describing the same row.
 *
 * Several runs can live in one list, next to plain `<List.Item>` children and
 * inside `<List.Group>`s; each takes its place in declaration order.
 *
 * @type {import("preact").FunctionComponent<{
 *   renderItem: (item: any, index: number) => import("preact").ComponentChildren,
 *   itemsAction: (range: {start: number, end: number, limit: number, before?: string, after?: string, around?: string, count?: number}) => any,
 *   count?: number,
 *   groupBy?: (item: any, index: number) => any,
 *   renderGroupLabel?: (item: any, index: number) => import("preact").ComponentChildren,
 *   pageSize?: number,
 *   memoryBudget?: number,
 *   renderSkeleton?: false | ((index: number) => import("preact").ComponentChildren),
 *   renderError?: (failure: {error: any, retry: () => void, start: number, end: number}) => import("preact").ComponentChildren,
 * }>}
 * @param {(item: any, index: number) => any} [props.groupBy]
 *   What tells rows that belong together apart from the others — the day of a
 *   message, the month of a game. Consecutive rows sharing it are wrapped in a
 *   `<List.Group>` whose label (`renderGroupLabel`) stays on screen for as long
 *   as one of them is. The groups are found in the data as it arrives, which is
 *   the only way a list that discovers its rows page by page can have any.
 * @param {(item: any, index: number) => any} [props.renderGroupLabel]
 *   The label of the group a row opens, given that row.
 * @param {number} [props.pageSize]
 *   How many rows to ask for at a time. A turn of the wheel opens a hole three
 *   rows wide; asking for exactly that would ask again at the next turn.
 *   Defaults to List's own `renderBudget` — what the list would draw at once.
 * @param {number} [props.memoryBudget=1000]
 *   How many rows the run keeps in memory. Past that, the ones far from what is
 *   on screen are dropped (and asked for again if the user goes back) — the
 *   same trade the render window makes with the DOM, one order of magnitude
 *   further out. `0` keeps everything.
 * @param {false|(index: number) => any} [props.renderSkeleton]
 *   What to draw for a row the run does not hold. Defaults to List's own
 *   `renderSkeleton`, then to a bare `<List.Item skeleton>`; `false` leaves the
 *   row empty (its room is still held, or the list would jump as it loads).
 * @param {(failure: object) => any} [props.renderError]
 *   What to draw where rows were asked for and never came: given the `error`,
 *   a `retry` to call, and the `start`/`end` of the range that failed. Defaults
 *   to an inline message with a retry button, drawn on the row the user is
 *   looking at.
 */
export const ListItems = ({
  renderItem,
  itemsAction,
  count,
  pageSize,
  memoryBudget,
  groupBy,
  renderGroupLabel,
  renderSkeleton,
  renderError,
}) => {
  const ownerId = useId();
  const virtual = useContext(ListVirtualContext);
  const renderWindow = useContext(RenderWindowContext);
  const separator = useContext(SeparatorContext);
  const store = useItemStore({ count, itemsAction, memoryBudget });
  const renderRowSkeleton =
    renderSkeleton === undefined ? virtual.renderSkeleton : renderSkeleton;
  // A row on its way takes the room the list reserves for it: anything else
  // and the rows drawn stop short of where the scroll says they are.
  const virtualItemSize = virtual.virtualItemSizeSignal.value;
  const skeletonRow = {};
  if (virtualItemSize) {
    if (virtual.horizontal) {
      skeletonRow.rowMinWidth = `${virtualItemSize}px`;
    } else {
      skeletonRow.rowMinHeight = `${virtualItemSize}px`;
    }
  }

  const runStart = virtual.take(ownerId, store.rowCount);
  const runEnd = runStart + store.rowCount;
  const getItemAt = (index) => store.getItem(index);
  const windowFrom =
    renderWindow.start > runStart ? renderWindow.start : runStart;
  const windowTo = renderWindow.end < runEnd ? renderWindow.end : runEnd;
  store.forget(windowFrom, windowTo);

  // The row answers to its own id when the item carries one — that is what
  // addresses it from outside (--navi-select, --navi-scroll, startAt) — and
  // otherwise to one made from the run and its place, unique within the list,
  // which is all an id has to be.
  const idOf = (item, index) =>
    item && item.id !== undefined ? item.id : `${ownerId}_${index}`;
  // Where a row named from outside actually sits. Only the run can answer:
  // rows it holds but does not draw are nowhere else — a list only knows the
  // rows it has drawn (they register themselves, see ListItemUI).
  virtual.setRowLocator(ownerId, (id) => {
    let found = null;
    store.eachHeld((item, index) => {
      if (found === null && idOf(item, index) === id) {
        found = index;
      }
    });
    return found;
  });
  useLayoutEffect(() => {
    return () => {
      virtual.dropRowLocator(ownerId);
    };
  }, []);

  // What the list is about to draw and the run does not have. Asked for as one
  // range: a caller answering with less than that (a page at a time) is asked
  // again for the rest, and one that answers with nothing is not asked twice.
  let missingStart = -1;
  let missingEnd = -1;
  let scanIndex = windowFrom;
  while (scanIndex < windowTo) {
    if (getItemAt(scanIndex) === undefined) {
      if (missingStart === -1) {
        missingStart = scanIndex;
      }
      missingEnd = scanIndex;
    }
    scanIndex++;
  }
  // Asked for a page at a time, not for the exact hole: a hole three rows wide
  // is what one turn of the wheel opens, and a source answering three rows at a
  // time is asked again at the next turn. The page is grown from the edge the
  // hole is on, which is the direction the user is going.
  let askStart = missingStart;
  let askEnd = missingEnd;
  if (missingStart !== -1) {
    const rowsPerPage = pageSize || virtual.renderBudget;
    const holeSize = missingEnd - missingStart + 1;
    if (holeSize < rowsPerPage) {
      // Which way the page grows: away from the rows already held, which is
      // the way the user is going.
      const heldBelow = store.holds(missingEnd + 1);
      const heldAbove = store.holds(missingStart - 1);
      if (heldBelow && !heldAbove) {
        askStart = missingEnd - rowsPerPage + 1;
      } else if (heldAbove && !heldBelow) {
        askEnd = missingStart + rowsPerPage - 1;
      } else {
        // A hole with nothing on either side (the scrollbar was thrown into
        // territory never visited): grow it both ways around what is on
        // screen.
        const grow = Math.floor((rowsPerPage - holeSize) / 2);
        askStart = missingStart - grow;
        askEnd = missingEnd + grow;
      }
    }
    if (askStart < 0) {
      askStart = 0;
    }
    if (askEnd > runEnd - 1) {
      askEnd = runEnd - 1;
    }
  }
  // The row the missing ones hang from, when there is one: a source paginating
  // by cursor ("the 50 before this one") needs a row to count from, and an
  // index is not that — rows can be inserted while the list is being read.
  const itemBefore = getItemAt(askEnd + 1);
  const itemAfter = getItemAt(askStart - 1);
  store.useRequestMissing(
    askStart,
    askEnd,
    {
      before:
        itemBefore === undefined ? undefined : idOf(itemBefore, askEnd + 1),
      after:
        itemAfter === undefined ? undefined : idOf(itemAfter, askStart - 1),
    },
    windowFrom,
    windowTo,
  );

  // Where the sentence goes when rows are missing: on the row the user is
  // looking at, clamped to the rows that are actually missing. Putting it at
  // the top of the failed range would put it off screen as often as not — a
  // range asked for counting back from the end (the very first ask, before the
  // count is known) does not even have a row of its own to sit on.
  // Where rows were asked for and never came: the whole run of them becomes one
  // band, which says it once instead of once per row — and holds exactly the
  // room those rows had, so nothing above or below moves and the scrollbar does
  // not jump. What it says is stuck to the top of the band: as long as any part
  // of the hole is on screen, the sentence is too, without a callout floating
  // away from what it is about.
  const failureFrom =
    store.failure === null
      ? -1
      : store.failure.start < 0 || store.failure.start < windowFrom
        ? windowFrom
        : store.failure.start;
  const failureTo =
    store.failure === null
      ? -1
      : store.failure.end < 0 || store.failure.end > windowTo - 1
        ? windowTo - 1
        : store.failure.end;
  const rows = [];
  // Rows that belong together, as the data says (a day of messages, a month of
  // games): consecutive rows sharing a group key are wrapped in one group, so
  // its label can stay on screen for as long as any of them is. The wrapper is
  // rebuilt as the window slides — a group holds the rows of its day that are
  // currently drawn, which is exactly the span its label has to survive.
  let group = null;
  const closeGroup = () => {
    if (!group) {
      return;
    }
    rows.push(
      <ListItemGroup key={`${ownerId}_group_${group.key}`} label={group.label}>
        {group.children}
      </ListItemGroup>,
    );
    group = null;
  };
  const pushRow = (rowKey, rowNode, item, rowIndex) => {
    const groupKey =
      groupBy && item !== undefined ? groupBy(item, rowIndex) : undefined;
    if (groupKey === undefined) {
      closeGroup();
      rows.push(rowNode);
      return;
    }
    if (!group || group.key !== groupKey) {
      closeGroup();
      group = {
        key: groupKey,
        label: renderGroupLabel ? renderGroupLabel(item, rowIndex) : groupKey,
        children: [],
      };
    }
    group.children.push(rowNode);
  };
  // The room held for this run's own rows that the window leaves out. It
  // belongs to the run and not to the list: a list is not necessarily made of
  // one run, and what sits before or after it (a header, rows given one by
  // one) is not virtualized at all.
  if (windowFrom > runStart) {
    rows.push(
      <VirtualFiller
        key="navi-list-filler-before"
        edge="before"
        itemCount={windowFrom - runStart}
        virtualItemSize={virtualItemSize}
      />,
    );
  }
  let rowIndex = windowFrom;
  while (rowIndex < windowTo) {
    if (rowIndex >= failureFrom && rowIndex <= failureTo) {
      closeGroup();
      const failedRowCount = failureTo - rowIndex + 1;
      rows.push(
        <li
          key={`${ownerId}_failure_${failureFrom}`}
          className="navi_list_failed_rows"
          style={{
            "--size-to-fill": `${failedRowCount * virtualItemSize}px`,
          }}
        >
          {renderError ? (
            renderError({
              error: store.failure.error,
              retry: store.retry,
              start: store.failure.start,
              end: store.failure.end,
            })
          ) : (
            <ListItemsFailure error={store.failure.error} retry={store.retry} />
          )}
        </li>,
      );
      rowIndex = failureTo + 1;
      continue;
    }
    const item = getItemAt(rowIndex);
    const key =
      item === undefined
        ? `${ownerId}_skeleton_${rowIndex}`
        : idOf(item, rowIndex);
    let rowVnode;
    if (item !== undefined) {
      rowVnode = renderItem(item, rowIndex);
    } else if (renderRowSkeleton === false) {
      // The row must still take its room: without it the rows below would
      // climb up and slide back down as the answer arrives.
      rowVnode = <ListItem skeleton style={SKELETON_HIDDEN_STYLE} />;
    } else if (renderRowSkeleton) {
      rowVnode = renderRowSkeleton(rowIndex);
    } else {
      rowVnode = <ListItem skeleton />;
    }
    if (rowVnode) {
      if (separator && rowIndex > 0) {
        pushRow(
          `${key}_separator`,
          cloneElement(resolveSeparatorVnode(separator, rowIndex - 1), {
            key: `${key}_separator`,
          }),
          item,
          rowIndex,
        );
      }
      pushRow(
        key,
        <ListRowContext.Provider
          key={key}
          value={
            item === undefined
              ? { id: key, index: rowIndex, ...skeletonRow }
              : { id: key, index: rowIndex, item }
          }
        >
          {rowVnode}
        </ListRowContext.Provider>,
        item,
        rowIndex,
      );
    }
    rowIndex++;
  }
  closeGroup();
  if (runEnd > windowTo) {
    rows.push(
      <VirtualFiller
        key="navi-list-filler-after"
        edge="after"
        itemCount={runEnd - windowTo}
        virtualItemSize={virtualItemSize}
      />,
    );
  }
  return rows;
};
List.Items = ListItems;

// What is drawn where rows were asked for and never came: the sentence and the
// way out, in the row itself — the rest of the list is fine, so replacing all
// of it (List's own `error`) would be a lie.
const ListItemsFailure = ({ error, retry }) => {
  return (
    <Box
      as="div"
      role="presentation"
      baseClassName="navi_list_item navi_list_error"
    >
      <span className="navi_list_error_icon" aria-hidden="true">
        ⚠
      </span>
      <span className="navi_list_item_error_message">
        {error && error.message ? error.message : naviI18n("list.rows_failed")}
      </span>
      <button
        type="button"
        className="navi_list_item_error_dismiss"
        onClick={retry}
      >
        {naviI18n("list.rows_retry")}
      </button>
    </Box>
  );
};

// How many rows a run keeps in memory before it starts dropping the ones it is
// not about to draw, and how many it keeps on either side of the window when it
// does. Sized so that a normal back-and-forth around what is on screen never
// hits the network again.
const ITEM_STORE_MAX_DEFAULT = 1000;
const ITEM_STORE_KEEP_AROUND = 250;

// The rows a run has, and how it gets more. Two shapes behind one reader: the
// caller holds them (items/count/itemStart), or the run asked for them and
// keeps what came back — a page saying where it lands and how many rows there
// are in all is enough to place it, so the pages need not be contiguous nor
// arrive in order.
const useItemStore = ({ count, itemsAction, memoryBudget }) => {
  const pagesRef = useRef(null);
  if (!pagesRef.current) {
    pagesRef.current = { byIndex: new Map(), count: undefined };
  }
  const pages = pagesRef.current;
  const [, setPageVersion] = useState(0);
  // The one request in flight, with the means to call it off: a page asked for
  // a window the list has left is work the server and the browser are doing for
  // nothing.
  const requestRef = useRef({
    busy: false,
    start: -1,
    end: -1,
    held: -1,
    controller: null,
    generation: 0,
  });
  // The rows asked for that never came. Kept as a range so the list can say
  // where the hole is, and cleared by a retry — which is what makes the same
  // range askable again (see the request memory just above).
  const [failure, setFailure] = useState(null);

  const virtual = useContext(ListVirtualContext);
  // Before the first answer a run does not know how many rows it stands for.
  // It stands for a windowful of them: a list that is about to be filled looks
  // like rows on their way, not like an empty list.
  const rowCount = pages.count ?? count ?? virtual.renderBudget;

  const store = {
    rowCount,
    failure,
    // JS memory is cheap next to the DOM, but a long enough scroll accumulates
    // everything it ever went through. Rows far from what is on screen are
    // dropped and simply asked for again if the user goes back — the same
    // trade the render window makes, one order of magnitude further out.
    forget: (windowFrom, windowTo) => {
      const budget =
        memoryBudget === undefined ? ITEM_STORE_MAX_DEFAULT : memoryBudget;
      if (!budget || pages.byIndex.size <= budget) {
        return;
      }
      const keepFrom = windowFrom - ITEM_STORE_KEEP_AROUND;
      const keepTo = windowTo + ITEM_STORE_KEEP_AROUND;
      for (const index of pages.byIndex.keys()) {
        if (index < keepFrom || index > keepTo) {
          pages.byIndex.delete(index);
        }
      }
    },
    retry: () => {
      const request = requestRef.current;
      request.start = -1;
      request.end = -1;
      request.held = -1;
      setFailure(null);
    },
    getItem: (index) => pages.byIndex.get(index),
    eachHeld: (visit) => {
      for (const [index, item] of pages.byIndex) {
        visit(item, index);
      }
    },
    holds: (index) => pages.byIndex.has(index),
    useRequestMissing: (
      missingStart,
      missingEnd,
      cursor,
      windowFrom,
      windowTo,
    ) => {
      // The very first ask has nothing to go on: the run does not even know
      // how many rows there are, so it asks for the rows the list would open
      // on — counting back from the end when that is where it opens, the way
      // an HTTP range does.
      const budget = virtual.renderBudget;
      let start = missingStart;
      let end = missingEnd;
      let around;
      if (pages.count === undefined) {
        const scrolled = virtual.scrolled;
        if (scrolled === "end") {
          // Counting back from the end, the way an HTTP range does: a list
          // opening on its last rows asks for them before it knows how many
          // there are.
          start = -budget;
          end = -1;
        } else if (scrolled && scrolled.id !== undefined) {
          // The list cannot say where that row is — that is the whole point of
          // naming it — so it asks for it by name and reads back where it
          // landed (see the page's own `start`).
          start = 0;
          end = budget - 1;
          around = scrolled.id;
        } else {
          const first =
            typeof scrolled === "number"
              ? scrolled - Math.floor(budget / 2)
              : 0;
          start = first < 0 ? 0 : first;
          end = start + budget - 1;
        }
      }
      useLayoutEffect(() => {
        if (start === -1) {
          return;
        }
        if (virtual.holdPending && pages.count !== undefined) {
          return;
        }
        const request = requestRef.current;
        if (request.busy) {
          // Still worth waiting for as long as what it went to fetch is still
          // what the list would draw. Once it is not, it is called off — and
          // whatever comes back anyway is kept all the same (see done): paid
          // for, and maybe useful when the user comes back this way.
          // A range counted back from the end (the very first ask) says
          // nothing the window can be compared to: it is what the list is
          // waiting for to exist at all.
          const stillWanted =
            request.start < 0 ||
            request.end < 0 ||
            (request.start <= windowTo && request.end >= windowFrom);
          if (stillWanted) {
            return;
          }
          console.info(
            `[abort] request ${request.start}..${request.end} window ${windowFrom}..${windowTo}`,
          );
          request.controller?.abort();
          request.busy = false;
        }
        const held = pages.byIndex.size;
        // Asking again for a range that was already asked for, having received
        // nothing since, can only produce the same answer.
        if (
          request.start === start &&
          request.end === end &&
          request.held === held
        ) {
          return;
        }
        request.start = start;
        request.end = end;
        request.held = held;
        request.generation++;
        const generation = request.generation;
        const controller = new AbortController();
        request.controller = controller;
        const range = {
          start,
          end,
          around,
          limit: end - start + 1,
          before: cursor.before,
          after: cursor.after,
          count: pages.count,
          signal: controller.signal,
        };
        request.busy = true;
        const done = (page) => {
          const current = generation === request.generation;
          if (current) {
            request.busy = false;
            setFailure(null);
          }
          if (!page) {
            return;
          }
          const pageItems = Array.isArray(page) ? page : page.items;
          const pageStart = Array.isArray(page) ? 0 : (page.start ?? 0);
          const pageCount = Array.isArray(page)
            ? pageItems.length
            : (page.count ?? pageStart + pageItems.length);
          let i = 0;
          while (i < pageItems.length) {
            pages.byIndex.set(pageStart + i, pageItems[i]);
            i++;
          }
          pages.count = pageCount;
          virtual.pagesSignal.value = virtual.pagesSignal.peek() + 1;
          setPageVersion((version) => version + 1);
        };
        const failed = (error) => {
          if (generation !== request.generation || controller.signal.aborted) {
            // Called off on purpose: not a failure, and nothing to say about it.
            return;
          }
          request.busy = false;
          setFailure({ start, end, error });
        };
        let result;
        try {
          result = itemsAction(range);
        } catch (e) {
          failed(e);
          return;
        }
        if (result && typeof result.then === "function") {
          result.then(done, failed);
        } else {
          done(result);
        }
      });
    },
  };
  return store;
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
