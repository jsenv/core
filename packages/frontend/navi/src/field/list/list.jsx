import {
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
  getElementSignature,
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

import { Box } from "../../box/box.jsx";
import { shortcutsViaOnKeyDown } from "../../keyboard/keyboard_shortcuts.js";
import { Separator } from "../../layout/separator.jsx";
import { useDebugScroll } from "../../navi_debug.jsx";
import { naviI18n } from "../../text/navi_i18n.js";
import { useAutoFocus } from "../../utils/focus/use_auto_focus.js";
import { useItemTracker } from "../../utils/item_tracker/use_item_tracker.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import { useActionProps } from "../use_action_props.jsx";
import {
  ParentUIStateControllerContext,
  SelectTriggerContentRegistryContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "../use_ui_state_controller.js";
import { useOnNaviConstraintMessage } from "../validation/constraint_message.js";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { useConstraints } from "../validation/hooks/use_constraints.js";
import { useSearchHighlight } from "./search_highlight.js";

const ListItemTrackerContext = createContext(null);
const GroupItemTrackerContext = createContext(null);
const PendingScrollRefContext = createContext(null);

export const ListIdContext = createContext();
export const InsideRealListItemContext = createContext(false);

// Provided by ListInteractive to give descendants (e.g. Suggestion) access
// to hover/keyboard-pointed/selection state.
// Values are item IDs (strings) or null — not indices — so they survive
// index changes caused by search reordering.
const ListMousePointedIdContext = createContext(null);
const ListKeyboardPointedIdContext = createContext(null);
// Non-null when inside a ListInteractive (used to render data-interactive).
const ListInteractiveContext = createContext(false);

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
      --list-outline-color: var(--navi-focus-outline-color);
      --list-border-color: light-dark(#ccc, #555);
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

      /* Pointed by mouse — subtle, just a shade above background */
      --list-item-color-mouse-pointed: var(--list-item-color);
      --list-item-background-color-mouse-pointed: light-dark(#ebebeb, #303030);

      /* Pointed by keyboard — subtle light blue highlight */
      --list-item-color-keyboard-pointed: var(--list-item-color);
      --list-item-background-color-keyboard-pointed: light-dark(
        #c2dcff,
        #1c3a6e
      );

      /* Selected — vivid blue accent */
      --list-item-color-selected: light-dark(#ffffff, #ffffff);
      --list-item-background-color-selected: light-dark(#1a73e8, #2b5fcc);

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
    --x-list-outline-width: calc(
      var(--list-outline-width) + var(--list-border-width)
    );
    --x-list-outline-offset: calc(-1 * var(--list-border-width));
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
    width: fit-content;
    max-width: 100%;
    flex-direction: column;
    background-color: var(--x-list-background-color);
    border: var(--x-list-border-width) solid var(--x-list-border-color);
    border-radius: var(--x-list-border-radius);
    outline-width: var(--x-list-outline-width);
    outline-color: var(--x-list-outline-color);
    outline-offset: var(--x-list-outline-offset);
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

    &[data-focus] {
      /* outline: var(--list-outline-width) solid var(--navi-focus-outline-color);
      outline-offset: calc(-1 * var(--list-outline-width)); */
    }
    &[data-focus-visible] {
      outline-style: solid;
    }

    &[data-callout] {
      --x-list-border-color: var(--callout-color);
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

    &[data-interactive] {
      cursor: pointer;
      user-select: none;
    }
    &[data-pointed] {
      --x-list-item-color: var(--list-item-color-mouse-pointed);
      --x-list-item-background-color: var(
        --list-item-background-color-mouse-pointed
      );
    }
    &[data-selected] {
      --x-list-item-color: var(--list-item-color-selected);
      --x-list-item-background-color: var(
        --list-item-background-color-selected
      );
      &[data-pointed] {
        /* Here important should no beed need, but for some reason it is */
        --x-list-item-background-color: var(
          --list-item-background-color-selected,
          var(--list-item-background-color-mouse-pointed)
        ) !important;
      }
    }
    &[data-disabled] {
      --x-list-item-color: var(--list-item-color-disabled);
      --x-list-item-background-color: var(
        --list-item-background-color-disabled
      );
      cursor: default;
      pointer-events: none;
    }
    &[data-readonly] {
      --x-list-item-color: var(--list-item-color-disabled);
      cursor: default;
    }
  }
  .navi_list_container {
    &[data-focus-within] {
      .navi_list_item {
        &[data-pointed-by-keyboard] {
          --x-list-item-color: var(--list-item-color-keyboard-pointed);
          --x-list-item-background-color: var(
            --list-item-background-color-keyboard-pointed
          );
        }

        /* Selected must win over pointed-by-keyboard */
        &[data-selected] {
          --x-list-item-color: var(--list-item-color-selected);
          --x-list-item-background-color: var(
            --list-item-background-color-selected
          );
          /* Selected + pointed by keyboard: use keyboard color as fallback
           so that if --list-item-background-color-selected is reset the
           keyboard-pointed highlight still shows. */
          &[data-pointed-by-keyboard] {
            --x-list-item-background-color: var(
              --list-item-background-color-selected,
              var(--list-item-background-color-keyboard-pointed)
            );
          }
        }
      }
    }
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
    &[navi-default] {
      display: inline;
      padding: var(--list-item-padding);
      color: light-dark(#888, #aaa);
      font-size: 0.9em;
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
  if (
    !alreadyInteractive &&
    (props.action || props.uiAction || parentUIStateController)
  ) {
    return <ListWithAction {...props} />;
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
    id,
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
    name,
    value,
    required,
    ...rest
  } = props;

  if (renderBudget < 30) {
    console.warn(
      `List: renderBudget=${renderBudget} is too low. A renderBudget below 30 is not supported: on large screens or when the list grows, items outside the window would appear as blank space instead of rendered content. Use a value of at least 30, or omit the prop to use the default (${RENDER_BUDGET_DEFAULT}).`,
    );
  }

  const hiddenInputId = useId();

  // lockSize: capture the container's dimensions on first render so filtering
  // cannot collapse the layout. Measurement happens on the initial (unfiltered)
  // state because the parent controls hidden props before any search is applied.
  const containerRef = useRef(null);
  const sizeLocked = useRef(false);
  useDisplayedLayoutEffect(
    containerRef,
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
    containerRef,
    ref,
    tracker,
    renderBudget,
    virtualItemHeight,
    searchText,
  });

  const idDefault = useId();
  const innerId = id || idDefault;

  const renderList = (listProps) => {
    return (
      <div className="navi_list_scroll_container">
        <UnorderedList
          ref={ref}
          id={innerId}
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
            <ListIdContext.Provider value={innerId}>
              {children}
            </ListIdContext.Provider>
          </PendingScrollRefContext.Provider>
        </UnorderedList>
      </div>
    );
  };
  const renderListMemoized = useCallback(renderList, [
    innerId,
    role,
    fallback,
    noMatchFallback,
    searchText,
    separator,
    expandX,
    expand,
    renderWindow,
    children,
  ]);

  const inputRef = useRef(null);
  const remainingProps = useConstraints(inputRef, rest, { disabled: !name });

  return (
    <Box
      {...remainingProps}
      ref={containerRef}
      baseClassName="navi_list_container"
      popover={popover}
      data-field={name ? `#${CSS.escape(hiddenInputId)}` : undefined}
      data-expand-x={expandX || expand ? "" : undefined}
      expandX={expandX}
      expand={expand}
      maxHeight={maxHeight}
      styleCSSVars={LIST_STYLE_CSS_VARS}
      pseudoClasses={LIST_PSEUDO_CLASSES}
      pseudoStateSelector=".navi_list"
      hasChildFunction
      data-navi-value={value || undefined}
      onnavi_list_request_scroll={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        scrollToItem(item, {
          event: e,
          reason: "navi_request_scroll",
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
  ":-navi-has-value",
  ":-navi-expanded",
];
const useListScrollSync = ({
  containerRef,
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
      const block = event.type === "keydown" ? "nearest" : "center";
      const scrollToItemCall = `${getElementSignature(itemEl)}.scrollIntoView({ block: "${block}", container: "nearest" })`;
      const listScrollContainerEl = containerRef.current.querySelector(
        `.navi_list_scroll_container`,
      );
      debugScroll(`${trigger} -> ${scrollToItemCall}`);
      scrollIntoViewScoped(itemEl, {
        container: listScrollContainerEl,
        block,
      });
      dispatchPublicCustomEvent(listEl, "navi_list_scroll", {
        event,
        item,
      });
    };

    // Dispatch navi_list_nav immediately — do not wait for scroll to complete.
    const listEl = ref.current;
    dispatchPublicCustomEvent(listEl, "navi_list_nav", {
      event,
      item,
    });

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
    const listContainerEl = containerRef.current;
    const listScrollContainerEl = listContainerEl.querySelector(
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
  // Scroll to the selected item when the list is first presented on screen.
  // Skipped when inside a closed <dialog>/<details> (scrollIntoView is a no-op
  // on hidden elements); re-runs automatically every time the ancestor opens.
  useDisplayedLayoutEffect(
    containerRef,
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
    const listContainerEl = containerRef.current;
    if (!listContainerEl) {
      return;
    }
    const listScrollContainerEl = listContainerEl.querySelector(
      `.navi_list_scroll_container`,
    );
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
          `restore scroll: ${getElementSignature(listScrollContainerEl)}.scrollTo({ left: ${left}, top: ${top} })`,
        );
        listScrollContainerEl.scrollTo({
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
          listScrollContainerEl,
          tracker,
          virtualItemHeightSignal,
          renderWindowRef,
        );
        const listEl = ref.current;
        dispatchPublicCustomEvent(listEl, "navi_list_nav", {
          item,
          event: new CustomEvent("navi_scroll_restore"),
        });
      });
      return;
    }
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
    const listContainerEl = containerRef.current;
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
    const listEl = ref.current;
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
      ? "Aucun élément ne correspond à cette recherche."
      : "Aucun élément ne correspond à cette recherche. Le reste est affiché ci-dessous";
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
    fallback = "Aucun élément dans cette liste.";
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
        const listEl = e.currentTarget;
        const listContainerEl = listEl.closest(".navi_list_container");
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
        dispatchPublicCustomEvent(listEl, "navi_list_open", {
          event: e,
        });
      }}
      onnavi_list_request_close={(e) => {
        const listEl = e.currentTarget;
        const listContainerEl = listEl.closest(".navi_list_container");
        cleanupRef.current?.();
        listContainerEl.removeAttribute("data-anchor-hidden");
        listContainerEl.hidePopover();
        dispatchPublicCustomEvent(listEl, "navi_list_close", {
          event: e,
        });
      }}
    />
  );
};

// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol. When an action is provided it binds the action to ui state
// and fires it on select. When only uiAction is provided it calls it directly.
const ListWithAction = (props) => {
  const uiStateController = useUIStateController(props, "list", {
    allowNameless: true,
  });
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <ListWithActionInner {...props} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const ListWithActionInner = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);

  const remainingProps = useActionProps(props);

  // Mouse/keyboard pointed state
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

  const listVnode = (
    <List
      {...remainingProps}
      keyboardInteractions
      action={undefined}
      uiAction={undefined}
      value={uiState}
      onListVisibleItemsChange={(visibleItems) => {
        props.onListVisibleItemsChange?.(visibleItems);
        visibleItemsRef.current = visibleItems;
      }}
      onnavi_list_nav={(e) => {
        const { item, event } = e.detail;
        const id = item ? item.id : null;
        const isNonUserNav =
          event.type === "navi_list_nav_top_on_displayed" ||
          event.type === "navi_list_top_match_change";
        if (isNonUserNav) {
          setAnchorId(null);
        } else {
          setAnchorId(id);
        }
        if (event.type === "keydown") {
          setKeyboardPointedId(id);
        } else {
          setKeyboardPointedId(null);
        }
        const isAutomaticNav =
          event.type === "navi_list_nav_top_on_displayed" ||
          event.type === "navi_list_top_match_change" ||
          event.type === "navi_scroll_restore";
        if (item && !isAutomaticNav) {
          uiStateController.setUIState(item.value, event);
        }
      }}
      // Dispatch action request on select
      onnavi_list_select={(e) => {
        const listEl = e.currentTarget;
        const item = e.detail?.item;
        const requester = item
          ? listEl.querySelector(`#${CSS.escape(item.id)}`)
          : e.target;
        const resolvedRequester = requester || e.target;
        dispatchRequestAction(listEl, {
          event: e,
          requester: resolvedRequester,
        });
      }}
      onnavi_list_request_nav={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        if (item.id === anchorIdRef.current) {
          return;
        }
        const isFailed = item.disabled || item.readOnly;
        if (isFailed) {
          return;
        }
        const listEl = e.currentTarget;
        dispatchCustomEvent(listEl, "navi_list_request_scroll", {
          event: e,
          item,
        });
      }}
      onnavi_list_request_select={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        const listEl = e.currentTarget;
        dispatchCustomEvent(listEl, "navi_list_request_nav", {
          event: e,
          item,
        });
        dispatchPublicCustomEvent(listEl, "navi_list_select", {
          item,
          event: e,
        });
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
        const isSkippedIndex = (i) =>
          Boolean(visibleItems[i]?.disabled || visibleItems[i]?.readOnly);
        const resolveIndex = () => {
          if (goal === "down") {
            if (anchorIndex === -1) {
              let i = 0;
              while (i < visibleItemCount && isSkippedIndex(i)) {
                i++;
              }
              return i < visibleItemCount ? i : anchorIndex;
            }
            let belowIndex = anchorIndex + 1;
            while (
              belowIndex < visibleItemCount &&
              isSkippedIndex(belowIndex)
            ) {
              belowIndex++;
            }
            return belowIndex < visibleItemCount ? belowIndex : anchorIndex;
          }
          if (goal === "up") {
            if (anchorIndex === -1) {
              let i = visibleItemCount - 1;
              while (i >= 0 && isSkippedIndex(i)) {
                i--;
              }
              return i >= 0 ? i : anchorIndex;
            }
            let aboveIndex = anchorIndex - 1;
            while (aboveIndex >= 0 && isSkippedIndex(aboveIndex)) {
              aboveIndex--;
            }
            return aboveIndex >= 0 ? aboveIndex : anchorIndex;
          }
          if (goal === "first") {
            let i = 0;
            while (i < visibleItemCount && isSkippedIndex(i)) {
              i++;
            }
            return i < visibleItemCount ? i : anchorIndex;
          }
          if (goal === "last") {
            let i = visibleItemCount - 1;
            while (i >= 0 && isSkippedIndex(i)) {
              i--;
            }
            return i >= 0 ? i : anchorIndex;
          }
          return anchorIndex;
        };
        const index = resolveIndex();
        if (index === anchorIndex) {
          if (event.type === "keydown") {
            event.preventDefault();
          }
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
    />
  );

  return (
    <ListInteractiveContext.Provider value={true}>
      <ListMousePointedIdContext.Provider value={mousePointedId}>
        <ListKeyboardPointedIdContext.Provider value={keyboardPointedId}>
          {listVnode}
        </ListKeyboardPointedIdContext.Provider>
      </ListMousePointedIdContext.Provider>
    </ListInteractiveContext.Provider>
  );
};

// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol, then delegates rendering to ListUI.
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
  let {
    id,
    value,
    filtered,
    hidden,
    selected,
    matchScore,
    disabled,
    readOnly,
    index,
    ...rest
  } = props;
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
    filtered,
    hidden,
    value,
    selected,
    matchScore,
    disabled,
    readOnly,
  };
  const visibleIndex = tracker.useTrackItem(item);
  const groupTracker = useContext(GroupItemTrackerContext);
  const groupVisibleIndex = groupTracker
    ? groupTracker.useTrackItem(item)
    : null;
  const separator = useContext(SeparatorContext);

  if (filtered) {
    return null;
  }
  // html-hidden items: excluded from virtual scroll accounting but always in DOM
  if (hidden) {
    return (
      <ListItemReal
        id={id}
        value={value}
        item={item}
        selected={selected}
        disabled={disabled}
        readOnly={readOnly}
        hidden={hidden}
        {...rest}
      />
    );
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
      readOnly={readOnly}
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
  readOnly,
  readOnlyMessage,
  item,
  pointed,
  children,
  ...rest
}) => {
  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;
  const onNaviConstraintMessage = useOnNaviConstraintMessage({
    readOnlyMessage,
  });
  const isInteractive = useContext(ListInteractiveContext);
  const mousePointedId = useContext(ListMousePointedIdContext);
  const keyboardPointedId = useContext(ListKeyboardPointedIdContext);
  const pendingScrollRef = useContext(PendingScrollRefContext);
  const registerTriggerContent = useContext(
    SelectTriggerContentRegistryContext,
  );

  useLayoutEffect(() => {
    if (!registerTriggerContent) {
      return;
    }
    if (selected) {
      registerTriggerContent(children);
    }
  }, [selected, children, registerTriggerContent]);

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
  useSearchHighlight(ref, highlight, [children, hidden]);

  return (
    <Box
      as="li"
      baseClassName="navi_list_item"
      styleCSSVars={LIST_ITEM_STYLE_CSS_VARS}
      pseudoClasses={LIST_ITEM_PSEUDO_CLASSES}
      pseudoElements={LIST_ITEM_PSEUDO_ELEMENTS}
      aria-selected={selected}
      aria-disabled={disabled ? true : undefined}
      id={id}
      navi-list-item-real=""
      data-interactive={isInteractive ? "" : undefined}
      data-anchor={isPointedByKeyboard ? "" : undefined}
      data-required-message={naviI18n(`list_item.readonly`, { item })}
      {...rest}
      hidden={hidden}
      ref={ref}
      onMouseEnter={(e) => {
        if (disabled) {
          return;
        }
        const listEl = e.currentTarget.closest(".navi_list");
        dispatchCustomEvent(listEl, "navi_list_request_hover", {
          item,
          event: e,
        });
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (disabled) {
          return;
        }
        const listEl = e.currentTarget.closest(".navi_list");
        dispatchCustomEvent(listEl, "navi_list_request_hover", {
          item: null,
          event: e,
        });
        rest.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        if (disabled) {
          return;
        }
        if (readOnly) {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        const listEl = e.currentTarget.closest(".navi_list");
        dispatchCustomEvent(listEl, "navi_list_request_select", {
          item,
          event: e,
        });
        rest.onMouseDown?.(e);
      }}
      onnavi_list_item_request_select={(e) => {
        if (readOnly) {
          return;
        }
        const listEl = e.currentTarget.closest(".navi_list");
        dispatchCustomEvent(listEl, "navi_list_request_select", {
          item,
          event: e.detail.event || e,
        });
      }}
      onnavi_constraint_message={onNaviConstraintMessage}
      basePseudoState={{
        ":disabled": Boolean(disabled),
        ":read-only": Boolean(readOnly),
        ":-navi-pointed": isPointed,
        ":-navi-pointed-by-mouse": isPointedByMouse,
        ":-navi-pointed-by-keyboard": isPointedByKeyboard,
        ":-navi-pointed-by-proxy": isPointedByProxy,
        ":-navi-selected": selected,
        ...rest.basePseudoState,
      }}
    >
      <InsideRealListItemContext.Provider value={true}>
        {children}
      </InsideRealListItemContext.Provider>
    </Box>
  );
};
const LIST_ITEM_STYLE_CSS_VARS = {
  "padding": "--list-item-padding",
  "color": "--list-item-color",
  "backgroundColor": "--list-item-background-color",
  "fontWeight": "--list-item-font-weight",
  ":-navi-pointed-by-keyboard": {
    color: "--list-item-color-keyboard-pointed",
    backgroundColor: "--list-item-background-color-keyboard-pointed",
  },
  ":-navi-pointed-by-mouse": {
    color: "--list-item-color-mouse-pointed",
    backgroundColor: "--list-item-background-color-mouse-pointed",
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
const LIST_ITEM_PSEUDO_CLASSES = [
  ":-navi-pointed",
  ":-navi-pointed-by-mouse",
  ":-navi-pointed-by-keyboard",
  ":-navi-pointed-by-proxy",
  ":-navi-selected",
  ":disabled",
  ":read-only",
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

export const requestListNavFromCurrent = (listEl, { event, goal }) => {
  return dispatchCustomEvent(listEl, "navi_list_request_nav_from_current", {
    event,
    goal,
  });
};
export const requestListSelectCurrent = (listEl, { event }) => {
  return dispatchCustomEvent(listEl, "navi_list_request_select_current", {
    event,
  });
};
export const requestListItemSelect = (itemEl, { event } = {}) => {
  return dispatchCustomEvent(itemEl, "navi_list_item_request_select", {
    event,
  });
};
export const requestListInteractionStateReset = (listEl, { event }) => {
  return dispatchCustomEvent(
    listEl,
    "navi_list_request_interaction_state_reset",
    {
      event,
    },
  );
};
export const requestListOpen = (listEl, { event, anchor }) => {
  return dispatchCustomEvent(listEl, "navi_list_request_open", {
    event,
    anchor,
  });
};
export const requestListClose = (listEl, { event }) => {
  return dispatchCustomEvent(listEl, "navi_list_request_close", {
    event,
  });
};
