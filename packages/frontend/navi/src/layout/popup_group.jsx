/**
 * A box of the page whose popups hand over to each other. While one of them is
 * open, the box itself stands above the wall: what it holds is lit and answers
 * for real (hover, the pressed state, a gesture, the focus), and the rest of
 * the screen is behind the wall. A press on another popup's trigger in the box
 * closes the open popup — which is how a picker notes its value — and opens
 * that one in the same press; a press on anything else in the box closes the
 * open popup and does that thing; a press on the wall only closes.
 *
 * The box is a <dialog>, shown with showModal() where it stands. That is what
 * makes it the layer: everything that is not its DOM descendant goes inert, its
 * ::backdrop is the wall, and its popups (Popover, Dialog, a Picker's popup or
 * callout — popover.jsx, dialog.jsx and picker_custom.jsx read
 * PopupGroupContext) draw no wall of their own and are shown above it. It is
 * also the one shape that holds inside another modal: a peer that is not a
 * descendant of the topmost modal dialog is inert, whatever it is painted
 * above, so the peers have to be inside the layer in the DOM. At rest the dialog is closed and laid out like any box of the page;
 * @jsenv/dom and navi tell it from a surface by [navi-popup-group].
 *
 * Shown modal, an element leaves the flow and the clip of its ancestors. So
 * while the group is engaged a placeholder holds its place, and the group is
 * fixed at the rect it had, follows that rect, and is clipped as its
 * ancestors clipped it.
 *
 * Tried and dropped, not to be brought back:
 * - the wall re-dispatching its click on the peer it covered: a click only, no
 *   hover, no pointerdown, and the wall had to be invisible for the peers to
 *   stay readable;
 * - holes cut in each popup's wall with clip-path over the peers: geometry
 *   recomputed on every scroll and mutation, and no answer for a modal;
 * - carrying the peers into the popup's layer: Preact remounts a portal's
 *   children when its container changes and loses portaled content after a
 *   Suspense park, and moving the nodes by hand loses focus and scroll in
 *   WebKit (no moveBefore) and cuts them from their ancestors' CSS and
 *   listeners.
 */

import {
  closestOpenableAncestor,
  findEvent,
  findSelfOrAncestorFixedPosition,
  getKeyboardEventDefaultAction,
  getScrollContainer,
  isPressDrivenClick,
  observeAncestorOpenState,
  trapScrollInside,
} from "@jsenv/dom";
import { createContext } from "preact";
import { useLayoutEffect, useMemo } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  pushPopupThemeColor,
  readBackdropColor,
  readPopupThemeColor,
} from "../nav/theme_color.js";
import { moveFocusTo } from "../utils/focus/focus_transfer.js";
import { openedDuringThisPress } from "./open_controller.js";
import { isDeclaredInsidePopup } from "./popup_shared.js";

/**
 * The group a popup opens in, or null: what a Popover or a Dialog reads to know
 * that its wall is the group's. Every popup provides null again to what it
 * holds, so a popup opened from inside a popup is in front of it, not a peer.
 */
export const PopupGroupContext = createContext(null);

/**
 * A popup in a group paints no wall, so what it says about one is not read —
 * said out loud, since moving a picker into a group is when it happens.
 */
export const warnWallPropsInsidePopupGroup = (popupKind) => {
  console.warn(
    `[navi] a ${popupKind} inside a <PopupGroup> has no wall of its own: its backdropVariant, backdropColor and backdropFilter are not read. The wall is the group's — set them on <PopupGroup>.`,
  );
};

/**
 * What a press outside a popup of the group does, read against a wall that is
 * always up: "ignore" closes, as "close" does. For a press the group does not
 * see itself, on a region the popup declared outside
 * (handlePressOnOutsideRegion).
 */
export const readPressOutsideInPopupGroup = (pressOutside) =>
  pressOutside === "ignore" ? "close" : pressOutside;

// The groups shown modal right now, for the popup around one of them to close
// it first (see closePopupGroupsInside).
const engagedGroupSet = new Set();

/**
 * Takes the groups engaged inside `popupElement` down, with what they have
 * open, before that popup gives the focus back: while a group is the topmost
 * modal everything else is inert, the element the focus goes back to
 * included. Called by Dialog and Popover as they close.
 */
export const closePopupGroupsInside = (popupElement, closeEvent) => {
  for (const group of engagedGroupSet) {
    if (popupElement.contains(group.getElement())) {
      group.closeEverything(closeEvent);
    }
  }
};

