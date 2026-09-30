import {
  canScroll,
  dispatchPublicCustomEvent,
  getElementSignature,
  getScrollContainer,
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

// Imported for its side effect: it is what writes navi-scrolling on whatever
// scrolls, which the CSS below reads.
import "../../utils/scroll_activity.js";
import { afterPaint } from "../../utils/after_paint.js";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { isLikelyPreactGeneratedId } from "../../nav/browser_integration/document_state_signal.js";
import {
  forgetScrollerUnlessPageLeft,
  holdDocumentScroll,
  recallScrollerPosition,
  rememberScrollerPosition,
} from "../../nav/browser_integration/scroll_restoration.js";
import { LoadingIndicator } from "../../graphic/loading/loading_indicator.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { openCallout } from "../rules/callout/callout.js";
import { findControlHost, isControlRoot } from "../control_dom.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import { Separator } from "../../layout/separator.jsx";
import { useDebugScroll } from "../../navi_debug.jsx";
import { naviI18n } from "../../text/navi_i18n.js";
import { Text } from "../../text/text.jsx";
import { withPropsClassName } from "../../utils/with_props_class_name.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import { getUIStateControllerById } from "../controller_registry.js";
import { ParallelGuardContext, useParallelGuard } from "../parallel_guard.js";
import { ListItemHeaderOrFooterResolver } from "./list_item_header_footer.jsx";
import { createListItems } from "./list_items.js";
import { listItemBlockedMessage } from "./list_item_blocked_message.js";
import {
  ListItemSelectableResolver,
  ListSelectableResolver,
} from "./list_selectable.jsx";
import { useSearchHighlight } from "./search_highlight.js";

// Everything the list knows about its items — see list_items.js. Filled in by
// the children as they render, read by everything that must reserve room for
// what is not rendered, count what is, or know what stands above it.
const ListItemsContext = createContext(null);
// The group an item is declared in, by id (see ListItemGroup): what its count
// and its separator are scoped to.
const ListGroupContext = createContext(undefined);
const PendingScrollRefContext = createContext(null);
// Controls how List.Item behaves when match=false (set via List searchNoMatchMode prop):
//   "remove"              — remove from DOM (default)
//   "invisible_and_inert" — keep in DOM, invisible and non-interactive (preserves layout, no content visible)
//   "muted"               — keep in DOM, visible but opacified and still interactive
const SearchNoMatchModeContext = createContext("remove");

// How much of the items a run draws (see ListItems) the list puts in the DOM at
// once: the render window [start, end), which slides as the user scrolls. Said
// with a unit, since items do not all weigh the same: "100item" is a count,
// "300px" and "150%" (of the box that scrolls the list) are sizes, and the
// window then holds whatever number of items that size takes — a few cards, a
// few dozen one-line items (see evaluateWindow). Items declared one by one
// (<List.Item>) are all drawn, whatever the budget.
const RENDER_BUDGET_DEFAULT = { value: 100, unit: "item" };
// The items of the very first commit when what it is to hold is a size:
// nothing is laid out yet to measure one with. A few are drawn to be measured,
// and the window is sized on the screen before the browser paints.
const FIRST_WINDOW_ITEM_COUNT = 3;
// How many items a run asks its source for at a time (see List.Items'
// `pageSize`): a page is what the network is asked for, which the screen does
// not decide.
const PAGE_SIZE_DEFAULT = 100;
// An item drawn by the list carries its index in it: what the render window
// reads its geometry from (see readWindowGeometry).
const LIST_ITEM_INDEX_ATTRIBUTE = "navi-list-item-index";

// Attribute used on <li> elements rendered by ListItemReal so the scroll listener
// and filler-height calculation can find real items without matching presentation ones.
const REAL_LIST_ITEM_SELECTOR = `[navi-list-item-real]`;
// Items standing in for content that has not arrived (see List's renderSkeleton).
const SKELETON_LIST_ITEM_CLASS = "navi_list_item_skeleton";

// Carries the render window {start, end} from List down to the runs of items
// inside it (see ListItems): a run draws the items it frames and holds the room
// of the others.
const RenderWindowContext = createContext(null);
// Carries List's own `itemColumns` prop (a grid-template-columns value, e.g.
// "1fr auto auto") down to each ListItem/filler/fallback so they can render
// as a subgrid row instead of a flex row — see ListItem's own use of this
// context, and List's own `itemColumns` doc, for the full rationale (table-like
// column sizing that stays correct across a virtualized, windowed item set).
// List's own `columns` never reaches here: it lays the items themselves into
// the track's columns, and an item then occupies a cell like anything else.
const ListItemColumnsContext = createContext(null);
// Carries the separator element/function down to each ListItem so separators
// are only rendered between items that actually mount (post-filter, post-window).
const SeparatorContext = createContext(null);
// Set by <List itemTransition>: each item then gets a view-transition-name of
// its own, so a change wrapped in a view transition animates item by item.
const ItemTransitionContext = createContext(false);
// Set around each item a run renders (see ListItems): which item of the
// collection it is, where it stands among the items the list holds, and which
// run it belongs to. Carried by context rather than injected into whatever
// vnode renderItem returned, so that returning a component of one's own —
// instead of a bare <List.Item> — works the same way.
const ListRunItemContext = createContext(null);
// The slot a child of the list stands in, by id (see ListDeclaredChildren). An
// item takes its place in the collection by slot: the place is then the list's
// to move, and the item's to follow — see list_items.js.
const ListSlotContext = createContext(null);

const css = /* css */ `
  /* The height of a group's sticky label, written on the group once it is
     measured — as the group mounts — and read by the group's items alone (their
     scroll-margin, below). Inherited, it would be taken by every element in
     the group, and writing it would restyle all of them: a list's worth of items
     and everything inside each. Handed down the two levels that lead to the
     items instead. */
  @property --list-group-label-height {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }
  @layer navi {
    .navi_list_container {
      --list-outline-width: 1px;
      --list-border-radius: 4px;
      /* A list is a box with items in it: it says where it starts and where it
         ends. The default is on the -default var, not on --list-border-width
         itself, so that the borderWidth prop (which writes the latter inline)
         wins wherever a default is put in its way — see the popup case. */
      --list-border-width-default: 1px;
      --list-border-color: light-dark(#ccc, #555);
      --list-background-color: light-dark(#fff, #1e1e1e);

      /* A sticky part paints over the items only while it IS stuck — which is
         what --navi-z-index-sticky says it is for ("kept stuck while something
         scrolls under it"). At rest it is a block in the flow with nothing
         passing under it, and a 10 there is what slices whatever a neighbouring
         item lets out of its box: a focus ring, a badge, a stamp. See
         useStuckStickyParts for the navi-stuck attribute these read.

         With "auto" at rest, a card whose badge overflows into the label
         below it gets past it by saying z-index: 1 on that badge — a literal,
         in the card, against its own neighbour, which is what docs/z_index.md
         asks for. These variables are the escape hatch for what that cannot
         reach, not the usual answer. Mind that a negative value here is
         compared against the page: it needs a stacking context between the
         label and the nearest opaque background, or the label goes behind that
         background and disappears. */
      --list-header-z-index: auto;
      --list-header-z-index-stuck: var(--navi-z-index-sticky);
      --list-footer-z-index: auto;
      --list-footer-z-index-stuck: var(--navi-z-index-sticky);
      --list-group-label-z-index: auto;
      --list-group-label-z-index-stuck: var(--navi-z-index-sticky);
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
     already drew it, and two frames around the same items read as a box in a box
     (the Picker's list, a select's suggestions). Only the default is dropped —
     a borderWidth asked for explicitly still applies. */
  :where([popover], dialog) > .navi_list_container,
  .navi_list_container[popover] {
    --list-border-width-default: 0px;
  }

  /* Same reasoning, for the corners: a dialog squares off whatever corner
     lands on its container's own (see the data-flush-* rules in dialog.jsx —
     a sheet from dockedOnSmallTouchScreen squares the two on its edge). A list
     drawn right against that corner has to square the same one, otherwise its
     own radius carves a notch out of the popup's square corner. Direct child
     only: any deeper and the list is presumably inset from the popup's edge,
     where its own radius is the right one. */
  .navi_dialog[data-flush-top][data-flush-left] > .navi_list_container {
    border-top-left-radius: 0;
  }
  .navi_dialog[data-flush-top][data-flush-right] > .navi_list_container {
    border-top-right-radius: 0;
  }
  .navi_dialog[data-flush-bottom][data-flush-right] > .navi_list_container {
    border-bottom-right-radius: 0;
  }
  .navi_dialog[data-flush-bottom][data-flush-left] > .navi_list_container {
    border-bottom-left-radius: 0;
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
    /* fit-content by default, but never wider than the parent. A maxWidth is
       the width of the LIST — its border, its background, the box a margin
       centers — and not only of the scroll box inside it, so the cap lands
       here as well as on .navi_list_scroll_container below. */
    max-width: var(--list-max-width, 100%);
    flex-direction: column;
    background-color: var(--x-list-background-color);
    border: var(--x-list-border-width) solid var(--x-list-border-color);
    /* Squared from the outside, corner by corner: whoever draws the surface
       the list is laid on says which corners are the list's to draw (a popup's
       body does, see box.jsx), and each corner falls back to the list's own
       radius when nothing asks for anything. */
    border-top-left-radius: var(
      --x-corner-top-left-radius,
      var(--x-list-border-radius)
    );
    border-top-right-radius: var(
      --x-corner-top-right-radius,
      var(--x-list-border-radius)
    );
    border-bottom-right-radius: var(
      --x-corner-bottom-right-radius,
      var(--x-list-border-radius)
    );
    border-bottom-left-radius: var(
      --x-corner-bottom-left-radius,
      var(--x-list-border-radius)
    );

    transition: opacity 0.2s ease;
    /* overflow:hidden is required on the container (not the inner scroll element)
       so that border-radius clips the content correctly. Without it, items near
       the corners would visually overflow the rounded corners during scroll. */
    overflow: hidden;

    /* The default radius is the border's. A list asked for no border draws no
       edge, and a curve kept on it only cuts into the items sitting there — a
       grid of framed cards loses its outer corners. With no curve left, the
       clip above has nothing to do: the scroll box inside clips what scrolls. */
    &[data-borderless] {
      --x-list-border-radius: 0px;
      overflow: visible;
    }

    /* overflow="visible" asks for the exact opposite of the clipping above: the
       content must be free to paint outside the list's box and to overflow into
       whatever scroll container is around it. Setting it on the inner scroll
       element alone changes nothing visible — this frame would clip it right
       back — so the frame has to let go of it too, and with it of the rounded
       corners it was clipping to. The two cannot both be true.
       An axis asked to be visible pairs with "clip" on the other one rather
       than "hidden": mixing visible with a scrollport value makes the browser
       compute the visible one to "auto" (a scrollport again), while
       visible/clip is the one pairing it keeps as written. */
    &[data-overflow-visible="both"] {
      overflow: visible;
    }
    &[data-overflow-visible="x"] {
      overflow-x: visible;
      overflow-y: clip;
    }
    &[data-overflow-visible="y"] {
      overflow-x: clip;
      overflow-y: visible;
    }

    /* Direct child throughout: this box is the list's own scroll box (see
       ListContent), and a list holding another list would otherwise style the
       inner list's one as if it were its own. */
    > .navi_list_scroll_container {
      /* The ask stops here: this element is inside the list's frame, so an item
         or a control it holds is not at the surface's corner. */
      --x-corner-top-left-radius: initial;
      --x-corner-top-right-radius: initial;
      --x-corner-bottom-right-radius: initial;
      --x-corner-bottom-left-radius: initial;
      /* This box carries the list's padding (see LIST_PADDING_PROP_SET) while
         the sizes it takes are the sizes of the list itself: the padding has
         to fit inside them rather than grow the box past its frame. */
      box-sizing: border-box;
      width: inherit;
      min-width: inherit;
      max-width: var(--list-max-width, inherit);
      max-height: var(--list-max-height, inherit);
      overflow: auto;
      /* The list keeps its own items still (see the scroll anchoring in
         list.jsx): two of them doing it at once compensate for each other's
         compensation, and the browser's own is blind to the fillers resizing
         under it anyway. */
      overflow-anchor: none;
      overscroll-behavior: inherit; /* inherit select behavior */
      scrollbar-width: inherit;
    }

    /* Any scroller other than "self": the list does not scroll, something
       around it does. Its own scroll box must then be transparent to
       layout — otherwise it would cap the list at a height of its own and
       start a second, nested scroll inside the page's. */
    &[data-scroller] {
      max-height: none;
      overflow: visible;

      > .navi_list_scroll_container {
        max-height: none;
        overflow: visible;
      }
    }

    /* A scroll moves the items under a motionless pointer: the browser then
       fires mouseenter/mouseleave for every item crossing the cursor, and
       whoever reacts to hover (a highlight elsewhere, a prefetch, a map) pays
       for those while the scroll animation runs. Out of hit-testing, the
       browser suppresses them all — see utils/scroll_activity.js for who
       writes navi-scrolling. The scroller itself keeps its own hit-testing, so
       the wheel and the scrollbar go on reaching it. */
    &:not([navi-hover-while-scrolling])
      > .navi_list_scroll_container
      > .navi_list:is([navi-scrolling] *) {
      pointer-events: none;
    }

    /* Scrolling with the page means sticking to the viewport, and whatever the
       app puts in front of that viewport — a FixedBar, a band of its own — is
       in front of the label too: without the offset a sticky label lands behind
       it. The safe area is what that adds up to (see layout/safe_area.js) and
       it is 0px when nothing covers the top. */
    &[data-scroller="document"] {
      --x-list-group-label-top: var(--navi-safe-area-inset-top);
      --x-list-group-label-left: var(--navi-safe-area-inset-left);
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
      > .navi_list_scroll_container {
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
      max-width: 95vw;
      margin: 0;
      padding: 0;

      &:popover-open {
        display: flex;
      }
      .navi_list {
        width: 100%;
      }
    }
  }

  .navi_list {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
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
       aria-hidden (skeleton items, the loader) stay visible. */
    &[aria-hidden="true"][inert] {
      opacity: 0;
    }

    &[navi-muted] {
      opacity: 0.35;
    }

    /* An item that cannot be acted on right now (see ListItemReal): it says so
       by dimming, and stops taking clicks — including on the buttons it holds,
       which is the whole point (the item is what is read-only, not one of its
       parts). Positioned so the loading outline it may draw has a box to sit
       on. */
    /* Same inline callout as the list's own error (.navi_list_error), scoped to
       one item. The message takes the room, the way out sits at the end. */
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
      /* NOT pointer-events: none — the press has to reach the item so it can
         say why it does nothing (see ListItemReal). What the item holds is
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
  }
  /* The text of the items a filler holds the room of (List.Items findText),
     one line per item at the item size — its share of its line, in a grid: a
     match found there is where its item will be drawn. Transparent once revealed — the item drawn over that place
     is what the user sees. No display of its own: a browser without
     hidden="until-found" reads it as plain hidden and draws nothing. */
  .navi_list_find_stand_in {
    height: calc(var(--x-find-line-count) * var(--x-find-line-size));
    color: transparent;
    line-height: var(--x-find-line-size);
    white-space: pre;
    overflow: clip;
  }
  .navi_list_container[data-horizontal] {
    --list-max-height: none;

    /* The whole chain down to the track, because the axis is the axis of THIS
       list: a vertical list nested in an item of a horizontal one fills along y
       and must keep the default above. */
    > .navi_list_scroll_container > .navi_list > .navi_list_virtual_filler {
      display: flex;
      width: var(--size-to-fill, 0px);
      height: 100%;

      > .navi_list_find_stand_in {
        width: calc(var(--x-find-line-count) * var(--x-find-line-size));
        height: auto;
        flex-shrink: 0;
        writing-mode: vertical-lr;
      }
    }
  }

  /* Either of List's column props makes .navi_list a grid — Box reflects that
     as navi-box-flow="grid" (see box.jsx), which this keys off directly rather
     than threading the value through React just for this. A grid track only
     ever spans the single column it is placed in by default, so without this
     the filler — or the band of items that never came — would collapse into
     just the first column's width instead of reserving height across the
     whole row. */
  .navi_list[navi-box-flow="grid"] > .navi_list_virtual_filler,
  .navi_list[navi-box-flow="grid"] > .navi_list_failed_items {
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
    z-index: var(--list-header-z-index);
    order: -2;

    &[navi-stuck] {
      z-index: var(--list-header-z-index-stuck);
    }
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
     A skeleton item reuses <Text loading> for the shimmer bar; the loader item
     centers a spinner; a custom loadingFallback is only given an item to live in,
     its own markup does the layout. */
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
  /* The room of items that were asked for and never came (see List.Items), with
     what it says stuck to the top of it, so it is on screen for as long as the
     hole is. That room is a floor and not a height: it holds the scrollbar
     still when those items have ranks of their own, and it is nothing at all for
     a run that never received anything — the windowful it stands for is a
     placeholder, not a place, and the sentence is then the only thing with a
     size. A sentence taller than the hole grows the band rather than spilling
     over the items below it. */
  .navi_list_failed_items {
    display: block;
    min-height: var(--size-to-fill, 0px);
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
    line-height: var(--navi-line-height);
    background: light-dark(#fef2f2, rgba(127, 29, 29, 0.25));
    border: 1px solid light-dark(#fecaca, rgba(248, 113, 113, 0.4));
    border-radius: 6px;
  }
  .navi_list_error_icon {
    flex: none;
    font-size: 1em;
    line-height: var(--navi-line-height);
  }
  /* Same rule as [data-scrollable] in box.jsx, said again for this scroller:
     what an item holds IS against the edge of the scroll container — the list
     element between the two is markup, not spacing — so its loading outline
     stays inside its own box rather than raising a scrollbar. */
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
    z-index: var(--list-footer-z-index);
    order: 2;

    &[navi-stuck] {
      z-index: var(--list-footer-z-index-stuck);
    }
  }

  /* Written for the items and what they hold, never for every element: with a
     ::highlight() rule every element matches, a view transition starting
     restyles the whole document (Chrome), in the frame the page being left is
     photographed. Both selectors, for a browser without highlight
     inheritance. */
  .navi_list_item::highlight(navi-search-match),
  .navi_list_item ::highlight(navi-search-match) {
    color: var(--list-item-color-highlight);
    background-color: var(--list-item-background-color-highlight);
  }

  /* A group is a band across the list, with its label capping it at the edge
     the list scrolls from. Written here along y, for the vertical list; the
     rule after this one reads the same structure along x. */
  .navi_list_item_group {
    min-width: 100%;

    .navi_list_item_group_label {
      position: sticky;
      top: var(--list-group-label-top, var(--x-list-group-label-top, 0px));
      z-index: var(--list-group-label-z-index);
      display: block;
      background-color: var(--list-group-label-background-color);
      user-select: none;

      &[navi-stuck] {
        z-index: var(--list-group-label-z-index-stuck);
      }

      &[navi-default] {
        padding: 4px 12px 2px;
        color: light-dark(#888, #aaa);
        font-weight: 600;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* A group whose items all failed the search keeps its height (its items are
         still there, invisible) — the label must disappear with them, otherwise
         the list shows a title standing over nothing. Same aria-hidden + inert
         pair as the items themselves. */
      &[aria-hidden="true"][inert] {
        opacity: 0;
      }
    }
    .navi_list_item_group_list {
      --list-group-label-height: inherit;
      display: flex;
      width: 100%;
      margin: 0;
      padding: 0;
      flex-direction: column;
      list-style: none;

      > .navi_list_item {
        --list-group-label-height: inherit;
      }
      /* Items inside a group must account for the sticky group label height
         on top of the list's global header/scroll-padding spacing. */
      .navi_list_item {
        scroll-margin-top: calc(
          var(--x-list-scroll-spacing-top) + var(--list-group-label-height)
        );
      }
    }

    /* Hide groups that have no rendered items. */
    &[data-hidden-while-empty]:not(:has([navi-list-item-real])) {
      display: none;
    }
  }

  /* The same group, in a list whose items run along x: the groups stand side by
     side, each one its label over its own run of items, and the label rides the
     left edge for as long as its group is on screen.

     The whole chain down to the group, because the axis is the axis of THIS
     list: a vertical list nested in an item of a horizontal one keeps the rules
     above. */
  .navi_list_container[data-horizontal]
    > .navi_list_scroll_container
    > .navi_list
    > .navi_list_item_group {
    /* An item is never wider than the list it is in (see .navi_list_item), but a
       group is a run of them: what it takes along x is what its items add up
       to, and the list scrolls to the rest. */
    min-width: auto;
    max-width: none;

    > .navi_list_item_group_label {
      top: auto;
      left: var(--list-group-label-left, var(--x-list-group-label-left, 0px));
    }

    > .navi_list_item_group_list {
      width: auto;
      flex-direction: row;
    }
  }

  /* <List itemTransition>: the items are named — a change the application wraps
     in a view transition is then seen item by item — and the pictures of the items
     are drawn INSIDE the picture of the list, which is what lets the list's edge
     cut them.

     Whether any of it happens is decided HERE and not in JS: items that are named
     without being contained animate across the page (the pictures live in the
     top layer, where no overflow of the document reaches them), which is worse
     than not animating at all. So a browser with no nested groups gets no name
     either, and the change simply happens.

     Named for a change of the list's own, and for that alone: while the PAGES
     are the ones moving — a route transition, a route travel — the list is part
     of what travels, and a picture of its own is precisely what does not
     travel. A page is carried by its own picture; anything named inside it is
     lifted out of that picture into a group of its own, which stays where it
     was captured while the page slides away under it. So the names are dropped
     for the length of such a movement and the list crosses the screen with the
     page, as a block. */
  @supports (view-transition-group: contain) {
    :root:not([data-navi-route-transition], [data-navi-route-travel])
      .navi_list_container[data-item-transition] {
      /* The list needs a name to be a group at all; which name does not matter,
         only that no other element in the document carries it. */
      view-transition-name: match-element;
      view-transition-class: navi_list_transition;
      view-transition-group: contain;

      /* An item is paired across the change by the id of the item it holds, never
         by the element that happens to hold it: items are recycled as the list
         scrolls, and pairing on the element would pair the wrong two. */
      [data-view-transition-name] {
        view-transition-name: attr(
          data-view-transition-name type(<custom-ident>)
        );
        view-transition-class: navi_list_item;
      }
    }
  }

  /* The list's edge, during the transition. */
  ::view-transition-group-children(.navi_list_transition) {
    overflow: clip;
  }
  /* The list box is the same thing before and after — only its items moved — and
     a cross-fade of something onto itself is a flicker. */
  ::view-transition-old(.navi_list_transition),
  ::view-transition-new(.navi_list_transition) {
    mix-blend-mode: normal;
    animation: none;
  }
`;

/* A padding on a list is space between its frame and its items, so it belongs on
   the scroll box and not on the frame around it: on the frame it insets the
   scroll box as a whole, and the scrollbar — which is drawn at the edge of what
   scrolls — comes off the list's edge by that same amount, floating in the
   middle of the padding. On the scroll box the scrollbar stays against the
   border and the padding is what separates the items from it. */
const LIST_PADDING_PROP_SET = new Set([
  "padding",
  "paddingX",
  "paddingY",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);

// "100item", "300px", "150%", or a number of items. A bare numeric string
// counts items too (renderBudget="50" from an HTML attribute): the arithmetic
// on the budget would silently misbehave on a raw string ("+" concatenates).
const RENDER_BUDGET_PATTERN = /^(\d+(?:\.\d+)?)(item|px|%)?$/;
const parseRenderBudget = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "number") {
    return { value, unit: "item" };
  }
  if (typeof value === "string") {
    const match = RENDER_BUDGET_PATTERN.exec(value.trim());
    if (match) {
      return { value: Number(match[1]), unit: match[2] || "item" };
    }
  }
  console.warn(
    `List: renderBudget ${JSON.stringify(value)} is not understood; it takes a number of items or a size: "100item", "300px", "150%" (of the box that scrolls the list).`,
  );
  return fallback;
};
const resolveRenderBudget = (renderBudget) => {
  if (renderBudget && typeof renderBudget === "object") {
    return {
      initial: parseRenderBudget(renderBudget.initial, undefined),
      after: parseRenderBudget(renderBudget.after, RENDER_BUDGET_DEFAULT),
    };
  }
  return {
    initial: undefined,
    after: parseRenderBudget(renderBudget, RENDER_BUDGET_DEFAULT),
  };
};

const ListUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    renderBudget: renderBudgetProp,
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
    defaultScrolled: defaultScrolledProp = "start",
    onScrolledChange,
    scroller = "self",
    hoverWhileScrolling = false,
    scrollResetOnNavigation = false,
    lockSize,
    columns,
    itemColumns,
    searchText,
    searchNoMatchMode = "remove",
    loading,
    loadingFallback = "skeleton",
    loadingSkeletonCount = 3,
    renderSkeleton,
    error,
    horizontal,
    spacing,
    overflow,
    overflowX,
    overflowY,
    listItems,
    ...rest
  } = props;
  // Remembered by name, and a name made up at render (see ListFirstResolver)
  // names no list a later mount would recognize.
  const rememberScroll =
    !scrollResetOnNavigation && !isLikelyPreactGeneratedId(rest.id);
  // Where the list was when its screen was left, when this is the way back
  // (see scroll_restoration.js). Read once: `defaultScrolled` is held by
  // reference, and a place read again each render would be a list moved each
  // render. A list held by its caller (`scrolled`) is where the caller says.
  const [scrolledRemembered] = useState(() => {
    if (!rememberScroll || (scrolled !== undefined && scrolled !== null)) {
      return undefined;
    }
    return recallScrollerPosition(rest.id);
  });
  const defaultScrolled = scrolledRemembered || defaultScrolledProp;
  const scrollBoxPaddingProps = {};
  for (const name of LIST_PADDING_PROP_SET) {
    if (name in rest) {
      scrollBoxPaddingProps[name] = rest[name];
      delete rest[name];
    }
  }
  // `renderBudget` is the window, or `{ initial, after }`: `initial` for the
  // first picture, until the browser has painted it, and `after` from then on.
  // A list opening inside a popup draws in the click that opens it, and the
  // browser paints nothing before that render ends: items below the fold cost
  // the same as items on screen there, and are drawn to be seen one frame
  // later just as well.
  const { initial: initialBudgetProp, after: renderBudget } =
    resolveRenderBudget(renderBudgetProp);
  // Opening on a position that says how many items were on screen from its item
  // on (the way back to where the list was, see reportPosition): that is what
  // the first picture shows, whatever `initial` guessed — with the item above
  // when it stood partly in view. The rest waits for the paint like any
  // `initial`: a page coming back in a route transition builds it inside the
  // update callback, and every item below the fold delays the movement.
  const openingPosition = scrolled ?? defaultScrolled;
  const initialBudget =
    openingPosition &&
    typeof openingPosition === "object" &&
    typeof openingPosition.visibleCount === "number"
      ? {
          value:
            openingPosition.visibleCount + (openingPosition.offset > 0 ? 1 : 0),
          unit: "item",
        }
      : initialBudgetProp;

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

  listItems.onChange = () => {
    onListVisibleItemsChange?.(listItems.visibleItemsSignal.peek());
  };
  // Code in a layout effect of the list reads the items as they stand after
  // the commit; the items settle on a microtask, which preact does not wait for.
  useLayoutEffect(() => {
    listItems.flushSync();
  });
  // What the runs ask for and stand for, in items: a source paginates in items,
  // and asks for the first picture's items and the rest in one round trip.
  listItems.pageSize = PAGE_SIZE_DEFAULT;
  listItems.scrolled = scrolled ?? defaultScrolled;

  const {
    virtualItemSizeSignal,
    renderWindow,
    scrollToItem,
    pendingScrollRef,
    captureAnchor,
  } = useListScrollSync({
    ref,
    listItems,
    initialBudget,
    renderBudget,
    virtualItemSize,
    scrolled,
    defaultScrolled,
    onScrolledChange,
    rememberScroll,
    listId: rest.id,
    scroller,
    searchText,
    horizontal,
    columns,
  });

  // renderBudget frames the items of a run; a list whose items are all declared
  // one by one draws every one of them, and the prop looks exactly like it is
  // doing something. Said once per list, when there is something drawn to
  // judge it on — a run mounting later (items behind a loading state) is not a
  // list without one.
  const renderBudgetWarnedRef = useRef(false);
  useLayoutEffect(() => {
    if (props.renderBudget === undefined || renderBudgetWarnedRef.current) {
      return;
    }
    if (listItems.hasRuns() || listItems.itemsSignal.peek().length === 0) {
      return;
    }
    renderBudgetWarnedRef.current = true;
    console.warn(
      `List: renderBudget has no effect here. The render window frames the items a run draws (<List.Items itemsAction>); items declared one by one (<List.Item>) are all rendered. Move the items to <List.Items> to cap the number of DOM nodes, or drop the prop.`,
    );
  });

  listItems.captureAnchor = captureAnchor;
  listItems.virtualItemSizeSignal = virtualItemSizeSignal;
  listItems.horizontal = Boolean(horizontal);
  listItems.renderSkeleton = renderSkeleton;

  // An item is addressed by id from outside (--navi-scroll, --navi-select): the
  // ones drawn have said so (see list_items.js), and the ones a run
  // holds without drawing are known only to that run (see List.Items' item
  // locator). Both answer here, so an item is reachable whether or not the
  // window happens to frame it.
  const getItemById = (itemId) => {
    const itemDrawn = listItems.itemsSignal
      .peek()
      .find((item) => item.itemId === itemId);
    if (itemDrawn) {
      return itemDrawn;
    }
    const itemIndex = listItems.locateItem(itemId);
    if (itemIndex === null) {
      return undefined;
    }
    return { id: itemId, itemId, index: itemIndex };
  };

  const noMatchCount = listItems.noMatchCountSignal.value;
  // What the list stands for, which is not always what it holds: a run saying
  // it covers 60 items is not an empty list while it waits for the first of
  // them (see List.Items).
  // eslint-disable-next-line no-unused-expressions
  listItems.pagesSignal.value;
  const itemCount = listItems.countSignal.value || listItems.totalSignal.value;
  const allNoMatch = noMatchCount > 0 && noMatchCount === itemCount;
  const searching = Boolean(searchText);
  const fallbackDisabled = fallback !== undefined && !fallback;
  const searchFallbackDisabled =
    searchFallback !== undefined && !searchFallback;
  // No item is visible when the list is empty (filtering may happen outside the
  // list, dropping itemCount to 0) or when a search removed them all — only the
  // "remove" mode empties the view; "muted"/"invisible_and_inert" keep items on
  // screen.
  const noVisibleItems =
    itemCount === 0 || (allNoMatch && searchNoMatchMode === "remove");
  // Which fallback message actually renders (mirrors SearchFallback / Fallback
  // below): during a search an empty/no-match result is a "no match" state (the
  // search fallback), otherwise an empty list is the "empty" state.
  const searchFallbackShown =
    (allNoMatch || (searching && itemCount === 0)) && !searchFallbackDisabled;
  const emptyFallbackShown = !searching && itemCount === 0 && !fallbackDisabled;
  // A loading state only holds the list on screen when it has something to
  // draw. A count of 0 (or no loadingFallback at all) says the list is known to
  // be empty before the response arrives, so the empty state can already be
  // shown — nothing jumps when the response lands, exactly as three skeletons
  // become three items.
  const loadingPlaceholderShown =
    Boolean(loading) &&
    Boolean(loadingFallback) &&
    (loadingFallback !== "skeleton" || loadingSkeletonCount > 0);
  // Hide the whole list — border included — when there is genuinely nothing to
  // show: no visible items AND no fallback message. Never while a loading
  // placeholder or an error message is on screen (they ARE the content to
  // display).
  const nothingToDisplay =
    !loadingPlaceholderShown &&
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
      // Held to the render budget like the items they stand for: a list
      // expecting a hundred items draws the ones its window frames, and the
      // room of the others is there, so nothing moves when they arrive.
      content = (
        <ListLoadingItems
          key="navi-list-loading-items"
          count={loadingSkeletonCount}
        />
      );
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
      data-item-transition={itemTransition ? "" : undefined}
      popover={popover}
      data-horizontal={horizontal ? "" : undefined}
      data-borderless={isBorderless(rest) ? "" : undefined}
      data-scroller={getScrollerAttribute(scroller)}
      data-overflow-visible={getOverflowVisibleAttribute(
        overflow,
        overflowX,
        overflowY,
      )}
      navi-hover-while-scrolling={hoverWhileScrolling ? "" : undefined}
      data-expand-x={expandX || expand ? "" : undefined}
      data-expand-y={expandY || expand ? "" : undefined}
      expandX={expandX}
      expandY={expandY}
      expand={expand}
      navi-nothing-to-display={nothingToDisplay ? "" : undefined}
      navi-loading={loading ? "" : undefined}
      navi-refreshing={listItems.refreshingSignal.value ? "" : undefined}
      navi-error={error ? "" : undefined}
      styleCSSVars={LIST_STYLE_CSS_VARS}
      pseudoClasses={LIST_PSEUDO_CLASSES}
      hasChildUsingForwardedProps
      childPropSet={LIST_TRACK_PROP_SET}
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
        fallbackShown={emptyFallbackShown}
        searchFallback={searchFallback}
        searchFallbackShown={searchFallbackShown}
        loadingPlaceholderShown={loadingPlaceholderShown}
        error={error}
        searchNoMatchMode={searchNoMatchMode}
        separator={separator}
        itemTransition={itemTransition}
        expandX={expandX || expand}
        horizontal={horizontal}
        spacing={spacing}
        columns={columns}
        itemColumns={itemColumns}
        listItems={listItems}
        renderWindow={renderWindow}
        pendingScrollRef={pendingScrollRef}
        overflow={overflow}
        overflowX={overflowX}
        overflowY={overflowY}
        scrollBoxPaddingProps={scrollBoxPaddingProps}
      >
        {content}
      </ListContent>
    </Box>
  );
};
// How many of a list's own items may be acting at once, when the items are what
// carry the action. Four rather than none: a list is a place where the same
// gesture is available many times over, and nothing else stops a long one from
// putting a request out for every item it draws.
const PARALLEL_GUARD_DEFAULT = 4;

const ListFirstResolver = (props) => {
  const Next = useNextResolver();
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const idDefault = useId();
  props.id = props.id || idDefault;
  const listItemsRef = useRef(null);
  if (!listItemsRef.current) {
    listItemsRef.current = createListItems();
  }
  props.listItems = listItemsRef.current;
  const parallelGuard = useParallelGuard(
    props.parallelGuard ?? PARALLEL_GUARD_DEFAULT,
  );

  return (
    <ParallelGuardContext.Provider value={parallelGuard}>
      <Next {...props} parallelGuard={undefined} />
    </ParallelGuardContext.Provider>
  );
};

