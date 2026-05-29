import { dispatchCustomEvent } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useId, useRef } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "../../resolver/resolver.jsx";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";

export const ListIdContext = createContext();

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
    width: fit-content;
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
  const listVnode = renderList(ListUI, props);
  return listVnode;
};
const ListWithPopoverResolver = (props) => {
  const Next = useNextResolver();
  return <Next {...props} />;
};
const renderList = createComponentResolver([ListWithPopoverResolver]);

const ListUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    id,
    role,
    children,
    popover,
    expandX,
    expand,
    maxHeight,
    ...rest
  } = props;
  const containerRef = useRef(null);
  useDisplayedLayoutEffect(containerRef, () => {
    const listEl = ref.current;
    console.log(listEl.dispatchEvent);
  }, [ref]);
  const idDefault = useId();
  const innerId = id || idDefault;

  return (
    <Box
      {...rest}
      ref={containerRef}
      baseClassName="navi_list_container"
      popover={popover}
      data-expand-x={expandX || expand ? "" : undefined}
      expandX={expandX}
      expand={expand}
      maxHeight={maxHeight}
      styleCSSVars={LIST_STYLE_CSS_VARS}
      pseudoClasses={LIST_PSEUDO_CLASSES}
    >
      <Box
        as="ul"
        ref={ref}
        id={innerId}
        role={role}
        expandX={expandX || expand}
        // {...listProps}
        baseClassName="navi_list"
      >
        {children}
      </Box>
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
  ":-navi-expanded",
];

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
  const idDefault = useId();
  props.id = props.id || idDefault;
  const { children, id, index, hidden, filtered, selected, value, ...rest } =
    props;
  return (
    <li id={props.id} {...rest}>
      {children}
    </li>
  );
};

export const LIST_ITEM_PSEUDO_CLASSES = [];

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
        {children}
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