const css = /* css */ `
  /* Not inherited: written on the group by its engagement (writePlacement)
     and read by the group alone — inherited, every write would restyle all it
     holds, on every scroll it follows. */
  @property --x-popup-group-top {
    syntax: "*";
    inherits: false;
  }
  @property --x-popup-group-left {
    syntax: "*";
    inherits: false;
  }
  @property --x-popup-group-width {
    syntax: "*";
    inherits: false;
  }
  @property --x-popup-group-height {
    syntax: "*";
    inherits: false;
  }
  @property --x-popup-group-padding {
    syntax: "*";
    inherits: false;
  }
  @property --x-popup-group-clip {
    syntax: "*";
    inherits: false;
  }

  @layer navi {
    /* The UA box of a <dialog> put back to a box of the page. Offered back:
       the app's own rules on the group — its display, padding, border,
       background, overflow, position — win over these. flow-root rather than
       block: what the group holds keeps its margins inside it, the way it does
       once the top layer makes it a formatting context of its own, so the box
       measured at rest is the box shown engaged. */
    .navi_popup_group {
      --backdrop-background: var(--navi-backdrop-close-background);
      --backdrop-filter: var(--navi-backdrop-close-backdrop-filter);
      position: static;
      inset: auto;

      display: flow-root;
      width: auto;
      max-width: none;
      height: auto;
      max-height: none;
      margin: 0;
      padding: 0;
      color: inherit;
      background: none;
      border: none;
      overflow: visible;
    }
  }

  /* Engaged: in the top layer, exactly where it stood (see engageGroup). Its
     containing block is the viewport there, so nothing resolving against the
     box it was declared in is left to resolve again. */
  .navi_popup_group:modal {
    position: fixed !important;
    inset: auto !important;
    top: var(--x-popup-group-top) !important;
    left: var(--x-popup-group-left) !important;
    box-sizing: border-box !important;
    width: var(--x-popup-group-width) !important;
    min-width: 0 !important;
    max-width: none !important;
    height: var(--x-popup-group-height) !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    padding: var(--x-popup-group-padding) !important;
    clip-path: var(--x-popup-group-clip, none) !important;
  }

  .navi_popup_group[data-backdrop-variant="lift"] {
    --backdrop-background: var(--navi-backdrop-lift-background);
    --backdrop-filter: var(--navi-backdrop-lift-backdrop-filter);
  }
  .navi_popup_group[data-backdrop-variant="discrete"] {
    --backdrop-background: var(--navi-backdrop-discrete-background);
    --backdrop-filter: var(--navi-backdrop-discrete-backdrop-filter);
  }
  .navi_popup_group[data-backdrop-variant="invisible"] {
    --backdrop-background: transparent;
    --backdrop-filter: none;
  }

  /* The wall arrives with the first popup, and goes with the press that closes
     the last one: once the group is back in the page, nothing is left in the
     top layer to fade. */
  .navi_popup_group::backdrop {
    background: var(--backdrop-background);
    opacity: 1;
    backdrop-filter: var(--backdrop-filter);
    transition: opacity var(--popup-animation-duration, 0.18s) ease;

    @starting-style {
      opacity: 0;
    }
  }
  .navi_popup_group[navi-transitions-off]::backdrop {
    transition: none;
  }

  /* While the pages move, an engaged group takes a picture of its own above
     them, the way an open popup does (see popup_css.js): it is in the top
     layer, and the page holds nothing but its placeholder. Named here when
     the whole document moves; a movement played on an area names it itself
     (nav/transition_furniture.js). */
  :root[data-navi-route-transition] .navi_popup_group:modal,
  :root[data-navi-route-travel] .navi_popup_group:modal {
    view-transition-class: navi_popup;
  }
  @supports (view-transition-name: match-element) {
    :root[data-navi-route-transition]:not(
        [data-navi-route-transition-target="area"]
      )
      .navi_popup_group:modal,
    :root[data-navi-route-travel] .navi_popup_group:modal {
      view-transition-name: match-element;
    }
  }
`;

/**
 * The box around popups that hand over to each other: score cells, a menu bar,
 * a toolbar. Being inside it is what makes a popup and a button peers: no name
 * to give.
 *
 * While one of its popups is open, the group is shown modal where it stands:
 * what it holds stays lit and live, the rest of the screen is behind its wall,
 * and a press on another of its popups' triggers closes the open one and opens
 * that one in the same press. Its popups draw no wall of their own (their
 * backdrop props are not read), and a Dialog in it is never modal. The page
 * behind stays still while one of its Popovers or Dialogs is open; a callout
 * of it lets the page scroll, as a callout does anywhere.
 *
 * Its element is a `<dialog>`, closed at rest and laid out like any box: the
 * app styles it as it would a `<div>`. While engaged, an invisible placeholder
 * holds its place in the page, as the element before it, marked
 * `navi-out-of-flow` like everything navi adds to a tree. See
 * docs/popup_backdrop.md.
 *
 * @type {import("preact").FunctionComponent<{
 *   backdropVariant?: "auto" | "lift" | "discrete" | "invisible",
 *   backdropColor?: string,
 *   backdropFilter?: string,
 *   themeColor?: string | false,
 *   role?: string,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {"auto"|"lift"|"discrete"|"invisible"} [props.backdropVariant="auto"] -
 *   How visible the wall is: `"auto"` is the wash a popup closing on an
 *   outside press paints, `"lift"` the opaque blurred wall, `"discrete"` a
 *   barely-there dim, `"invisible"` a wall that is not seen and still takes the
 *   press.
 * @param {string} [props.backdropColor] - The wash itself, over the tokens.
 * @param {string} [props.backdropFilter] - What that wash does to what is
 *   behind it.
 * @param {string|false} [props.themeColor] - The browser's colour while the
 *   wall is up (see docs/popup_backdrop.md): worked out from the wash by
 *   default.
 * @param {string} [props.role="group"] - A box of the page, not a dialog: the
 *   element is a `<dialog>` for its modality alone.
 */
export const PopupGroup = (props) => {
  import.meta.css = css;
  const {
    backdropVariant = "auto",
    backdropColor,
    backdropFilter,
    themeColor,
    role = "group",
    children,
    ...rest
  } = props;
  const group = useMemo(createPopupGroup, []);
  group.themeColor = themeColor;
  // Unmounted or parked while engaged: a modal left open with its tree gone
  // keeps the whole document inert.
  useLayoutEffect(() => {
    return () => {
      group.disengage({ leavingTree: true });
    };
  }, [group]);

  return (
    <Box
      as="dialog"
      {...rest}
      // A callback ignoring null: a Suspense park nulls an object ref and
      // gives it back only when its identity changes.
      ref={group.captureElement}
      baseClassName="navi_popup_group"
      navi-popup-group=""
      role={role}
      data-backdrop-variant={
        backdropVariant === "auto" ? undefined : backdropVariant
      }
      backdropColor={backdropColor}
      backdropFilter={backdropFilter}
      styleCSSVars={POPUP_GROUP_STYLE_CSS_VARS}
    >
      <PopupGroupContext.Provider value={group}>
        {children}
      </PopupGroupContext.Provider>
    </Box>
  );
};

const POPUP_GROUP_STYLE_CSS_VARS = {
  backdropColor: "--backdrop-background",
  backdropFilter: "--backdrop-filter",
};

// How long after the release a press that closed a popup may still bring the
// click that ends it: the compatibility events of a tap come after touchend,
// in a task of their own.
const END_OF_PRESS_SAFETY_MS = 1000;