const ListContent = ({
  role,
  fallback,
  fallbackShown,
  searchFallback,
  searchFallbackShown,
  loadingPlaceholderShown,
  error,
  searchNoMatchMode,
  separator,
  itemTransition,
  expandX,
  horizontal,
  spacing,
  columns,
  itemColumns,
  listItems,
  renderWindow,
  pendingScrollRef,
  overflow,
  overflowX,
  overflowY,
  scrollBoxPaddingProps,
  children,
}) => {
  const listProps = useContext(BoxForwardedPropsContext);
  return (
    // Every provider the list puts around its items stands OUTSIDE the <ul>:
    // the walk that gives the items their places (see ListDeclaredChildren) is
    // over the <ul>'s children, and one component between it and the caller's
    // items is one child — all the items would then stand in a single slot, and
    // reordering them would move nothing.
    <PendingScrollRefContext.Provider value={pendingScrollRef}>
      <Box
        className="navi_list_scroll_container"
        overflow={overflow}
        overflowX={overflowX}
        overflowY={overflowY}
        {...scrollBoxPaddingProps}
      >
        <UnorderedList
          role={role}
          fallback={fallback}
          fallbackShown={fallbackShown}
          searchFallback={searchFallback}
          searchFallbackShown={searchFallbackShown}
          loadingPlaceholderShown={loadingPlaceholderShown}
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
          itemColumns={itemColumns}
          {...listProps}
          listItems={listItems}
          renderWindow={renderWindow}
        >
          {children}
        </UnorderedList>
      </Box>
    </PendingScrollRefContext.Provider>
  );
};
// Where the items sit is a question about the track (the <ul>), not about the
// frame around it: the frame's only child is the scroll box, which fills it and
// has nothing to arrange. Box moves these out of the container's own props and
// into BoxForwardedPropsContext, which ListContent reads and hands to the <ul>
// — the same route `horizontal`, `spacing` and the column props take by hand.
const LIST_TRACK_PROP_SET = new Set(["align", "alignX", "alignY", "flexWrap"]);
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
  listItems,
  initialBudget,
  renderBudget,
  virtualItemSize,
  scrolled,
  defaultScrolled,
  onScrolledChange,
  rememberScroll,
  listId,
  scroller,
  searchText,
  horizontal,
  columns,
}) => {
  const debugScroll = useDebugScroll();
  // The items drawn, [start, end) among the list's own. A ref as well as a
  // state: the render moves it where the list is held (holdWindow) without a
  // commit of its own.
  const renderWindowRef = useRef(null);
  const windowLeavesItemsOut = () => {
    const renderWindow = renderWindowRef.current;
    if (!renderWindow) {
      return false;
    }
    return (
      renderWindow.start > 0 || renderWindow.end < listItems.totalSignal.peek()
    );
  };
  const virtualItemSizeSignal = useVirtualItemSizeSignal(
    ref,
    virtualItemSize,
    horizontal,
    {
      inLines: Boolean(columns),
      windowLeavesItemsOut,
      scrolledWanted: scrolled ?? defaultScrolled,
      // The fillers hold the room of items above the screen at this size: a
      // size that changes moves what is on screen, like items landing above it.
      beforeSizeChange: () => listItems.captureAnchor(),
    },
  );
  const getScroller = () => getScrollerEl(ref.current, scroller, horizontal);
  const getListEl = () => ref.current.querySelector(".navi_list");
  // Which box scrolls is measured (see getScrollerEl), so the answer holds
  // only for the geometry it was taken on: an ancestor that is bounded but
  // still waiting for its first items looks like it will never scroll. It is
  // taken again on every commit and every resize; the state exists so the
  // effects below reattach their listeners to whatever it lands on.
  const [scrollerElResolved, setScrollerElResolved] = useState(null);
  const resolveScroller = () => {
    if (!ref.current) {
      return;
    }
    const scrollerElNow = getScroller();
    setScrollerElResolved((current) =>
      current === scrollerElNow ? current : scrollerElNow,
    );
  };
  useLayoutEffect(resolveScroller);
  useStickyScrollportWarning(ref, scroller);
  useDuplicateHeaderWarning(ref);
  useStuckWindowWarning({
    ref,
    scrollerElResolved,
    renderWindowRef,
    windowLeavesItemsOut,
    totalSignal: listItems.totalSignal,
    virtualItemSizeSignal,
    horizontal,
  });
  useStuckStickyParts(ref, getScroller, scrollerElResolved, horizontal);

  // The item the scroll holds onto across a change of geometry, and where it
  // sat when that change was decided. Captured at the two moments the list
  // knows its own geometry is about to change — the window moving, a page
  // arriving — because at those moments the DOM still shows the state to
  // preserve. Capturing on every render instead would mean capturing at
  // moments where there is nothing to preserve, and missing the ones where
  // there is.
  const anchorRef = useRef(null);
  const captureAnchor = () => {
    if (anchorRef.current || !ref.current || pendingScrollRef.current) {
      return;
    }
    if (
      !startPlaceRef.current.userTookOver &&
      scrolledWanted !== "start" &&
      scrolledWanted !== undefined
    ) {
      // The list is holding itself somewhere; that is what owns the scroll.
      return;
    }
    const scrollerEl = getScroller();
    if (
      scrollerEl &&
      (horizontal ? scrollerEl.scrollLeft : scrollerEl.scrollTop) === 0
    ) {
      // A scroller at its start has nothing above the view to keep still, and
      // items landing above the first one are what a list read from its start
      // (a journal newest first, a feed) is there to show: holding the item on
      // top would scroll past them. The browser's own scroll anchoring makes
      // the same exception at offset 0.
      return;
    }
    anchorRef.current = captureScrollAnchor({
      scrollerEl,
      listEl: getListEl(),
      items: listItems.visibleItemsSignal.peek(),
      horizontal,
    });
  };

  // How many items share a line: the tracks a grid of items (`columns`)
  // resolves to, one otherwise. A layout result under auto-fill, so it is read
  // off the list once laid out, at each commit and each resize — for the runs
  // alone, which draw in lines: items declared one by one are all drawn. A
  // line of another length rewraps every item drawn: the item at the top of
  // the view is held where it is across it.
  const itemsPerLineRef = useRef(1);
  const [itemsPerLine, setItemsPerLine] = useState(1);
  const updateItemsPerLine = () => {
    if (!ref.current) {
      return;
    }
    const itemsPerLineNow =
      columns && listItems.hasRuns() ? readItemsPerLine(getListEl()) : 1;
    if (
      itemsPerLineNow === null ||
      itemsPerLineNow === itemsPerLineRef.current
    ) {
      return;
    }
    captureAnchor();
    itemsPerLineRef.current = itemsPerLineNow;
    setItemsPerLine(itemsPerLineNow);
  };
  const updateItemsPerLineRef = useRef(null);
  updateItemsPerLineRef.current = updateItemsPerLine;
  useLayoutEffect(() => {
    if (columns || itemsPerLineRef.current !== 1) {
      updateItemsPerLine();
    }
  });

  // What the window holds goes through three stages (see settleWindow):
  // - "first": the first commit, a count of items since nothing is laid out
  //   yet to measure a size with — `initial` or the budget when they are one,
  //   a few items to measure otherwise;
  // - "picture": the first picture of its own `initial` asks for, sized on the
  //   screen before the browser paints it when `initial` is a size, held until
  //   it is painted;
  // - "steady": `after`, moved by the scroll alone (see evaluateWindow).
  // Without `initial`, the first commit goes straight to "steady" before the
  // paint: the first picture is the scrolling one.
  const initialBudgetRef = useRef(initialBudget);
  const firstWindowItemCountRef = useRef(
    initialBudget
      ? initialBudget.unit === "item"
        ? initialBudget.value
        : FIRST_WINDOW_ITEM_COUNT
      : renderBudget.unit === "item"
        ? renderBudget.value
        : FIRST_WINDOW_ITEM_COUNT,
  );
  const firstWindowItemCount = firstWindowItemCountRef.current;
  const stageRef = useRef("first");
  const paintedRef = useRef(false);

  // How many items the window keeps above the item the list is held at. The
  // first window is a picture of the list opening on an item: that item and what
  // is below it — with the one above when a remembered position says it stood
  // partly in view. After it, the quarter a window keeps behind the screen
  // (see evaluateWindow), until the screen sizes it around that item.
  const itemsAboveOpening = (openAt, windowSize) => {
    if (stageRef.current !== "steady") {
      return openAt && typeof openAt === "object" && openAt.offset > 0 ? 1 : 0;
    }
    return Math.floor(windowSize / 4);
  };
  const [renderWindow, setRenderWindow] = useState(() => {
    // Opening somewhere else than the beginning starts by framing there: the
    // items the list will draw are the items it will ask for.
    const openAt = scrolled ?? defaultScrolled;
    const start =
      typeof openAt === "number"
        ? openAt - itemsAboveOpening(openAt, firstWindowItemCount)
        : 0;
    const startClamped = start < 0 ? 0 : start;
    return { start: startClamped, end: startClamped + firstWindowItemCount };
  });
  renderWindowRef.current = renderWindow;
  // A window running past the last item slides back instead of framing fewer
  // items than it was given: every item that fits in it stays drawn. Derived on
  // every render and not written once: the state keeps the window it had, and
  // a collection growing back gives it back. The same object is handed out for
  // as long as the numbers hold, so the items are not told about a window that
  // did not move.
  const framedWindowRef = useRef(null);
  {
    const { start, end } = renderWindowRef.current;
    const total = listItems.totalSignal.peek();
    if (total > 0 && end > total) {
      const windowSize = end - start;
      const framedStart = total - windowSize < 0 ? 0 : total - windowSize;
      const framedEnd = total;
      const framed = framedWindowRef.current;
      if (framed && framed.start === framedStart && framed.end === framedEnd) {
        renderWindowRef.current = framed;
      } else {
        framedWindowRef.current = renderWindowRef.current = {
          start: framedStart,
          end: framedEnd,
        };
      }
    }
  }
  const updateRenderWindow = (newStart, newEnd, reason) => {
    const { start, end } = renderWindowRef.current;
    if (newStart === start && newEnd === end) {
      return null;
    }
    captureAnchor();
    debugScroll(`updateRenderWindow(${newStart}, ${newEnd}, "${reason}")`);
    const renderWindow = { start: newStart, end: newEnd };
    renderWindowRef.current = renderWindow;
    setRenderWindow(renderWindow);
    return renderWindow;
  };

  // While the list is held somewhere, its window is not free state: it is
  // around that place. Deriving it rather than waiting for the scroll listener
  // to catch up is what keeps a list opening on its last items from asking for
  // its first ones — it would have drawn them, for the one commit before it
  // jumped.
  const holdWindow = () => {
    if (startPlaceRef.current.userTookOver) {
      listItems.holdPending = false;
      return;
    }
    // Held somewhere it has not reached yet: what the window frames right now
    // is not what it will frame, so nothing should be fetched for it.
    listItems.holdPending =
      scrolledWanted !== "start" && scrolledWanted !== undefined;
    // Zero until the runs have rendered — they count their items as they do,
    // after the list — which is not a collection fitting in the window: it is
    // one whose end is not known yet, and the window then frames the item the
    // list opens on, already in the first commit.
    const total = listItems.totalSignal.peek();
    const { start, end } = renderWindowRef.current;
    const windowSize = end - start;
    if (total > 0 && total <= windowSize) {
      // The whole collection is what the list draws: wherever in it the list is
      // held, the window is already its place. Nowhere to move to means nothing
      // to wait for — a hold left standing here is a list that never asks for
      // anything again.
      listItems.holdPending = false;
      return;
    }
    let heldItem = null;
    let wantedStart = null;
    if (scrolledWanted === "end") {
      heldItem = total - 1;
      wantedStart = total - windowSize;
    } else if (typeof scrolledWanted === "number") {
      heldItem = scrolledWanted;
    } else if (scrolledWanted && scrolledWanted.id !== undefined) {
      const itemIndex = listItems.locateItem(scrolledWanted.id);
      if (itemIndex !== null) {
        heldItem = itemIndex;
      } else if (typeof scrolledWanted.index === "number") {
        // The item has not come back yet, but where it stood is known: near
        // enough to frame, and to put the scrollbar roughly where it will end
        // up rather than at the top.
        heldItem = scrolledWanted.index;
      }
    }
    if (heldItem === null) {
      // Held on an item nobody can place yet: the window frames the start, which
      // is not where the list is going. The hold stands until the item comes
      // back — the run asks for it by name (see useRequestMissing).
      return;
    }
    if (stageRef.current !== "first" && heldItem >= start && heldItem < end) {
      // Around the item it holds, the window is the screen's to size (see
      // evaluateWindow): the hold only brings that item into it. Framing it
      // exactly on that item would undo the sizing at every render, and the
      // sizing would answer at every frame.
      listItems.holdPending = false;
      return;
    }
    if (wantedStart === null) {
      wantedStart = heldItem - itemsAboveOpening(scrolledWanted, windowSize);
    }
    if (total > 0 && wantedStart + windowSize > total) {
      wantedStart = total - windowSize;
    }
    if (wantedStart < 0) {
      wantedStart = 0;
    }
    if (wantedStart === start) {
      listItems.holdPending = false;
      return;
    }
    renderWindowRef.current = {
      start: wantedStart,
      end: wantedStart + windowSize,
    };
    listItems.holdPending = false;
  };

  const pendingScrollRef = useRef();
  const scrollToItem = (item, { event, reason, block: blockRequested }) => {
    if (!item) {
      return;
    }
    const items = listItems.itemsSignal.peek();
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
      const align =
        blockRequested ||
        (event.type === "navi_displayed" ? "center" : "nearest");
      const scrollToItemCall = `${getElementSignature(itemEl)}.scrollIntoView({ block: "${align}", inline: "${align}", container: "nearest" })`;
      debugScroll(`${trigger} -> ${scrollToItemCall}`);
      // The list is going somewhere on purpose, so there is no view to hold
      // still any more: an anchor captured before this drop it, or it would
      // put the list back where it was the moment the items move under it.
      anchorRef.current = null;
      // One alignment, said on both axes: the axis the list scrolls on is the
      // one that reads it, and the other has nothing to move.
      scrollIntoViewScoped(itemEl, {
        container: getScroller(),
        block: align,
        inline: align,
      });
      const listEl = getListEl();
      dispatchPublicCustomEvent(listEl, "navi_scroll", {
        event,
        item,
      });
    };

    // Whether the item is drawn is asked of the dom, not of the render window:
    // the window says what a run draws, and a list whose items are declared one
    // by one has them all in the dom whatever the window says.
    const itemEl = findItemElement(getListEl(), item.itemId);
    if (itemEl) {
      scrollItemIntoView(itemEl);
      return;
    }
    // Not in DOM — shift the render window. The item will read
    // pendingScrollRef on mount and scroll into view.
    pendingScrollRef.current = {
      id: item.itemId,
      resolve: (itemEl) => {
        pendingScrollRef.current = null;
        scrollItemIntoView(itemEl);
      },
    };
    const { start, end } = renderWindowRef.current;
    const windowSize = end - start;
    const half = Math.floor(windowSize / 2);
    const newStart = Math.max(0, index - half);
    const newEnd = newStart + windowSize;
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
  // somewhere, the anchoring stays out of it (holding an item still is precisely
  // not being at the end anymore once what is above it shrinks).
  const heldSomewhere =
    !startPlaceRef.current.userTookOver &&
    scrolledWanted !== "start" &&
    scrolledWanted !== undefined;
  if (heldSomewhere) {
    // Subscribing on purpose: the item size is measured by this list but read
    // by the runs, so a size that settles re-renders THEM — their fillers grow,
    // the end of the list moves, and nothing would tell this list to aim at it
    // again.
    // eslint-disable-next-line no-unused-expressions
    virtualItemSizeSignal.value;
  }
  // Set around a scroll the list performs itself. What it protects against is
  // not the scroll event as such, but what the listener would conclude from it:
  // the position it is about to read was chosen to keep the items where they
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
      const items = listItems.itemsSignal.peek();
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
  // Watch scores of the top items, as many as the window draws.
  // When scores change during an active search, scroll to top to reveal the most relevant items.
  // When search becomes empty, put the list back at the offset (and the render
  // window) it was at when the search started — see docs/scroll.md.

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
          listItems,
          virtualItemSizeSignal,
          itemsPerLine: itemsPerLineRef.current,
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
    const visibleItems = listItems.visibleItemsSignal.peek();
    const { start, end } = renderWindowRef.current;
    const topItems = visibleItems.slice(0, end - start);
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
      reason: "top match changed",
    });
    return undefined;
  });

  // Where the list opens when it has no reason to be anywhere else: at the end
  // for a thread one reads backwards, on a named item when one is coming back
  // to where they were, at the start otherwise.
  //
  // Held until the user takes over rather than done once: where that place is
  // keeps moving while the list is still finding out how many items it has and
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
      listItems.totalSignal.peek() === 0 ||
      virtualItemSizeSignal.peek() === 0
    ) {
      return;
    }
    // Coming back to a named item: it has to be on screen to be put back where
    // it was — measured, not computed from an estimate, which is what makes
    // the position exact whatever the items in between turn out to weigh. Until
    // it is drawn, the most this can do is aim the window at it.
    let openAt = scrolledWanted;
    if (typeof scrolledWanted === "object" && scrolledWanted.id !== undefined) {
      // Only whoever holds the items can say where that one sits: the list
      // itself knows the items it has drawn, and this one is precisely the one
      // it has not drawn yet.
      const itemIndex = listItems.locateItem(scrolledWanted.id);
      if (itemIndex === null) {
        // Not there yet, but where it stood is drawn already: the item
        // standing in for it at that index (see holdWindow). The list is placed
        // on that one, measured like any other, and the named item takes over
        // where it lands.
        if (listItems.pagesSignal.peek() === 0) {
          if (typeof scrolledWanted.index === "number") {
            placeItem(
              findItemElementAt(getListEl(), scrolledWanted.index),
              scrolledWanted.offset || 0,
            );
          }
          return;
        }
        openAt = scrolledFallback;
        if (openAt === "start" || openAt === undefined) {
          startPlaceRef.current.userTookOver = true;
          return;
        }
      } else {
        const { start, end } = renderWindowRef.current;
        if (itemIndex < start || itemIndex >= end) {
          const above = itemsAboveOpening(scrolledWanted, end - start);
          const wantedStart = itemIndex - above < 0 ? 0 : itemIndex - above;
          updateRenderWindow(
            wantedStart,
            wantedStart + (end - start),
            `opening on item ${scrolledWanted.id}`,
          );
          return;
        }
      }
    }
    const scrollerEl = getScroller();
    if (openAt === "end") {
      anchorRef.current = null;
      if (horizontal) {
        scrollerEl.scrollLeft = scrollerEl.scrollWidth;
      } else {
        scrollerEl.scrollTop = scrollerEl.scrollHeight;
      }
      return;
    }
    if (typeof openAt === "number") {
      placeItem(findItemElementAt(getListEl(), openAt), 0);
      return;
    }
    if (typeof openAt === "object" && openAt.id !== undefined) {
      placeItem(findItemElement(getListEl(), openAt.id), openAt.offset || 0);
    }
  };
  // An item is placed by measuring it where it is drawn — named, or at the
  // place a number says — so it lands where it should whatever the items
  // above it weigh, and wherever the list starts in the box that scrolls it.
  // The window frames it from the first commit on (see holdWindow).
  const placeItem = (itemEl, offset) => {
    if (!itemEl) {
      return;
    }
    const scrollerEl = getScroller();
    const viewportRect = getScrollerViewportRect(scrollerEl);
    const itemRect = itemEl.getBoundingClientRect();
    const offsetWanted = resolveOpenOffset(
      getItemScrollInset(scrollerEl, itemEl, horizontal) + offset,
      horizontal ? viewportRect.width : viewportRect.height,
      horizontal ? itemRect.width : itemRect.height,
    );
    const offsetNow = horizontal
      ? itemRect.left - viewportRect.left
      : itemRect.top - viewportRect.top;
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
  };
  useLayoutEffect(placeWhereHeld);
  // The window leaves its first stage where the list stands once it is placed
  // — tried at every commit until the list is laid out somewhere it can be
  // measured (a closed popup is not) — and a first picture of its own leaves
  // its stage once the browser has painted it: afterPaint rather than an
  // effect, since preact runs a component's pending effects early whenever it
  // renders again, and something always does before a popup has painted.
  const settleWindow = () => {
    const stage = stageRef.current;
    if (stage === "steady") {
      return;
    }
    const initialBudget = initialBudgetRef.current;
    if (initialBudget && !paintedRef.current) {
      if (stage === "picture") {
        return;
      }
      stageRef.current = "picture";
      if (initialBudget.unit === "item") {
        // A count is the picture already.
        return;
      }
      if (!evaluateWindowRef.current("first picture", { force: true })) {
        stageRef.current = stage;
      }
      return;
    }
    stageRef.current = "steady";
    if (!evaluateWindowRef.current("sized on the screen", { force: true })) {
      stageRef.current = stage;
    }
  };
  useLayoutEffect(settleWindow);
  useLayoutEffect(() => {
    if (!initialBudgetRef.current) {
      return undefined;
    }
    return afterPaint(() => {
      paintedRef.current = true;
      settleWindow();
    });
  }, []);
  // Held on an item of a list scrolling the document: where the document goes is
  // this list's to say, measured on the item, not the url's offset in pixels
  // (see holdDocumentScroll).
  useLayoutEffect(() => {
    if (!heldSomewhere || getScroller() !== document.scrollingElement) {
      return undefined;
    }
    return holdDocumentScroll();
  }, [heldSomewhere, scrollerElResolved]);
  // What to do when the list's own geometry moves under it, kept fresh for the
  // observer below (which is installed once).
  const onGeometryChangeRef = useRef(null);
  onGeometryChangeRef.current = () => {
    settleWindow();
    if (heldSomewhere) {
      placeWhereHeld();
      return true;
    }
    // Items that came in at another size than what stood in for them (a
    // skeleton becoming its item) leave the window short of the screen, or past
    // it, and nothing scrolled to say so.
    evaluateWindowRef.current("items resized");
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
  }, [scrolledWanted, scrollerElResolved]);

  // Where the list is, said the way it can be given back to it: the item at the
  // top of what is on screen, and how far above the fold it sits. An index
  // would not do — items get inserted while a list is being read, and the item
  // one was looking at is then somewhere else.
  const onScrolledChangeRef = useRef(null);
  onScrolledChangeRef.current = onScrolledChange;
  const rememberScrollRef = useRef(false);
  rememberScrollRef.current = rememberScroll;
  // Where the list was at the last thing that moved it. Kept whether anyone
  // asked for it or not: it is what a resize needs to put things back.
  const positionRef = useRef(null);
  const captureListAnchor = (countVisible) =>
    captureScrollAnchor({
      scrollerEl: getScroller(),
      listEl: getListEl(),
      items: listItems.visibleItemsSignal.peek(),
      horizontal,
      countVisible,
    });
  // Said from where the item lands on its own, and with `visibleCount`: the
  // items on screen from that one on, which is what a list given this position
  // back draws first (see ListUI).
  const toScrolledPosition = (position) => {
    const itemEl = findItemElement(getListEl(), position.id);
    return {
      id: position.id,
      index: position.index,
      offset:
        position.offset - getItemScrollInset(getScroller(), itemEl, horizontal),
      visibleCount: position.visibleCount,
    };
  };
  // A position read at a scroll event is read before the window has drawn what
  // the scroll brought on screen: the items below the top one can still be
  // fillers then, and `visibleCount` counts the items drawn. So it is read
  // again once the screen is better known — a window change on screen, items
  // landing or resizing — and said again when it reads differently (`ifChanged`):
  // the same scroll, the screen said right.
  const announcedRef = useRef(null);
  const reportPosition = ({ ifChanged } = {}) => {
    if (!ref.current) {
      return;
    }
    if (ifChanged && !announcedRef.current) {
      return;
    }
    const remember = rememberScrollRef.current;
    const onScrolledChange = onScrolledChangeRef.current;
    const position = captureListAnchor(remember || Boolean(onScrolledChange));
    if (!position) {
      return;
    }
    positionRef.current = position;
    if (!remember && !onScrolledChange) {
      return;
    }
    const scrolledNow = toScrolledPosition(position);
    if (ifChanged && isSamePosition(scrolledNow, announcedRef.current)) {
      return;
    }
    announcedRef.current = scrolledNow;
    if (remember) {
      rememberScrollerPosition(listId, scrolledNow);
    }
    if (onScrolledChange) {
      onScrolledChange(scrolledNow);
    }
  };
  // Nothing scrolled, yet what is on screen changed: the list has just been
  // laid out, its items have arrived, one of them grew. A list read where it
  // opened would otherwise come back with nothing kept — opening again as a
  // fresh arrival does, all of its window drawn in the first commit instead of
  // the items that were on screen. Kept, and told to nobody while nobody
  // scrolled; once a position was said, it is said again (see reportPosition).
  const rememberPosition = () => {
    if (announcedRef.current) {
      reportPosition({ ifChanged: true });
      return;
    }
    if (!rememberScrollRef.current || !ref.current) {
      return;
    }
    const position = captureListAnchor(true);
    if (position) {
      rememberScrollerPosition(listId, toScrolledPosition(position));
    }
  };
  // Leaving: with its page, or alone (see forgetScrollerUnlessPageLeft).
  useLayoutEffect(() => {
    return () => {
      if (rememberScrollRef.current) {
        forgetScrollerUnlessPageLeft(listId);
      }
    };
  }, []);

  // A list that gets narrower rewraps every item it holds, so everything below
  // moves and the reader loses their place — the very thing scrolling a long
  // list is supposed to protect. The item that was at the top goes back to
  // where it was, measured on the new layout.
  useLayoutEffect(() => {
    if (!ref.current) {
      return undefined;
    }
    const scrollerEl = getScroller();
    const listEl = getListEl();
    // Two things resize here, and they call for opposite answers. The LIST
    // growing is its own content settling: only a list holding itself
    // somewhere cares (the end it aims at has moved), and a list the user is
    // reading must not be touched — its items are held still by the anchoring,
    // which this would undo. The SCROLLER resizing is the window around it
    // changing shape, and then the item that was at the top goes back where it
    // was.
    const putTopItemBack = (entries) => {
      const listResized = entries.some((entry) => entry.target === listEl);
      if (listResized && onGeometryChangeRef.current()) {
        return;
      }
      if (!entries.some((entry) => entry.target === scrollerEl)) {
        return;
      }
      const position = positionRef.current;
      if (!position) {
        return;
      }
      const itemEl = findItemElement(getListEl(), position.id);
      if (!itemEl) {
        return;
      }
      const viewportRect = getScrollerViewportRect(scrollerEl);
      const itemRect = itemEl.getBoundingClientRect();
      const offsetNow = horizontal
        ? itemRect.left - viewportRect.left
        : itemRect.top - viewportRect.top;
      const delta =
        offsetNow -
        resolveOpenOffset(
          position.offset,
          horizontal ? viewportRect.width : viewportRect.height,
          horizontal ? itemRect.width : itemRect.height,
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
    };
    const observer = new ResizeObserver((entries) => {
      // A box that grows may be a box that starts to scroll — the scroller is
      // resolved again before anything is done about the resize, so that a
      // list which has outgrown a bounded ancestor stops holding on to the
      // page.
      resolveScroller();
      rememberPosition();
      putTopItemBack(entries);
      // Once the top item is back where it was: that is the place a line of
      // another length has to keep, and putting it back drops any anchor
      // captured before.
      updateItemsPerLineRef.current();
    });
    observer.observe(scrollerEl);
    observer.observe(listEl);
    return () => {
      observer.disconnect();
    };
  }, [scrollerElResolved]);

  // Inserting items above what the user is looking at must not move it by a
  // single pixel. The browser will not do it for us — overflow-anchor gives up
  // on changes it attributes to a scroll, and the fillers resize in the very
  // same commit — so the item at the top of the viewport is measured before the
  // commit and put back at the same offset after it. Asked after every commit
  // of the list, and of a filler, which can resize in a commit of its own (see
  // VirtualFiller).
  const holdAnchorStill = () => {
    const anchor = anchorRef.current;
    if (!anchor || !ref.current || heldSomewhere) {
      anchorRef.current = null;
      return;
    }
    const items = listItems.visibleItemsSignal.peek();
    const itemNow = items.find((i) => i.itemId === anchor.id);
    if (!itemNow) {
      anchorRef.current = null;
      return;
    }
    const indexShift = itemNow.index - anchor.index;
    if (indexShift !== 0) {
      // The render window addresses items by their place in the collection:
      // items inserted before the anchor renumbered everything after them, so
      // the window must follow or it would frame a different part of the list
      // entirely. The anchor is kept — where it must land does not change —
      // but its index is now the new one, so the commit that follows compares
      // against it and moves on to the scroll correction.
      anchor.index = itemNow.index;
      const { start, end } = renderWindowRef.current;
      const windowSize = end - start;
      const startShifted = start + indexShift;
      let startWanted = startShifted < 0 ? 0 : startShifted;
      const total = listItems.totalSignal.peek();
      // Same normalization as the scroll listener: a window running past the
      // last item slides back instead of framing fewer items than its budget
      // allows — every item that fits in it must stay rendered.
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
          `${indexShift} item(s) inserted before the anchored item`,
        );
        return;
      }
    }
    const anchorEl = findItemElement(getListEl(), anchor.id);
    if (!anchorEl) {
      anchorRef.current = null;
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
      // Nothing moved in this commit — which does not mean nothing will: what
      // was captured is a change that has not landed yet (a page merged into a
      // run re-renders the run, and this list a commit later). The anchor is
      // kept until it has something to correct, and dropped the moment the
      // user scrolls, which is the one thing that makes it stale.
      return;
    }
    anchorRef.current = null;
    scrolledByListRef.current = true;
    if (horizontal) {
      scrollerEl.scrollLeft += drift;
    } else {
      scrollerEl.scrollTop += drift;
    }
  };
  useLayoutEffect(holdAnchorStill);
  // What a filler resizing in a commit of its own asks for (see VirtualFiller):
  // the view put back the way the list keeps it — where the list holds itself,
  // or on the item the anchor captured.
  listItems.holdViewStill = () => {
    if (heldSomewhere) {
      placeWhereHeld();
      return;
    }
    holdAnchorStill();
  };

  // The window the budget asks for around the screen: what is on screen, and
  // the rest of the budget three quarters ahead of the direction the user goes
  // and one quarter behind — the whole of it on one side when the other is the
  // edge of the collection. A budget in items counts each item as one; a
  // budget that is a size ("300px", "150%") weighs each item on screen (see
  // createItemSizeReader), so the same budget holds a few cards or a few dozen
  // one-line items. Which items the screen shows is read off the items drawn
  // either way, not estimated from an average size: items ten times apart in
  // height put the average nowhere near any of them.
  // It moves once what it keeps ahead of the screen falls under half a screen,
  // or half of what it keeps there: re-framed, it holds enough ahead that the
  // next move is a while away, instead of drawing items at every scroll event
  // while the user waits for them. What it keeps behind is judged the same
  // way, for the user turning around.
  // The budget is `after`, or `initial` while the first picture is (see
  // settleWindow). `force` places it whatever it holds, which is how it leaves
  // a stage; `grow` only adds to what it holds (see the "after slide" effect).
  // Answers whether the list could be measured.
  const scrollDirectionRef = useRef(1);
  // The window a slide asked for, until a commit shows it.
  const windowSlidRef = useRef(null);
  const budgetWarnedRef = useRef(false);
  const evaluateWindow = (reason, { force, grow } = {}) => {
    const stage = stageRef.current;
    const renderBudgetNow =
      stage === "picture" ? initialBudgetRef.current : renderBudget;
    if (stage === "first" || renderBudgetNow.unit === "item") {
      if (stage !== "steady") {
        // A count of items is the first commit's, or a first picture of its
        // own: it holds what it was given until the next stage.
        return false;
      }
    }
    const total = listItems.totalSignal.peek();
    if (total === 0 || !ref.current) {
      return false;
    }
    const scrollerEl = getScroller();
    const listEl = getListEl();
    if (!scrollerEl || !listEl) {
      return false;
    }
    const geometry = readWindowGeometry(scrollerEl, listEl, horizontal);
    if (!geometry) {
      return false;
    }
    const { screenSize, bandFrom, bandTo, items } = geometry;
    const { start, end } = renderWindowRef.current;
    // What an item not drawn weighs: its share of a line, which the items side
    // by side on it take together.
    const itemsPerLineNow = itemsPerLineRef.current;
    const itemSize = virtualItemSizeSignal.peek() / itemsPerLineNow;
    const pixelsOf = createItemSizeReader(items, start, end, itemSize);
    const walkBefore = (from, sizeWanted, sizeOf) => {
      let index = from;
      let size = 0;
      while (index > 0 && size < sizeWanted) {
        index--;
        size += sizeOf(index);
      }
      return { index, sizeLeft: size < sizeWanted ? sizeWanted - size : 0 };
    };
    const walkAfter = (from, sizeWanted, sizeOf) => {
      let index = from;
      let size = 0;
      while (index < total && size < sizeWanted) {
        size += sizeOf(index);
        index++;
      }
      return { index, sizeLeft: size < sizeWanted ? sizeWanted - size : 0 };
    };
    // Which items are on screen. While the list holds itself on an item (see
    // placeWhereHeld), the screen is where that item is going to stand, not
    // where the scroll happens to be while it is placed — items landing,
    // fillers resizing, the placement catching up a commit later: framed on
    // such a moment, the window would be somewhere the screen is not by the
    // time it paints. The screen is then counted from the item, with the room
    // the hold leaves above it, and the list goes forward from there.
    let bandStart;
    let bandEnd;
    let forward;
    const hold = readHold(scrollerEl, listEl, screenSize, total);
    if (hold && hold.atEnd) {
      bandEnd = total;
      bandStart = walkBefore(total, screenSize, pixelsOf).index;
      forward = false;
    } else if (hold) {
      bandStart = walkBefore(hold.index, hold.above, pixelsOf).index;
      bandEnd = walkAfter(hold.index, screenSize - hold.above, pixelsOf).index;
      forward = true;
    } else {
      bandStart = findBandStart(items, bandFrom, itemSize);
      bandEnd =
        bandTo > bandFrom ? findBandEnd(items, bandTo, itemSize) : bandStart;
      forward = scrollDirectionRef.current > 0;
    }
    if (bandStart > total) {
      bandStart = total;
    }
    if (bandEnd > total) {
      bandEnd = total;
    }
    if (bandEnd < bandStart) {
      bandEnd = bandStart;
    }
    const countsItems = renderBudgetNow.unit === "item";
    const sizeOf = countsItems ? () => 1 : pixelsOf;
    // The screen and the budget in the budget's own unit.
    const screen = countsItems ? bandEnd - bandStart : screenSize;
    const budget =
      renderBudgetNow.unit === "%"
        ? (renderBudgetNow.value / 100) * screenSize
        : renderBudgetNow.value;
    const spare = budget > screen ? budget - screen : 0;
    const behindSize = countsItems ? Math.floor(spare / 4) : spare / 4;
    const aheadSize = spare - behindSize;
    if (
      import.meta.dev &&
      stage === "steady" &&
      !budgetWarnedRef.current &&
      bandEnd > bandStart
    ) {
      const twoLines =
        (countsItems ? 2 : (2 * (bandTo - bandFrom)) / (bandEnd - bandStart)) *
        itemsPerLineNow;
      if (spare < twoLines) {
        budgetWarnedRef.current = true;
        console.warn(
          `List: renderBudget=${renderBudget.value}${renderBudget.unit} leaves less than two ${itemsPerLineNow > 1 ? "lines of items" : "items"} beyond what the screen shows (${bandEnd - bandStart} items): items will go blank as it scrolls. Give it room for a screen ahead or more — "300%" of the box that scrolls it, say.`,
        );
      }
    }
    if (!force) {
      const roomAround = readRoomAround({
        hold,
        items,
        start,
        end,
        bandStart,
        bandEnd,
        bandFrom,
        bandTo,
        countsItems,
        sizeOf,
      });
      if (roomAround) {
        let { roomBefore, roomAfter } = roomAround;
        if (start <= 0) {
          roomBefore = Infinity;
        }
        if (end >= total) {
          roomAfter = Infinity;
        }
        const roomAhead = forward ? roomAfter : roomBefore;
        const roomBehind = forward ? roomBefore : roomAfter;
        const halfScreen = screen / 2;
        const aheadNeeded =
          halfScreen < aheadSize / 2 ? halfScreen : aheadSize / 2;
        const behindNeeded =
          halfScreen < behindSize / 2 ? halfScreen : behindSize / 2;
        if (roomAhead >= aheadNeeded && roomBehind >= behindNeeded) {
          return true;
        }
      }
    }
    let newStart;
    let newEnd;
    if (budget <= screen) {
      // A budget the screen alone exceeds is still the budget: it is drawn
      // from the edge the user goes away from, and the rest of the screen
      // stays blank (said once, above). The item that edge cuts through
      // counts for what is on screen of it.
      if (forward && hold && !countsItems) {
        // Held on an item: the screen is that much above it, the rest below.
        newStart = bandStart;
        newEnd = walkAfter(hold.index, budget - hold.above, sizeOf).index;
      } else if (forward) {
        const bandFirst = hold
          ? null
          : items.find((item) => item.index === bandStart);
        const cut =
          !countsItems && bandFirst && bandFirst.from < bandFrom
            ? bandFrom - bandFirst.from
            : 0;
        newStart = bandStart;
        newEnd = walkAfter(bandStart, budget + cut, sizeOf).index;
      } else {
        const bandLast = hold
          ? null
          : items.find((item) => item.index === bandEnd - 1);
        const cut =
          !countsItems && bandLast && bandLast.to > bandTo
            ? bandLast.to - bandTo
            : 0;
        newEnd = bandEnd;
        newStart = walkBefore(bandEnd, budget + cut, sizeOf).index;
      }
    } else {
      const before = walkBefore(
        bandStart,
        forward ? behindSize : aheadSize,
        sizeOf,
      );
      const after = walkAfter(
        bandEnd,
        (forward ? aheadSize : behindSize) + before.sizeLeft,
        sizeOf,
      );
      newStart =
        after.sizeLeft > 0
          ? walkBefore(before.index, after.sizeLeft, sizeOf).index
          : before.index;
      newEnd = after.index;
    }
    if (grow) {
      if (newStart > start) {
        newStart = start;
      }
      if (newEnd < end) {
        newEnd = end;
      }
    }
    if (newStart === start && newEnd === end) {
      return true;
    }
    windowSlidRef.current = updateRenderWindow(
      newStart,
      newEnd,
      `${reason}: items ${bandStart}-${bandEnd} on screen, going ${forward ? "forward" : "backward"}`,
    );
    return true;
  };
  // The item the list holds itself on, and the room the hold leaves above it
  // (see placeWhereHeld) — `null` once the user took the list over, or while
  // nobody can say where that item stands.
  const readHold = (scrollerEl, listEl, screenSize, total) => {
    const place = startPlaceRef.current;
    const wanted = place.wanted;
    if (place.userTookOver || wanted === "start" || wanted === undefined) {
      return null;
    }
    if (wanted === "end") {
      return { atEnd: true };
    }
    let index = null;
    let offset = 0;
    if (typeof wanted === "number") {
      index = wanted;
    } else if (wanted && wanted.id !== undefined) {
      index = listItems.locateItem(wanted.id);
      if (index === null && typeof wanted.index === "number") {
        index = wanted.index;
      }
      offset = wanted.offset || 0;
    }
    if (index === null || index < 0 || index >= total) {
      return null;
    }
    const itemEl = findItemElementAt(listEl, index);
    let itemSize = 0;
    if (itemEl) {
      const rect = itemEl.getBoundingClientRect();
      itemSize = horizontal ? rect.width : rect.height;
    }
    const above = resolveOpenOffset(
      getItemScrollInset(scrollerEl, itemEl, horizontal) + offset,
      screenSize,
      itemSize,
    );
    return { index, above };
  };
  const evaluateWindowRef = useRef(null);
  evaluateWindowRef.current = evaluateWindow;
  // A slide is judged again once its items are laid out: the scroll had moved
  // on while the items were being drawn, or the anchoring of this very commit
  // moved it, and a window that stops short of the screen's edge with no
  // scroll event to come would stay short for good. On the next frame, after
  // the layout this commit's anchoring settles on — except for a first picture
  // (see settleWindow), which is painted once: what its sizing guessed about
  // items it had not drawn yet is measured, and what it fell short of is drawn
  // before the browser paints it. Added to, never taken from: each pass then
  // grows the window, so the passes end by themselves — by the time the
  // screen is covered, at the latest when the collection runs out — however
  // the items resize as their neighbours are drawn. A pass that could also
  // take items away could swing between two windows without end, and nothing
  // is painted while it runs.
  useLayoutEffect(() => {
    if (windowSlidRef.current !== renderWindow) {
      return undefined;
    }
    windowSlidRef.current = null;
    if (stageRef.current === "picture") {
      evaluateWindowRef.current("first picture, measured", { grow: true });
      return undefined;
    }
    const frameId = requestAnimationFrame(() => {
      evaluateWindowRef.current("after slide");
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [renderWindow]);

  // Scroll listener — slides the window as the user scrolls.
  useLayoutEffect(() => {
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return undefined;
    }
    const scrollerEl = getScroller();
    const onScroll = () => {
      // Which way the user is going, read before the position is stored: what
      // the window keeps ahead is ahead of this.
      const previousScroll = currentScrollRef.current;
      if (previousScroll) {
        const delta = horizontal
          ? scrollerEl.scrollLeft - previousScroll.left
          : scrollerEl.scrollTop - previousScroll.top;
        if (delta > 0) {
          scrollDirectionRef.current = 1;
        } else if (delta < 0) {
          scrollDirectionRef.current = -1;
        }
      }
      updateCurrentScroll();
      // Where the user is now is where things must be held from now on.
      anchorRef.current = null;
      if (scrolledByListRef.current) {
        // The window stays where it is — the position it would be re-derived
        // from was chosen to keep the items still — but where the list is has
        // genuinely changed, and whoever keeps that position must hear it.
        scrolledByListRef.current = false;
        reportPosition();
        return;
      }
      reportPosition();
      evaluateWindowRef.current("scroll");
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
  }, [scrollerElResolved]);

  holdWindow();
  const { start: windowStart, end: windowEnd } = renderWindowRef.current;
  useLayoutEffect(() => {
    reportPosition({ ifChanged: true });
  }, [windowStart, windowEnd]);
  // What the runs draw: the window widened to whole lines. The window itself
  // moves an item at a time, and a grid lays the first item drawn in its first
  // column — started anywhere but on a line, every item drawn would sit in the
  // column of another. Started on one, an item is in the column its place says
  // whatever the window frames. The same object while the numbers hold, so the
  // runs are not told about a window that did not move.
  const windowDrawnRef = useRef(null);
  const drawnStart = windowStart - (windowStart % itemsPerLine);
  const endPastLine = windowEnd % itemsPerLine;
  const drawnEnd =
    endPastLine === 0 ? windowEnd : windowEnd + itemsPerLine - endPastLine;
  let windowDrawn = windowDrawnRef.current;
  if (
    !windowDrawn ||
    windowDrawn.start !== drawnStart ||
    windowDrawn.end !== drawnEnd ||
    windowDrawn.itemsPerLine !== itemsPerLine
  ) {
    windowDrawn = { start: drawnStart, end: drawnEnd, itemsPerLine };
    windowDrawnRef.current = windowDrawn;
  }
  return {
    virtualItemSizeSignal,
    renderWindow: windowDrawn,
    pendingScrollRef,
    scrollToItem,
    captureAnchor,
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
// The tracks a grid resolved its template to, as its computed
// grid-template-columns lists them once laid out: "150px 150px [end] 150px".
// Not laid out (a closed popup), that is the template as written, which says
// nothing yet under auto-fill: `null`.
const readItemsPerLine = (listEl) => {
  const tracks = getComputedStyle(listEl).gridTemplateColumns;
  if (tracks === "none" || tracks.includes("(")) {
    return null;
  }
  const sizes = tracks.replace(/\[[^\]]*\]/g, " ").trim();
  if (!sizes) {
    return null;
  }
  return sizes.split(/\s+/).length;
};
// A window that cannot move is the one failure of a virtualized list that
// looks like nothing: the items outside it are fillers holding their room, so
// the list simply ends on blank space, at exactly the height of the items never
// drawn. It happens when the box the window follows (see getScrollerEl) scrolls
// nothing — a list given no height of its own inside an ancestor that clips
// instead of scrolling — and there is no event missing to notice it by.
const useStuckWindowWarning = ({
  ref,
  scrollerElResolved,
  renderWindowRef,
  windowLeavesItemsOut,
  totalSignal,
  virtualItemSizeSignal,
  horizontal,
}) => {
  const doneRef = useRef(false);
  // Read where they stand at each commit, not subscribed to: this reports a
  // geometry, and the commit is when there is a new one to look at.
  useLayoutEffect(() => {
    if (!import.meta.dev || doneRef.current || !scrollerElResolved) {
      return;
    }
    if (!windowLeavesItemsOut() || !virtualItemSizeSignal.peek()) {
      // Nothing is held outside the window yet, or the room it takes is not
      // measured: there is no blank tail to report.
      return;
    }
    const viewportRect = getScrollerViewportRect(scrollerElResolved);
    const viewportSize = horizontal ? viewportRect.width : viewportRect.height;
    if (!viewportSize) {
      // Not on screen — a list inside a closed popup, a parked subtree.
      return;
    }
    if (canScrollerScroll(scrollerElResolved, horizontal ? "x" : "y")) {
      return;
    }
    doneRef.current = true;
    const { start, end } = renderWindowRef.current;
    console.warn(
      `<List> draws ${end - start} of ${totalSignal.peek()} items and holds the room of the others, and the box its render window follows, ${getElementSignature(
        scrollerElResolved,
      )}, scrolls nothing: the window never moves and those items stay blank. Give the list a bounded height so its own scroll box scrolls, or name the box that scrolls it with scroller="parent" / "document" / {element}.`,
      { list: ref.current, scroller: scrollerElResolved },
    );
  });
};
// canScroll reads the declared overflow, which the root element answers
// "visible" to however much the page scrolls.
const canScrollerScroll = (scrollerEl, axis) => {
  if (scrollerEl !== document.scrollingElement) {
    return canScroll(scrollerEl, axis);
  }
  const scrollSize =
    axis === "x" ? scrollerEl.scrollWidth : scrollerEl.scrollHeight;
  const clientSize =
    axis === "x" ? scrollerEl.clientWidth : scrollerEl.clientHeight;
  return scrollSize - clientSize > 1;
};
// What a sticky part of the list sticks to is the nearest scroll container in
// the DOM; `scroller` has no say in it. A list told the page scrolls it can
// therefore have its group labels and its header stuck to a wrapper that never
// scrolls — and pushed down by that wrapper's scroll-padding on top of it. The
// usual culprit is an app wrapper carrying `overflow-x: auto` to keep the
// document from overflowing horizontally on mobile; `overflow-x: clip` keeps
// that guarantee without making a scroll container.
const STICKY_LIST_PART_SELECTOR = `.navi_list_item_header, .navi_list_item_footer, .navi_list_item_group_label`;
const useStickyScrollportWarning = (ref, scroller) => {
  const doneRef = useRef(false);
  useLayoutEffect(() => {
    if (!import.meta.dev || doneRef.current || scroller !== "document") {
      return;
    }
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return;
    }
    const scrollportEl = findScrollportEl(listContainerEl);
    if (!scrollportEl) {
      doneRef.current = true;
      return;
    }
    // Groups arrive with the items: nothing sticky yet only means "not yet".
    const stickyEl = listContainerEl.querySelector(STICKY_LIST_PART_SELECTOR);
    if (!stickyEl) {
      return;
    }
    doneRef.current = true;
    console.warn(
      `<List scroller="document"> is inside ${getElementSignature(
        scrollportEl,
      )}, a scroll container: its sticky group labels and header stick to that box instead of to the page. Give that box "overflow: clip" (it clips without creating a scroll container), or tell the list about it with scroller={element}.`,
      { list: listContainerEl, scrollport: scrollportEl, sticky: stickyEl },
    );
  });
};
// A list has one header: the item that caps it — the line of column titles
// over a table —
// and the box the list measures to keep the others from scrolling under it. A
// second one takes that same place, so both sit at the capped edge before
// every item and the items declared between them read as belonging to the last:
// a title meant to open a run of items ends up titling nothing. That title is a
// group label, which is why this points at List.Group rather than at the
// stacking.
const useDuplicateHeaderWarning = (ref) => {
  const doneRef = useRef(false);
  useLayoutEffect(() => {
    if (!import.meta.dev || doneRef.current) {
      return;
    }
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return;
    }
    const headerEls = listContainerEl.querySelectorAll(
      ".navi_list_item_header",
    );
    if (headerEls.length < 2) {
      return;
    }
    doneRef.current = true;
    console.warn(
      `<List> has ${headerEls.length} items carrying "header", and a list has one: they all stick to the edge it caps, before every item, and the items declared between them read as belonging to the last one. A title standing over a run of items is a group: <List.Group label="...">{items}</List.Group>.`,
      { list: listContainerEl, headers: [...headerEls] },
    );
  });
};

/**
 * "Am I stuck?" — the question a `position: sticky` element cannot ask about
 * itself. There is no selector for it, and `scroll-state(stuck: top)` does not
 * answer it either: that query styles a container's DESCENDANTS, so a part
 * cannot read its own stuck state, which is exactly the one a background, a
 * shadow or a stacking order has to depend on.
 *
 * So the list says it, on the three parts it makes sticky: `navi-stuck` while a
 * part sits at the edge it sticks to, gone while it rides along in the flow.
 * The list is the right place for it because it is the only one that knows
 * WHICH box its parts stick to — an app writing this outside would listen to
 * the window and be right only for `scroller="document"` (see getScrollerEl,
 * and useStickyScrollportWarning for the case where even the list is wrong
 * about it: a scroll container between the two, which dev mode reports).
 *
 * What reads it is navi's own z-index rule first (see --list-*-z-index above:
 * the sticky band is for a part with something scrolling under it, not for a
 * block at rest in the flow), and an app second, for anything it wants to say
 * about a part being stuck.
 */
// Fractional layout is the rule, not the exception — zoom, screen density, a
// scroller at a half-pixel offset. A part at its sticky offset can render a
// fraction short of it, and without this slack it reads as being at rest: a
// bug that shows up on one machine and not the next.
const STUCK_SLACK = 1;
// Which edge a part sticks to: the edge the list scrolls FROM for the header
// and a group label, the one it scrolls toward for the footer.
const getStickyEdge = (partEl, horizontal) => {
  if (partEl.classList.contains("navi_list_item_footer")) {
    return horizontal ? "right" : "bottom";
  }
  return horizontal ? "left" : "top";
};
// A sticky inset is measured from the scrollport — the padding box of the
// scroller, or the viewport when the page scrolls. getScrollerViewportRect
// gives the border box; the borders come off here, since a scroller with one
// would otherwise read as a pixel of scrolling already done.
const getScrollportRect = (scrollerEl) => {
  const rect = getScrollerViewportRect(scrollerEl);
  if (scrollerEl === document.scrollingElement) {
    return rect;
  }
  const top = rect.top + scrollerEl.clientTop;
  const left = rect.left + scrollerEl.clientLeft;
  return {
    top,
    left,
    bottom: top + scrollerEl.clientHeight,
    right: left + scrollerEl.clientWidth,
  };
};
const isPartStuck = (partEl, edge, scrollportRect) => {
  // The inset is read computed, not from the rule: --list-group-label-top and
  // the FixedBar space behind it are what put the label where it sticks.
  const declared = parseFloat(getComputedStyle(partEl)[edge]);
  const inset = Number.isFinite(declared) ? declared : 0;
  const rect = partEl.getBoundingClientRect();
  if (edge === "top") {
    return rect.top - scrollportRect.top <= inset + STUCK_SLACK;
  }
  if (edge === "left") {
    return rect.left - scrollportRect.left <= inset + STUCK_SLACK;
  }
  if (edge === "bottom") {
    return scrollportRect.bottom - rect.bottom <= inset + STUCK_SLACK;
  }
  return scrollportRect.right - rect.right <= inset + STUCK_SLACK;
};
const useStuckStickyParts = (
  ref,
  getScroller,
  scrollerElResolved,
  horizontal,
) => {
  // Rewritten on every render so the listeners below, registered once per
  // scroller, always run against the current geometry.
  const updateRef = useRef(null);
  updateRef.current = () => {
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return;
    }
    const partEls = listContainerEl.querySelectorAll(STICKY_LIST_PART_SELECTOR);
    if (partEls.length === 0) {
      return;
    }
    const scrollerEl = getScroller();
    if (!scrollerEl) {
      return;
    }
    // One rect per RENDERED part: virtualization already bounds how many of
    // them exist, which is what keeps this affordable on every scroll event.
    const scrollportRect = getScrollportRect(scrollerEl);
    for (const partEl of partEls) {
      const edge = getStickyEdge(partEl, horizontal);
      partEl.toggleAttribute(
        "navi-stuck",
        isPartStuck(partEl, edge, scrollportRect),
      );
    }
  };

  // Every commit, because a virtualized list changes which parts exist without
  // anything scrolling: group labels enter and leave the DOM as the window
  // moves, and one that arrives already at the edge has never been measured.
  useLayoutEffect(() => {
    updateRef.current();
  });

  useLayoutEffect(() => {
    const listContainerEl = ref.current;
    if (!listContainerEl) {
      return undefined;
    }
    const update = () => {
      // Synchronously, not on a rAF: scroll events are dispatched while the
      // frame is being put together, so the attribute lands in the same paint
      // as the scroll that caused it. A frame late is a frame of flicker.
      updateRef.current();
    };
    // A page-level scroller does not emit "scroll" on the element itself
    // (document.scrollingElement); the document does.
    const scrollerEl = getScroller();
    const scrollEventTarget =
      !scrollerEl || scrollerEl === document.scrollingElement
        ? document
        : scrollerEl;
    scrollEventTarget.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // The list growing under a scroller that has not moved — items loaded by
    // scroll, a group unfolding — changes which parts sit at an edge.
    const observer = new ResizeObserver(update);
    observer.observe(listContainerEl);
    return () => {
      scrollEventTarget.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [scrollerElResolved]);
};

// Anything but visible and clip makes a scroll container, hidden included.
const isScrollportOverflow = (overflow) =>
  overflow !== "visible" && overflow !== "clip";
const findScrollportEl = (el) => {
  const { documentElement, body } = document;
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== documentElement) {
    const { overflowX, overflowY } = getComputedStyle(ancestor);
    if (isScrollportOverflow(overflowX) || isScrollportOverflow(overflowY)) {
      // <body> keeps its overflow for itself only when <html> declares one of
      // its own; otherwise it hands it to the viewport, which is the page.
      if (ancestor === body) {
        const rootStyle = getComputedStyle(documentElement);
        if (
          !isScrollportOverflow(rootStyle.overflowX) &&
          !isScrollportOverflow(rootStyle.overflowY)
        ) {
          return null;
        }
      }
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
};

// The CSS needs to tell "the page scrolls me" from "some box around me
// scrolls me": only the first one sticks to the viewport, where the fixed bars
// are.
const getScrollerAttribute = (scroller) => {
  if (scroller === "self") {
    return undefined;
  }
  if (scroller === "document") {
    return "document";
  }
  return "parent";
};

// A radius asked for explicitly is kept: a borderless list painting a
// background of its own may want that surface rounded, and clipped to it.
const isBorderless = ({ border, borderWidth, borderRadius }) => {
  if (borderRadius !== undefined) {
    return false;
  }
  if (borderWidth !== undefined) {
    return parseFloat(borderWidth) === 0;
  }
  if (border === undefined) {
    return false;
  }
  return border === "none" || parseFloat(border) === 0;
};

// overflow lands as an inline style on the inner scroll element, which is
// enough for every value but "visible": that one only means anything once the
// frame around it stops clipping too. Reading the per-axis props over the
// shorthand mirrors how CSS itself resolves them.
const getOverflowVisibleAttribute = (overflow, overflowX, overflowY) => {
  const x = overflowX === undefined ? overflow : overflowX;
  const y = overflowY === undefined ? overflow : overflowY;
  const xVisible = x === "visible";
  const yVisible = y === "visible";
  if (xVisible && yVisible) {
    return "both";
  }
  if (xVisible) {
    return "x";
  }
  if (yVisible) {
    return "y";
  }
  return undefined;
};

// Which box the render window follows, and which box a scroll position is read
// from and written to. The list's own scroll box by default — but "self" is a
// promise about geometry, not a fact: a box given no height of its own is
// exactly as tall as its items and scrolls nothing, so what shows the list is
// then the scroll box around it. Which box that is can only be measured, and a
// measurement holds for the geometry it was taken on — see resolveScroller in
// useListScrollSync, which takes it again whenever the geometry moves.
const getScrollerEl = (listContainerEl, scroller, horizontal) => {
  if (scroller === "document") {
    return document.scrollingElement;
  }
  if (scroller && typeof scroller === "object") {
    // The caller names the scroller: an element, or a ref holding one.
    // Detection is a heuristic forever; being told is not.
    const el = scroller.nodeType === 1 ? scroller : scroller.current;
    return el || document.scrollingElement;
  }
  const axis = horizontal ? "x" : "y";
  if (scroller !== "parent") {
    const ownScrollBoxEl = listContainerEl.querySelector(
      `:scope > .navi_list_scroll_container`,
    );
    if (!ownScrollBoxEl || canScroll(ownScrollBoxEl, axis)) {
      return ownScrollBoxEl;
    }
    const outerScrollerEl = getOuterScrollerEl(listContainerEl, axis);
    if (overflowsScroller(ownScrollBoxEl, outerScrollerEl, horizontal)) {
      // The list stands taller than the box showing it: the items past that
      // box's edge are reachable only by scrolling IT, and a window following
      // a box that never moves would leave them as fillers — a list ending on
      // blank space, at exactly the height of the items never drawn.
      return outerScrollerEl;
    }
    // The whole list is in view. Its own box scrolling nothing is then the
    // truth of it, and where the list is remains a question about that box.
    return ownScrollBoxEl;
  }
  return getOuterScrollerEl(listContainerEl, axis);
};
// The scroll box the list is inside of, measured: the nearest ancestor whose
// content actually overflows it.
const getOuterScrollerEl = (listContainerEl, axis) => {
  let element = listContainerEl;
  let nearestScrollContainer = null;
  while (true) {
    const scrollContainer = getScrollContainer(element);
    if (
      !scrollContainer ||
      scrollContainer === element ||
      scrollContainer === document.documentElement ||
      scrollContainer === document.scrollingElement
    ) {
      break;
    }
    // A scroll container that declares an overflow it does not have is not the
    // one to listen to (see canScroll): the box that scrolls is above it.
    if (canScroll(scrollContainer, axis)) {
      return scrollContainer;
    }
    nearestScrollContainer = nearestScrollContainer || scrollContainer;
    element = scrollContainer;
  }
  // Nothing scrolls yet. A bounded box waiting for its first items is the one
  // that will, and until it does, holding it changes nothing — where holding
  // the page instead would drag the whole document to the end of a list that
  // is not even scrollable.
  return nearestScrollContainer || document.scrollingElement;
};
// Whether the list stands past the edges of the box showing it — on that box's
// viewport, not its box: a page-level scroller is as tall as the document.
const overflowsScroller = (listScrollBoxEl, scrollerEl, horizontal) => {
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const listRect = listScrollBoxEl.getBoundingClientRect();
  // A pixel of slack, like canScroll: a box whose content fits rounds up.
  return horizontal
    ? listRect.width - viewportRect.width > 1
    : listRect.height - viewportRect.height > 1;
};
// An item must be worth looking at once put back where it was. The offset comes
// from wherever the position was taken — another screen, another window size,
// items that wrap differently — so it is not necessarily a place this view has:
// keep enough of the item on screen for it to be the answer to "take me back
// there".
const OPEN_ITEM_MIN_VISIBLE = 24;
const resolveOpenOffset = (offset, viewportSize, itemSize) => {
  const lowest = -itemSize + OPEN_ITEM_MIN_VISIBLE;
  const highest = viewportSize - OPEN_ITEM_MIN_VISIBLE;
  if (offset < lowest) {
    return lowest < 0 ? lowest : 0;
  }
  if (offset > highest) {
    return highest < 0 ? 0 : highest;
  }
  return offset;
};

// The room an item must be given at the top (or left) of the view: the
// scroller's own scroll-padding — where a fixed bar publishes the space it
// takes — plus the item's scroll-margin, where the list puts its sticky header
// and the height of the group label it lives under. `scrollIntoView()` on an item
// lands past both; a position given as `{id, offset}` means the same place, so
// `offset` is the caller's own few pixels and not a number restating what the
// CSS already measures.
const getItemScrollInset = (scrollerEl, itemEl, horizontal) => {
  if (!itemEl) {
    return 0;
  }
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const viewportSize = horizontal ? viewportRect.width : viewportRect.height;
  const scrollerStyle = window.getComputedStyle(scrollerEl);
  const rowStyle = window.getComputedStyle(itemEl);
  const scrollPadding = resolveScrollInset(
    horizontal
      ? scrollerStyle.scrollPaddingLeft
      : scrollerStyle.scrollPaddingTop,
    viewportSize,
  );
  const scrollMargin = resolveScrollInset(
    horizontal ? rowStyle.scrollMarginLeft : rowStyle.scrollMarginTop,
    viewportSize,
  );
  return scrollPadding + scrollMargin;
};
// scroll-padding is a length, a percentage of the scrollport, or "auto" (the
// browser decides, which for placing an item means nothing).
const resolveScrollInset = (value, viewportSize) => {
  const number = parseFloat(value);
  if (!number) {
    return 0;
  }
  if (value.endsWith("%")) {
    return (number * viewportSize) / 100;
  }
  return number;
};

// The item of that name, IN THIS LIST — by the name the list knows it under
// (see ListItemUI), not the element's id. Not document.getElementById either:
// a name is only ever unique within a list — two lists on the same page can be
// showing the same collection — and a list acting on an item that belongs to
// another one is a spectacular kind of wrong (it scrolls to hold still
// something it is not even showing).
const findItemElement = (listEl, id) => {
  return listEl.querySelector(`[navi-list-item-real="${CSS.escape(id)}"]`);
};
const getItemName = (itemEl) => itemEl.getAttribute("navi-list-item-real");

// The item the user is looking at, and where it sits: what must not move when
// the list is rebuilt around it. Read off the items' own boxes, not by
// hit-testing the screen: a scrolling list takes its items out of hit-testing
// (see the navi-scrolling rule in the css above), and the scroll event is
// precisely when this is asked. `countVisible` adds how many items are on
// screen from that one on: what a list coming back there has to draw before
// anything else (see the first paint in ListUI).
const captureScrollAnchor = ({
  scrollerEl,
  listEl,
  items,
  horizontal,
  countVisible,
}) => {
  if (!scrollerEl || !listEl) {
    return null;
  }
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const listRect = listEl.getBoundingClientRect();
  const range = getListVisibleRange(viewportRect, listRect, horizontal);
  if (!range) {
    return null;
  }
  const viewportFrom = horizontal ? viewportRect.left : viewportRect.top;
  const { itemEls, index } = findItemsFrom(listEl, range.from, horizontal);
  let fallbackAnchor = null;
  for (let i = index; i < itemEls.length; i++) {
    const itemEl = itemEls[i];
    const itemRect = itemEl.getBoundingClientRect();
    const itemStart = horizontal ? itemRect.left : itemRect.top;
    if (itemStart >= range.to) {
      break;
    }
    const itemName = getItemName(itemEl);
    const item = items.find((i) => i.itemId === itemName);
    if (!item) {
      continue;
    }
    const offset = itemStart - viewportFrom;
    const anchor = { id: item.itemId, index: item.index, offset };
    if (offset >= 0) {
      if (countVisible) {
        anchor.visibleCount = countItemsStartingBefore(
          itemEls,
          i,
          range.to,
          horizontal,
        );
      }
      return anchor;
    }
    // The item under the top of the view starts above it. Good enough to hold
    // the list still, but as a position to hand out and come back to, the item
    // that STARTS in the view says it better — "this item, that far below the
    // top" reads, and can be drawn. Keep looking; this one is the fallback.
    if (!fallbackAnchor) {
      fallbackAnchor = anchor;
      if (countVisible) {
        anchor.visibleCount = countItemsStartingBefore(
          itemEls,
          i,
          range.to,
          horizontal,
        );
      }
    }
  }
  return fallbackAnchor;
};
// Two positions handed out say the same thing (see reportPosition): the same
// item, as far below the top within a pixel, as many items on screen.
const isSamePosition = (a, b) => {
  if (a.id !== b.id || a.index !== b.index) {
    return false;
  }
  if (a.visibleCount !== b.visibleCount) {
    return false;
  }
  const offsetDelta = a.offset - b.offset;
  return offsetDelta > -0.5 && offsetDelta < 0.5;
};
// How many of the items from `fromIndex` on start before `to` along the scroll
// axis — the ones on screen, when `to` is where the view ends.
const countItemsStartingBefore = (itemEls, fromIndex, to, horizontal) => {
  let index = fromIndex;
  while (index < itemEls.length) {
    const rect = itemEls[index].getBoundingClientRect();
    if ((horizontal ? rect.left : rect.top) >= to) {
      break;
    }
    index++;
  }
  return index - fromIndex;
};
// The part of the list that is on screen, along the scrolling axis. Both edges
// matter: the scroller may be larger than the list (scroller="parent") as well
// as smaller (the list scrolls inside its own box).
const getListVisibleRange = (viewportRect, listRect, horizontal) => {
  const viewportFrom = horizontal ? viewportRect.left : viewportRect.top;
  const viewportTo = horizontal ? viewportRect.right : viewportRect.bottom;
  const listFrom = horizontal ? listRect.left : listRect.top;
  const listTo = horizontal ? listRect.right : listRect.bottom;
  const from = listFrom > viewportFrom ? listFrom : viewportFrom;
  const to = listTo < viewportTo ? listTo : viewportTo;
  if (to - from < 2) {
    return null;
  }
  return { from, to };
};
// The real items of the list, and the first of them reaching past `from` along
// the scroll axis. A binary search over their boxes: the items stand in
// document order along that axis, so their far edges only grow.
const findItemsFrom = (listEl, from, horizontal) => {
  const itemEls = listEl.querySelectorAll(REAL_LIST_ITEM_SELECTOR);
  let low = 0;
  let high = itemEls.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const rect = itemEls[mid].getBoundingClientRect();
    const end = horizontal ? rect.right : rect.bottom;
    if (end > from) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return { itemEls, index: low };
};
// Whether an item belongs to this list and not to a list nested in one of its
// items (a card holding a list of its own): both carry the same attributes.
// Groups nest the items in a list of their own class, not in another list.
const isOwnItem = (itemEl, listEl) => itemEl.closest(".navi_list") === listEl;
// The item drawn at an index of the list, a stand-in or a real one.
const findItemElementAt = (listEl, index) => {
  for (const itemEl of listEl.querySelectorAll(
    `[${LIST_ITEM_INDEX_ATTRIBUTE}="${index}"]`,
  )) {
    if (isOwnItem(itemEl, listEl)) {
      return itemEl;
    }
  }
  return null;
};
// What the render window is placed and sized on (see evaluateWindow), along
// the scroll axis and in viewport coordinates: the size of the screen, the part
// of the list on it (the band), and the items drawn, in the order they stand.
// The screen is the viewport of the box that scrolls the list — what "150%"
// is a percentage of. A box that does not scroll — a list given no height, as
// tall as its items — shows no more of them than the browser does: its
// viewport is cut by the browser's, or a budget in % would draw items to fill
// a screen they make grow. A list off screen is met at its edge nearest to the
// screen, where it comes in.
const readWindowGeometry = (scrollerEl, listEl, horizontal) => {
  const scrollerRect = getScrollerViewportRect(scrollerEl);
  let screenFrom = horizontal ? scrollerRect.left : scrollerRect.top;
  let screenTo = horizontal ? scrollerRect.right : scrollerRect.bottom;
  if (!canScrollerScroll(scrollerEl, horizontal ? "x" : "y")) {
    const browserSize = horizontal
      ? document.documentElement.clientWidth
      : document.documentElement.clientHeight;
    if (screenFrom < 0) {
      screenFrom = 0;
    }
    if (screenTo > browserSize) {
      screenTo = browserSize;
    }
  }
  const screenSize = screenTo - screenFrom;
  if (screenSize < 1) {
    return null;
  }
  const listRect = listEl.getBoundingClientRect();
  const listFrom = horizontal ? listRect.left : listRect.top;
  const listTo = horizontal ? listRect.right : listRect.bottom;
  if (listTo - listFrom < 1) {
    return null;
  }
  let bandFrom = screenFrom < listFrom ? listFrom : screenFrom;
  if (bandFrom > listTo) {
    bandFrom = listTo;
  }
  let bandTo = screenTo > listTo ? listTo : screenTo;
  if (bandTo < bandFrom) {
    bandTo = bandFrom;
  }
  const items = [];
  for (const itemEl of listEl.querySelectorAll(
    `[${LIST_ITEM_INDEX_ATTRIBUTE}]`,
  )) {
    if (!isOwnItem(itemEl, listEl)) {
      continue;
    }
    const rect = itemEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Not laid out (display: none): it stands nowhere.
      continue;
    }
    items.push({
      index: Number(itemEl.getAttribute(LIST_ITEM_INDEX_ATTRIBUTE)),
      from: horizontal ? rect.left : rect.top,
      to: horizontal ? rect.right : rect.bottom,
    });
  }
  if (items.length === 0) {
    return null;
  }
  return { screenSize, bandFrom, bandTo, items };
};
// The first item the screen shows from `position` on, and the item after the
// last one it shows up to `position` (exclusive, like the window's end). An
// item drawn is read off its box; in the room a filler holds for items not
// drawn, the item is counted at the size the filler gives each of them — the
// only way a scroll position there says which item it is.
const findBandStart = (items, position, itemSize) => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (items[mid].to > position) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  const next = items[low];
  const previous = items[low - 1];
  if (!next) {
    if (!itemSize) {
      return previous.index + 1;
    }
    return previous.index + 1 + Math.floor((position - previous.to) / itemSize);
  }
  if (next.from <= position) {
    return next.index;
  }
  if (!previous) {
    if (!itemSize) {
      return next.index;
    }
    const index = next.index - Math.ceil((next.from - position) / itemSize);
    return index < 0 ? 0 : index;
  }
  if (!itemSize || next.index === previous.index + 1) {
    // Between two items that follow each other: a separator, a group label.
    return next.index;
  }
  const index =
    previous.index + 1 + Math.floor((position - previous.to) / itemSize);
  return index < next.index ? index : next.index;
};
const findBandEnd = (items, position, itemSize) => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (items[mid].from >= position) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  const previous = items[low - 1];
  const next = items[low];
  if (!previous) {
    if (!itemSize) {
      return next.index;
    }
    const index = next.index - Math.ceil((next.from - position) / itemSize) + 1;
    return index < 0 ? 0 : index;
  }
  if (previous.to >= position) {
    return previous.index + 1;
  }
  if (!itemSize || (next && next.index === previous.index + 1)) {
    return previous.index + 1;
  }
  const index =
    previous.index + 2 + Math.floor((position - previous.to) / itemSize);
  if (next && index > next.index) {
    return next.index;
  }
  return index;
};
// How much the window holds on each side of the screen, in the budget's unit:
// read off the items' boxes where they stand, or — while the list holds itself
// on an item, and the screen is where that item is going to stand (see
// evaluateWindow) — summed from what the items weigh. `null` when nothing of
// the window is drawn to be read.
const readRoomAround = ({
  hold,
  items,
  start,
  end,
  bandStart,
  bandEnd,
  bandFrom,
  bandTo,
  countsItems,
  sizeOf,
}) => {
  if (hold) {
    let roomBefore = 0;
    let roomAfter = 0;
    let index = start;
    while (index < bandStart) {
      roomBefore += sizeOf(index);
      index++;
    }
    index = bandEnd;
    while (index < end) {
      roomAfter += sizeOf(index);
      index++;
    }
    return {
      roomBefore: bandStart < start ? -1 : roomBefore,
      roomAfter: bandEnd > end ? -1 : roomAfter,
    };
  }
  if (countsItems) {
    return { roomBefore: bandStart - start, roomAfter: end - bandEnd };
  }
  let firstItem = null;
  let lastItem = null;
  for (const item of items) {
    if (item.index >= start && item.index < end) {
      if (!firstItem) {
        firstItem = item;
      }
      lastItem = item;
    }
  }
  if (!firstItem) {
    return null;
  }
  return {
    roomBefore: bandFrom - firstItem.from,
    roomAfter: lastItem.to - bandTo,
  };
};
// What each item weighs along the scroll axis, for a budget that is a size: an
// item drawn weighs the room it stands in — up to the next item, so a
// separator, or the label of a group opening above the next item, is counted
// too — and an item not drawn is taken to weigh what the drawn items at that
// edge of the window weigh. Items of one kind come together (the one-line
// items of the past, the cards ahead), and an item misjudged is weighed again
// once it is drawn (see "after slide"): a window that came up short is
// extended on the next frame, from what it measured. Weighing an item not drawn
// at the average of all items, or at the smallest an item can be so that the
// window never comes up short, walks into the cards at the one-line size,
// several at a time — the latter measured in wematch: no blank spared, 50–65 ms
// tasks while reading down through the cards.
const EDGE_SAMPLE_ITEM_COUNT = 8;
const createItemSizeReader = (items, start, end, itemSize) => {
  const sizeByIndex = new Map();
  const windowSizes = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    const next = items[i + 1];
    const size =
      next && next.index === item.index + 1
        ? next.from - item.from
        : item.to - item.from;
    sizeByIndex.set(item.index, size);
    if (item.index >= start && item.index < end) {
      windowSizes.push(size);
    }
    i++;
  }
  const averageOf = (sizes) => {
    let sum = 0;
    for (const size of sizes) {
      sum += size;
    }
    return sum / sizes.length;
  };
  const sizeOfAny =
    itemSize > 0 ? itemSize : averageOf([...sizeByIndex.values()]);
  const sizeBefore = windowSizes.length
    ? averageOf(windowSizes.slice(0, EDGE_SAMPLE_ITEM_COUNT))
    : sizeOfAny;
  const sizeAfter = windowSizes.length
    ? averageOf(windowSizes.slice(-EDGE_SAMPLE_ITEM_COUNT))
    : sizeOfAny;
  // A pixel at least: items laid side by side (columns) share a line, and all
  // but the last weigh nothing, which would walk the whole collection.
  const atLeastOnePixel = (size) => (size < 1 ? 1 : size);
  return (index) => {
    const measured = sizeByIndex.get(index);
    if (measured !== undefined) {
      return atLeastOnePixel(measured);
    }
    if (index < start) {
      return atLeastOnePixel(sizeBefore);
    }
    if (index >= end) {
      return atLeastOnePixel(sizeAfter);
    }
    return atLeastOnePixel(sizeOfAny);
  };
};
// Whether a filler (the room held for items outside the window) is what stands
// at that position along the scroll axis.
const isFillerAt = (listEl, position, horizontal) => {
  for (const fillerEl of listEl.querySelectorAll("[navi-virtual-filler]")) {
    const rect = fillerEl.getBoundingClientRect();
    const from = horizontal ? rect.left : rect.top;
    const to = horizontal ? rect.right : rect.bottom;
    if (position >= from && position < to) {
      return true;
    }
  }
  return false;
};

