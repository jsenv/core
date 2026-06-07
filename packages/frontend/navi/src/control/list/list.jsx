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

import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { Separator } from "../../layout/separator.jsx";
import { useDebugScroll } from "../../navi_debug.jsx";
import { naviI18n } from "../../text/navi_i18n.js";
import { useItemTracker } from "../../utils/item_tracker/use_item_tracker.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import { useSearchHighlight } from "./search_highlight.js";

const ListItemTrackerContext = createContext(null);
const GroupItemTrackerContext = createContext(null);
const PendingScrollRefContext = createContext(null);

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
// Carries the separator element/function down to each ListItem so separators
// are only rendered between items that actually mount (post-filter, post-window).
const SeparatorContext = createContext(null);

const css = /* css */ `
  @layer navi {
    .navi_list_container {
      --list-outline-width: 1px;
      --list-border-radius: 4px;
      --list-border-width: 1px;
      --list-border-color: light-dark(#ccc, #555);
      --list-background-color: light-dark(#fff, #1e1e1e);
      --list-max-height: 220px;
    }
    .navi_list_item {
      --list-item-padding-x: 0px;
      --list-item-padding-y: 0px;
      --list-item-padding: var(--list-item-padding-y) var(--list-item-padding-x);
      --list-item-color: inherit;
      --list-item-font-weight: inherit;
      --list-item-background-color: transparent;

      /* Highlight (CSS Highlight API match) */
      --list-item-color-highlight: inherit;
      --list-item-background-color-highlight: #ffe066;

      /* Here to be overridable by box layout props such as flex */
      display: inline-block;
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

    display: flex;
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
      max-width: inherit;
      max-height: var(--list-max-height);
      overflow: auto;
      overscroll-behavior: inherit; /* inherit select behavior */
    }

    &[data-expand-x] {
      width: 100%;
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
    display: flex;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    flex-direction: column;
    list-style: none;
    outline: none; /*  Focus is displayed on the container */

    /* Would create scrollbars, for now just hide the loader here */
    .navi_input {
      .navi_loading_rectangle_wrapper {
        display: none;
      }
    }
  }

  .navi_list_item {
    --x-list-item-color: var(--list-item-color);
    --x-list-item-background-color: var(--list-item-background-color);
    --x-list-item-font-weight: var(--list-item-font-weight);

    box-sizing: border-box;
    min-width: 100%;
    padding: var(--list-item-padding);
    color: var(--x-list-item-color);
    font-weight: var(--x-list-item-font-weight);
    background-color: var(--x-list-item-background-color);
    /*
    CSS impossible d'obtenir un layout qui ferait en gros:
    width = max(min(max-content, 100%), unbreakable-content)
    Donc 3 options:
    - Laisser le contenu overflow
      - moche, background ne suit pas
      -> NOPE
    - Force overflow hidden + ellipsis
      - casse la lisibilité des mots insécables
      - possible d'optin en utilisant overflowEllipsis sur le ListItem
      -> Bien mais pas par défaut
    - Forcer le retour a la ligne des mot inécables
      - Aucun des inconvénient ci dessus 
      -> Comportement par défaut
    */
    overflow-wrap: anywhere;
    /* When list has sticky header/footer, put a scroll padding */
    scroll-margin-top: var(--x-list-scroll-spacing-top);
    scroll-margin-bottom: var(--x-list-scroll-spacing-bottom);
  }

  /* Virtual scroll fillers — must remain invisible.
     The browser may briefly flash them during scroll before the render window
     updates, so giving them a visible background would cause visual glitches. */
  .navi_list_virtual_filler {
    display: inline-block;
    height: 0px;
    list-style: none;
    /* background: pink; */
  }

  /* Empty state — hidden by default, shown when no list items are rendered.
     order: 1 pushes fallbacks after all regular items in flex column layout.
     The list children are open-ended (headers, presentation items, real items),
     so we cannot control where the consumer places the fallback nodes in the DOM.
     Using order ensures fallbacks always appear after items regardless of DOM order.
     matchFallback intentionally shares the same order as fallback so it appears
     at the same visual position — after an input if present but before any items
     still displayed (non-matching items remain in DOM with hidden prop):
       1. Input (sticky header, order: -2)
       2. matchFallback (order: -1)
       3. hidden items (regular order, after DOM flow)
       4. HOT FIX OF THE DEAD for bottom filler + preact issue: order: 1
       5. sticky footer (order: 2)
  */
  /* order: 0 keeps the header pinned before fallbacks (order: 1) in flex order,
     ensuring the header (e.g. a search input) always appears above them. */
  .navi_list_item_header {
    position: sticky;
    top: 0;
    z-index: 1;
    order: -2;
  }
  .navi_list_fallback,
  .navi_list_no_match_fallback {
    order: -1;
    color: light-dark(#888, #aaa);
    &[navi-default] {
      display: inline;
      padding: var(--list-item-padding);
      text-align: center;
      user-select: none;
    }
  }
  [navi-virtual-filler="bottom"] {
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
      }
    }

    &[data-hidden-while-empty]:not(:has([navi-list-item-real])) {
      display: none;
    }
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
 *   fallback             — content shown when no items exist at all
 *   matchFallback         — content shown when items exist but all are hidden (e.g. no search match)
 *   separator            — element or function(index, { previousItem, currentItem }) inserted between visible items
 *   lockSize             — when true, captures the container's dimensions on first render
 *                          (always in unfiltered state). Those values become min-width/
 *                          min-height so filtering cannot collapse the layout.
 *   ...rest              — forwarded to the outer scroll container <Box>
 */
export const List = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const idDefault = useId();
  props.id = props.id || idDefault;
  const listVnode = <ListUI {...props} />;
  return listVnode;
};
const ListUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    renderBudget = RENDER_BUDGET_DEFAULT,
    renderBudgetSkipCheck,
    role,
    fallback,
    noMatchFallback,
    separator,
    children,
    popover,
    expandX,
    expand,
    maxHeight,
    onListVisibleItemsChange,
    virtualItemHeight,
    lockSize,
    searchText,
    ...rest
  } = props;
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
    virtualItemHeightSignal,
    renderWindow,
    scrollToItem,
    pendingScrollRef,
  } = useListScrollSync({
    ref,
    tracker,
    renderBudget,
    virtualItemHeight,
    searchText,
  });

  const getItemById = (itemId) => {
    return tracker.itemsSignal.peek().find((item) => item.id === itemId);
  };

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_list_container"
      popover={popover}
      data-expand-x={expandX || expand ? "" : undefined}
      expandX={expandX}
      expand={expand}
      maxHeight={maxHeight}
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
        noMatchFallback={noMatchFallback}
        searchText={searchText}
        separator={separator}
        expandX={expandX}
        expand={expand}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemHeightSignal={virtualItemHeightSignal}
        pendingScrollRef={pendingScrollRef}
      >
        {children}
      </ListContent>
    </Box>
  );
};
const ListContent = ({
  role,
  fallback,
  noMatchFallback,
  searchText,
  separator,
  expandX,
  expand,
  tracker,
  renderWindow,
  virtualItemHeightSignal,
  pendingScrollRef,
  children,
}) => {
  const listProps = useContext(BoxForwardedPropsContext);
  return (
    <div className="navi_list_scroll_container">
      <UnorderedList
        role={role}
        fallback={fallback}
        noMatchFallback={noMatchFallback}
        searchText={searchText}
        separator={separator === true ? <Separator margin="0" /> : separator}
        expandX={expandX || expand}
        {...listProps}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemHeightSignal={virtualItemHeightSignal}
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
  borderColor: "--list-border-color",
  borderRadius: "--list-border-radius",
  borderWidth: "--list-border-width",
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
  virtualItemHeight,
  searchText,
}) => {
  const debugScroll = useDebugScroll();
  const virtualItemHeightSignal = useVirtualItemHeightSignal(
    ref,
    virtualItemHeight,
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
      const firstSelected = items.find((i) => i.selected);
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
      const raf = requestAnimationFrame(() => {
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
          { scrollTop: savedScroll.top },
          listScrollContainerEl,
          tracker,
          virtualItemHeightSignal,
          renderWindowRef,
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
      return () => {
        cancelAnimationFrame(raf);
      };
    }
    const visibleItems = tracker.visibleItemsSignal.peek();
    const topItems = visibleItems.slice(0, renderBudget);
    const topMatchScoresKey = topItems
      .map((i) => `${i.id}:${i.matchScore ?? ""}`)
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
        { scrollTop: listScrollContainerEl.scrollTop },
        listScrollContainerEl,
        tracker,
        virtualItemHeightSignal,
        renderWindowRef,
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
    virtualItemHeightSignal,
    renderWindow,
    pendingScrollRef,
    scrollToItem,
  };
};
// Returns the item located at the current scroll position of a list container.
// Uses DOM hit-testing to find visible items/fillers; falls back to index
// estimation via virtualItemHeight or renderWindow.start.
// Returns { index, item, reason } or null if nothing can be determined.
const getScrollInfo = (
  { scrollTop },
  listScrollContainerEl,
  tracker,
  virtualItemHeightSignal,
  renderWindowRef,
) => {
  const listEl = listScrollContainerEl.querySelector(".navi_list");
  const items = tracker.itemsSignal.peek();
  const containerRect = listScrollContainerEl.getBoundingClientRect();
  let hitEl = null;
  let hitFiller = null;
  // Start scanning from the vertical center of the viewport rather than the top.
  // The render window places half its budget above and half below the hit index.
  // Anchoring to the center maximises how many rendered items fall within the
  // visible area: starting from the top would waste the "above" budget on items
  // already scrolled past, leaving the bottom of the viewport uncovered.
  // For large lists where renderBudget >> visible item count this never matters
  // in practice (the window always covers the whole viewport), but it is
  // strictly better and costs nothing.
  const scanStartY = (containerRect.top + containerRect.bottom) / 2;
  for (let y = scanStartY; y < containerRect.bottom; y += 4) {
    const el = document.elementFromPoint(containerRect.left + 1, y);
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
    const virtualItemHeight = virtualItemHeightSignal.peek();
    if (virtualItemHeight === 0) {
      return null;
    }
    const estimatedIndex = Math.floor(scrollTop / virtualItemHeight);
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

const useVirtualItemHeightSignal = (ref, virtualItemHeightProp = 0) => {
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
    const listEl = ref.current?.querySelector(".navi_list");
    if (!listEl) {
      return;
    }
    const firstListItem = listEl.querySelector(REAL_LIST_ITEM_SELECTOR);
    if (!firstListItem) {
      return;
    }
    const measuredHeight = firstListItem.getBoundingClientRect().height;
    virtualHeightSignal.value = measuredHeight;
  });
  return virtualHeightSignal;
};

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
  noMatchFallback,
  searchText,
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
      <NoMatchFallback
        noMatchFallback={noMatchFallback}
        tracker={tracker}
        searchText={searchText}
      />
      <Fallback fallback={fallback} tracker={tracker} />
      <RenderWindowContext.Provider value={renderWindow}>
        <SeparatorContext.Provider value={separator ?? null}>
          <ListItemTrackerContext.Provider value={tracker}>
            {children}
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

const NoMatchFallback = ({ tracker, noMatchFallback, searchText }) => {
  const itemCount = tracker.countSignal.value;
  const visibleItemCount = tracker.visibleCountSignal.value;
  const matchCount = tracker.matchCountSignal.value;
  // Show when all items are filtered out (filtered prop), or when search is
  // active but no visible item has a positive match score.
  const allHidden = itemCount > 0 && visibleItemCount === 0;
  const noneMatch = searchText && visibleItemCount > 0 && matchCount === 0;
  const showMatchFallback = allHidden || noneMatch;

  if (noMatchFallback === undefined) {
    noMatchFallback = allHidden
      ? naviI18n("list.no_match")
      : naviI18n("list.no_match_rest_shown");
  }

  return (
    <ListItem
      role="presentation"
      className="navi_list_item navi_list_no_match_fallback"
      hidden={!showMatchFallback}
      navi-default={typeof noMatchFallback === "string" ? "" : undefined}
    >
      {noMatchFallback}
    </ListItem>
  );
};
const Fallback = ({ tracker, fallback }) => {
  const itemCount = tracker.countSignal.value;
  const showFallback = itemCount === 0;
  if (fallback === undefined) {
    fallback = naviI18n("list.empty");
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
  const visibleItemCount = tracker.visibleCountSignal.value;
  const virtualItemHeight = virtualItemHeightSignal.value;
  const numberOfItemsBelow = Math.max(visibleItemCount - renderWindowEnd, 0);
  const heightToFillBelow = numberOfItemsBelow * virtualItemHeight;

  return (
    <li
      className="navi_list_virtual_filler"
      // eslint-disable-next-line react/no-unknown-property
      navi-virtual-filler="bottom"
      aria-hidden
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
 *   filtered  — when true, item is excluded from visible count and removed from DOM entirely
 *   hidden    — when true, item is excluded from visible count (no virtual scroll height)
 *               but stays in DOM with the native HTML hidden attribute
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
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  const { ref, id, hidden, highlight, children, ...rest } = props;
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

  // CSS Highlight API: mark matching text ranges when highlight prop is set.
  useSearchHighlight(ref, highlight, [children, hidden]);

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
      index={undefined}
      selected={undefined}
      matchScore={undefined}
      hidden={hidden}
      ref={ref}
    >
      {children}
    </Box>
  );
};
const LIST_ITEM_STYLE_CSS_VARS = {
  "paddingX": "--list-item-padding-x",
  "paddingY": "--list-item-padding-y",
  "padding": "--list-item-padding",
  "color": "--list-item-color",
  "backgroundColor": "--list-item-background-color",
  "fontWeight": "--list-item-font-weight",
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
export const LIST_ITEM_PSEUDO_CLASSES = [];
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
      const labelHeight = labelEl.getBoundingClientRect().height;
      groupEl.style.setProperty(
        "--list-group-label-height",
        `${labelHeight}px`,
      );
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

export const ListItemHeader = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  useDisplayedLayoutEffect(
    ref,
    (headerEl) => {
      const listContainerEl = headerEl.closest(".navi_list_container");
      const headerHeight = headerEl.getBoundingClientRect().height;
      listContainerEl.style.setProperty(
        "--list-header-height",
        `${headerHeight}px`,
      );
    },
    [],
  );

  return (
    <ListItem
      {...props}
      ref={ref}
      role="presentation"
      baseClassName="navi_list_item_header"
    />
  );
};

export const ListItemFooter = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  useDisplayedLayoutEffect(
    ref,
    (headerEl) => {
      const listContainerEl = headerEl.closest(".navi_list_container");
      const headerHeight = headerEl.getBoundingClientRect().height;
      listContainerEl.style.setProperty(
        "--list-footer-height",
        `${headerHeight}px`,
      );
    },
    [],
  );

  return (
    <ListItem
      {...props}
      ref={ref}
      role="presentation"
      baseClassName="navi_list_item_footer"
    />
  );
};