const createPopupGroup = () => {
  let groupEl = null;
  // Every popup rendered in the group, open or not: "is one of them open" is
  // their own decision, read before any of them shows (a lifting dialog shows a
  // frame after it decided).
  const memberControllerSet = new Set();
  // The popups of the group that are open, as their openEffect described
  // them, the last one to open last. One at a time, except when the open one
  // refuses to close as another opens (a value it cannot note): it is kept
  // here, so the group can still close it.
  const openMemberMap = new Map();
  let engagement = null;

  const noMemberOpen = () => {
    for (const openController of memberControllerSet) {
      if (openController.opened) {
        return false;
      }
    }
    return true;
  };
  const getOpenMembers = () => {
    const openMembers = [];
    for (const [openController, member] of openMemberMap) {
      if (openController.opened) {
        openMembers.push(member);
      } else {
        openMemberMap.delete(openController);
      }
    }
    return openMembers;
  };
  // The page behind is held still unless what is open is a callout, which
  // lets it scroll as it does anywhere (its closeByScroll answers that
  // scroll). Kept as it is while nothing is open: the wall stays up until the
  // press that closed the last popup ends.
  const followScrollLock = () => {
    const openMembers = getOpenMembers();
    if (openMembers.length === 0) {
      return;
    }
    engagement.followScrollLock(
      openMembers.some((openMember) => !openMember.pageScrolls),
    );
  };

  const group = {
    themeColor: undefined,
    captureElement: (element) => {
      if (element) {
        groupEl = element;
      }
    },
    getElement: () => groupEl,
    register: (openController) => {
      memberControllerSet.add(openController);
      return () => {
        memberControllerSet.delete(openController);
      };
    },
    /**
     * Called by a popup of the group as it opens, before it shows itself.
     * `member`: { openController, popupElement, pressOutside, event,
     * pageScrolls, popupId }. `popupElement` is read at each press, so a
     * member whose element is drawn after it engaged (a callout) passes a
     * getter. `pageScrolls`: the page behind may scroll while it is open.
     * `popupId`: the id a data-navi-popup-inside names it by, when it is not
     * the popup element's own.
     */
    engage: (member) => {
      // One popup of the group at a time. A press on a peer has closed the
      // open one already (see armPressArbiter): this one opened from the
      // keyboard or from code.
      for (const openMember of getOpenMembers()) {
        if (openMember.openController === member.openController) {
          continue;
        }
        if (openMember.openController.requestClose(member.event)) {
          openMemberMap.delete(openMember.openController);
        }
      }
      openMemberMap.delete(member.openController);
      openMemberMap.set(member.openController, member);
      if (engagement) {
        engagement.cancelPendingCheck();
      } else {
        if (!groupEl || !groupEl.isConnected) {
          return;
        }
        engagement = engageGroup(groupEl, group, {
          silent: Boolean(member.event?.detail?.silent),
        });
        engagedGroupSet.add(group);
      }
      followScrollLock();
    },
    /**
     * Called by a popup of the group as it closes. Whether the group goes back
     * into the page is decided once nothing of the group is open — at the end
     * of the press that closed it when a press did, since that same press may
     * be opening a peer.
     */
    release: (openController, closeEvent) => {
      openMemberMap.delete(openController);
      if (!engagement) {
        return;
      }
      followScrollLock();
      if (
        findEvent(closeEvent, [
          "pointerdown",
          "mousedown",
          "pointerup",
          "mouseup",
          "click",
        ])
      ) {
        if (findEvent(closeEvent, "click") || !engagement.pressInFlight) {
          // Closed from inside the click, or after the press ended (a lifting
          // Dialog closes in a view transition's update callback, a frame
          // later): what is left of the press is over once this task is.
          engagement.checkAfterTask();
          return;
        }
        engagement.pressClosed = true;
        return;
      }
      // Not a press (Escape, a command, code): a peer opening in the same
      // stack, from the keyboard, is the only thing to wait for.
      engagement.checkAfterMicrotask();
    },
    getOpenMember: () => {
      const openMembers = getOpenMembers();
      return openMembers.length ? openMembers[openMembers.length - 1] : null;
    },
    disengageIfNothingOpen: () => {
      if (engagement && noMemberOpen()) {
        group.disengage();
      }
    },
    // Nothing of the group may stay open over a page that is live again.
    closeEverything: (closeEvent) => {
      for (const openMember of getOpenMembers()) {
        openMember.openController.close(closeEvent);
      }
      openMemberMap.clear();
      group.disengage();
    },
    disengage: ({ leavingTree = false } = {}) => {
      if (!engagement) {
        return;
      }
      const leavingEngagement = engagement;
      engagement = null;
      engagedGroupSet.delete(group);
      leavingEngagement.cleanup({ leavingTree });
    },
  };
  return group;
};