// Which item of the collection sits at the current scroll position. Read off
// the items' boxes when a real item is there (see captureScrollAnchor for why
// not hit-testing), and from the item size when what is on screen is only
// reserved room.
// Returns { index, item, reason } or null if nothing can be determined.
const getScrollInfo = ({
  scrollValues,
  scrollerEl,
  listEl,
  listItems,
  virtualItemSizeSignal,
  itemsPerLine,
  renderWindowRef,
  horizontal,
}) => {
  const items = listItems.itemsSignal.peek();
  const viewportRect = getScrollerViewportRect(scrollerEl);
  const listRect = listEl.getBoundingClientRect();
  const range = getListVisibleRange(viewportRect, listRect, horizontal);
  if (!range) {
    return null;
  }
  // Read from the center of the visible part of the list along the main axis.
  // The render window places half its budget before and half after the hit
  // index. Anchoring to the center maximises how many rendered items fall
  // within the visible area.
  const scanStart = (range.from + range.to) / 2;
  let hitEl = null;
  const hitFiller = isFillerAt(listEl, scanStart, horizontal);
  if (!hitFiller) {
    // The first real item from the center down, the way a probe walking down
    // from it would meet one — past a separator or a group label in between.
    const { itemEls, index } = findItemsFrom(listEl, scanStart, horizontal);
    const itemEl = itemEls[index];
    if (itemEl) {
      const itemRect = itemEl.getBoundingClientRect();
      const itemStart = horizontal ? itemRect.left : itemRect.top;
      if (itemStart < range.to) {
        hitEl = itemEl;
      }
    }
  }
  // Shared by the "hit a filler" and "hit nothing at all" cases below: both
  // mean we don't know the real on-screen index, only the scroll position,
  // so estimate from it rather than assume nothing changed.
  const estimateFromScrollPos = (reasonPrefix) => {
    // An item's share of its line: the items side by side on it take it
    // together.
    const virtualItemSize = virtualItemSizeSignal.peek() / itemsPerLine;
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
    const hitName = getItemName(hitEl);
    const item = items.find((i) => i.itemId === hitName);
    if (!item) {
      return null;
    }
    return {
      item,
      index: item.index,
      reason: `hit item at ${item.index} (${item.value})`,
    };
  }
  // No real item stands between the center and the end of what is visible.
  // Keeping the stale renderWindow here means the DOM never gets asked to
  // catch up with a scrollTop that may have jumped far away — the user ends
  // up staring at blank space. Same estimate as the hitFiller case is a safe
  // fallback: it only needs the scroll position.
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
// Measures the items currently in the DOM, edge to edge: what a filler stands in
// for is the room a run of items takes together — separators and group labels
// included — not the height of one <li>. The size of a line of them: one item
// in a list, the items side by side in a grid (`inLines`), counted where a new
// line starts.
const measureItemSize = (listEl, horizontal, inLines) => {
  let fromSkeletons = false;
  let itemEls = listEl.querySelectorAll(REAL_LIST_ITEM_SELECTOR);
  if (itemEls.length === 0) {
    fromSkeletons = true;
    // Nothing real yet: a list that knows how many items it has draws them as
    // skeletons before it holds any of them, and their height is what it can
    // reserve room with — a list arriving at its full height rather than
    // growing into it. They are only ever measured while no real item is there
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
  let lineCount = itemEls.length;
  if (inLines) {
    lineCount = 0;
    let lineFrom = -Infinity;
    for (const itemEl of itemEls) {
      const rect = itemEl.getBoundingClientRect();
      const from = horizontal ? rect.left : rect.top;
      if (from > lineFrom + 0.5) {
        lineCount++;
        lineFrom = from;
      }
    }
  }
  return {
    size: span / lineCount,
    lineCount,
    fromSkeletons,
  };
};

const useVirtualItemSizeSignal = (
  ref,
  virtualItemSizeProp = 0,
  horizontal,
  { inLines, windowLeavesItemsOut, scrolledWanted, beforeSizeChange },
) => {
  const virtualSizeSignalRef = useRef(null);
  if (!virtualSizeSignalRef.current) {
    virtualSizeSignalRef.current = signal(virtualItemSizeProp);
  }
  const virtualSizeSignal = virtualSizeSignalRef.current;
  // propagate prop changes to the signal
  if (virtualItemSizeProp && virtualSizeSignal.peek() !== virtualItemSizeProp) {
    virtualSizeSignal.value = virtualItemSizeProp;
  }
  // Every item ever measured has a say, and an equal one. An average over a
  // growing sample settles; a running average of the last window measured
  // chases it, and since the fillers hold (total - window) items, a moving
  // average moves the whole scrollbar every time the window slides over items
  // that are a little taller than usual.
  const samplesRef = useRef(null);
  if (!samplesRef.current) {
    samplesRef.current = { sum: 0, count: 0, fromSkeletons: true };
  }
  const feedSample = (measure) => {
    const samples = samplesRef.current;
    if (samples.fromSkeletons && !measure.fromSkeletons) {
      // What an item on its way looks like was a stand-in for what an item looks
      // like. The first real ones settle the question.
      samples.sum = 0;
      samples.count = 0;
      samples.fromSkeletons = false;
    } else if (measure.fromSkeletons) {
      if (!samples.fromSkeletons || samples.count > 0) {
        // Items on their way are given the size this very estimate holds, so
        // measuring them again says nothing — and would say it in a loop: the
        // size sets their height, their height sets the size. They seed it
        // once, when there is nothing else to go on, and never again.
        return;
      }
    }
    samples.sum += measure.size * measure.lineCount;
    samples.count += measure.lineCount;
    const next = samples.sum / samples.count;
    const current = virtualSizeSignal.peek();
    if (Math.abs(next - current) > VIRTUAL_ITEM_SIZE_EPSILON) {
      beforeSizeChange();
      virtualSizeSignal.value = next;
    }
  };
  // Re-measured during render, not in a layout effect: the fillers read this
  // signal while rendering just below, so the new size lands in the same commit
  // as the items it was measured on. Written from a layout effect it would
  // resize them one commit later — after the scroll anchoring of that commit
  // had already run, which is exactly the jump anchoring exists to prevent.
  // And only while some items are held off screen: the fillers are what the
  // size is for, and a list drawing every item it has would pay a layout on
  // each of its renders for a number nothing reads.
  const sizeAlreadyKnown = virtualSizeSignal.peek() !== 0;
  const itemsHeldOffScreen = windowLeavesItemsOut();
  if (
    !virtualItemSizeProp &&
    sizeAlreadyKnown &&
    itemsHeldOffScreen &&
    ref.current
  ) {
    const listEl = ref.current.querySelector(".navi_list");
    const measure = listEl
      ? measureItemSize(listEl, horizontal, inLines)
      : null;
    if (measure) {
      feedSample(measure);
    }
  }
  useLayoutEffect(() => {
    if (virtualSizeSignal.peek() !== 0) {
      return undefined;
    }
    // Measured only for what reads the size: the fillers of items held off
    // screen, and a list held somewhere (placeWhereHeld) before it knows where
    // that is. A list drawing every item it has, opening at its start, would
    // pay a layout in every commit for a number nobody reads.
    const sizeRead =
      windowLeavesItemsOut() ||
      (scrolledWanted !== undefined && scrolledWanted !== "start");
    if (!sizeRead) {
      return undefined;
    }
    const listEl = ref.current?.querySelector(".navi_list");
    if (!listEl) {
      return undefined;
    }
    const measure = measureItemSize(listEl, horizontal, inLines);
    if (measure) {
      const samples = samplesRef.current;
      samples.sum = measure.size * measure.lineCount;
      samples.count = measure.lineCount;
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
  listItems,
  renderWindow,
  fallback,
  fallbackShown,
  searchFallback,
  searchFallbackShown,
  loadingPlaceholderShown,
  error,
  searchNoMatchMode,
  separator,
  itemTransition,
  horizontal,
  spacing,
  columns,
  itemColumns,
  children,
  ...rest
}) => {
  // No empty/no-match message while a loading placeholder or an error message
  // is on screen — that IS the content, even though no items are tracked yet.
  // A loading state drawing nothing keeps the message: an announced count of 0
  // already tells us the list is empty (see ListUI's loadingPlaceholderShown).
  const suppressFallback = loadingPlaceholderShown || Boolean(error);

  // One track, one template: the two column props are the same
  // grid-template-columns seen from either end, and only differ in what an
  // item does with it (see useItemColumnsOverrideProps).
  if (columns && itemColumns) {
    console.warn(
      `List: "columns" and "itemColumns" cannot both be set — they define the same track. "columns" lays the items into the columns; "itemColumns" gives each item the columns its own children fill.`,
    );
  }
  const trackColumns = columns || itemColumns;

  return (
    <Box
      as="ul"
      flex={trackColumns ? undefined : horizontal ? "x" : "y"}
      grid={trackColumns ? true : undefined}
      gridTemplateColumns={trackColumns}
      {...rest}
      spacing={spacing}
      baseClassName="navi_list"
    >
      {!suppressFallback && searchFallbackShown && (
        <SearchFallback searchFallback={searchFallback} />
      )}
      {!suppressFallback && fallbackShown && <Fallback fallback={fallback} />}
      <SearchNoMatchModeContext.Provider value={searchNoMatchMode}>
        <RenderWindowContext.Provider value={renderWindow}>
          <SeparatorContext.Provider value={separator ?? null}>
            <ItemTransitionContext.Provider value={Boolean(itemTransition)}>
              <ListItemsContext.Provider value={listItems}>
                <ListRunItemContext.Provider value={null}>
                  <ListItemColumnsContext.Provider
                    value={columns ? null : itemColumns || null}
                  >
                    <ListDeclaredChildren>{children}</ListDeclaredChildren>
                  </ListItemColumnsContext.Provider>
                </ListRunItemContext.Provider>
              </ListItemsContext.Provider>
            </ItemTransitionContext.Provider>
          </SeparatorContext.Provider>
        </RenderWindowContext.Provider>
      </SearchNoMatchModeContext.Provider>
    </Box>
  );
};

// The "no match" message. Whether it shows is decided by ListUI (see its
// searchFallbackShown): a search left nothing to display, and the caller did
// not disable it.
const SearchFallback = ({ searchFallback }) => {
  if (searchFallback === undefined) {
    searchFallback = naviI18n("list.no_match");
  }
  return (
    <ListItem
      role="presentation"
      className="navi_list_item navi_list_search_fallback"
      navi-default={typeof searchFallback === "string" ? "" : undefined}
    >
      {searchFallback}
    </ListItem>
  );
};
// The "empty list" message. Whether it shows is decided by ListUI (see its
// emptyFallbackShown) — not during a search: an empty search result is a
// "no match" state (SearchFallback), not an empty-list state.
const Fallback = ({ fallback }) => {
  if (fallback === undefined) {
    fallback = naviI18n("list.empty");
  }
  return (
    <ListItem
      role="presentation"
      className="navi_list_item navi_list_fallback"
      navi-default={typeof fallback === "string" ? "" : undefined}
    >
      {fallback}
    </ListItem>
  );
};
// Reads the item size itself: it is what the size is for, and a run holding
// every item it draws must not be redrawn — every item of it — because the size
// settled after the first commit.
// It holds lines: the items side by side on one take its room together, and a
// last line left short takes it all the same.
const VirtualFiller = ({ edge, itemCount, itemsPerLine, findChunks }) => {
  const listItems = useContext(ListItemsContext);
  const lineSize = listItems.virtualItemSizeSignal.value;
  const sizeToFill = Math.ceil(itemCount / itemsPerLine) * lineSize;
  // A filler resizing moves what stands below it — the items on screen, when it
  // holds the room of items above them — and it resizes in a commit of its own
  // when the item size settles after the list has rendered: the list puts its
  // view back from here too (see holdViewStill).
  useLayoutEffect(() => {
    listItems.holdViewStill();
  }, [sizeToFill]);
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
        "--x-find-line-size": findChunks
          ? `${lineSize / itemsPerLine}px`
          : undefined,
      }}
    >
      {findChunks &&
        findChunks.map((chunk) => (
          <div
            // The browser removes the attribute of the chunk it reveals, and
            // preact, handed the same prop again, would not put it back: a
            // chunk whose items change is another element, hidden again.
            key={`${chunk.from}_${chunk.to}`}
            className="navi_list_find_stand_in"
            hidden="until-found"
            style={{ "--x-find-line-count": chunk.to - chunk.from }}
          >
            {chunk.text}
          </div>
        ))}
    </li>
  );
};

// List's own `itemColumns` prop (see ListItemColumnsContext) turns a list item
// into a subgrid row instead of a flex row: its own children become direct grid
// items of List's own <ul>, so column widths are computed from whichever
// items are actually in the DOM (the currently-windowed items plus the
// always-mounted header/footer) — real grid/table column sizing, not a
// hand-picked width. Shared by both ListItemReal (regular tracked items)
// and ListItemPresentation (header/footer/fallback items — these skip
// ListItemReal entirely via ListItemPresentationResolver below, so without
// this they'd silently stay flex rows and break column alignment against
// the rest of the grid). `flex` is force-cleared here because Box picks
// flex over grid when both are set (see box.jsx's own boxFlow resolution),
// so a caller-provided `flex` prop would otherwise silently win over this.
const useItemColumnsOverrideProps = (callerStyle) => {
  const itemColumns = useContext(ListItemColumnsContext);
  if (!itemColumns) {
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
// An item produced by <List.Items> is given its identity here rather than by the
// caller: the run knows which item of the collection this is. It has to happen
// before the rest of the chain, since what comes next derives from the id (a
// selectable item names its input after it, keyboard navigation addresses items
// by it).
const ListItemRunResolver = (props) => {
  const Next = useNextResolver();
  const runItem = useContext(ListRunItemContext);
  if (!runItem) {
    return <Next {...props} />;
  }
  const minHeight =
    props.minHeight === undefined ? runItem.itemMinHeight : props.minHeight;
  const minWidth =
    props.minWidth === undefined ? runItem.itemMinWidth : props.minWidth;
  if (runItem.skeleton && !props.skeleton) {
    return (
      <ListItemStandIn
        {...props}
        index={runItem.index}
        minHeight={minHeight}
        minWidth={minWidth}
      />
    );
  }
  return (
    <Next
      {...props}
      id={props.id || runItem.id}
      index={runItem.index}
      minHeight={minHeight}
      minWidth={minWidth}
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
  const itemColumnsOverrideProps = useItemColumnsOverrideProps(props.style);

  return <Box as="li" {...props} {...itemColumnsOverrideProps} />;
};
// A <List.Item skeleton> — a non-interactive placeholder item shown while a list
// is loading. It is presentation-only (not tracked, not selectable, aria-hidden)
// and reuses <Text loading> for the shimmer. Box layout props (padding, spacing…)
// pass through so a renderSkeleton item can match the real items' metrics; and when
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
  // Without vertical padding the bars of consecutive items touch and read as one
  // block; "s" is enough air for them to be seen as separate items.
  // eslint-disable-next-line no-unused-vars
  const { skeleton, children, paddingY = "s", index, ...rest } = props;
  const itemColumnsOverrideProps = useItemColumnsOverrideProps(rest.style);

  return (
    <Box
      as="li"
      role="presentation"
      aria-hidden="true"
      paddingY={paddingY}
      // The index of the item it stands for, when a run draws it: the window
      // is sized on skeletons like on the items they stand for.
      navi-list-item-index={index}
      {...rest}
      {...itemColumnsOverrideProps}
      baseClassName={`navi_list_item ${SKELETON_LIST_ITEM_CLASS}`}
    >
      {children ?? <Text loading />}
    </Box>
  );
};
// An item the run does not hold yet, drawn with a <List.Item> of the caller's
// (renderSkeleton) laid out like the item it announces. It stands where that
// item will be and is none: nothing names it — a position handed out, a
// selection, a count — and it is measured as a skeleton (see measureItemSize).
// Its box is an item's box, so the layout props it was given land where an
// item's do.
const ListItemStandIn = (props) => {
  // eslint-disable-next-line no-unused-vars
  const { index, id, children, ...rest } = props;
  const itemColumnsOverrideProps = useItemColumnsOverrideProps(rest.style);
  return (
    <Box
      as="li"
      role="presentation"
      aria-hidden="true"
      styleCSSVars={LIST_ITEM_STYLE_CSS_VARS}
      navi-list-item-index={index}
      {...rest}
      {...itemColumnsOverrideProps}
      baseClassName={`navi_list_item ${SKELETON_LIST_ITEM_CLASS}`}
    >
      {children}
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
  const listItems = useContext(ListItemsContext);
  const groupId = useContext(ListGroupContext);
  const searchNoMatchMode = useContext(SearchNoMatchModeContext);
  // The run this item belongs to, when it comes from one (see ListItems): it
  // gave the item its place and decided it is inside the render window.
  const runItem = useContext(ListRunItemContext);
  const slotId = useContext(ListSlotContext);
  // What the item is called in the list — the run's name for an item it draws,
  // whatever `id` the caller put on the element (a run item may need a DOM id of
  // its own, to keep clear of another element's). A position names an item by
  // this (see captureScrollAnchor), and an item asked for by name is found by
  // this (locateItem, findItemElement); the DOM id is the caller's.
  props.itemId = runItem ? runItem.id : props.id;
  // There is no standalone match/matchScore/highlight prop — participation
  // in a matching system (search, filter…) only goes through `matchInfo`
  // (e.g. useSearchText's getItemMatchInfo(item): { match, matchScore,
  // matchRanges }), so there is exactly one way to wire it up.
  const matchInfo = props.matchInfo;
  // Expose match on the item: the list counts non-matching items via
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
      if (import.meta.dev && runItem) {
        listItems.warnRunItemRemoved();
      }
    } else if (searchNoMatchMode === "invisible_and_inert") {
      props.hidden = true;
    } else if (searchNoMatchMode === "muted") {
      props.muted = true;
    }
  }
  // Where an item sits is where it was declared, full stop: a list is written in
  // the order it reads. Its slot is what says that — a search that reorders
  // items reorders the items it declares, and the slots follow. An item drawn by a
  // run already knows its place; the run gave it. The place is taken in the
  // name of this very component (idDefault, not the item's id): two components
  // may stand for the same item for a moment, one leaving as the other arrives,
  // and the one leaving must give back its own place, not the newcomer's.
  if (!runItem) {
    if (props.filtered) {
      listItems.drop(idDefault);
    } else {
      props.index = listItems.take(idDefault, 1, slotId);
    }
  }
  // Every item that renders says so, whether it was declared one by one or
  // drawn by a run: what it is (its value, whether it is selected) and whether
  // it mounts at all are written where it renders, in one place.
  listItems.draw(idDefault, {
    ownerId: runItem ? runItem.ownerId : idDefault,
    place: props.index,
    groupId,
    data: props,
  });
  useLayoutEffect(() => {
    return () => {
      listItems.erase(idDefault);
    };
  }, []);
  const separator = useContext(SeparatorContext);

  if (props.filtered) {
    return null;
  }
  const listItemVnode = <ListItemReal {...props} />;
  // The separator an item wears is the one at the gap above it: none when
  // nothing of the list stands above it (see list_items.js).
  if (!separator || listItems.isFirst(idDefault)) {
    return listItemVnode;
  }
  // The gap index, only used as the function-form argument.
  let separatorVnode = resolveSeparatorVnode(separator, props.index - 1);
  if (props.hidden) {
    // An item kept in the DOM but hidden keeps its separator, hidden with it:
    // the point of keeping an item that matches nothing is that nothing moves,
    // and a divider that leaves takes its own height away.
    separatorVnode = cloneElement(separatorVnode, {
      style: VISIBILITY_HIDDEN_STYLE,
    });
  }
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
    itemId,
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
  // An item that failed says so in place of its content, and — when the caller
  // gave it somewhere to go — carries the way out with the message: the item
  // stands for something that never happened, so acknowledging the failure is
  // what makes it leave. Making it leave is the CALLER's move, not this one's:
  // the item it stands for is the caller's, and so is whatever animates its
  // departure (navi starts no view transition of its own — the browser has to
  // see the state change, which only the caller can arrange).
  const pendingScrollRef = useContext(PendingScrollRefContext);
  const pendingScroll = pendingScrollRef.current;
  const needScrollOnMount = pendingScroll && pendingScroll.id === itemId;
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

  const itemColumnsOverrideProps = useItemColumnsOverrideProps(rest.style);
  // <List itemTransition>: the item carries the name it is to be paired by, and
  // the stylesheet turns it into a view-transition-name where a browser can
  // draw it inside the list (see the @supports block in the css above).
  const itemTransition = useContext(ItemTransitionContext);

  // Pressing an item that is busy or read-only must say why nothing happens,
  // where the press happened — a control does this through its own interaction
  // gate, and a list item has none (same situation as picker_spin's way-out
  // buttons). Caught in the capture phase so the buttons the item contains never
  // see the press either: it is the ITEM that is unavailable, not one of its
  // parts.
  const blocked = loading || readOnly;
  // The primary button only: a right (or middle) click asks the browser for its
  // own menu — copying the item's text, opening a link it holds in a tab — and
  // none of that acts on the item, so a busy item has no reason to swallow it.
  // What is layered OVER the item is not part of it: the callout explaining why
  // the item is blocked is parented to the item (that is how it is anchored), so
  // a capture-phase block would swallow the press on its own close button — the
  // callout could then never be dismissed. Anything inside a popover is someone
  // else's business.
  const isOverlaidOnItem = (event) =>
    event.target.closest && event.target.closest("[popover]");
  const blockInteraction = (event) => {
    if (event.button !== 0 || isOverlaidOnItem(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  // Whether the click about to arrive belongs to a press that started on this
  // item. A click can be delivered here without one: dismissing the callout
  // presses its close button, the callout goes away, and the click that follows
  // is delivered to whatever is now under the pointer — this item.
  const pressStartedHereRef = useRef(false);

  const calloutRef = useRef(null);
  const explainBlockedInteraction = (event) => {
    if (event.button !== 0 || isOverlaidOnItem(event)) {
      return;
    }
    pressStartedHereRef.current = true;
    // An item that IS a control has one already able to answer this, in the same
    // words it uses for the keyboard, and it is the one the callout would be
    // anchored on either way — two answers would be two callouts on one anchor,
    // toggling each other off (see `reopen` in openCallout).
    //
    // Asked before the press is blocked, not after: a gate handed an event
    // already prevented reads it as "someone else took this one" and steps
    // back without a word (see onRequestInteraction).
    const controlHost = isControlRoot(event.currentTarget)
      ? findControlHost(event.currentTarget)
      : null;
    if (controlHost) {
      dispatchRequestInteraction(controlHost, {
        event,
        name: "press on a blocked item",
      });
      blockInteraction(event);
      return;
    }
    blockInteraction(event);
    // One at a time, and not the one that just dismissed it (see the refs).
    if (calloutRef.current && calloutRef.current.opened) {
      return;
    }
    calloutRef.current = openCallout(listItemBlockedMessage(loading, props), {
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
      id={id}
      navi-list-item-real={itemId}
      navi-list-item-index={rest.index}
      {...rest}
      {...itemColumnsOverrideProps}
      index={undefined}
      selected={undefined}
      // Read by listItemBlockedMessage, not by the element.
      readOnlyMessage={undefined}
      busyMessage={undefined}
      // We use aria-hidden and not hidden because hidden would be forced to
      // display: none while here we want to keep it in the DOM to avoid layout shift
      // but visually hidden
      aria-hidden={hidden}
      inert={hidden ? true : undefined}
      navi-muted={muted ? "" : undefined}
      // An item of a list is edited item by item — created, saved, deleted — so
      // waiting on a server and being untouchable are states of the ITEM, not
      // only of a control inside it. Loading implies read-only: an item whose
      // fate is in flight must not take another order in the meantime.
      navi-loading={loading ? (loading === true ? "" : loading) : undefined}
      navi-readonly={readOnly || loading ? "" : undefined}
      aria-busy={loading ? "true" : undefined}
      aria-readonly={readOnly ? "true" : undefined}
      navi-error={error ? "" : undefined}
      data-view-transition-name={
        itemTransition ? `navi_list_item_${id}` : undefined
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
      {/* The error IS the item's content: what the item stood for did not
          happen, so showing it as if it had would be a lie — same choice as
          the list's own error, one item down. */}
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
      {/* Drawn on top of the item, taking no space: the item keeps whatever
          layout it was given (a flex row, a grid of columns…) while it waits. */}
      {loading && (
        <LoadingOutline loading color="var(--navi-loader-color)" inset={-1} />
      )}
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
};

/**
 * ListItem — one item of a list.
 *
 * Must be used inside <List>. Declared one by one, its place is where it is
 * declared; drawn by a <List.Items>, the run gives it its place and its id.
 * Either way the item registers itself with the list, which is what makes what
 * it says about itself (its value, whether it is selected) the one description
 * of it. Props not listed here are forwarded to the rendered <li> (Box layout
 * props included).
 *
 * @type {import("preact").FunctionComponent<{
 *   id?: string,
 *   selectable?: boolean,
 *   value?: any,
 *   selected?: boolean,
 *   defaultSelected?: boolean,
 *   pointed?: boolean,
 *   selectableArea?: "all" | "manual",
 *   skeleton?: boolean,
 *   error?: boolean | import("preact").ComponentChildren,
 *   onErrorDismiss?: (event: Event) => void,
 *   loading?: boolean | "adding" | "removing" | "updating",
 *   readOnly?: boolean,
 *   filtered?: boolean,
 *   hidden?: boolean,
 *   matchInfo?: {match: boolean, matchScore?: number, matchRanges?: Array<[number, number]>},
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {string} [props.id]
 *   HTML element id AND the stable identifier used by external commands
 *   (--navi-select, --navi-unselect, --navi-scroll, --navi-update). Required
 *   when items need to be targeted programmatically from outside the list;
 *   auto-generated if omitted.
 * @param {boolean} [props.selectable]
 *   The item participates in selection (radio or checkbox depending on whether
 *   the parent List has `multiple`). Requires `value` and typically a
 *   <SelectableInput /> child. Inherited from `<List selectable>` — pass
 *   `false` for an item that is only there to be read, and nothing otherwise.
 * @param {any} [props.value]
 *   The JS value emitted by the list's action/uiAction when this item is
 *   selected. Can be any type (string, number, object…).
 * @param {boolean} [props.selected]
 *   Controlled selected state. Pass `selected === value` (single) or
 *   `selected.includes(value)` (multiple) from parent state. `defaultSelected`
 *   is the uncontrolled form.
 * @param {boolean} [props.pointed]
 *   Controlled "pointed" state (the :-navi-pointed pseudo state): the item a
 *   connected control designates without selecting it.
 * @param {"all"|"manual"} [props.selectableArea="all"]
 *   Where a press selects the item. "all" is the whole item: its content is
 *   see-through to the pointer, so a press on a word, on the padding, or
 *   between two cells selects — everywhere except on what answers a press for
 *   itself (a link, a button, a control, a popup opened from the item), which
 *   keeps its own press. "manual" gives the press back to the content
 *   entirely: only the <SelectableInput /> the item draws selects.
 * @param {boolean} [props.skeleton]
 *   Render a non-interactive placeholder item (a shimmering bar) instead of a
 *   real item. This is what a `renderSkeleton` returns for an item on its way;
 *   Box layout props (padding…) pass through so the placeholder can match the
 *   real items' metrics.
 * @param {boolean|import("preact").ComponentChildren} [props.error]
 *   What this item stood for failed: the message replaces its content, styled
 *   like the list's own error. `true` shows a generic sentence. When
 *   `onErrorDismiss` is given, a dismiss button is drawn next to the message
 *   and calls it.
 * @param {boolean|"adding"|"removing"|"updating"} [props.loading]
 *   The item is waiting on something: it draws a loading outline and, like
 *   readOnly, stops taking clicks. Works on any item, not only a selectable
 *   one — a list is edited item by item. Rather than true, say WHAT it is
 *   waiting for, which is what a press on it then answers: "adding" (joining
 *   the list), "removing" (leaving it), "updating" (being saved where it is).
 *
 *   All three are about the item as a thing the LIST holds, never about the
 *   selection: a selectable item taken while its list sends says so on its own
 *   ("le choix est en cours d'enregistrement", "la sélection…" in a `multiple`
 *   list), and needs no `loading` for that.
 * @param {boolean} [props.readOnly]
 *   The item cannot be acted on: dimmed and click-through-proof, buttons inside
 *   it included.
 * @param {boolean} [props.filtered]
 *   Excluded from the visible count and removed from the DOM entirely.
 * @param {boolean} [props.hidden]
 *   Excluded from the visible count (no virtual scroll height) but kept in the
 *   DOM, invisible and inert — layout is preserved.
 * @param {{match: boolean, matchScore?: number, matchRanges?: Array<[number, number]>}} [props.matchInfo]
 *   Participation in a matching system (search, filter…): the object
 *   useSearchText's getItemMatchInfo(item) returns, or any object shaped the
 *   same way. There is no standalone match/matchScore/highlight prop —
 *   matchInfo is the only way to wire this up. `match: false` is interpreted
 *   per the List's own searchNoMatchMode ("remove" -> filtered,
 *   "invisible_and_inert" -> hidden, "muted" -> muted). `matchScore` is the
 *   item's search relevance (higher = more relevant), only read for the
 *   search-driven scroll-to-top-match behavior. `matchRanges` are [start, end]
 *   ranges highlighted via the CSS Highlight API.
 */
export const ListItem = /*#__PURE__*/ createComponentResolver(
  [
    ListItemFirstResolver,
    ListItemRunResolver,
    ListItemSkeletonResolver,
    ListItemSelectableResolver,
    ListItemHeaderOrFooterResolver,
    ListItemPresentationResolver,
    ListItemUI,
  ],
  // Rendered by the hundred, and almost always with the same primitive props:
  // a selection change re-renders the list, and every item but two has nothing
  // to change.
  { pure: true },
);

// The walk that gives the list's children their places: a slot for each of
// them, declared to the list's items all at once before any child renders,
// and handed to the child through a provider of its own — which is what lets
// the item reach it however deep the caller buried it in components of theirs.
//
// A slot is named the way preact tells the child apart: by key when it has
// one, by position otherwise, and inside the array it was given in — a nested
// array is one child to preact, so what follows the array keeps its name
// however many items the array holds. A child preact would not render (null,
// a boolean) has no slot: it is not there.
const ListDeclaredChildren = ({ children }) => {
  const listItems = useContext(ListItemsContext);
  const parentSlotId = useContext(ListSlotContext);
  if (parentSlotId !== null && listItems.slotHasOwner(parentSlotId)) {
    return children;
  }
  const slotIds = [];
  const declared = [];
  declareChildren(
    children,
    parentSlotId === null ? "" : `${parentSlotId}/`,
    slotIds,
    declared,
  );
  listItems.declareSlots(parentSlotId, slotIds);
  return <>{declared}</>;
};
const declareChildren = (children, prefix, slotIds, declared) => {
  const childArray = Array.isArray(children) ? children : [children];
  let index = 0;
  for (const child of childArray) {
    if (Array.isArray(child)) {
      declareChildren(child, `${prefix}${index}/`, slotIds, declared);
    } else if (
      child !== null &&
      child !== undefined &&
      child !== false &&
      child !== true
    ) {
      const slotId =
        child.key === undefined || child.key === null
          ? `${prefix}i${index}`
          : `${prefix}k${child.key}`;
      slotIds.push(slotId);
      declared.push(
        <ListSlotContext.Provider key={slotId} value={slotId}>
          {child}
        </ListSlotContext.Provider>,
      );
    }
    index++;
  }
};

const VISIBILITY_HIDDEN_STYLE = { visibility: "hidden" };

/**
 * List.Items — a run of items given as data rather than as one component each.
 *
 * The list renders `renderItem` only for the items inside its render window; the
 * others cost nothing but their place. A run that stands for more items than it
 * holds draws the rest as skeletons the moment they enter the window, and asks
 * for them — which is what makes an infinitely scrolled list nothing more than
 * a list that says how many items it has.
 *
 * A collection held in memory is given whole: `items={users}`. The run holds all
 * of them from the first render and never asks for anything — it is still the
 * render window that decides how many are drawn.
 *
 * A collection read a slice at a time comes from `itemsAction(range)`: the run
 * asks for what it is about to draw and keeps what it gets. The range says the
 * same thing three ways, so a source can read it however it paginates —
 * `{ start, end }` (places in the collection, a negative `start` counting back
 * from the end like `Range: items=-25`, which is what a list opening on its
 * last items asks for before it knows how many there are), `limit` (how many
 * items), and
 * `before`/`after`/`around` (the id of an item to count from, for a source
 * paginating by cursor). Answer with the items (an array — that is all of
 * them), or with a range the way a Content-Range does: `{ items, start, count }`
 * — these items, at this place, out of that many. May be async. The range also
 * carries a `signal`, aborted when the list stops wanting those items (the
 * window has moved on) — pass it to fetch to call the request off.
 *
 * A resource answers through its range reader:
 * `itemsAction={GAME.GET_RANGE.bindParams({ radar })}` — the items are upserted
 * into the store on their way in, so the list draws store items rather than
 * copies of the JSON. The list holds the slices, the store holds the objects
 * (see docs/resource.md).
 *
 * A collection that changes as a whole (a search reordering it) is a different
 * collection: with `items`, another array is another collection and the run
 * draws it from its first item; with `itemsAction`, give the run a `key` that
 * changes with it, the way one does for anything else that is not the same
 * thing anymore.
 *
 * An item says what it is where it is drawn: `renderItem` returns a
 * `<List.Item>` carrying its own props (`selectable`, `value`, `selected`…),
 * and the item registers itself with the list from there — there is no second
 * place describing the same item.
 *
 * Several runs can live in one list, next to plain `<List.Item>` children and
 * inside `<List.Group>`s; each takes its place in declaration order.
 *
 * @type {import("preact").FunctionComponent<{
 *   renderItem: (item: any, index: number, state: {refreshing: boolean}) => import("preact").ComponentChildren,
 *   findText?: (item: any, index: number) => string,
 *   items?: any[],
 *   itemsAction?: (range: {start: number, end: number, limit: number, before?: string, after?: string, around?: string, count?: number, signal: AbortSignal}) => any,
 *   count?: number,
 *   groupBy?: (item: any, index: number) => any,
 *   renderGroupLabel?: (item: any, index: number) => import("preact").ComponentChildren,
 *   groupLabelProps?: (item: any, index: number) => object,
 *   pageSize?: number,
 *   memoryBudget?: number,
 *   renderSkeleton?: false | ((index: number) => import("preact").ComponentChildren),
 *   renderError?: (failure: {error: any, retry: () => void, start: number, end: number}) => import("preact").ComponentChildren,
 *   onRequestStateChange?: (state: {busy: boolean, refreshing: boolean, range: {start: number, end: number}|null}) => void,
 * }>}
 * @param {(item: any, index: number, state: {refreshing: boolean}) => any} props.renderItem
 *   What is drawn for one item, given its data and where it sits — its place in the list,
 *   which is its rank in the collection plus whatever items are declared before
 *   the run. `state.refreshing` says the items drawn are the ones from before
 *   while the run reads the collection again — the list carries
 *   `navi-refreshing` for the same reason.
 * @param {(item: any, index: number) => string} [props.findText]
 *   The text of an item as the browser's find in page (Cmd/Ctrl + F) sees it
 *   while the item is not drawn — without it, find reaches only the items in the
 *   render window. The items held off screen then carry that text where they
 *   stand, hidden until the browser finds it there: it scrolls to the place,
 *   and the list draws the item. One line per item. An item the run does not hold
 *   yet has nothing to be found by.
 * @param {any[]} [props.items]
 *   The collection, when it is held in memory: all of it, in order. Nothing is
 *   ever asked for — `itemsAction`, `count`, `pageSize` and `memoryBudget` have
 *   no part to play, and no item is ever a skeleton. Every item takes its
 *   room, whether the run draws it or holds it in a filler: a search that
 *   is to remove items (`searchNoMatchMode="remove"`) is applied to the array
 *   itself — see `useSearchText` — not to the items it draws.
 * @param {(range: object) => any} [props.itemsAction]
 *   Where the items come from when the collection is read a slice at a time:
 *   a resource's range reader (`RESOURCE.GET_RANGE.bindParams(...)`).
 * @param {(item: any, index: number) => any} [props.groupBy]
 *   What tells items that belong together apart from the others — the day of a
 *   message, the month of a game. Consecutive items sharing it are wrapped in a
 *   `<List.Group>` whose label (`renderGroupLabel`) stays on screen for as long
 *   as one of them is. The groups are found in the data as it arrives, which is
 *   the only way a list that discovers its items page by page can have any.
 * @param {(item: any, index: number) => any} [props.renderGroupLabel]
 *   The label of the group an item opens, given that item.
 * @param {(item: any, index: number) => object} [props.groupLabelProps]
 *   The props the label of the group an item opens carries — `class`,
 *   `data-*`, anything a `<span>` takes. For a label that says something about
 *   its group (a day behind us, today, one ahead) rather than just naming it:
 *   the state then sits on the element the CSS styles, instead of being read
 *   back from a child.
 * @param {number} [props.pageSize=100]
 *   How many items to ask for at a time. A turn of the wheel opens a hole three
 *   items wide; asking for exactly that would ask again at the next turn.
 * @param {number} [props.memoryBudget=1000]
 *   How many items the run keeps in memory. Past that, the ones far from what is
 *   on screen are dropped (and asked for again if the user goes back) — the
 *   same trade the render window makes with the DOM, one order of magnitude
 *   further out. `Infinity` keeps every item the run ever received; `0` keeps
 *   only the ones around the window.
 * @param {false|(index: number) => any} [props.renderSkeleton]
 *   What to draw for an item the run does not hold. Defaults to List's own
 *   `renderSkeleton`, then to a bare `<List.Item skeleton>`; `false` leaves the
 *   item empty (its room is still held, or the list would jump as it loads).
 * @param {(failure: {error: any, retry: () => void, start: number, end: number}) => any} [props.renderError]
 *   What to draw where items were asked for and never came: given the `error`,
 *   a `retry` to call, and the `start`/`end` of the range that failed — the
 *   collection's own ranks, as `itemsAction` was asked for them. Defaults to an
 *   inline message with a retry button, drawn on the item the user is looking
 *   at.
 * @param {(state: {busy: boolean, refreshing: boolean, range: {start: number, end: number}|null}) => void} [props.onRequestStateChange]
 *   Called when the run starts or stops asking for items — for the screen around
 *   the list to say that it is looking (the items themselves have skeletons and
 *   `refreshing` already). `busy` covers every ask, first slice and holes
 *   opened by scrolling included; `refreshing` is the subset where items already
 *   held are being read again; `range` is what is being asked for, in the
 *   collection's own ranks as `itemsAction` sees them, `null` once nothing is.
 *   A range called off and asked again right away stays one `busy`, and a list
 *   unmounted while asking says `busy: false` on its way out.
 */
export const ListItems = ({
  items,
  itemsAction,
  count,
  memoryBudget,
  onRequestStateChange,
  ...runProps
}) => {
  const store = useItemStore({
    items,
    count,
    itemsAction,
    memoryBudget,
    onRequestStateChange,
  });
  return useRunItems(store, runProps);
};

// The items a `loading` list is told to expect (loadingSkeletonCount): a run
// holding none of them, and asking for none — they arrive through the app.
// Drawn as a run's missing items are, under the render window with fillers
// holding the room of the rest, since that is what they stand for.
const ListLoadingItems = ({ count }) => {
  return useRunItems(createStoreHoldingNothing(count), LOADING_ITEMS_PROPS);
};
const LOADING_ITEMS_PROPS = {};
const createStoreHoldingNothing = (itemCount) => {
  return {
    itemCount,
    failure: null,
    refreshing: false,
    forget: () => {},
    retry: () => {},
    getItem: () => undefined,
    eachHeld: () => {},
    holds: () => false,
    useRequestMissing: () => {},
  };
};

// How many items share one element of the text a filler carries for find in
// page (see findText). One element per item would put back the DOM nodes the
// window saves; one per filler would be revealed whole — every item of it laid
// out — by the first match found in it.
const FIND_CHUNK_ITEM_COUNT = 64;

// What a run draws: the items its window frames, a skeleton for each one the
// store does not hold, and fillers holding the room of the items outside it.
// Which items are held, and fetching the others, is the store's (see
// useItemStore).
const useRunItems = (
  store,
  {
    renderItem,
    findText,
    pageSize,
    groupBy,
    renderGroupLabel,
    groupLabelProps,
    renderSkeleton,
    renderError,
  },
) => {
  const ownerId = useId();
  const listItems = useContext(ListItemsContext);
  const slotId = useContext(ListSlotContext);
  const renderWindow = useContext(RenderWindowContext);
  const separator = useContext(SeparatorContext);
  // The vnode drawn for an item, kept by its data: a run rendering again (its window
  // moving, its first paint's budget giving way to the full one) hands preact
  // the same vnode for an item that has not changed, and preact leaves that
  // item's whole subtree alone. Only for a `renderItem` that is the same
  // function as last time — a new one may close over new state — and for an
  // item at the same index, in the same refreshing state: everything the
  // function is given.
  const itemVnodesRef = useRef(null);
  if (
    !itemVnodesRef.current ||
    itemVnodesRef.current.renderItem !== renderItem
  ) {
    itemVnodesRef.current = { renderItem, byItem: new Map() };
  }
  const itemVnodesByItem = itemVnodesRef.current.byItem;
  const renderItemSkeleton =
    renderSkeleton === undefined ? listItems.renderSkeleton : renderSkeleton;
  // An item on its way takes the room the list reserves for it: anything else
  // and the items drawn stop short of where the scroll says they are. Read
  // where an item is actually missing, and not before: the size settles after
  // the first commit, and a run holding every item it draws would otherwise be
  // redrawn whole by a number it has no use for.
  let skeletonItem = null;
  const getSkeletonItem = () => {
    if (skeletonItem) {
      return skeletonItem;
    }
    skeletonItem = {};
    const virtualItemSize = listItems.virtualItemSizeSignal.value;
    if (virtualItemSize) {
      if (listItems.horizontal) {
        skeletonItem.itemMinWidth = `${virtualItemSize}px`;
      } else {
        skeletonItem.itemMinHeight = `${virtualItemSize}px`;
      }
    }
    return skeletonItem;
  };

  const runStart = listItems.take(ownerId, store.itemCount, slotId);
  const runEnd = runStart + store.itemCount;
  // The two ways to count the same item. The list numbers its items from its own
  // first one, whatever draws it; the store numbers the collection's, straight
  // from the answer (a page lands at its own `start`). They are the same number
  // only when the run is the whole list — one item declared before it and they
  // are off by one for good. Everything below counts in items, which is what
  // frames the window and what the caller is shown; the store is spoken to in
  // ranks, and this is where the two meet.
  const rankOf = (itemIndex) => itemIndex - runStart;
  const indexOfRank = (rank) => rank + runStart;
  const getItemAt = (itemIndex) => store.getItem(rankOf(itemIndex));
  const { itemsPerLine } = renderWindow;
  const windowFrom =
    renderWindow.start > runStart ? renderWindow.start : runStart;
  const windowTo = renderWindow.end < runEnd ? renderWindow.end : runEnd;
  store.forget(rankOf(windowFrom), rankOf(windowTo));
  listItems.declareWindow(ownerId, windowFrom, windowTo);

  // The item answers to its own id when the item carries one — that is what
  // addresses it from outside (--navi-select, --navi-scroll, startAt) — and
  // otherwise to one made from the run and its place, unique within the list,
  // which is all an id has to be.
  const idOf = (item, index) =>
    item && item.id !== undefined ? item.id : `${ownerId}_${index}`;
  // Where an item named from outside actually sits. Only the run can answer:
  // items it holds but does not draw are nowhere else — a list only knows the
  // items it has drawn (they register themselves, see ListItemUI).
  listItems.setItemLocator(ownerId, (id) => {
    let found = null;
    store.eachHeld((item, rank) => {
      const itemIndex = indexOfRank(rank);
      if (found === null && idOf(item, itemIndex) === id) {
        found = itemIndex;
      }
    });
    return found;
  });
  useLayoutEffect(() => {
    return () => {
      listItems.dropItemLocator(ownerId);
      listItems.drop(ownerId);
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
  // Asked for a page at a time, not for the exact hole: a hole three items wide
  // is what one turn of the wheel opens, and a source answering three items at a
  // time is asked again at the next turn. The page is grown from the edge the
  // hole is on, which is the direction the user is going.
  let askStart = missingStart;
  let askEnd = missingEnd;
  if (missingStart !== -1) {
    const itemsPerPage = pageSize || listItems.pageSize;
    const holeSize = missingEnd - missingStart + 1;
    if (holeSize < itemsPerPage) {
      // Which way the page grows: away from the items already held, which is
      // the way the user is going.
      const heldBelow = store.holds(rankOf(missingEnd + 1));
      const heldAbove = store.holds(rankOf(missingStart - 1));
      if (heldBelow && !heldAbove) {
        askStart = missingEnd - itemsPerPage + 1;
      } else if (heldAbove && !heldBelow) {
        askEnd = missingStart + itemsPerPage - 1;
      } else {
        // A hole with nothing on either side (the scrollbar was thrown into
        // territory never visited): grow it both ways around what is on
        // screen.
        const grow = Math.floor((itemsPerPage - holeSize) / 2);
        askStart = missingStart - grow;
        askEnd = missingEnd + grow;
      }
    }
    if (askStart < runStart) {
      askStart = runStart;
    }
    if (askEnd > runEnd - 1) {
      askEnd = runEnd - 1;
    }
  }
  // The item the missing ones hang from, when there is one: a source paginating
  // by cursor ("the 50 before this one") needs an item to count from, and an
  // index is not that — items can be inserted while the list is being read.
  const itemBefore = getItemAt(askEnd + 1);
  const itemAfter = getItemAt(askStart - 1);
  // -1 is "nothing missing", not an item: it says there is nothing to ask for and
  // must reach the store as it is.
  const askRankOf = (itemIndex) => (itemIndex === -1 ? -1 : rankOf(itemIndex));
  store.useRequestMissing(
    askRankOf(askStart),
    askRankOf(askEnd),
    {
      before:
        itemBefore === undefined ? undefined : idOf(itemBefore, askEnd + 1),
      after:
        itemAfter === undefined ? undefined : idOf(itemAfter, askStart - 1),
    },
    rankOf(windowFrom),
    rankOf(windowTo),
    runStart,
  );

  // Where the sentence goes when items are missing: on the item the user is
  // looking at, clamped to the items that are actually missing. Putting it at
  // the top of the failed range would put it off screen as often as not — a
  // range asked for counting back from the end (the very first ask, before the
  // count is known) does not even have an item of its own to sit on.
  // Where items were asked for and never came: the whole run of them becomes one
  // band, which says it once instead of once per item — and holds exactly the
  // room those items had, so nothing above or below moves and the scrollbar does
  // not jump. What it says is stuck to the top of the band: as long as any part
  // of the hole is on screen, the sentence is too, without a callout floating
  // away from what it is about.
  // The range that failed is the one that was asked for, so it is in ranks; the
  // band is drawn among the items. A negative start is not a rank but a count
  // back from the end (the very first ask, before the count is known) — there
  // is no item to convert it to, and the band falls back to the window.
  let failureFrom =
    store.failure === null
      ? -1
      : store.failure.start < 0 || indexOfRank(store.failure.start) < windowFrom
        ? windowFrom
        : indexOfRank(store.failure.start);
  let failureTo =
    store.failure === null
      ? -1
      : store.failure.end < 0 || indexOfRank(store.failure.end) > windowTo - 1
        ? windowTo - 1
        : indexOfRank(store.failure.end);
  if (store.failure !== null && itemsPerLine > 1) {
    // In a grid the band takes whole lines, like the window: begun mid-line,
    // it would push every item after it into another column.
    failureFrom -= failureFrom % itemsPerLine;
    if (failureFrom < windowFrom) {
      failureFrom = windowFrom;
    }
    failureTo += itemsPerLine - 1 - (failureTo % itemsPerLine);
    if (failureTo > windowTo - 1) {
      failureTo = windowTo - 1;
    }
  }
  const nodes = [];
  // Items that belong together, as the data says (a day of messages, a month of
  // games): consecutive items sharing a group key are wrapped in one group, so
  // its label can stay on screen for as long as any of them is. The wrapper is
  // rebuilt as the window slides — a group holds the items of its day that are
  // currently drawn, which is exactly the span its label has to survive.
  let group = null;
  // Two groups can still share a key (a failure band standing mid-group, data
  // not sorted by group): the later ones are told apart by their rank among
  // them, so the first keeps its element. A group keyed by where it starts
  // would lose its element each time the window slides past its first item.
  const groupCountByKey = new Map();
  const closeGroup = () => {
    if (!group) {
      return;
    }
    const groupCount = (groupCountByKey.get(group.key) || 0) + 1;
    groupCountByKey.set(group.key, groupCount);
    nodes.push(
      <ListItemGroup
        key={
          groupCount === 1
            ? `${ownerId}_group_${group.key}`
            : `${ownerId}_group_${group.key}_${groupCount}`
        }
        label={group.label}
        labelProps={group.labelProps}
      >
        {group.children}
      </ListItemGroup>,
    );
    group = null;
  };
  // An item not held has no group of its own. Between two items of the open
  // group it is a line of that group whose content has not arrived: drawn
  // outside, it would cut the group in two and show its label twice. A hole at
  // a group's edge stays outside — nothing says which side it belongs to.
  let holeTo = -1;
  let holeGroupKey;
  const groupKeyOfHole = (itemIndex) => {
    if (itemIndex < holeTo) {
      return holeGroupKey;
    }
    holeTo = itemIndex + 1;
    while (
      holeTo < windowTo &&
      holeTo !== failureFrom &&
      getItemAt(holeTo) === undefined
    ) {
      holeTo++;
    }
    holeGroupKey = undefined;
    if (group && holeTo < windowTo && holeTo !== failureFrom) {
      const keyAfterHole = groupBy(getItemAt(holeTo), holeTo);
      if (keyAfterHole === group.key) {
        holeGroupKey = keyAfterHole;
      }
    }
    return holeGroupKey;
  };
  // Which group an item belongs to, or undefined when it belongs to none.
  const groupKeyOf = (item, itemIndex) => {
    if (!groupBy) {
      return undefined;
    }
    if (item === undefined) {
      return groupKeyOfHole(itemIndex);
    }
    return groupBy(item, itemIndex);
  };
  const pushItem = (itemNode, item, itemIndex, groupKey) => {
    if (groupKey === undefined) {
      closeGroup();
      nodes.push(itemNode);
      return;
    }
    if (!group || group.key !== groupKey) {
      closeGroup();
      group = {
        key: groupKey,
        label: renderGroupLabel ? renderGroupLabel(item, itemIndex) : groupKey,
        labelProps: groupLabelProps
          ? groupLabelProps(item, itemIndex)
          : undefined,
        children: [],
      };
    }
    group.children.push(itemNode);
  };
  // The text of the items a filler stands for, cut in chunks aligned on the
  // run's own ranks: the window sliding changes the chunk at its edge and
  // leaves the others as they are.
  const getFindChunks = (from, to) => {
    if (!findText) {
      return null;
    }
    const chunks = [];
    let chunkFrom = from;
    while (chunkFrom < to) {
      const chunkIndex = Math.floor(rankOf(chunkFrom) / FIND_CHUNK_ITEM_COUNT);
      const alignedTo = indexOfRank((chunkIndex + 1) * FIND_CHUNK_ITEM_COUNT);
      const chunkTo = alignedTo < to ? alignedTo : to;
      const lines = [];
      let lineIndex = chunkFrom;
      while (lineIndex < chunkTo) {
        const item = getItemAt(lineIndex);
        // An item not held has nothing to find, but keeps its line: the items
        // after it stay at their place.
        lines.push(
          item === undefined ? "" : toFindLine(findText(item, lineIndex)),
        );
        lineIndex++;
      }
      chunks.push({ from: chunkFrom, to: chunkTo, text: lines.join("\n") });
      chunkFrom = chunkTo;
    }
    return chunks;
  };
  // The room held for this run's own items that the window leaves out. It
  // belongs to the run and not to the list: a list is not necessarily made of
  // one run, and what sits before or after it (a header, items given one by
  // one) is not virtualized at all.
  if (windowFrom > runStart) {
    nodes.push(
      <VirtualFiller
        key="navi-list-filler-before"
        edge="before"
        itemCount={windowFrom - runStart}
        itemsPerLine={itemsPerLine}
        findChunks={getFindChunks(runStart, windowFrom)}
      />,
    );
  }
  const renderItemState = { refreshing: store.refreshing };
  let itemIndex = windowFrom;
  while (itemIndex < windowTo) {
    if (itemIndex >= failureFrom && itemIndex <= failureTo) {
      closeGroup();
      const failedItemCount = failureTo - itemIndex + 1;
      nodes.push(
        <li
          key={`${ownerId}_failure_${failureFrom}`}
          className="navi_list_failed_items"
          style={{
            "--size-to-fill": `${Math.ceil(failedItemCount / itemsPerLine) * listItems.virtualItemSizeSignal.value}px`,
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
      itemIndex = failureTo + 1;
      continue;
    }
    const item = getItemAt(itemIndex);
    const key =
      item === undefined
        ? `${ownerId}_skeleton_${itemIndex}`
        : idOf(item, itemIndex);
    const groupKey = groupKeyOf(item, itemIndex);
    if (item === undefined) {
      // An item on its way never reaches ListItemUI (see ListItemSkeletonResolver):
      // it is stood among the items that mount, and given its separator, here.
      let itemVnode;
      if (renderItemSkeleton === false) {
        // The item must still take its room: without it the items below would
        // climb up and slide back down as the answer arrives.
        itemVnode = <ListItem skeleton style={VISIBILITY_HIDDEN_STYLE} />;
      } else if (renderItemSkeleton) {
        itemVnode = renderItemSkeleton(itemIndex);
      } else {
        itemVnode = <ListItem skeleton />;
      }
      if (itemVnode) {
        pushItem(
          <ListRunSkeletonItem
            key={key}
            runItem={{
              id: key,
              index: itemIndex,
              ownerId,
              skeleton: true,
              ...getSkeletonItem(),
            }}
            separator={separator}
          >
            {itemVnode}
          </ListRunSkeletonItem>,
          item,
          itemIndex,
          groupKey,
        );
      }
      itemIndex++;
      continue;
    }
    let itemVnode;
    let itemContextValue;
    const itemVnodeKept = itemVnodesByItem.get(item);
    if (
      itemVnodeKept &&
      itemVnodeKept.itemIndex === itemIndex &&
      itemVnodeKept.refreshing === renderItemState.refreshing
    ) {
      itemVnode = itemVnodeKept.vnode;
      itemContextValue = itemVnodeKept.itemContextValue;
    } else {
      itemVnode = renderItem(item, itemIndex, renderItemState);
      // Kept with the vnode, for the same reason: a context value that is a
      // fresh object on every render forces every consumer of it to render,
      // which is the item's own chain — the vnode handed back unchanged would
      // then buy nothing.
      itemContextValue = { id: key, index: itemIndex, item, ownerId };
      itemVnodesByItem.set(item, {
        vnode: itemVnode,
        itemContextValue,
        itemIndex,
        refreshing: renderItemState.refreshing,
      });
    }
    if (itemVnode) {
      pushItem(
        <ListRunItemContext.Provider key={key} value={itemContextValue}>
          {itemVnode}
        </ListRunItemContext.Provider>,
        item,
        itemIndex,
        groupKey,
      );
    }
    itemIndex++;
  }
  closeGroup();
  if (runEnd > windowTo) {
    nodes.push(
      <VirtualFiller
        key="navi-list-filler-after"
        edge="after"
        itemCount={runEnd - windowTo}
        itemsPerLine={itemsPerLine}
        findChunks={getFindChunks(windowTo, runEnd)}
      />,
    );
  }
  return nodes;
};
// One item, one line: a line break inside it would push every item below off
// its place.
const toFindLine = (text) => {
  if (text === undefined || text === null) {
    return "";
  }
  return String(text).replace(/[\r\n]+/g, " ");
};

// A run's item that has not arrived, standing where the real one will. It never
// reaches ListItemUI (see ListItemSkeletonResolver), so it is drawn among the
// items here, and wears the separator of the gap above it the way a real item
// does there.
const SKELETON_ITEM_DATA = { skeleton: true };
const ListRunSkeletonItem = ({ runItem, separator, children }) => {
  const listItems = useContext(ListItemsContext);
  const groupId = useContext(ListGroupContext);
  const entryId = useId();
  listItems.draw(entryId, {
    ownerId: runItem.ownerId,
    place: runItem.index,
    groupId,
    data: SKELETON_ITEM_DATA,
  });
  useLayoutEffect(() => {
    return () => {
      listItems.erase(entryId);
    };
  }, []);
  const itemVnode = (
    <ListRunItemContext.Provider value={runItem}>
      {children}
    </ListRunItemContext.Provider>
  );
  if (!separator || listItems.isFirst(entryId)) {
    return itemVnode;
  }
  return (
    <>
      {resolveSeparatorVnode(separator, runItem.index - 1)}
      {itemVnode}
    </>
  );
};

// What is drawn where items were asked for and never came: the sentence and the
// way out, in the item itself — the rest of the list is fine, so replacing all
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
        {error && error.message ? error.message : naviI18n("list.items_failed")}
      </span>
      <button
        type="button"
        className="navi_list_item_error_dismiss"
        onClick={retry}
      >
        {naviI18n("list.items_retry")}
      </button>
    </Box>
  );
};

// How many items a run keeps in memory before it starts dropping the ones it is
// not about to draw, and how many it keeps on either side of the window when it
// does. Sized so that a normal back-and-forth around what is on screen never
// hits the network again.
const ITEM_STORE_MAX_DEFAULT = 1000;
const ITEM_STORE_KEEP_AROUND = 250;

const rangeIsSame = (a, b) => {
  if (!a || !b) {
    return a === b;
  }
  return a.start === b.start && a.end === b.end;
};

// The items a run has, and how it gets more. Two shapes behind one reader: the
// caller holds them (items/count/itemStart), or the run asked for them and
// keeps what came back — a page saying where it lands and how many items there
// are in all is enough to place it, so the pages need not be contiguous nor
// arrive in order.
const useItemStore = ({
  items,
  count,
  itemsAction,
  memoryBudget,
  onRequestStateChange,
}) => {
  // A collection given whole (`items`) is held from the first render: nothing
  // to ask for, nothing to keep across mounts, nothing to invalidate. The rest
  // of the store then never has a hole to fill, so it stays inert on its own —
  // the asking below finds nothing missing.
  const inMemory = items !== undefined;
  // The run's asking, on the same channel as the window it asks for — they are
  // one subject: what the list is about to draw is what it goes to fetch (see
  // `useRequestMissing`, and `updateRenderWindow` which logs the other half).
  //
  // A run that decides NOT to ask is the case this exists for. It sends
  // nothing and changes no state, so nothing outside can see it: the network
  // is silent, and `onRequestStateChange` — which reports what a request is
  // doing — has no request to report. A run that declined and a run that was
  // never mounted look identical from the application's side, which makes
  // "this list stopped refreshing" a question with no observable answer.
  // Here it has one, and every pass says which.
  const debugScroll = useDebugScroll();
  // What the source kept of the collection when the screen it was on went away
  // (a range reader keeps the composition: see resource_range_reader.js). The
  // items are drawn from it right away and the window is asked for again — the
  // revalidation below, entered from a fresh mount rather than from a write.
  // A reader is an interface, not just a function that answers a range: a list
  // handed something else keeps drawing items and quietly gives up everything
  // the reader holds for it (see resource_range_reader.js).
  const warnedRef = useRef(false);
  if (import.meta.dev && !warnedRef.current) {
    if (inMemory && itemsAction !== undefined) {
      warnedRef.current = true;
      console.warn(
        `<List.Items> received both items and itemsAction: the collection is read from items, itemsAction is never called. A collection held in memory goes through items={users}; one read a slice at a time goes through itemsAction={RESOURCE.GET_RANGE.bindParams(...)}.`,
      );
    } else if (
      !inMemory &&
      typeof itemsAction === "function" &&
      !itemsAction.isRangeReader
    ) {
      warnedRef.current = true;
      console.warn(
        `<List.Items itemsAction> received a plain function, not a range reader: this list starts from zero on every mount (no composition kept), hears nothing when a write moves the collection (no invalidation), and keeps everything it loads (no memory budget). Pass RESOURCE.GET_RANGE.bindParams(...) itself; a collection held in memory goes through items={users}. To be told what the run is doing, use onRequestStateChange rather than wrapping it.`,
      );
    }
  }

  const pagesRef = useRef(null);
  const itemsRef = useRef(items);
  const itemsHeldRef = useRef(false);
  let restored = false;
  if (inMemory) {
    // The array as a whole is the collection: another array is another
    // collection, drawn from its first item (which is also why a run reading a
    // collection that changes as a whole takes a key).
    if (!pagesRef.current || itemsRef.current !== items) {
      itemsRef.current = items;
      const byIndex = new Map();
      let index = 0;
      while (index < items.length) {
        byIndex.set(index, items[index]);
        index++;
      }
      pagesRef.current = { byIndex, count: items.length };
      itemsHeldRef.current = false;
    }
  } else if (!pagesRef.current) {
    const composition =
      typeof itemsAction === "function" && itemsAction.readComposition
        ? itemsAction.readComposition()
        : null;
    if (composition && composition.count !== undefined) {
      pagesRef.current = composition;
      restored = true;
    } else {
      pagesRef.current = { byIndex: new Map(), count: undefined };
    }
  }
  const pages = pagesRef.current;
  const [, setPageVersion] = useState(0);
  // The ranks whose item is from before: the run came back to the screen, or
  // the source said the collection moved. They stay drawn until a page confirms
  // or replaces them, rank by rank. A page covers what the window framed when it
  // was asked for, and the window keeps growing meanwhile: dropping what the
  // page did not cover empties items on screen.
  const staleRanksRef = useRef(null);
  if (staleRanksRef.current === null) {
    staleRanksRef.current = restored
      ? new Set(pages.byIndex.keys())
      : new Set();
  }
  const [refreshing, setRefreshing] = useState(false);
  // A source that says when what it reads has moved (a resource range reader
  // does: see rerunOn.GET_RANGE) is heard here — a write deciding who belongs
  // to the collection is exactly what a run cannot deduce from the items it
  // holds. A source that says nothing is read once and stays as it is.
  const invalidationSignal =
    typeof itemsAction === "function" ? itemsAction.invalidationSignal : null;
  const invalidation = invalidationSignal ? invalidationSignal.value : 0;
  const invalidationRef = useRef(invalidation);
  if (invalidationRef.current !== invalidation) {
    invalidationRef.current = invalidation;
    staleRanksRef.current = new Set(pages.byIndex.keys());
  }
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
    revalidating: false,
  });
  // The items asked for that never came. Kept as a range so the list can say
  // where the hole is, and cleared by a retry — which is what makes the same
  // range askable again (see the request memory just above).
  const [failure, setFailure] = useState(null);

  const listItems = useContext(ListItemsContext);
  // The items are there, which is what the list waits for to place itself on the
  // item it is held at (see placeWhereHeld). Said from an effect: a signal read
  // during this very render must not be written during it.
  useLayoutEffect(() => {
    if (!inMemory || itemsHeldRef.current) {
      return;
    }
    itemsHeldRef.current = true;
    listItems.pagesSignal.value = listItems.pagesSignal.peek() + 1;
  });
  // Before the first answer a run does not know how many items it stands for.
  // It stands for a page of them: a list that is about to be filled looks
  // like items on their way, not like an empty list.
  const itemCount = pages.count ?? count ?? listItems.pageSize;
  useLayoutEffect(() => {
    if (!refreshing) {
      return null;
    }
    listItems.refreshingSignal.value = listItems.refreshingSignal.peek() + 1;
    return () => {
      listItems.refreshingSignal.value = listItems.refreshingSignal.peek() - 1;
    };
  }, [refreshing]);

  // What the run is doing, for the screen around the list to draw: the list has
  // its own skeletons, what is around it has to be told. Read from the request
  // itself rather than pushed from each place that touches it, so a range
  // called off and asked again right away stays one uninterrupted ask.
  const requestStateRef = useRef({
    busy: false,
    refreshing: false,
    range: null,
  });
  const onRequestStateChangeRef = useRef(onRequestStateChange);
  onRequestStateChangeRef.current = onRequestStateChange;
  const publishRequestState = () => {
    const request = requestRef.current;
    const busy = request.busy;
    const state = {
      busy,
      refreshing: busy && request.revalidating,
      range: busy ? { start: request.start, end: request.end } : null,
    };
    const previous = requestStateRef.current;
    if (
      previous.busy === state.busy &&
      previous.refreshing === state.refreshing &&
      rangeIsSame(previous.range, state.range)
    ) {
      return;
    }
    requestStateRef.current = state;
    if (onRequestStateChangeRef.current) {
      onRequestStateChangeRef.current(state);
    }
  };
  // A list taken off the screen while it was asking leaves nothing ringing
  // behind it: whoever is drawing "looking for items" has to stop.
  useLayoutEffect(() => {
    return () => {
      if (requestStateRef.current.busy && onRequestStateChangeRef.current) {
        onRequestStateChangeRef.current({
          busy: false,
          refreshing: false,
          range: null,
        });
      }
    };
  }, []);

  const store = {
    itemCount,
    failure,
    refreshing,
    // JS memory is cheap next to the DOM, but a long enough scroll accumulates
    // everything it ever went through. Items far from what is on screen are
    // dropped and simply asked for again if the user goes back — the same
    // trade the render window makes, one order of magnitude further out.
    forget: (windowFrom, windowTo) => {
      if (inMemory) {
        // Dropping an item here would drop it for good: there is no source to
        // ask it back from.
        return;
      }
      const budget =
        memoryBudget === undefined ? ITEM_STORE_MAX_DEFAULT : memoryBudget;
      const keepFrom = windowFrom - ITEM_STORE_KEEP_AROUND;
      const keepTo = windowTo + ITEM_STORE_KEEP_AROUND;
      if (pages.byIndex.size > budget) {
        const staleRanks = staleRanksRef.current;
        for (const index of pages.byIndex.keys()) {
          if (index < keepFrom || index > keepTo) {
            pages.byIndex.delete(index);
            staleRanks.delete(index);
          }
        }
      }
      if (typeof itemsAction === "function" && itemsAction.trimComposition) {
        itemsAction.trimComposition(keepFrom, keepTo, budget);
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
      runStart,
    ) => {
      // Everything here counts the collection's own ranks: the run converts
      // what it hands over (see rankOf). The one thing read from the list
      // itself is where it is being held, which is a list item.
      const rankOfIndex = (itemIndex) => itemIndex - runStart;
      // The very first ask has nothing to go on: the run does not even know
      // how many items there are, so it asks for the items the list would open
      // on — counting back from the end when that is where it opens, the way
      // an HTTP range does.
      const budget = listItems.pageSize;
      let start = missingStart;
      let end = missingEnd;
      let around;
      // The window draws items from before: they are asked for again, and stay
      // drawn meanwhile.
      const staleRanks = staleRanksRef.current;
      let staleFrom = -1;
      let staleTo = -1;
      if (staleRanks.size > 0) {
        let rank = windowFrom;
        while (rank < windowTo) {
          if (staleRanks.has(rank)) {
            if (staleFrom === -1) {
              staleFrom = rank;
            }
            staleTo = rank;
          }
          rank++;
        }
      }
      const revalidating = staleFrom !== -1;
      // The list is held on an item nothing on screen leads to: the items it holds
      // do not contain it, so no window it could draw will ever bring it. Only
      // asking for it by name does.
      const wanted = listItems.scrolled;
      const askingAroundWantedItem =
        revalidating &&
        // Only while the hold stands: once the user has taken the list over,
        // the reading position is where they are, not where it opened.
        listItems.holdPending &&
        wanted &&
        typeof wanted === "object" &&
        wanted.id !== undefined &&
        listItems.locateItem(wanted.id) === null;
      if (askingAroundWantedItem) {
        around = wanted.id;
        // Where it stood when it was written down is enough to frame the ask;
        // the answer says where it really landed.
        const from =
          typeof wanted.index === "number"
            ? rankOfIndex(wanted.index) - Math.floor(budget / 2)
            : 0;
        start = from < 0 ? 0 : from;
        end = start + budget - 1;
      } else if (revalidating) {
        // The items from before that the window draws, and the missing ones
        // with them: one ask.
        if (start === -1 || staleFrom < start) {
          start = staleFrom;
        }
        if (staleTo > end) {
          end = staleTo;
        }
        // Grown over the items from before on either side, up to a page: the
        // window grows past its first picture right after it is painted, and
        // what it grows onto would otherwise be asked for once more.
        while (end - start + 1 < budget) {
          const staleBefore = staleRanks.has(start - 1);
          const staleAfter = staleRanks.has(end + 1);
          if (!staleBefore && !staleAfter) {
            break;
          }
          if (staleBefore) {
            start--;
          }
          if (staleAfter && end - start + 1 < budget) {
            end++;
          }
        }
        // Anchored on the first item from before on screen: a source
        // paginating by cursor gets an item to count from, and the reading
        // position is what must survive.
        const firstStale = pages.byIndex.get(staleFrom);
        if (firstStale && firstStale.id !== undefined) {
          around = firstStale.id;
        }
      } else if (pages.count === undefined) {
        const scrolled = listItems.scrolled;
        if (scrolled === "end") {
          // Counting back from the end, the way an HTTP range does: a list
          // opening on its last items asks for them before it knows how many
          // there are.
          start = -budget;
          end = -1;
        } else if (scrolled && scrolled.id !== undefined) {
          // Asked for by name, since a place can have changed hands since it
          // was written down — but the place it had is sent too, so a source
          // that paginates by index has something to work with, and the answer
          // says where it really landed (see the page's own `start`).
          const from =
            typeof scrolled.index === "number"
              ? rankOfIndex(scrolled.index) - Math.floor(budget / 2)
              : 0;
          start = from < 0 ? 0 : from;
          end = start + budget - 1;
          around = scrolled.id;
        } else {
          const first =
            typeof scrolled === "number"
              ? rankOfIndex(scrolled) - Math.floor(budget / 2)
              : 0;
          start = first < 0 ? 0 : first;
          end = start + budget - 1;
        }
      }
      const ask = () => {
        // One line per pass, whatever the outcome — an absence in the trace
        // then means the run did not render, which is a different fact from
        // the run choosing not to ask. The state that decides is on the line
        // rather than left to be inferred: `revalidating` says the run knows
        // what it holds is from before, `holdPending` that the list is on its
        // way somewhere the window does not frame yet, `count` that it knows
        // how many items it stands for.
        const debugAsk = (outcome) => {
          debugScroll(
            `ask ${start}-${end}: ${outcome}`,
            `(revalidating=${revalidating} holdPending=${listItems.holdPending} count=${pages.count})`,
          );
        };
        if (start === -1) {
          // Nothing missing and nothing to revalidate: the run has what it
          // draws.
          debugAsk("nothing missing");
          return;
        }
        if (
          listItems.holdPending &&
          pages.count !== undefined &&
          !askingAroundWantedItem
        ) {
          // The one ask a hold lets through: the item the list is held on is
          // what would lift the hold, and nothing else is going to bring it.
          debugAsk("held on an item not reached yet");
          return;
        }
        const request = requestRef.current;
        if (revalidating && request.busy) {
          if (request.revalidating) {
            debugAsk("already revalidating");
            return;
          }
          // A page asked for before the items went stale answers for the
          // collection as it was.
          request.controller?.abort();
          request.busy = false;
        }
        if (request.busy) {
          // Still worth waiting for as long as what it went to fetch is still
          // what the list would draw. Once it is not, it is called off — and
          // whatever comes back anyway is kept all the same (see done): paid
          // for, and maybe useful when the user comes back this way.
          // Nothing to compare a request to while the run does not know how
          // many items it stands for: what the window frames then is a
          // placeholder, not a place. The first answer is what the list is
          // waiting for to exist at all.
          const stillWanted =
            pages.count === undefined ||
            (request.start <= windowTo && request.end >= windowFrom);
          if (stillWanted) {
            debugAsk("a request still covers this window");
            return;
          }
          request.controller?.abort();
          request.busy = false;
        }
        // Asking again for a range that was already asked for, having received
        // nothing since, can only produce the same answer — unless the
        // collection moved since, which is what an invalidation says.
        const held = `${pages.byIndex.size}/${staleRanks.size}/${invalidation}`;
        if (
          request.start === start &&
          request.end === end &&
          request.held === held
        ) {
          debugAsk("this range was asked for already");
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
          // A cursor names an item of the collection as it was; a revalidation
          // is asked precisely because that is what changed.
          before: revalidating ? undefined : cursor.before,
          after: revalidating ? undefined : cursor.after,
          count: pages.count,
          signal: controller.signal,
        };
        request.busy = true;
        request.revalidating = revalidating;
        debugAsk("sent");
        if (revalidating) {
          setRefreshing(true);
        }
        const done = (page) => {
          const current = generation === request.generation;
          if (current) {
            request.busy = false;
            request.revalidating = false;
            setFailure(null);
            if (revalidating) {
              setRefreshing(false);
            }
            publishRequestState();
          }
          if (revalidating && !current) {
            // Items of a composition already superseded by a newer ask: keeping
            // them would mix two states of the collection.
            return;
          }
          if (!page) {
            return;
          }
          const pageItems = Array.isArray(page) ? page : page.items;
          const pageStart = Array.isArray(page) ? 0 : (page.start ?? 0);
          const pageCount = Array.isArray(page)
            ? pageItems.length
            : (page.count ?? pageStart + pageItems.length);
          // Before the items land: what is on screen has to stay where it is,
          // and the DOM still shows the state to hold onto.
          listItems.captureAnchor();
          // An item from before is gone from where it stood when the page puts
          // it at another rank (it would be drawn twice), or when its rank is
          // past the end of the collection.
          const staleRanksNow = staleRanksRef.current;
          const pageEnd = pageStart + pageItems.length;
          let dropped = false;
          if (staleRanksNow.size > 0) {
            const pageIds = new Set();
            for (const pageItem of pageItems) {
              if (pageItem && pageItem.id !== undefined) {
                pageIds.add(pageItem.id);
              }
            }
            for (const rank of staleRanksNow) {
              if (rank >= pageStart && rank < pageEnd) {
                continue;
              }
              const staleItem = pages.byIndex.get(rank);
              if (
                rank >= pageCount ||
                (staleItem && pageIds.has(staleItem.id))
              ) {
                staleRanksNow.delete(rank);
                pages.byIndex.delete(rank);
                dropped = true;
              }
            }
          }
          let i = 0;
          while (i < pageItems.length) {
            pages.byIndex.set(pageStart + i, pageItems[i]);
            staleRanksNow.delete(pageStart + i);
            i++;
          }
          pages.count = pageCount;
          // Which rank holds which id, kept by the source so a list drawing
          // this collection again finds it drawn (see readComposition above).
          if (itemsAction.writeComposition) {
            itemsAction.writeComposition({
              byIndex: pages.byIndex,
              count: pageCount,
              replace: dropped,
            });
          }
          listItems.pagesSignal.value = listItems.pagesSignal.peek() + 1;
          setPageVersion((version) => version + 1);
        };
        const failed = (error) => {
          if (generation !== request.generation || controller.signal.aborted) {
            // Called off on purpose: not a failure, and nothing to say about it.
            return;
          }
          request.busy = false;
          request.revalidating = false;
          publishRequestState();
          if (revalidating) {
            // The items from before stay, and are not asked for again until the
            // source says the collection moved: a revalidation that failed has
            // nothing better to put in their place.
            let rank = start;
            while (rank <= end) {
              staleRanksRef.current.delete(rank);
              rank++;
            }
            setRefreshing(false);
            return;
          }
          setFailure({ start, end, error });
        };
        let result;
        try {
          if (typeof itemsAction !== "function") {
            throw new TypeError(
              `itemsAction must be a function, received ${itemsAction}. A resource feeds a list through its range reader: itemsAction={RESOURCE.GET_RANGE.bindParams(...)} — its other actions keep one response and cannot answer a range.`,
            );
          }
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
      };
      useLayoutEffect(() => {
        ask();
        publishRequestState();
      });
    },
  };
  return store;
};

/**
 * List.Group — a labeled group of list items.
 *
 * Renders a <li role="presentation"> wrapper containing a label span
 * (accessible via aria-labelledby) and a <ul role="group"> for the items.
 *
 * Props:
 *   label            — group label content
 *   labelProps       — props forwarded to the label <span>
 *   hiddenWhileEmpty — the group leaves the flow (`display: none`) while it
 *                      holds no real item — a search that emptied it, items not
 *                      arrived yet
 *   ...rest          — forwarded to the outer <li role="presentation">
 */
export const ListItemGroup = ({
  label,
  labelProps,
  hiddenWhileEmpty,
  children,
  ...rest
}) => {
  const groupId = useId();
  const listItems = useContext(ListItemsContext);
  const group = listItems.group(groupId);
  useLayoutEffect(() => {
    return () => {
      listItems.dropGroup(groupId);
    };
  }, []);
  const searchNoMatchMode = useContext(SearchNoMatchModeContext);
  const groupItemCount = group.countSignal.value;
  const groupNoMatchCount = group.noMatchCountSignal.value;
  // Every item of this group failed the search: the label has nothing left to
  // title. "remove" empties the group on its own (and hiddenWhileEmpty takes it
  // out of the flow), "muted" keeps the items readable so the label stays useful
  // — only "invisible_and_inert" would leave a title floating over blank space.
  const labelHidden =
    searchNoMatchMode === "invisible_and_inert" &&
    groupNoMatchCount > 0 &&
    groupNoMatchCount === groupItemCount;
  const groupRef = useRef(null);
  const labelRef = useRef(null);
  useDisplayedLayoutEffect(
    labelRef,
    (labelEl) => {
      const groupEl = groupRef.current;
      if (!groupEl) {
        return;
      }
      const { height } = labelEl.getBoundingClientRect();
      groupEl.style.setProperty("--list-group-label-height", `${height}px`);
    },
    [],
  );

  const {
    className: labelClassName,
    class: labelClass,
    ...labelRest
  } = labelProps || {};

  return (
    <ListItem
      {...rest}
      ref={groupRef}
      baseClassName="navi_list_item_group"
      role="presentation"
      data-hidden-while-empty={hiddenWhileEmpty ? "" : undefined}
    >
      <span
        {...labelRest}
        ref={labelRef}
        id={groupId}
        className={withPropsClassName(
          "navi_list_item_group_label",
          labelClassName || labelClass,
        )}
        role="presentation"
        aria-hidden={labelHidden ? "true" : undefined}
        inert={labelHidden ? true : undefined}
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
        <ListGroupContext.Provider value={groupId}>
          <ListDeclaredChildren>{children}</ListDeclaredChildren>
        </ListGroupContext.Provider>
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

const ListResolved = /*#__PURE__*/ createComponentResolver([
  ListFirstResolver,
  ListSelectableResolver,
  ListUI,
]);

// Declared last because Item and Items are consts defined above, and they are
// folded into the declaration rather than written onto List afterwards
// (`List.Item = ListItem`): List is what createComponentResolver returns, an
// object a bundler cannot see through, so a property assigned to it later is a
// side effect it has to keep — and with it List, its items and everything they
// import, in a bundle that never renders a list. See Picker for the same shape.
/**
 * List — generic virtualized scroll container.
 * Items must use <List.Item> to participate in tracking.
 *
 * @type {import("preact").FunctionComponent<{
 *   selectable?: boolean,
 *   multiple?: boolean,
 *   deselectable?: boolean,
 *   maxLength?: number,
 *   maxLengthGuard?: number,
 *   parallelGuard?: number,
 *   standalone?: boolean,
 *   action?: (value: any) => void,
 *   uiAction?: (value: any) => void,
 *   popover?: boolean,
 *   role?: string,
 *   renderBudget?: number | string | {initial?: number | string, after?: number | string},
 *   virtualItemSize?: number,
 *   onListVisibleItemsChange?: (visibleItems: any[]) => void,
 *   scrolled?: "start" | "end" | number | {id: string, offset?: number},
 *   defaultScrolled?: "start" | "end" | number | {id: string, offset?: number},
 *   onScrolledChange?: (scrolled: {id: string, index: number, offset: number}) => void,
 *   scroller?: "self" | "parent" | "document" | Element | {current: Element},
 *   hoverWhileScrolling?: boolean,
 *   scrollResetOnNavigation?: boolean,
 *   fallback?: import("preact").ComponentChildren,
 *   searchFallback?: import("preact").ComponentChildren,
 *   searchText?: string,
 *   searchNoMatchMode?: "remove" | "invisible_and_inert" | "muted",
 *   loading?: boolean,
 *   loadingFallback?: "skeleton" | "loader" | import("preact").ComponentChildren,
 *   loadingSkeletonCount?: number,
 *   renderSkeleton?: false | ((index: number) => import("preact").ComponentChildren),
 *   error?: boolean | import("preact").ComponentChildren,
 *   separator?: boolean | import("preact").ComponentChildren,
 *   itemTransition?: boolean,
 *   lockSize?: boolean,
 *   horizontal?: boolean,
 *   spacing?: string,
 *   columns?: string,
 *   itemColumns?: string,
 *   alignX?: string,
 *   alignY?: string,
 *   flexWrap?: boolean,
 *   overflow?: string,
 *   expandX?: boolean,
 *   expandY?: boolean,
 *   expand?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {string} [props.columns]
 *   The list's own columns: a `grid-template-columns` value the ITEMS are laid
 *   into — a sheet of icons (`repeat(auto-fill, minmax(2.5rem, 1fr))`), a row of
 *   choices (`repeat(3, minmax(0, 1fr))`), a feed of covers
 *   (`repeat(auto-fill, minmax(150px, 1fr))` over a `<List.Items>`). Each item
 *   takes one cell, and an item meant to take a whole line says so for itself
 *   (`style={{ gridColumn: "1 / -1" }}`). A `<List.Items>` run is drawn in whole
 *   lines — as many items to a line as the template resolves to, read again
 *   when the list's width changes: its window starts and ends on a line, so an
 *   item is always in the column its place says, and the fillers hold the room
 *   of the lines it does not draw (`virtualItemSize` is then a line's size).
 *   That count holds only while every item of the run takes one cell: an item
 *   spanning a line, or a `groupBy`, puts the ones after it in other columns.
 * @param {string} [props.itemColumns]
 *   The columns inside an ITEM: a `grid-template-columns` value each item fills
 *   with its own children, a table whose cells line up down the list. Every item
 *   becomes a subgrid row spanning all the columns, so a column is as wide as
 *   the widest cell in it among the items actually in the DOM — real column
 *   sizing that stays right as the window moves. Rows of a table, then, where
 *   `columns` above is a grid of items; the two cannot both be set.
 * @param {string} [props.alignX]
 *   Where the items sit across the track — `alignX="center"` centres a
 *   horizontal list's row of items inside a list wider than they are. Together
 *   with `alignY`, `align` and `flexWrap`, this reaches the `<ul>` holding the
 *   items rather than the frame drawn around it: the frame's only child is the
 *   scroll box, which fills it and has nothing to arrange.
 * @param {boolean} [props.flexWrap]
 *   Lets a horizontal list's items fall to the next line instead of running
 *   past the edge — a row of choices under a `maxWidth`, say. A wrapped line
 *   holding several items is not virtualizable: a long collection laid several
 *   to a line goes in `columns`.
 * @param {string} [props.overflow]
 *   `"visible"` lets the items paint outside the list — a check in an item's
 *   corner, a badge crossing the edge. A list clips by default, which is what
 *   its rounded corners and its scroll box need, and the two cannot both be
 *   true: asking for visible gives up the clipping, corners included.
 * @param {boolean} [props.itemTransition]
 *   Names each item, so a change the application wraps in
 *   `document.startViewTransition` is seen item by item — items moving to their new
 *   place, an arriving item appearing where it lands — instead of the list
 *   cross-fading as a block. The items are drawn inside the list's own picture,
 *   so one coming from outside the visible part of the list is cut at the list's
 *   edge like any other overflow. Requires nested view transition groups
 *   (Chrome/Edge 140+): elsewhere the items are left unnamed and the change
 *   simply happens — but the browser still names the document root, so the page
 *   cross-fades as a whole unless the application says otherwise, which is its
 *   call and not the list's:
 *   ```css
 *   @supports not (view-transition-group: contain) {
 *     :root { view-transition-name: none; }
 *   }
 *   ```
 * @param {false|((index: number) => any)} [props.renderSkeleton]
 *   What an item on its way looks like — an item of the shape the real ones will
 *   have, so nothing moves when they arrive. Used for the items a `<List.Items>`
 *   stands for and does not hold yet, and for the placeholder items drawn while
 *   the whole list is `loading`. Defaults to a bare `<List.Item skeleton>`.
 * @param {"skeleton"|"loader"|import("preact").ComponentChildren} [props.loadingFallback="skeleton"]
 *   What to display in place of the items while `loading` — that is, while
 *   there is nothing to show at all: `"skeleton"` renders
 *   `loadingSkeletonCount` placeholder items (look:
 *   `renderSkeleton`), `"loader"` a single centered spinner, and
 *   anything else is rendered as-is in an item of its own. A falsy value
 *   displays nothing. A list read a slice at a time has no use for this — see
 *   `<List.Items count>`, whose not-yet-loaded items are drawn as skeletons in
 *   place, one per item, virtualized like the rest.
 * @param {number} [props.loadingSkeletonCount=3]
 *   How many items `loadingFallback="skeleton"` stands for — the number the
 *   answer will hold, so nothing moves when it arrives. Drawn under
 *   `renderBudget` like the items they stand for: the ones the window frames
 *   are skeletons, the others hold their room. `0` says the list is already
 *   known to be empty: the empty `fallback` shows right away rather than an
 *   empty frame.
 * @param {"start"|"end"|number|{id: string, index?: number, offset?: number, visibleCount?: number}} [props.defaultScrolled="start"]
 *   Where the list opens, after which the user owns the scroll — unless it is
 *   being come back to (see `scrollResetOnNavigation`). `"end"` is a
 *   thread read backwards — the last items are the ones to show, and the ones
 *   asked for first. A number opens on that item of the collection. `{id,
 *   offset}` — what `onScrolledChange` hands out — opens on a NAMED item,
 *   `offset` pixels below where the item would land on its own: the item is asked
 *   for by name (see the range's own `around`), then put back by MEASURING it,
 *   so it lands where it was even if items were inserted before it, and whatever
 *   the screen it was saved on. `offset: 0` is where a `scrollIntoView()` puts
 *   it — in front of the fixed bar the scroller gives room for, below the
 *   sticky header and the group label the item lives under — so nothing of that
 *   room has to be restated as a number by whoever asks. The `index` and
 *   `visibleCount` it also hands out say where to aim before the item is found,
 *   and how many items to draw before the first paint (see `renderBudget`).
 * @param {"start"|"end"|number|{id: string, index?: number, offset?: number, visibleCount?: number}} [props.scrolled]
 *   The same, but held: the list goes back there every time this changes, even
 *   after the user has scrolled — the caller owns where the list is (see
 *   `defaultScrolled` for the uncontrolled form, and `open`/`defaultOpen`
 *   elsewhere in navi for the same pair). When the named item turns out not to
 *   exist — a message deleted since — the list opens at `defaultScrolled`
 *   instead.
 *
 *   In every form the list holds itself there while it is still finding out
 *   how many items there are and how tall one is, and lets go the moment the
 *   user reaches for the list.
 * @param {(scrolled: {id: string, index: number, offset: number, visibleCount: number}) => void} [props.onScrolledChange]
 *   Where the list is, as the user scrolls: the item at the top of the view and
 *   how far below the place an item lands on its own (see `defaultScrolled`) it
 *   starts, and how many items are on screen from that one on. Said again for
 *   the same scroll when the screen reads differently once the items it
 *   brought are drawn, or once items landing change what it shows: the last
 *   one said is the one to keep. Keep it whole to come back to it later
 *   through `scrolled`/`defaultScrolled` — an index alone would not do, since
 *   items get inserted while a list is being read.
 * @param {number|string|{initial?: number|string, after?: number|string}} [props.renderBudget="100item"]
 *   How much of a `<List.Items>` run is in the DOM at once: the render window,
 *   which slides as the user scrolls while fillers hold the room of the items
 *   outside it. A count of items (`"100item"`, or `100`), or a size: `"300px"`,
 *   or `"150%"` of the viewport of the box that scrolls the list (see
 *   `scroller`). A size holds whatever number of items it takes — a few cards,
 *   a few dozen one-line items — which is what a list mixing items of very
 *   different sizes wants: a count right for the small ones draws screens of
 *   the big ones nobody scrolls to, and a count right for the big ones leaves
 *   blank screens when a fling crosses the small ones. Items declared one by
 *   one as `<List.Item>` children are all drawn, whatever this says — a list
 *   with more than a few dozen items gives them to a run (see docs/scroll.md,
 *   "Many rows"). The window keeps three quarters of what the screen leaves of
 *   it ahead of the scroll, and moves once that falls under half a screen; it
 *   has to hold more than the screen shows, with room for that lookahead — the
 *   list warns when it leaves less than two items beyond the screen.
 *
 *   `{ initial, after }` for a list whose first picture is taken as it is
 *   built — drawn in the click that opens a popup, or in the update callback
 *   of a route transition bringing its page back: `initial` for the picture
 *   the browser paints first, counted from the item the list opens on, and
 *   `after` from the paint on, around it. `initial: "100%"` is the screen and
 *   nothing more, whatever the items weigh: a few are drawn to be measured and
 *   the window is sized on them before the browser paints. A count
 *   (`initial: 6`) is drawn as it is, blind. Opening on a position that says
 *   how many items were on screen (`visibleCount`, see `onScrolledChange`)
 *   draws those first, whatever `initial` says. What the runs ask their
 *   source for is a page (see `<List.Items pageSize>`), whatever either says,
 *   so the first picture costs no second request.
 * @param {number} [props.virtualItemSize]
 *   The room an item not drawn is held at, in px along the scroll axis: what
 *   the fillers hold for each item outside the render window, what a scroll
 *   position inside them is read with, and the least an item on its way takes
 *   (see `renderSkeleton`). Left out, it is the average of the items measured
 *   so far — once when the list mounts, again when a popup around it opens,
 *   and after each commit while items are held off screen. Given, it is the
 *   worst case: the size every item has, or, in a list whose items differ, the
 *   smallest an item can be (a thread of one-line items and cards: the
 *   one-line size) — an item guessed too small builds one more, an item
 *   guessed too big leaves a blank (see docs/scroll.md, "What the list knows,
 *   and what it guesses"). The items drawn are measured either way: the render
 *   window is sized on them. In a grid (`columns`), the size is a line's: a
 *   card's, which the items side by side on it share.
 * @param {"self"|"parent"|"document"|Element|{current: Element}} [props.scroller="self"]
 *   Which box scrolls — and with it, which box the render window follows and
 *   which box a scroll position is read from (`onScrolledChange`). `"self"`
 *   gives the list a scroll box of its own; `"parent"` makes it virtualize
 *   against the scrollable ancestor it lives in (the page, a panel) — no scroll
 *   box nested inside another one, no height to compute.
 *
 *   `"self"` asks for a height to scroll in: a `maxHeight`, an `expandY` in a
 *   bounded parent. Given none, the list is exactly as tall as its items and its
 *   box scrolls nothing — what shows the list is then the box around it, and
 *   that is what the window follows (the measured walk below), rather than a
 *   window standing still over a list ending on blank space. In dev the list
 *   warns when nothing scrolls it at all.
 *
 *   `"parent"` finds that ancestor by measuring: the nearest one whose content
 *   actually overflows it, the page if none does. Declaring `overflow` is not
 *   enough to be picked (a box with `overflow-x: auto` that grows with its
 *   content computes `overflow-y: auto` without ever scrolling), and the
 *   answer is taken again as the geometry moves, so an ancestor that starts to
 *   scroll once it fills up is picked up then. When that is still not the box
 *   you mean, say so: `"document"`, or the element itself (a ref works) —
 *   nothing is guessed then.
 * @param {boolean} [props.hoverWhileScrolling=false]
 *   Whether the items still answer the pointer while the scroller they live in
 *   is moving. They do not by default: a scroll slides the items under a
 *   motionless pointer, so the browser reports a hover on each of them, and
 *   the user asked to scroll, not to hover. The cost of taking them at face
 *   value is paid by whatever hover triggers — a highlight elsewhere in the
 *   tree, a prefetch, a map — at the worst moment, mid-scroll.
 *
 *   Pass `true` for a list whose items must stay live under the pointer while
 *   it scrolls. The trade of the default is the mirror one: right after a
 *   scroll, the item under the pointer lights up only once the pointer moves.
 * @param {boolean} [props.scrollResetOnNavigation=false]
 *   A list that opens the same way every time. Without it the list comes back
 *   where it was when its screen is left and come back to — the way the page
 *   does, and for a list that scrolls itself the page's own restoration cannot
 *   see. The position is kept under the list's `id` and the page's url, for
 *   the session (a reload comes back too); a list without an `id` of its own
 *   has nothing to be remembered by. A fresh arrival at the page opens at
 *   `defaultScrolled` either way, and so does a list the caller holds through
 *   `scrolled`.
 * @param {boolean} [props.deselectable]
 *   A single-select list allowed to hold nothing: the selected item, pressed
 *   again, lets go. Without it the list is a radio group — a choice, once
 *   made, moves to another item but never goes away. A `multiple` list toggles
 *   its items already.
 * @param {number} [props.maxLength]
 *   How many items a `selectable multiple` list accepts — the same word, and
 *   the same behaviour, as `maxLength` on a text field: a rule the list is
 *   judged against, not a wall. A longer selection is allowed to exist and is
 *   reported as invalid, which is what lets a value coming from elsewhere (an
 *   API, a URL) be shown and then corrected.
 * @param {number} [props.maxLengthGuard]
 *   The same limit, enforced as the selection is made: while the list holds as
 *   many items as it accepts, the ones not selected go read-only — still
 *   pointable, focusable and pressable, answering `"[max] max."` instead of
 *   taking — and `uiAction` is not called. The selected ones stay takeable
 *   back, so a selection that arrived too long can always be brought back
 *   under the limit. Implies `maxLength` for validity.
 * @param {number} [props.parallelGuard=4]
 *   How many runs the items may have in flight at once, for a list whose items
 *   carry their own `action` (a button per item). While that many are out, every
 *   control that would start another run goes read-only and says how many it is
 *   waiting on; the next press is possible again as soon as one comes back.
 *   `Infinity` lifts it. Counts runs, not values — `maxLengthGuard` above is
 *   the one that says how many things the selection may hold.
 * @param {boolean} [props.standalone]
 *   This list answers for itself: it does not register with the control group
 *   or picker around it, so its selection stays out of that value and nothing
 *   coming down — a distributed value, a reset — reaches it. What a popup whose
 *   one answer is spread over several lists says, so that none of them is taken
 *   for the answer itself.
 */
export const List = /*#__PURE__*/ Object.assign(ListResolved, {
  Item: ListItem,
  Items: ListItems,
  Group: ListItemGroup,
});
