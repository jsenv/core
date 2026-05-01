import {
  getElementSignature,
  getScrollContainer,
  pickPositionRelativeTo,
  scrollIntoViewScoped,
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

import { useAction } from "../../action/use_action.js";
import { useActionStatus } from "../../action/use_action_status.js";
import { useExecuteAction } from "../../action/use_execute_action.js";
import { Box } from "../../box/box.jsx";
import { shortcutsViaOnKeyDown } from "../../keyboard/keyboard_shortcuts.js";
import { useDebugScroll } from "../../navi_debug.jsx";
import {
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
} from "../../utils/custom_event.js";
import { useAutoFocus } from "../../utils/focus/use_auto_focus.js";
import { useItemTracker } from "../../utils/item_tracker/use_item_tracker.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import { useActionEvents } from "../use_action_events.js";
import {
  ParentUIStateControllerContext,
  useUIStateController,
} from "../use_ui_state_controller.js";
import { forwardActionRequested } from "../validation/custom_constraint_validation.js";
import { useConstraints } from "../validation/hooks/use_constraints.js";

const ListItemTrackerContext = createContext(null);
const GroupItemTrackerContext = createContext(null);
const PendingScrollRefContext = createContext(null);

export const ListIdContext = createContext();

// Provided by ListInteractive to give descendants (e.g. Suggestion) access
// to hover/keyboard-pointed/selection state.
// Values are item IDs (strings) or null — not indices — so they survive
// index changes caused by search reordering.
const ListMousePointedIdContext = createContext(null);
const ListKeyboardPointedIdContext = createContext(null);
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
    --x-border-radius: var(--list-border-radius);
    --x-border-width: var(--list-border-width);
    --x-border-color: var(--list-border-color);
    --x-border-style: var(--list-border-style);
    --x-background-color: var(--list-background-color);
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

    width: fit-content;
    max-width: 100%;
    max-height: var(--list-max-height);
    background-color: var(--x-background-color);
    border: var(--x-border-width) var(--x-border-style) var(--x-border-color);
    border-radius: var(--x-border-radius);
    transition: opacity 0.2s ease;
    overflow: auto;
    overscroll-behavior: inherit; /* inherit select behavior */

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
    &[data-callout] {
      --x-border-color: var(--callout-color);
      --x-outline-color: var(--callout-color);
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
    box-sizing: border-box;
    min-width: 100%;
    padding: var(--list-item-padding);
    color: var(--x-color);
    font-weight: var(--x-font-weight);
    background-color: var(--x-background-color);
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

  /* Virtual scroll fillers — must remain invisible.
     The browser may briefly flash them during scroll before the render window
     updates, so giving them a visible background would cause visual glitches. */
  .navi_list_virtual_filler {
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
    &[navi-default] {
      display: inline;
      padding: var(--list-item-padding);
      color: light-dark(#888, #aaa);
      font-size: 0.9em;
      text-align: center;
      user-select: none;
    }
    &[hidden] {
      display: none;
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
    &[data-hidden-while-empty]:not(:has([navi-list-item-real])) {
      display: none;
    }

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
      margin: 0;
      padding: 0;
      list-style: none;

      /* Items inside a group must account for the sticky group label height
         on top of the list's global header/scroll-padding spacing. */
      .navi_list_item {
        scroll-margin-top: calc(
          var(--x-list-scroll-spacing-top) + var(--list-group-label-height, 0px)
        );
      }
    }
  }

  .navi_list_select_placeholder {
    height: 0;
    padding-block: 0;
    line-height: 0;
    overflow: hidden;
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
  const ref = props.ref || refDefault;

  return <ListDispatcher {...props} ref={ref} />;
};
const ListDispatcher = (props) => {
  const alreadyInteractive = useContext(ListInteractiveContext);
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  if (!alreadyInteractive && props.action) {
    return <ListWithAction {...props} />;
  }
  if (!alreadyInteractive && (props.uiAction || parentUIStateController)) {
    return <ListInteractive {...props} />;
  }
  if (props.popover === true) {
    return <ListWithPopover {...props} />;
  }
  if (props.keyboardInteractions) {
    return <ListWithKeyboardInteractions {...props} />;
  }
  return <ListUI {...props} />;
};
const ListUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    renderBudget = RENDER_BUDGET_DEFAULT,
    listId,
    listRole,
    fallback = "Aucun élément dans cette liste",
    noMatchFallback = "Aucun élément ne correspond à cette recherche",
    separator,
    children,
    popover,
    expandX,
    maxHeight,
    onListVisibleItemsChange,
    virtualItemHeight,
    lockSize,
    searchText,
    name,
    value,
    required,
    ...rest
  } = props;

  const hiddenInputId = useId();

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

  const ulRef = useRef(null);
  const {
    virtualItemHeightSignal,
    renderWindow,
    scrollToItem,
    pendingScrollRef,
  } = useListScrollSync({
    ref,
    ulRef,
    tracker,
    renderBudget,
    virtualItemHeight,
    searchText,
  });

  const renderList = (listProps) => {
    const listIdDefault = useId();
    const innerListid = listId || listIdDefault;

    return (
      <UnorderedList
        ref={ulRef}
        id={innerListid}
        role={listRole}
        fallback={fallback}
        noMatchFallback={noMatchFallback}
        searchText={searchText}
        separator={separator}
        expandX={expandX}
        {...listProps}
        tracker={tracker}
        renderWindow={renderWindow}
        virtualItemHeightSignal={virtualItemHeightSignal}
      >
        <PendingScrollRefContext.Provider value={pendingScrollRef}>
          <ListIdContext.Provider value={innerListid}>
            {children}
          </ListIdContext.Provider>
        </PendingScrollRefContext.Provider>
      </UnorderedList>
    );
  };
  const renderListMemoized = useCallback(renderList, [
    listId,
    listRole,
    fallback,
    noMatchFallback,
    searchText,
    separator,
    expandX,
    renderWindow,
    children,
  ]);

  const inputRef = useRef(null);
  const remainingProps = useConstraints(inputRef, rest, { disabled: !name });

  return (
    <Box
      {...remainingProps}
      ref={ref}
      baseClassName="navi_list_container"
      popover={popover}
      data-expand-x={expandX ? "" : undefined}
      expandX={expandX}
      maxHeight={maxHeight}
      styleCSSVars={LIST_STYLE_CSS_VARS}
      pseudoClasses={LIST_PSEUDO_CLASSES}
      hasChildFunction
      data-navi-value={value || undefined}
      data-input-proxy={name ? `#${CSS.escape(hiddenInputId)}` : undefined}
      onnavi_list_request_nav={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        // navi_list_nav is dispatched by scrollToItem after the scroll
        // completes (including the async path via pendingScrollRef).
        scrollToItem(item, {
          reason: "navi_list_request_nav",
          event: e.detail.event,
        });
      }}
      onnavi_list_request_select={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        dispatchPublicCustomEvent(e.currentTarget, "navi_list_select", {
          item,
          event: e,
        });
      }}
    >
      {name && (
        <input
          ref={inputRef}
          id={hiddenInputId}
          type="hidden"
          name={name}
          value={value}
          required={required}
          data-rendered-by=".navi_list_container"
        />
      )}
      {renderListMemoized}
    </Box>
  );
};
const useListScrollSync = ({
  ref,
  ulRef,
  tracker,
  renderBudget,
  virtualItemHeight,
  searchText,
}) => {
  const debugScroll = useDebugScroll();
  const virtualItemHeightSignal = useVirtualItemHeightSignal(
    ulRef,
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

    const srollItemIntoView = (itemEl) => {
      const trigger = `"${event.type}" on ${getElementSignature(event.target)} (${reason})`;
      const block = event.type === "keydown" ? "nearest" : "center";
      const scrollToItemCall = `${getElementSignature(itemEl)}.scrollIntoView({ block: "${block}", container: "nearest" })`;
      debugScroll(`${trigger} -> ${scrollToItemCall}`);
      scrollIntoViewScoped(itemEl, {
        container: ref.current,
        block,
      });
      const listContainerEl = ref.current;
      dispatchPublicCustomEvent(listContainerEl, "navi_list_nav", {
        event,
        item,
      });
    };

    const { start, end } = renderWindowRef.current;
    const isInWindow = index >= start && index < end;
    if (isInWindow) {
      const itemEl = document.getElementById(item.id);
      if (itemEl) {
        srollItemIntoView(itemEl);
        return;
      }
    }
    // Not in DOM — shift the render window. The item will read
    // pendingScrollRef on mount and call scrollIntoViewWithStickyAwareness,
    // then call onScrolled so we can dispatch navi_list_scroll.
    pendingScrollRef.current = {
      id: item.id,
      resolve: (itemEl) => {
        pendingScrollRef.current = null;
        srollItemIntoView(itemEl);
      },
    };
    const half = Math.floor(renderBudget / 2);
    const newStart = Math.max(0, index - half);
    const newEnd = newStart + renderBudget;
    updateRenderWindow(newStart, newEnd, `item to scroll out of render window`);
  };

  const currentScrollRef = useRef(null);
  const updateCurrentScroll = () => {
    const listContainerEl = ref.current;
    const currentScrollLeft = listContainerEl.scrollLeft;
    const currentScrollTop = listContainerEl.scrollTop;
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
  // Scroll to the selected item when the list is first presented on screen.
  // Skipped when inside a closed <dialog>/<details> (scrollIntoView is a no-op
  // on hidden elements); re-runs automatically every time the ancestor opens.
  useDisplayedLayoutEffect(
    ref,
    (el, openEvent) => {
      updateCurrentScroll();
      const items = tracker.itemsSignal.peek();
      const firstSelected = items.find((i) => i.selected);
      if (firstSelected) {
        scrollToItem(firstSelected, {
          event: openEvent,
          reason: "scroll to selected",
        });
      } else {
        scrollToItem(items[0], {
          event: new CustomEvent("navi_list_nav_top_on_displayed", {
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
    const listContainerEl = ref.current;

    if (!searchText) {
      // no search -> try to restore scroll position
      topMatchScoresKeyRef.current = "";
      const savedScroll = savedScrollRef.current;
      if (!savedScroll) {
        // nothing to restore
        return;
      }
      savedScrollRef.current = null;
      debugScroll("Restoring scroll to", savedScroll);
      updateRenderWindow(
        savedScroll.renderWindow.start,
        savedScroll.renderWindow.end,
        "restore scroll window",
      );
      requestAnimationFrame(() => {
        const left = savedScroll.left;
        const top = savedScroll.top;
        // use scrollTo to respect eventual css scroll-behavior: smooth;
        debugScroll(
          `restore scroll: ${getElementSignature(listContainerEl)}.scrollTo({ left: ${left}, top: ${top} })`,
        );
        listContainerEl.scrollTo({
          left: savedScroll.left,
          top: savedScroll.top,
        });
        // The reliable way to restore scroll is to use scrollTop because otherwise we will estimate the item to scroll
        // based on virtual item height which can wrongly restore the scroll.
        // However we have a contract with outside to inside which item is scrolled
        // (used by keyboard nav to enable anchoring the item for list item nav with arrow keys)
        // so we do our best to give that item back
        const { item } = getScrollInfo(
          { scrollTop: savedScroll.top },
          listContainerEl,
          tracker,
          virtualItemHeightSignal,
          renderWindowRef,
        );
        dispatchPublicCustomEvent(listContainerEl, "navi_list_nav", {
          item,
          event: new CustomEvent("navi_scroll_restore"),
        });
      });
    }

    // During search -> watch for changes in the top items or their scores.
    const visibleItems = tracker.visibleItemsSignal.peek();
    const topItems = visibleItems.slice(0, renderBudget);
    const topMatchScoresKey = topItems
      .map((i) => `${i.id}:${i.matchScore ?? ""}`)
      .join(",");
    const currentTopMatchScore = topMatchScoresKeyRef.current;
    if (topMatchScoresKey === currentTopMatchScore) {
      // no changes in top matches -> no need to scroll
      return;
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
    return;
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
        { scrollTop: listContainerEl.scrollTop },
        listContainerEl,
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
    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
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
  listContainerEl,
  tracker,
  virtualItemHeightSignal,
  renderWindowRef,
) => {
  const listEl = listContainerEl.querySelector(".navi_list");
  const items = tracker.itemsSignal.peek();
  const containerRect = listContainerEl.getBoundingClientRect();
  let hitEl = null;
  let hitFiller = null;
  for (let y = containerRect.top + 1; y < containerRect.bottom; y += 4) {
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
    const firstListItem = ulEl.querySelector(REAL_LIST_ITEM_SELECTOR);
    if (!firstListItem) {
      return;
    }
    const measuredHeight = firstListItem.getBoundingClientRect().height;
    virtualHeightSignal.value = measuredHeight;
  });
  return virtualHeightSignal;
};

const LIST_STYLE_CSS_VARS = {
  maxHeight: "--list-max-height",
  borderColor: "--list-border-color",
  borderRadius: "--list-border-radius",
  borderWidth: "--list-border-width",
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
      {noMatchFallback && (
        <NoMatchFallback
          noMatchFallback={noMatchFallback}
          tracker={tracker}
          searchText={searchText}
        />
      )}
      {fallback && <Fallback fallback={fallback} tracker={tracker} />}
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
  // Show when all items are filtered out (hidden prop), or when search is
  // active but no visible item has a positive match score.
  const allHidden = itemCount > 0 && visibleItemCount === 0;
  const noneMatch = searchText && visibleItemCount > 0 && matchCount === 0;
  const showMatchFallback = allHidden || noneMatch;

  return (
    <ListItem
      role="presentation"
      className="navi_list_item navi_list_no_match_fallback"
      hidden={!showMatchFallback}
      navi-default={typeof noMatchFallback === "string" ? "" : undefined}
    >
      {allHidden
        ? "Aucun élément ne correspond à cette recherche"
        : "Aucun élément ne correspond à cette recherche. Le reste est affiché ci-dessous"}
    </ListItem>
  );
};
const Fallback = ({ tracker, fallback }) => {
  const itemCount = tracker.countSignal.value;
  const showFallback = itemCount === 0;
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
              positionTry: "bottom",
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
        dispatchPublicCustomEvent(listContainerEl, "navi_list_open", {
          event: e,
        });
      }}
      onnavi_list_request_close={(e) => {
        const listContainerEl = e.currentTarget;
        cleanupRef.current?.();
        listContainerEl.removeAttribute("data-anchor-hidden");
        listContainerEl.hidePopover();
        dispatchPublicCustomEvent(listContainerEl, "navi_list_close", {
          event: e,
        });
      }}
    />
  );
};

// Interactive variant with action: calls the action whenever a value is selected.
const ListWithAction = (props) => {
  const {
    ref,
    action,
    loading,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    uiAction,
    ...rest
  } = props;
  const boundAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });

  useActionEvents(ref, {
    onRequested: (e) => forwardActionRequested(e, boundAction),
    onAction: executeAction,
    onPrevented: onActionPrevented,
    onStart: onActionStart,
    onAbort: onActionAbort,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  const innerUiAction = (value, event) => {
    uiAction?.(value, event);
    // Dispatch action request so useActionEvents can pick it up
    if (ref && ref.current) {
      dispatchCustomEvent(ref.current, "navi_action_requested", {
        bubbles: true,
        detail: { value },
      });
    }
  };

  return (
    <List
      data-action={boundAction.name}
      {...rest}
      ref={ref}
      action={undefined}
      loading={loading || actionLoading}
      uiAction={innerUiAction}
    />
  );
};

// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol, then delegates rendering to ListUI.
const ListInteractive = (props) => {
  const uiStateController = useUIStateController(props, "list", {
    allowNameless: true,
  });
  const [mousePointedId, setMousePointedId] = useState(null);
  const [keyboardPointedId, setKeyboardPointedId] = useState(null);
  const anchorIdRef = useRef(null);
  const setAnchorId = (id) => {
    anchorIdRef.current = id;
  };

  const visibleItemsRef = useRef([]);
  const getAnchorIndex = () => {
    const anchorId = anchorIdRef.current;
    if (!anchorId) {
      return -1;
    }
    return visibleItemsRef.current.findIndex((i) => i.id === anchorId);
  };
  const getAnchorItem = () => {
    const anchorId = anchorIdRef.current;
    if (!anchorId) {
      return null;
    }
    return visibleItemsRef.current.find((i) => i.id === anchorId);
  };

  return (
    <ListInteractiveContext.Provider value={true}>
      <ListMousePointedIdContext.Provider value={mousePointedId}>
        <ListKeyboardPointedIdContext.Provider value={keyboardPointedId}>
          <List
            keyboardInteractions
            {...props}
            uiAction={undefined}
            onListVisibleItemsChange={(visibleItems) => {
              props.onListVisibleItemsChange?.(visibleItems);
              visibleItemsRef.current = visibleItems;
            }}
            onnavi_list_request_hover={(e) => {
              const { item } = e.detail;
              setMousePointedId(item ? item.id : null);
            }}
            onnavi_list_request_nav_from_current={(e) => {
              const { event = e, goal } = e.detail;
              const visibleItems = visibleItemsRef.current;
              const visibleItemCount = visibleItems.length;
              if (visibleItemCount === 0) {
                return;
              }
              const anchorIndex = getAnchorIndex();
              const isDisabledIndex = (i) => Boolean(visibleItems[i]?.disabled);
              const resolveIndex = () => {
                if (goal === "down") {
                  if (anchorIndex === -1) {
                    let i = 0;
                    while (i < visibleItemCount && isDisabledIndex(i)) {
                      i++;
                    }
                    return i < visibleItemCount ? i : anchorIndex;
                  }
                  let belowIndex = anchorIndex + 1;
                  while (
                    belowIndex < visibleItemCount &&
                    isDisabledIndex(belowIndex)
                  ) {
                    belowIndex++;
                  }
                  return belowIndex < visibleItemCount
                    ? belowIndex
                    : anchorIndex;
                }
                if (goal === "up") {
                  if (anchorIndex === -1) {
                    let i = visibleItemCount - 1;
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
                if (goal === "first") {
                  let i = 0;
                  while (i < visibleItemCount && isDisabledIndex(i)) {
                    i++;
                  }
                  return i < visibleItemCount ? i : anchorIndex;
                }
                if (goal === "last") {
                  let i = visibleItemCount - 1;
                  while (i >= 0 && isDisabledIndex(i)) {
                    i--;
                  }
                  return i >= 0 ? i : anchorIndex;
                }
                return anchorIndex;
              };
              const index = resolveIndex();
              if (index === anchorIndex) {
                return;
              }
              if (event.type === "keydown") {
                event.preventDefault();
              }
              const item = visibleItems[index];
              dispatchCustomEvent(e.currentTarget, "navi_list_request_nav", {
                event: e,
                item,
              });
            }}
            onnavi_list_request_interaction_state_reset={() => {
              setAnchorId(null);
              setKeyboardPointedId(null);
              setMousePointedId(null);
            }}
            onnavi_list_request_select_current={(e) => {
              const item = getAnchorItem();
              dispatchCustomEvent(e.currentTarget, "navi_list_request_select", {
                event: e,
                item,
              });
            }}
            onnavi_list_nav={(e) => {
              const { item, event } = e.detail;
              const id = item.id;
              if (event.type === "navi_list_nav_top_on_displayed") {
                // arrow down should focus first item for instance
                setAnchorId(null);
              } else {
                setAnchorId(id);
              }
              if (event.type === "keydown") {
                setKeyboardPointedId(id);
              } else {
                setKeyboardPointedId(null);
              }
            }}
            onnavi_list_select={(e) => {
              const { item, event } = e.detail;
              const id = item.id;
              setAnchorId(id);
              if (event.type === "keydown") {
                setKeyboardPointedId(id);
              } else {
                setKeyboardPointedId(null);
              }
              const value = item.value;
              uiStateController.setUIState(value, event);
            }}
          />
        </ListKeyboardPointedIdContext.Provider>
      </ListMousePointedIdContext.Provider>
    </ListInteractiveContext.Provider>
  );
};

const ListWithKeyboardInteractions = (props) => {
  const { autoFocus, autoFocusPreventScroll } = props;
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;

  const onKeyDown = shortcutsViaOnKeyDown(
    {
      arrowdown: (e) => {
        return requestListNavFromCurrent(e.currentTarget, {
          event: e,
          goal: "down",
        });
      },
      arrowup: (e) => {
        return requestListNavFromCurrent(e.currentTarget, {
          event: e,
          goal: "up",
        });
      },
      home: (e) => {
        return requestListNavFromCurrent(e.currentTarget, {
          event: e,
          goal: "first",
        });
      },
      end: (e) => {
        return requestListNavFromCurrent(e.currentTarget, {
          event: e,
          goal: "last",
        });
      },
      enter: (e) => {
        return requestListSelectCurrent(e.currentTarget, {
          event: e,
        });
      },
      space: (e) => {
        e.preventDefault(); // prevent page scroll
        return requestListSelectCurrent(e.currentTarget, {
          event: e,
        });
      },
      escape: (e) => {
        return requestListInteractionStateReset(e.currentTarget, {
          event: e,
        });
      },
    },
    props.onKeyDown,
  );
  useAutoFocus(ref, autoFocus, { preventScroll: autoFocusPreventScroll });

  return (
    <List
      {...props}
      ref={ref}
      keyboardInteractions={undefined}
      tabIndex="0"
      onKeyDown={onKeyDown}
      autoFocus={undefined} // See use_auto_focus.js
      autoFocusPreventScroll={undefined}
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
  let { id, value, hidden, selected, matchScore, disabled, index, ...rest } =
    props;
  if (id === undefined) {
    console.warn(
      "ListItem is missing an explicit id prop. Provide a stable id so pointed/selected state survives search reordering.",
      { value },
    );
  }
  if (index === undefined) {
    console.warn(
      "ListItem is missing an explicit index prop. Provide an index so item ordering is stable regardless of render order.",
      { value },
    );
  }
  const idDefault = useId();
  id = id || idDefault;
  const renderWindow = useContext(RenderWindowContext);
  const tracker = useContext(ListItemTrackerContext);
  const item = {
    id,
    index,
    hidden,
    value,
    selected,
    matchScore,
    disabled,
  };
  const visibleIndex = tracker.useTrackItem(item);
  const groupTracker = useContext(GroupItemTrackerContext);
  const groupVisibleIndex = groupTracker
    ? groupTracker.useTrackItem(item)
    : null;
  const separator = useContext(SeparatorContext);

  if (hidden) {
    return null;
  }
  if (visibleIndex === -1) {
    return null;
  }
  if (visibleIndex < renderWindow.start || visibleIndex >= renderWindow.end) {
    return <ListItemVoid />;
  }
  const listItemVnode = (
    <ListItemReal
      id={id}
      value={value}
      item={item}
      selected={selected}
      disabled={disabled}
      {...rest}
    />
  );
  // Use group-scoped visible index for separator when inside a group,
  // so separators are only rendered between items within the same group.
  const separatorIndex =
    groupVisibleIndex !== null ? groupVisibleIndex : visibleIndex;
  if (!separator || separatorIndex === 0) {
    return listItemVnode;
  }

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
const ListItemReal = ({
  id,
  hidden,
  highlight,
  selected,
  disabled,
  item,
  pointed,
  children,
  ...rest
}) => {
  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;
  const isInteractive = useContext(ListInteractiveContext);
  const mousePointedId = useContext(ListMousePointedIdContext);
  const keyboardPointedId = useContext(ListKeyboardPointedIdContext);
  const pendingScrollRef = useContext(PendingScrollRefContext);

  const isPointedByMouse = id === mousePointedId;
  const isPointedByKeyboard = id === keyboardPointedId;
  const isPointedByProxy = Boolean(pointed);
  const isPointed = isPointedByMouse || isPointedByKeyboard || isPointedByProxy;
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
  // highlight can be:
  //   - an array of [start, end] pairs — applied to all text nodes under itemEl
  //   - an object { [domSelector]: [[start, end], …] } — applied to each
  //     matching sub-element found by the selector (from createSearch)
  useLayoutEffect(() => {
    const hl = getNaviSearchHighlight();
    if (!hl) {
      return undefined;
    }
    const itemEl = ref.current;
    if (!itemEl || !highlight) {
      return undefined;
    }

    // Normalise highlight to { rootOrSelector: ranges[] } entries.
    // Flat array → single entry scoped to the whole item element.
    const entries = Array.isArray(highlight)
      ? highlight.length === 0
        ? []
        : [{ root: itemEl, ranges: highlight }]
      : Object.entries(highlight).map(([selector, ranges]) => ({
          root: itemEl.querySelector(selector) ?? itemEl,
          ranges,
        }));

    if (entries.length === 0) {
      return undefined;
    }

    const ownRanges = [];
    for (const { root, ranges } of entries) {
      // Collect text nodes under root and their cumulative offsets so that
      // [start, end] ranges (character positions in the field string) map
      // directly to the correct text node positions without re-searching.
      const textNodes = [];
      let totalLength = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        textNodes.push({ node, offset: totalLength });
        totalLength += node.textContent.length;
      }
      for (const [start, end] of ranges) {
        for (const { node: textNode, offset: nodeOffset } of textNodes) {
          const nodeEnd = nodeOffset + textNode.textContent.length;
          if (nodeEnd <= start || nodeOffset >= end) {
            continue;
          }
          const rangeStart = start - nodeOffset;
          const rangeEnd = end - nodeOffset;
          const range = new Range();
          range.setStart(textNode, rangeStart < 0 ? 0 : rangeStart);
          range.setEnd(
            textNode,
            rangeEnd > textNode.textContent.length
              ? textNode.textContent.length
              : rangeEnd,
          );
          hl.add(range);
          ownRanges.push(range);
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
      id={id}
      navi-list-item-real=""
      data-interactive={isInteractive ? "" : undefined}
      data-anchor={isPointedByKeyboard ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      onMouseEnter={(e) => {
        if (disabled) {
          return;
        }
        const listContainerEl = e.currentTarget.closest(".navi_list_container");
        dispatchCustomEvent(listContainerEl, "navi_list_request_hover", {
          item,
          event: e,
        });
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (disabled) {
          return;
        }
        const listContainerEl = e.currentTarget.closest(".navi_list_container");
        dispatchCustomEvent(listContainerEl, "navi_list_request_hover", {
          item: null,
          event: e,
        });
        rest.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        if (disabled) {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        const listContainerEl = e.currentTarget.closest(".navi_list_container");
        dispatchCustomEvent(listContainerEl, "navi_list_request_select", {
          item,
          event: e,
        });
        rest.onMouseDown?.(e);
      }}
      {...rest}
      ref={ref}
      basePseudoState={{
        ...rest.basePseudoState,
        ":disabled": Boolean(disabled),
        ":-navi-pointed": isPointed,
        ":-navi-pointed-by-mouse": isPointedByMouse,
        ":-navi-pointed-by-keyboard": isPointedByKeyboard,
        ":-navi-pointed-by-proxy": isPointedByProxy,
        ":-navi-selected": selected,
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
      const scrollContainer = getScrollContainer(headerEl);
      const headerHeight = headerEl.getBoundingClientRect().height;
      scrollContainer.style.setProperty(
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
      const scrollContainer = getScrollContainer(headerEl);
      const headerHeight = headerEl.getBoundingClientRect().height;
      scrollContainer.style.setProperty(
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

export const requestListNavFromCurrent = (
  listContainerElement,
  { event, goal },
) => {
  return dispatchCustomEvent(
    listContainerElement,
    "navi_list_request_nav_from_current",
    {
      event,
      goal,
    },
  );
};
export const requestListSelectCurrent = (listContainerElement, { event }) => {
  return dispatchCustomEvent(
    listContainerElement,
    "navi_list_request_select_current",
    {
      event,
    },
  );
};
export const requestListInteractionStateReset = (
  listContainerElement,
  { event },
) => {
  return dispatchCustomEvent(
    listContainerElement,
    "navi_list_request_interaction_state_reset",
    {
      event,
    },
  );
};
export const requestListOpen = (listContainerElement, { event, anchor }) => {
  return dispatchCustomEvent(listContainerElement, "navi_list_request_open", {
    event,
    anchor,
  });
};
export const requestListClose = (listContainerElement, { event }) => {
  return dispatchCustomEvent(listContainerElement, "navi_list_request_close", {
    event,
  });
};