const engageGroup = (groupEl, group, { silent }) => {
  // Everything read before anything is written.
  const rect = groupEl.getBoundingClientRect();
  const groupStyle = getComputedStyle(groupEl);
  // Copied out: the style is live, and shown modal the group has its margins
  // and its bounds forced.
  const { marginLeft, marginRight, minWidth, maxWidth } = groupStyle;
  const ancestorClip = readAncestorClip(groupEl, groupStyle);
  const baselineDescent = readBaselineDescent(groupEl, groupStyle, rect);
  const themeColor = readPopupThemeColor(groupEl, group.themeColor);
  const focusedBefore = document.activeElement;
  const focusWasInGroup =
    Boolean(focusedBefore) &&
    focusedBefore !== groupEl &&
    groupEl.contains(focusedBefore);
  const ringBefore = Boolean(focusedBefore?.matches?.(":focus-visible"));
  const { scrollTop, scrollLeft } = groupEl;
  // A gesture on a box fixed in the top layer goes to the viewport: only a
  // place that scrolls with the viewport moves under it.
  const placeScroller = getScrollContainer(groupEl);
  const placeScrollsWithViewport =
    (placeScroller === document.scrollingElement ||
      // Reported as a scroll container on an app setting `body {
      // overflow-x: hidden }` (its computed overflow-y turns auto), it never
      // scrolls itself: the viewport does.
      (placeScroller === document.body && bodyOverflowIsTheViewports())) &&
    !findSelfOrAncestorFixedPosition(groupEl);

  const placeholder = createPlaceholder(groupStyle, rect, baselineDescent);
  groupEl.before(placeholder);
  groupEl.style.setProperty(
    "--x-popup-group-padding",
    `${groupStyle.paddingTop} ${groupStyle.paddingRight} ${groupStyle.paddingBottom} ${groupStyle.paddingLeft}`,
  );
  const visibleBox = writePlacement(groupEl, rect, ancestorClip);
  if (silent) {
    groupEl.setAttribute("navi-transitions-off", "");
  }
  // showModal() runs the dialog focusing steps: it focuses the first element
  // marked autofocus, or else the first focusable the group holds — and
  // scrolls the group's own scroller to it. Pointed at what already has the
  // focus, or at the group itself, with any other mark set aside for the
  // call, so nothing moves. A native autofocus is otherwise never used (see
  // the focus skill): this one exists for the length of the call, to steer
  // the browser's own pick, not to transfer anything.
  const autofocusTarget = focusWasInGroup ? focusedBefore : groupEl;
  const autofocusWasSet = autofocusTarget.hasAttribute("autofocus");
  const autofocusSetAside = focusWasInGroup
    ? [...groupEl.querySelectorAll("[autofocus]")].filter(
        (element) => element !== autofocusTarget,
      )
    : [];
  for (const element of autofocusSetAside) {
    element.removeAttribute("autofocus");
  }
  if (!autofocusWasSet) {
    autofocusTarget.setAttribute("autofocus", "");
  }
  try {
    groupEl.showModal();
  } catch (error) {
    placeholder.remove();
    clearPlacement(groupEl);
    groupEl.removeAttribute("navi-transitions-off");
    throw error;
  } finally {
    if (!autofocusWasSet) {
      autofocusTarget.removeAttribute("autofocus");
    }
    for (const element of autofocusSetAside) {
      element.setAttribute("autofocus", "");
    }
  }
  // Measured once the group has left the flow, where a parent sized by its
  // content no longer counts it. Only a box given its width by what holds it
  // goes on following that width (a rotation while engaged); one sized by its
  // content, bounded by a min or max width the placeholder does not carry, or
  // placed by margins read here as px (auto ones, percentages), is held at
  // the width it has.
  const placeholderWidth = placeholder.getBoundingClientRect().width;
  if (
    parseFloat(marginLeft) !== 0 ||
    parseFloat(marginRight) !== 0 ||
    maxWidth !== "none" ||
    (minWidth !== "auto" && parseFloat(minWidth) !== 0) ||
    placeholderWidth < rect.width - 0.5 ||
    placeholderWidth > rect.width + 0.5
  ) {
    placeholder.style.width = `${rect.width}px`;
  }
  // Where the engine focused something else anyway.
  if (groupEl.scrollTop !== scrollTop) {
    groupEl.scrollTop = scrollTop;
  }
  if (groupEl.scrollLeft !== scrollLeft) {
    groupEl.scrollLeft = scrollLeft;
  }
  if (focusWasInGroup && document.activeElement !== focusedBefore) {
    moveFocusTo(focusedBefore, { focusVisible: ringBefore });
  }
  // What showModal() left focused when the focus came from outside: that is
  // the browser's pick, not a restore of navi's, at the close (see cleanup).
  const focusLeftByShowModal = focusWasInGroup ? null : document.activeElement;
  if (silent) {
    // The wall's starting style is resolved with no transition to play from
    // it; giving the transition back afterwards changes no value, so nothing
    // fades.
    groupEl.getBoundingClientRect();
    groupEl.removeAttribute("navi-transitions-off");
  }
  // Top-layer order is the order things were shown in: whatever was already
  // open inside the group (a callout on a peer) is now under it, and goes back
  // on top.
  for (const topLayerEl of groupEl.querySelectorAll(":popover-open")) {
    topLayerEl.hidePopover();
    topLayerEl.showPopover();
  }

  const [cleanups, addCleanup] = createCleanupList();
  const engagement = {
    // From a press's pointerdown to its click (or its pointercancel).
    pressInFlight: false,
    // A popup closed during the press in flight: its end decides.
    pressClosed: false,
    visibleBox,
    cleanup: ({ leavingTree }) => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      clearPlacement(groupEl);
      placeholder.remove();
      if (leavingTree) {
        // Closed once the commit is over, as a Dialog leaving the tree is (see
        // its close cleanup): closing now would hand the focus to what held it
        // at showModal() time, often leaving in this same commit. A park
        // takes the group out of the top layer and leaves its `open`
        // attribute, which the reveal would show.
        queueMicrotask(() => {
          if (groupEl.open) {
            groupEl.close();
          }
        });
        return;
      }
      // close() hands the focus back to whatever held it at showModal() time
      // (focusedBefore), undoing where a popup of the group, or the user, put
      // it since. Unless no popup moved the focus since showModal() did, that
      // element is made no focus target for the call, so the focus stays where
      // it is: inert — or, when the focus is inside it (the sheet around the
      // popover around the group, focused by a press on its blank), without
      // its tabindex, inert taking the focus with it. A <dialog> stays
      // focusable without one: around a Dialog sheet, close() focuses it and
      // the moveFocusTo below brings the focus back.
      const focusedBeforeClose = document.activeElement;
      const ringBeforeClose = Boolean(
        focusedBeforeClose?.matches?.(":focus-visible"),
      );
      const focusMovedSinceShowModal =
        focusedBeforeClose &&
        focusedBeforeClose !== document.body &&
        focusedBeforeClose !== groupEl &&
        focusedBeforeClose !== focusLeftByShowModal &&
        focusedBeforeClose.isConnected;
      const keepsFocusWhereItIs =
        focusMovedSinceShowModal &&
        focusedBefore &&
        focusedBefore !== focusedBeforeClose &&
        focusedBefore !== document.body &&
        focusedBefore.isConnected;
      const holdsFocusInside =
        keepsFocusWhereItIs && focusedBefore.contains(focusedBeforeClose);
      const madeInert =
        keepsFocusWhereItIs && !holdsFocusInside && !focusedBefore.inert;
      const tabindexSetAside =
        holdsFocusInside && focusedBefore.tagName !== "DIALOG"
          ? focusedBefore.getAttribute("tabindex")
          : null;
      if (madeInert) {
        focusedBefore.inert = true;
      }
      if (tabindexSetAside !== null) {
        focusedBefore.removeAttribute("tabindex");
      }
      try {
        if (groupEl.open) {
          groupEl.close();
        }
      } finally {
        if (madeInert) {
          focusedBefore.inert = false;
        }
        if (tabindexSetAside !== null) {
          focusedBefore.setAttribute("tabindex", tabindexSetAside);
        }
      }
      // Where the engine moved it anyway (an element focusable without a
      // tabindex).
      if (
        focusMovedSinceShowModal &&
        document.activeElement !== focusedBeforeClose
      ) {
        moveFocusTo(focusedBeforeClose, { focusVisible: ringBeforeClose });
      }
    },
  };

  let pendingCheck = null;
  engagement.cancelPendingCheck = () => {
    if (pendingCheck) {
      pendingCheck.cancel();
      pendingCheck = null;
    }
  };
  engagement.checkAfterTask = (delay = 0) => {
    engagement.cancelPendingCheck();
    const timeout = setTimeout(() => {
      pendingCheck = null;
      group.disengageIfNothingOpen();
    }, delay);
    pendingCheck = {
      cancel: () => {
        clearTimeout(timeout);
      },
    };
  };
  engagement.checkAfterMicrotask = () => {
    engagement.cancelPendingCheck();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      pendingCheck = null;
      group.disengageIfNothingOpen();
    });
    pendingCheck = {
      cancel: () => {
        cancelled = true;
      },
    };
  };
  addCleanup(engagement.cancelPendingCheck);

  addCleanup(armPressArbiter(groupEl, group, engagement));
  addCleanup(followPlaceholder(groupEl, placeholder, engagement));
  // A wheel or a finger on the wall would scroll the page behind, and with it
  // the place the group is pinned to. On the wall means outside what is shown
  // of the group, which a clip can make less than its box. Let go for a
  // callout only where the group's place scrolls with the viewport: in a
  // sheet, a list scrolling on its own, a fixed bar, the gesture would scroll
  // the document behind and never the box the group stands in.
  let releaseScrollLock = null;
  const letGoOfScroll = () => {
    if (releaseScrollLock) {
      releaseScrollLock();
      releaseScrollLock = null;
    }
  };
  engagement.followScrollLock = (openMemberHoldsPage) => {
    if (!openMemberHoldsPage && placeScrollsWithViewport) {
      letGoOfScroll();
      return;
    }
    if (!releaseScrollLock) {
      releaseScrollLock = trapScrollInside(groupEl, {
        backdrop: true,
        getElementBox: () => engagement.visibleBox,
        // The group is no scroll container: shown fixed in the top layer, a
        // gesture over what it holds, or a scroll key pressed in it, would go
        // straight on to the page.
        containInside: true,
      });
    }
  };
  addCleanup(letGoOfScroll);
  if (themeColor !== "none") {
    addCleanup(
      pushPopupThemeColor({
        themeColor,
        backdropColor: readBackdropColor(groupEl),
      }),
    );
  }

  // Escape and the back gesture reach the topmost modal, which is the group:
  // they are the open popup's to answer, as they would be with focus in it.
  // Escape is answered at its keydown, before it becomes the browser's close
  // request: a cancel can be prevented only while the page has a user
  // activation to spend, and Escape gives none — at the second one the
  // browser closes the group itself, whatever the open popup said. A keydown
  // prevented is no close request at all. Left to what the key was pressed in
  // when that uses it (a search field clearing itself), as the open popup's
  // own shortcut leaves it.
  const onKeyDown = (keydownEvent) => {
    if (keydownEvent.key !== "Escape" || keydownEvent.defaultPrevented) {
      // Answered already: by the open popup's own shortcut, when the focus is
      // in it.
      return;
    }
    if (keydownEvent.target !== groupEl) {
      const defaultAction = getKeyboardEventDefaultAction(keydownEvent);
      if (defaultAction && defaultAction !== "dismiss") {
        return;
      }
    }
    const openMember = group.getOpenMember();
    if (!openMember) {
      return;
    }
    // requestClose prevents the keydown, whether the popup closes or refuses.
    openMember.openController.requestClose(keydownEvent, { isCancel: true });
  };
  groupEl.addEventListener("keydown", onKeyDown);
  addCleanup(() => {
    groupEl.removeEventListener("keydown", onKeyDown);
  });
  // What still reaches the group as a close request: the back gesture, an
  // Escape with nothing of the group open.
  const onCancel = (cancelEvent) => {
    if (cancelEvent.target !== cancelEvent.currentTarget) {
      // A file input inside the group cancelling its own picker.
      return;
    }
    cancelEvent.preventDefault();
    const openMember = group.getOpenMember();
    if (openMember) {
      openMember.openController.requestClose(cancelEvent, { isCancel: true });
      return;
    }
    group.disengageIfNothingOpen();
  };
  groupEl.addEventListener("cancel", onCancel);
  addCleanup(() => {
    groupEl.removeEventListener("cancel", onCancel);
  });
  // The browser may close the group itself: a close request with no user
  // activation left to spend (a second back gesture) ignores preventDefault.
  const onNativeClose = (closeEvent) => {
    if (groupEl.open) {
      // Queued by an earlier engagement's close(): the group has been shown
      // modal again since, and nothing closed it.
      return;
    }
    group.closeEverything(closeEvent);
  };
  groupEl.addEventListener("close", onNativeClose);
  addCleanup(() => {
    groupEl.removeEventListener("close", onNativeClose);
  });
  // What holds the group closing (the sheet it is in) does not close the
  // group: a modal left open in a closed dialog keeps the whole document inert
  // with nothing on screen to dismiss. A navi popup closes the groups inside it
  // itself, before it gives the focus back (closePopupGroupsInside); this is
  // for any other.
  const openableAncestor = closestOpenableAncestor(groupEl);
  if (openableAncestor) {
    addCleanup(
      observeAncestorOpenState(openableAncestor, ({ isOpen }) => {
        if (isOpen) {
          return;
        }
        group.closeEverything(
          new CustomEvent("popup_group_ancestor_close", { detail: {} }),
        );
      }),
    );
  }
  return engagement;
};

/**
 * Hears every press while the group is engaged, for the popup of the group
 * that is open. A press outside that popup closes it, per its pressOutside,
 * and goes on to what it landed on: another popup's trigger opens it, a button
 * does its thing. A press on the wall — the ::backdrop reports the group as its
 * target, outside its box — closes and reaches nothing else, everything behind
 * being inert.
 *
 * Decided on the press's mousedown, the event the page acts on: on a touch
 * screen it is synthesized at touchend and hit-tested again, with the group
 * still up, so a finger that scrolled the group (pointercancel, no mousedown)
 * closes nothing. A pointerdown cancelled downstream (a drag source) brings no
 * mousedown: its click decides instead. A popup that captures the outside is
 * answered at the pointerdown itself: nothing of that press may reach a peer.
 */
const armPressArbiter = (groupEl, group, engagement) => {
  let press = null;

  const isOnWall = (event) => {
    if (event.target !== groupEl) {
      return false;
    }
    const { left, top, right, bottom } = engagement.visibleBox;
    return (
      event.clientX < left ||
      event.clientX > right ||
      event.clientY < top ||
      event.clientY > bottom
    );
  };
  const spend = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  // The open popup this press is outside of, or null.
  const findMemberPressedOutside = (event) => {
    const openMember = group.getOpenMember();
    if (!openMember) {
      return null;
    }
    if (openedDuringThisPress(openMember.openController)) {
      // The release of the press that opened it.
      return null;
    }
    const { target } = event;
    const { popupElement } = openMember;
    if (popupElement.contains(target)) {
      return null;
    }
    if (isDeclaredInsidePopup(target, openMember.popupId || popupElement.id)) {
      return null;
    }
    // In front of the open popup: something open inside the group that is
    // neither that popup nor around it (a callout on a peer).
    const layerUnderPointer = target.closest?.(
      ':popover-open, dialog[open]:not([navi-popup-group]), [navi-control="popover"][aria-expanded="true"]',
    );
    if (
      layerUnderPointer &&
      !layerUnderPointer.contains(popupElement) &&
      !popupElement.contains(layerUnderPointer)
    ) {
      return null;
    }
    return openMember;
  };
  const readPressOutside = (openMember) =>
    readPressOutsideInPopupGroup(openMember.pressOutside);
  const arbitrate = (event) => {
    const openMember = findMemberPressedOutside(event);
    if (!openMember) {
      return;
    }
    const pressOutside = readPressOutside(openMember);
    if (pressOutside === "capture") {
      spend(event);
      press.spendClick = true;
      return;
    }
    // A press on a peer goes on to it, so the close is told the pointerdown:
    // told the mousedown, the focus restore cancels that mousedown, and the
    // peer's own reaction to it with it (a picker opening at mousedown).
    let closeEvent;
    if (isOnWall(event)) {
      closeEvent = event;
    } else if (event.type === "click" && press.pointerdown) {
      // Decided at the click (the pointerdown was cancelled): the close is
      // told both, so what holds a reopen back for this press knows the press
      // ends with this very click.
      closeEvent = new CustomEvent("popup_group_press_outside", {
        detail: { event, eventChain: [press.pointerdown, event] },
      });
    } else {
      closeEvent = press.pointerdown || event;
    }
    const closed = openMember.openController.requestClose(closeEvent, {
      isCancel: pressOutside === "cancel",
    });
    if (!closed) {
      // The popup refuses to be left (a value it cannot note): the press must
      // not go on to open a peer next to it.
      spend(event);
      press.spendClick = true;
    }
  };

  const onPointerDown = (pointerDownEvent) => {
    if (engagement.pressClosed) {
      // The press that closed the last popup ended without a click (a gesture
      // swallowed it): this one is a new press.
      engagement.pressClosed = false;
      group.disengageIfNothingOpen();
      if (!groupEl.open) {
        return;
      }
    }
    press = {
      pointerdown: pointerDownEvent,
      mousedown: null,
      spendClick: false,
    };
    if (pointerDownEvent.button !== 0) {
      return;
    }
    engagement.pressInFlight = true;
    const openMember = findMemberPressedOutside(pointerDownEvent);
    if (openMember && readPressOutside(openMember) === "capture") {
      // Cancelling the pointerdown also cancels the mousedown it would bring.
      spend(pointerDownEvent);
      press.spendClick = true;
    }
  };
  const onMouseDown = (mouseDownEvent) => {
    if (mouseDownEvent.button !== 0) {
      return;
    }
    if (!press) {
      press = { pointerdown: null, mousedown: null, spendClick: false };
    }
    engagement.pressInFlight = true;
    press.mousedown = mouseDownEvent;
    if (press.spendClick) {
      spend(mouseDownEvent);
      return;
    }
    arbitrate(mouseDownEvent);
  };
  const onClick = (clickEvent) => {
    if (!isPressDrivenClick(clickEvent)) {
      // A keyboard activation or a click() from code: not the click of the
      // press in flight, which the next pointerdown replaces anyway.
      return;
    }
    if (press?.spendClick) {
      spend(clickEvent);
    } else if (press && !press.mousedown) {
      arbitrate(clickEvent);
    }
    press = null;
    engagement.pressInFlight = false;
    if (engagement.pressClosed) {
      engagement.pressClosed = false;
      // After the click's dispatch: a peer it opens counts.
      engagement.checkAfterTask();
    }
  };
  const onPointerUp = () => {
    if (engagement.pressClosed) {
      engagement.checkAfterTask(END_OF_PRESS_SAFETY_MS);
    }
  };
  const onPointerCancel = () => {
    press = null;
    engagement.pressInFlight = false;
    if (engagement.pressClosed) {
      engagement.pressClosed = false;
      engagement.checkAfterTask();
    }
  };
  const listeners = [
    ["pointerdown", onPointerDown],
    ["mousedown", onMouseDown],
    ["click", onClick],
    ["pointerup", onPointerUp],
    ["pointercancel", onPointerCancel],
  ];
  for (const [type, listener] of listeners) {
    document.addEventListener(type, listener, { capture: true });
  }
  return () => {
    for (const [type, listener] of listeners) {
      document.removeEventListener(type, listener, { capture: true });
    }
  };
};

// The group follows the place it holds in the page: a scroll of what holds it,
// the viewport resizing (a keyboard, a rotation), the page reflowing around
// it, a popup it is in being placed again. Its own scroll moves nothing.
const followPlaceholder = (groupEl, placeholder, engagement) => {
  const [cleanups, addCleanup] = createCleanupList();
  // An ancestor's movement may end after this engagement did, and the group a
  // later one engaged is the same element.
  let disposed = false;
  addCleanup(() => {
    disposed = true;
  });
  const update = () => {
    if (disposed) {
      return;
    }
    const rect = placeholder.getBoundingClientRect();
    const ancestorClip = readAncestorClip(
      placeholder,
      getComputedStyle(placeholder),
    );
    engagement.visibleBox = writePlacement(groupEl, rect, ancestorClip);
  };
  const onScroll = (scrollEvent) => {
    if (
      scrollEvent.target === groupEl ||
      groupEl.contains(scrollEvent.target)
    ) {
      return;
    }
    update();
  };
  document.addEventListener("scroll", onScroll, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", update);
  const { visualViewport } = window;
  visualViewport?.addEventListener("resize", update);
  addCleanup(() => {
    document.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", update);
    visualViewport?.removeEventListener("resize", update);
  });
  const resizeObserver = new ResizeObserver(update);
  if (placeholder.parentElement) {
    resizeObserver.observe(placeholder.parentElement);
  }
  addCleanup(() => {
    resizeObserver.disconnect();
  });
  // A popup the group is in moves by a translate, animated, and says so only
  // to itself (applyNewPosition): followed frame by frame while it moves, as
  // visibleRectEffect follows it for what is anchored inside it.
  let ancestor = closestOpenableAncestor(groupEl);
  while (ancestor) {
    const openableAncestor = ancestor;
    let positionTransitionFrame = null;
    const onPositionChange = () => {
      update();
    };
    const onPositionTransition = (positionTransitionEvent) => {
      cancelAnimationFrame(positionTransitionFrame);
      const loop = () => {
        update();
        positionTransitionFrame = requestAnimationFrame(loop);
      };
      loop();
      positionTransitionEvent.detail.onEnd(() => {
        cancelAnimationFrame(positionTransitionFrame);
        positionTransitionFrame = null;
        update();
      });
    };
    openableAncestor.addEventListener("navi_position_change", onPositionChange);
    openableAncestor.addEventListener(
      "navi_position_transition",
      onPositionTransition,
    );
    addCleanup(() => {
      cancelAnimationFrame(positionTransitionFrame);
      openableAncestor.removeEventListener(
        "navi_position_change",
        onPositionChange,
      );
      openableAncestor.removeEventListener(
        "navi_position_transition",
        onPositionTransition,
      );
    });
    ancestor = closestOpenableAncestor(openableAncestor);
  }
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
};

// What stands in the page for the group while it is in the top layer: the same
// outer box at the height it had, invisible, counted by nothing that skips
// what navi puts in a tree (css_architecture.md, "Counting children").
const createPlaceholder = (groupStyle, rect, baselineDescent) => {
  const placeholder = document.createElement("div");
  placeholder.setAttribute("navi-popup-group-placeholder", "");
  placeholder.setAttribute("navi-out-of-flow", "");
  placeholder.setAttribute("aria-hidden", "true");
  const { style } = placeholder;
  if (groupStyle.display.startsWith("inline")) {
    style.display = "inline-block";
  } else if (establishesFormattingContext(groupStyle)) {
    // Such a box keeps clear of a float beside it, where a plain block slides
    // under it.
    style.display = "flow-root";
  } else {
    style.display = "block";
  }
  style.visibility = "hidden";
  style.pointerEvents = "none";
  style.boxSizing = "border-box";
  style.height = `${rect.height}px`;
  style.flex = "none";
  for (const property of PLACEHOLDER_COPIED_PROPERTIES) {
    style[property] = groupStyle[property];
  }
  if (baselineDescent !== null) {
    // An empty inline box sits on its bottom edge; the group sat on its own
    // baseline, this far above its bottom.
    style.verticalAlign = `${-baselineDescent}px`;
  }
  return placeholder;
};
const establishesFormattingContext = (style) => {
  const {
    display,
    overflowX,
    overflowY,
    contain,
    containerType,
    contentVisibility,
    columnCount,
    columnWidth,
  } = style;
  if (
    display === "flow-root" ||
    display === "flex" ||
    display === "grid" ||
    display === "table" ||
    display.includes("flow-root")
  ) {
    return true;
  }
  if (
    (overflowX !== "visible" && overflowX !== "clip") ||
    (overflowY !== "visible" && overflowY !== "clip")
  ) {
    return true;
  }
  // Containment the computed `contain` does not show: a size container, a box
  // whose content-visibility skips its content.
  if (
    /\b(?:size|inline-size)\b/.test(containerType) ||
    contentVisibility === "auto" ||
    contentVisibility === "hidden"
  ) {
    return true;
  }
  // A multi-column box.
  if (columnCount !== "auto" || columnWidth !== "auto") {
    return true;
  }
  return /\b(?:layout|paint|strict|content)\b/.test(contain);
};
const PLACEHOLDER_COPIED_PROPERTIES = [
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "alignSelf",
  "justifySelf",
  "order",
  "gridRowStart",
  "gridRowEnd",
  "gridColumnStart",
  "gridColumnEnd",
  "float",
  "verticalAlign",
];

// How far below the line's baseline an inline-level group on that baseline
// reaches: what the placeholder, which has no line of its own, has to sink by.
const readBaselineDescent = (groupEl, groupStyle, rect) => {
  if (
    !groupStyle.display.startsWith("inline") ||
    groupStyle.verticalAlign !== "baseline"
  ) {
    return null;
  }
  const marginTop = parseFloat(groupStyle.marginTop) || 0;
  const marginBottom = parseFloat(groupStyle.marginBottom) || 0;
  const readBaselineY = (insert) => {
    const probe = document.createElement("span");
    probe.style.cssText =
      "display:inline-block;width:0;height:0;vertical-align:baseline";
    insert(probe);
    const baselineY = probe.getBoundingClientRect().bottom;
    probe.remove();
    return baselineY;
  };
  // On the group's own line, between its top and its bottom margin edge: a
  // probe that takes no room can stay at the end of the line before it.
  const isOnGroupLine = (y) =>
    y >= rect.top - marginTop - 0.5 && y <= rect.bottom + marginBottom + 0.5;
  let baselineY = readBaselineY((probe) => groupEl.before(probe));
  if (!isOnGroupLine(baselineY)) {
    baselineY = readBaselineY((probe) => groupEl.after(probe));
    if (!isOnGroupLine(baselineY)) {
      return null;
    }
  }
  // Down to the margin edge: that is what an empty inline box sits on.
  return rect.bottom + marginBottom - baselineY;
};

// Writes where the group stands and how its ancestors clip it; returns what of
// it is on screen.
const writePlacement = (groupEl, rect, ancestorClip) => {
  const { style } = groupEl;
  style.setProperty("--x-popup-group-top", `${rect.top}px`);
  style.setProperty("--x-popup-group-left", `${rect.left}px`);
  style.setProperty("--x-popup-group-width", `${rect.width}px`);
  style.setProperty("--x-popup-group-height", `${rect.height}px`);
  if (ancestorClip) {
    // From the group's border box, reaching past it on a side nothing clips:
    // what overflows the group was painted up to its ancestors' edge.
    const toInset = (distance) =>
      distance === -Infinity ? "-100vmax" : `${distance}px`;
    style.setProperty(
      "--x-popup-group-clip",
      `inset(${toInset(ancestorClip.top - rect.top)} ${toInset(rect.right - ancestorClip.right)} ${toInset(rect.bottom - ancestorClip.bottom)} ${toInset(ancestorClip.left - rect.left)})`,
    );
  } else {
    style.removeProperty("--x-popup-group-clip");
  }
  return intersectBox(rect, ancestorClip);
};
const clearPlacement = (groupEl) => {
  const { style } = groupEl;
  style.removeProperty("--x-popup-group-top");
  style.removeProperty("--x-popup-group-left");
  style.removeProperty("--x-popup-group-width");
  style.removeProperty("--x-popup-group-height");
  style.removeProperty("--x-popup-group-padding");
  style.removeProperty("--x-popup-group-clip");
};

// The clip the ancestors of `element` put on it, up to the first box nothing
// around clips (a top-layer or fixed one), -Infinity/Infinity on a side
// nothing clips — or null when nothing clips it at all.
const readAncestorClip = (element, elementStyle) => {
  if (elementStyle.position === "fixed") {
    return null;
  }
  // Read on body, an overflow that is the viewport's clips nothing.
  const bodyClipsNothing = bodyOverflowIsTheViewports();
  let left = -Infinity;
  let top = -Infinity;
  let right = Infinity;
  let bottom = Infinity;
  let clipped = false;
  // An absolutely placed box escapes the clip of every ancestor between it
  // and its containing block: those are skipped.
  let skipUntilContainingBlock = elementStyle.position === "absolute";
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const ancestorStyle = getComputedStyle(ancestor);
    if (
      skipUntilContainingBlock &&
      !isContainingBlockForAbsolute(ancestorStyle)
    ) {
      ancestor = ancestor.parentElement;
      continue;
    }
    skipUntilContainingBlock = false;
    const { overflowX, overflowY, position } = ancestorStyle;
    const overflowGoesToViewport =
      ancestor === document.body && bodyClipsNothing;
    const clipsX = !overflowGoesToViewport && overflowX !== "visible";
    const clipsY = !overflowGoesToViewport && overflowY !== "visible";
    if (clipsX || clipsY) {
      clipped = true;
      const ancestorRect = ancestor.getBoundingClientRect();
      const innerLeft = ancestorRect.left + ancestor.clientLeft;
      const innerTop = ancestorRect.top + ancestor.clientTop;
      if (clipsX) {
        const innerRight = innerLeft + ancestor.clientWidth;
        if (innerLeft > left) {
          left = innerLeft;
        }
        if (innerRight < right) {
          right = innerRight;
        }
      }
      if (clipsY) {
        const innerBottom = innerTop + ancestor.clientHeight;
        if (innerTop > top) {
          top = innerTop;
        }
        if (innerBottom < bottom) {
          bottom = innerBottom;
        }
      }
    }
    if (
      position === "fixed" ||
      ancestor.matches(":popover-open, dialog:modal")
    ) {
      break;
    }
    if (position === "absolute") {
      skipUntilContainingBlock = true;
    }
    ancestor = ancestor.parentElement;
  }
  return clipped ? { left, top, right, bottom } : null;
};
// The overflow of <body> is the viewport's when the root leaves its own
// visible: body itself then neither scrolls nor clips.
const bodyOverflowIsTheViewports = () => {
  const rootStyle = getComputedStyle(document.documentElement);
  return rootStyle.overflowX === "visible" && rootStyle.overflowY === "visible";
};

const isContainingBlockForAbsolute = (style) =>
  style.position !== "static" ||
  style.transform !== "none" ||
  style.translate !== "none" ||
  style.rotate !== "none" ||
  style.scale !== "none" ||
  style.perspective !== "none" ||
  style.filter !== "none" ||
  // Prefixed alone before Safari 18.
  (style.backdropFilter ?? style.webkitBackdropFilter ?? "none") !== "none" ||
  /\b(?:layout|paint|strict|content)\b/.test(style.contain) ||
  // Layout containment the computed `contain` does not show.
  style.contentVisibility === "auto" ||
  /\b(?:size|inline-size)\b/.test(style.containerType) ||
  /\b(?:transform|translate|rotate|scale|perspective|filter|backdrop-filter|contain)\b/.test(
    style.willChange,
  );

const intersectBox = (rect, clip) => {
  let { left, top, right, bottom } = rect;
  if (clip) {
    if (clip.left > left) {
      left = clip.left;
    }
    if (clip.top > top) {
      top = clip.top;
    }
    if (clip.right < right) {
      right = clip.right;
    }
    if (clip.bottom < bottom) {
      bottom = clip.bottom;
    }
  }
  if (right < left) {
    right = left;
  }
  if (bottom < top) {
    bottom = top;
  }
  return { left, top, right, bottom };
};

const createCleanupList = () => {
  const cleanups = [];
  return [
    cleanups,
    (cleanup) => {
      cleanups.push(cleanup);
    },
  ];
};
