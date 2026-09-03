/**
 * Expandable: an in-flow disclosure — a UI part that reveals a content part.
 * It covers the same ground as <Details> with structural differences:
 *
 * - the two parts are explicit, and are Boxes:
 *
 *     <Expandable>
 *       <Expandable.UI>See more</Expandable.UI>
 *       <Expandable.Content>…</Expandable.Content>
 *     </Expandable>
 *
 *   `openDirection` decides where the content is revealed — down (the
 *   <details> shape) or up, left or right in `layout="column"`, where the
 *   parts sit side by side sharing their height. It places the parts too
 *   (CSS `order`), so an expandable revealing upward can still be written UI
 *   first, and an expandable with no UI part at all — driven from
 *   `open`/`signal` by a toggle of the app's own — can say which way it
 *   opens. The marker chevron follows: it points right while closed and
 *   toward where the content went while open (down, up, or left). The common
 *   shape has a shorthand: `ui` prop + children as content.
 *
 * - the UI part is the focusable toggle itself (role button, Space/Enter,
 *   arrow keys) and accepts any markup: controls inside it keep their own
 *   behavior, the marker is purely decorative.
 *
 * The root never looks at its children: which parts are there, in which order,
 * is none of its business. It publishes a context and the parts take what they
 * need from it.
 *
 * Deciding to open or to close is the same decision a Dialog or a Popover
 * takes — the same props behind it (`open`/`defaultOpen`/`signal`/`navState`),
 * the same commands in front of it, the same refusable close — so it is taken
 * in the same place: an open controller (see open_controller.js). What belongs
 * to an expandable is only what opening LOOKS like, which is `openEffect` and
 * the cleanup it returns. Both render synchronously (flushSyncRendering)
 * before measuring, so the DOM is in the state they are about to measure —
 * that, and not any inspection of the children, is what makes a part free to
 * re-render later than the root (a memoized subtree does exactly that).
 *
 * Reach for it knowingly: expanding in-flow SHIFTS the layout — everything
 * below (or beside) moves when it opens. A Popover, Dialog, Picker or Callout
 * answers the same click on its own layer, moving nothing, which is usually
 * the better UX: a layout that stays where it is reads and operates better —
 * all the more on small screens, mobile first of all, where the shift can
 * push most of the page away. Expandable is for content that genuinely
 * belongs in the flow (a tree, a changelog, a settings group read top to
 * bottom).
 *
 * What <details> gives for free is rebuilt here:
 * - a "toggle" event (a real ToggleEvent when the browser has it) dispatched on
 *   the root whenever the state actually changes — but never on mount, unlike
 *   the native one (see the workaround comment in details.jsx);
 * - `--navi-toggle`/`--navi-open`/`--navi-close` commands work against it: the
 *   root and the UI part carry `aria-expanded` (what the command system reads)
 *   and answer the `navi_command`/`navi_request_open`/`navi_request_close`
 *   events.
 *
 * Content is not built until the first expansion and stays built afterwards:
 * a popup's policy, and its code (`usePopupContentMount`, see
 * popup_content_mount.js) — `"always"` builds it right away, `"while-opened"`
 * throws it away once the collapse settles, so a closing animation still plays
 * on real content.
 *
 * The animation is a REVEAL, not a resize: the expandable's own footprint
 * grows/shrinks progressively (the content's grid track interpolates
 * 0fr <-> 1fr — rows for the stacked layout, columns for `layout="column"`),
 * but the content inside is laid out at its final size for the whole movement
 * (its animated dimension is frozen to the measured final value, see
 * freezeContentSize) and the container simply uncovers it. Text never rewraps
 * mid-animation. The content is revealed from its UI side (pinned against the
 * UI when it comes first). Once settled open the clipping is released, so a
 * popover or focus ring inside is not cut at the edges.
 */
import {
  elementIsFocusable,
  findAfter,
  getKeyboardEventDefaultAction,
  stringifyStyle,
} from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { ActionRenderer } from "../../action/action_renderer.jsx";
import { useAction } from "../../action/use_action.js";
import { runUnwatched } from "../../action/run_unwatched.js";
import { useActionStatus } from "../../action/use_action_status.js";
import { Box } from "../../box/box.jsx";
import { useOpenControllerByProps } from "../../layout/open_controller.js";
import {
  MOUNT_DEFAULT,
  usePopupContentMount,
} from "../../layout/popup_content_mount.js";
import { whenTransitionSettles } from "../../layout/popup_shared.js";
import { flushSyncRendering } from "../../utils/flush_sync_rendering.js";
import { moveFocusTo } from "../../utils/focus/focus_transfer.js";
import { onNaviCommand } from "../commands.js";
import { SummaryMarker } from "../details/summary_marker.jsx";

const css = /* css */ `
  .navi_expandable {
    position: relative;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;

    /* Where the content is revealed places the parts, whatever order they are
       written in: an app is free to keep the UI part first in the DOM (where
       the tab order comes from) and reveal the content above it. */
    &[data-open-direction="down"] > .navi_expandable_content_container,
    &[data-open-direction="right"] > .navi_expandable_content_container {
      order: 1;
    }
    &[data-open-direction="up"] > .navi_expandable_ui,
    &[data-open-direction="left"] > .navi_expandable_ui {
      order: 1;
    }

    > .navi_expandable_ui {
      display: flex;
      flex-shrink: 0;
      flex-direction: row;
      align-items: center;
      gap: 0.2em;
      cursor: pointer;
      user-select: none;

      &:focus-visible {
        border-radius: 4px;
        outline: 2px solid AccentColor;
        outline-offset: 1px;
      }

      > .navi_expandable_marker {
        display: flex;
        flex-shrink: 0;
        align-items: center;
      }

      > .navi_expandable_ui_label {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 0.2em;
      }
    }

    > .navi_expandable_content_container {
      position: relative;
      display: grid;
      grid-template-rows: 0fr;
      /* The clip lives here, on the moving box, because the content inside
         keeps its final size during the animation (see the top comment) and
         overflows the track on purpose. One-sided (a clip-path with the free
         sides pushed far out) rather than overflow: hidden: only the side
         being revealed hides anything, so a badge sticking out of the other
         sides is visible from the very first frame of the movement. */
      clip-path: inset(-9999px -9999px 0 -9999px);

      /* The sizer is what lets the track actually collapse: min-height 0 on
         an auto-sized item zeroes its min-content contribution. The frozen
         content cannot play that role itself — a definite height makes the
         contribution definite too, and the track then never goes below it. */
      > .navi_expandable_content_sizer {
        display: grid;
        min-height: 0;
      }
    }
    &[aria-expanded="true"] > .navi_expandable_content_container {
      grid-template-rows: 1fr;
    }
    /* Revealed upward: the bottom edge stays and the top is what gets
       uncovered. Said at BOTH levels: a transitioning fr resolves once for the
       container's own size and once more inside it (the row is fraction²
       high), so the row must be glued to the container's bottom edge and the
       oversized frozen content to the row's — anchoring only the inner one
       leaves the content following the drifting fraction² row. */
    &[data-open-direction="up"] > .navi_expandable_content_container {
      align-content: end;
      clip-path: inset(0 -9999px -9999px -9999px);

      > .navi_expandable_content_sizer {
        align-content: end;
      }
    }

    /* The parts sit side by side, sharing their height: the UI part becomes a
       vertical strip and the content expands horizontally, on the columns
       track — the rows track collapses too, so a closed expandable is only as
       tall as its UI (the content, unmounted or 0-wide, says nothing about
       the height it will bring). */
    &[data-layout="column"] {
      flex-direction: row;

      > .navi_expandable_ui {
        flex-direction: column;
        align-items: center;

        > .navi_expandable_ui_label {
          flex-direction: column;
        }
      }
      > .navi_expandable_content_container {
        grid-template-columns: 0fr;
        grid-template-rows: 0fr;
        /* Both tracks reveal: clip the far side of each (right and bottom),
           the UI side and the top stay free. */
        clip-path: inset(-9999px 0 0 -9999px);

        > .navi_expandable_content_sizer {
          min-width: 0;
          min-height: 0;
        }
      }
      &[aria-expanded="true"] > .navi_expandable_content_container {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
      }
      /* mount="always": the content is built and width-frozen while closed
         (see the component), so it can size the height at all times — the
         expandable then keeps one stable height and only the width reveals. */
      &[data-closed-content-sized] > .navi_expandable_content_container {
        grid-template-rows: none;
      }
      &[data-open-direction="left"] > .navi_expandable_content_container {
        justify-content: end;
        clip-path: inset(-9999px -9999px 0 0);

        > .navi_expandable_content_sizer {
          justify-content: end;
        }
      }
    }

    &[data-animation] > .navi_expandable_content_container {
      transition:
        grid-template-rows var(--navi-expandable-animation-duration, 0.3s) ease,
        grid-template-columns var(--navi-expandable-animation-duration, 0.3s)
          ease;
    }
    @media (prefers-reduced-motion: reduce) {
      &[data-animation] > .navi_expandable_content_container {
        transition: none;
      }
    }
    /* Settled open: stop clipping entirely, so a popover, a focus ring or a
       dragged element inside the content can spill out on any side. Settled
       closed: clip every side — the collapsed box must show nothing, a
       stick-out included. In between (any movement, opening or closing) the
       one-sided clips above apply. */
    &[aria-expanded="true"][data-settled] > .navi_expandable_content_container {
      clip-path: none;
    }
    &:not([aria-expanded="true"])[data-settled]
      > .navi_expandable_content_container {
      clip-path: inset(0 0 0 0);
    }
    &[data-content-scrolls]
      > .navi_expandable_content_container
      > .navi_expandable_content_sizer
      > .navi_expandable_content {
      max-height: var(--navi-expandable-max-content-height);
      overflow-y: auto;
    }
  }
`;

const ExpandableContext = createContext(null);
const useExpandableContext = (partName) => {
  const expandableContext = useContext(ExpandableContext);
  if (!expandableContext) {
    throw new Error(
      `<Expandable.${partName}> must be used inside <Expandable>`,
    );
  }
  return expandableContext;
};

/**
 * @type {import("preact").FunctionComponent<{
 *   ui?: import("preact").ComponentChildren | ((state: { open: boolean }) => import("preact").ComponentChildren),
 *   open?: boolean,
 *   defaultOpen?: boolean,
 *   signal?: import("@preact/signals").Signal<boolean>,
 *   navState?: boolean | string | { id?: string, type?: "push" | "replace" },
 *   onClose?: (event: Event) => void,
 *   onToggle?: (event: Event) => void,
 *   action?: Function,
 *   loading?: boolean,
 *   animation?: boolean,
 *   layout?: "row" | "column",
 *   openDirection?: "down" | "up" | "right" | "left",
 *   autoFocus?: boolean,
 *   maxContentHeight?: string | number,
 *   mount?: "always" | "idle" | "from-first-open" | "while-opened",
 *   arrowKeyShortcuts?: boolean,
 *   openKeyShortcut?: string,
 *   closeKeyShortcut?: string,
 * }>}
 * @param ui - Shorthand for the common shape: renders `<Expandable.UI>{ui}</Expandable.UI>`
 *   above the content (children). Any markup is allowed (buttons, links,
 *   fields inside it keep their own behavior and do not toggle the
 *   expandable). A function receives `{ open }` to render differently per
 *   state. For other orders/orientations, pass `<Expandable.UI>` and
 *   `<Expandable.Content>` as children instead.
 * @param open - Drives the state from outside: the expandable opens/closes to
 *   match every change of this prop, but user interaction can still toggle it
 *   in between. Same open controller as Dialog/Popover, so the four props
 *   below behave exactly as they do there (see open_controller.js).
 * @param defaultOpen - Uncontrolled, mount-only initial state.
 * @param signal - Two-way binding: the expandable follows the signal and
 *   writes back into it whenever it toggles on its own. Excludes `open`.
 * @param navState - Keeps the open state in the history entry, so a screen
 *   left and come back to finds its sections as they were: `true` uses the
 *   expandable's own `id`, a string names the key, `{ id, type }` chooses
 *   between rewriting the entry ("replace", the default) and pushing one
 *   ("push"), where closing goes back. Source of truth — excludes
 *   `open`/`signal`.
 * @param onClose - Called when the expandable actually closes, whatever asked
 *   for it. Not preventable.
 * @param onToggle - Listens the "toggle" event dispatched on the root (a
 *   ToggleEvent with newState/oldState where supported). Fires on every actual
 *   state change, never on mount.
 * @param action - Ran when the expandable opens, aborted when it closes.
 *   Content children may then be a function `(data) => ui` or a branches
 *   object (`{ loading, error, completed, ... }`) — see ActionRenderer.
 * @param loading - Shows the loading spinner on the marker regardless of
 *   `action`'s own loading state.
 * @param animation - Off by default. `true` plays the reveal transition;
 *   duration comes from `--navi-expandable-animation-duration` (0.3s).
 * @param layout - `"row"` (default): the parts stack, the content expands
 *   vertically. `"column"`: the parts sit side by side sharing their height,
 *   the content expands horizontally next to the UI part.
 * @param openDirection - Where the content is revealed: `"down"` (default) or
 *   `"up"` in the stacked layout, `"right"` (default) or `"left"` in
 *   `layout="column"`. It also places the parts, so the direction holds
 *   whatever order they are written in — and an expandable with no
 *   `<Expandable.UI>` at all, driven from `open`/`signal` by a toggle of the
 *   app's own, can still say which way it opens.
 * @param autoFocus - Off by default (the keyboard stays where it is when the
 *   expandable opens). `true` hands the focus to the content through the same
 *   transfer a popup uses — the ladder picks the target (`navi-autofocus`
 *   first, see focus_transfer.js) and closing gives the keyboard back where it
 *   came from. An expandable that mounts already open never takes it. Whatever
 *   the setting, closing while the focus sits inside the content hands it back
 *   to the UI part (it would otherwise be lost to the closed, inert content).
 * @param maxContentHeight - Caps the content height; taller content scrolls
 *   inside the expandable instead of growing it.
 * @param mount - When the content is built and thrown away, a popup's own
 *   values and a popup's own code (see popup_content_mount.js). `"from-first-open"` (the
 *   default) builds it on the first expansion and keeps it afterwards.
 *   `"always"` builds it right away; in layout="column" it also gives the
 *   closed expandable its content's height (the content is kept laid out at
 *   its open width), so opening only reveals the width instead of changing the
 *   height too. `"idle"` builds it in a browser idle moment after load.
 *   `"while-opened"` throws the content away once the collapse
 *   settles — after the closing animation, so it still plays on real
 *   content — and rebuilds it from scratch on every expansion. Whatever the
 *   value, intent on the UI part (pointer entering it, focus landing in it)
 *   builds the content ahead of the click.
 */
export const Expandable = (props) => {
  import.meta.css = css;
  /* The open props are read from `props` by the open controller below; they
     are named here only to keep them out of `rest`, and so out of the DOM. */
  /* eslint-disable no-unused-vars */
  const {
    ref,
    ui,
    open,
    defaultOpen,
    signal,
    navState,
    onClose,
    action,
    loading,
    animation = false,
    layout,
    openDirection,
    autoFocus,
    maxContentHeight,
    mount = MOUNT_DEFAULT,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    children,
    ...rest
  } = props;
  /* eslint-enable no-unused-vars */

  const defaultRef = useRef();
  const rootRef = ref || defaultRef;
  const uiRef = useRef();
  const contentContainerRef = useRef();
  const contentId = useId();
  const isColumn = layout === "column";
  const closedContentSized = isColumn && mount === "always";

  const hasAction = Boolean(action);
  const effectiveAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(effectiveAction);

  // Registered before the open controller, so this cleanup runs before its own
  // unmount safety net (see useOpenController): a close fired on the way out
  // still does its bookkeeping, it just has no tree left to move.
  const unmountedRef = useRef(false);
  useLayoutEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  const openController = useOpenControllerByProps(props, "expandable");
  // What the controller decided, mirrored for the render (aria-expanded, the
  // content's inert, the marker). Written only from `openEffect` and the
  // cleanup it returns, and synchronously (see flushSyncRendering), so the DOM
  // is already in the new state when what follows measures it.
  const [opened, setOpened] = useState(false);
  // Fully open (or fully closed) and no longer moving — what releases the
  // clipping, see the CSS.
  const [settled, setSettled] = useState(true);
  const contentMounted = usePopupContentMount(
    openController,
    contentContainerRef,
    // The UI part is what the user aims at to expand — the closest thing an
    // expandable has to a popup's anchor, warming the content on intent.
    { mount, anchor: uiRef },
  );

  // The pointer press that is about to toggle can blur the focused field
  // before the click ever fires — so what held the focus has to be remembered
  // at pointerdown time.
  const focusedAtPointerDownRef = useRef(null);
  const onUIPointerDown = () => {
    focusedAtPointerDownRef.current = document.activeElement;
  };

  // The content keeps its final size while the track animates (see the top
  // comment): its animated dimension is pinned to a measured pixel value, and
  // released once the movement settles.
  const freezeContentSize = () => {
    const contentContainer = contentContainerRef.current;
    const contentElement = contentContainer.firstElementChild.firstElementChild;
    const rect = contentElement.getBoundingClientRect();
    if (isColumn) {
      // Both, not just the width: a max-height-capped content otherwise
      // follows the collapsing rows track down instead of holding its size.
      contentElement.style.width = `${rect.width}px`;
      contentElement.style.height = `${rect.height}px`;
    } else {
      contentElement.style.height = `${rect.height}px`;
    }
  };

  // A movement still playing: what a new one cancels before starting, so a
  // reveal interrupted halfway does not have the previous settle release its
  // frozen size under it.
  const cancelSettleWatchRef = useRef(null);
  const cancelSettleWatch = () => {
    cancelSettleWatchRef.current?.();
    cancelSettleWatchRef.current = null;
  };
  const watchSettle = () => {
    const contentContainer = contentContainerRef.current;
    const contentElement = contentContainer.firstElementChild.firstElementChild;
    cancelSettleWatchRef.current = whenTransitionSettles(
      contentContainer,
      () => {
        cancelSettleWatchRef.current = null;
        contentElement.style.width = "";
        contentElement.style.height = "";
        setSettled(true);
      },
    );
  };

  // The reveal needs the content at its final size before the track starts
  // moving, and that size only exists in the open state — the reflow trick
  // (see instructions.md, CSS section), with transitions suppressed BEFORE the
  // first layout read: this runs pre-paint, so any earlier read would itself be
  // the first recalc of the open state and would start the track transition.
  const armReveal = (startRect) => {
    const contentContainer = contentContainerRef.current;
    const contentElement = contentContainer.firstElementChild.firstElementChild;
    contentContainer.style.transitionProperty = "none";
    const finalRect = contentElement.getBoundingClientRect();
    if (isColumn) {
      contentElement.style.width = `${finalRect.width}px`;
      contentElement.style.height = `${finalRect.height}px`;
    } else {
      contentElement.style.height = `${finalRect.height}px`;
    }
    // Put the tracks back where the last paint left them and let the
    // transition play from there. In fr — px does not interpolate with fr.
    const startFrOf = (startSize, finalSize) =>
      finalSize > 0 ? startSize / finalSize : 0;
    if (isColumn) {
      contentContainer.style.gridTemplateColumns = `${startFrOf(
        startRect ? startRect.width : 0,
        finalRect.width,
      )}fr`;
      if (!closedContentSized) {
        // The height opens alongside the width (a closed column expandable is
        // only as tall as its UI) — unless the closed content already sizes
        // it, where only the width has anywhere to go.
        contentContainer.style.gridTemplateRows = `${startFrOf(
          startRect ? startRect.height : 0,
          finalRect.height,
        )}fr`;
      }
    } else {
      contentContainer.style.gridTemplateRows = `${startFrOf(
        startRect ? startRect.height : 0,
        finalRect.height,
      )}fr`;
    }
    // That starting frame must be genuinely rendered to transition from it,
    // and transitions re-enabled BEFORE the flip back to the open value —
    // same order as popover.jsx's own reflow trick.
    contentContainer.getBoundingClientRect();
    contentContainer.style.transitionProperty = "";
    contentContainer.style.gridTemplateColumns = "";
    contentContainer.style.gridTemplateRows = "";
  };

  // What opening LOOKS like here, and how to undo it — the one thing an
  // expandable owns that a popup does not (see open_controller.js). Reassigned
  // on every render so it always closes over the latest props.
  openController.openEffect = (openEvent) => {
    const contentContainer = contentContainerRef.current;
    // `silent`: the expandable was already open when the page appeared
    // (`open`/`defaultOpen` at mount). Nothing changed for anyone to be told
    // about, nothing was ever shown closed to move away from, and a page must
    // not have its focus stolen by a section that was simply already open — so
    // an opening that was never an opening plays nothing, says nothing and
    // takes nothing. The action it carries still runs: its content is due.
    const silent = Boolean(openEvent.detail.silent);
    const revealing = animation && !silent && Boolean(contentContainer);
    // Where the last paint left the track — 0 when fully closed, partway when
    // reopening during a collapse — read while the DOM still says closed.
    const startRect = revealing
      ? contentContainer.getBoundingClientRect()
      : null;
    cancelSettleWatch();
    flushSyncRendering(() => {
      setOpened(true);
      setSettled(!revealing);
    });
    if (hasAction) {
      runUnwatched(() => effectiveAction.run());
    }
    // autoFocus off (the default): the keyboard stays where it is, and with no
    // transfer there is nothing to restore on close either.
    const restoreFocus =
      autoFocus && !silent && contentContainer
        ? openController.transferFocusOnOpen(contentContainer)
        : null;
    if (revealing) {
      armReveal(startRect);
      watchSettle();
    }
    if (!silent) {
      rootRef.current.dispatchEvent(createToggleEvent(true));
    }

    return (closeEvent) => {
      if (unmountedRef.current) {
        return;
      }
      const contentContainerAtClose = contentContainerRef.current;
      // Read while the content still holds what it holds: the close is about
      // to make it inert, which blurs whatever is inside it.
      const activeElement = document.activeElement;
      const focusedBeforeClose =
        !activeElement || activeElement === document.body
          ? focusedAtPointerDownRef.current
          : activeElement;
      focusedAtPointerDownRef.current = null;
      if (hasAction) {
        effectiveAction.abort();
      }
      cancelSettleWatch();
      const collapsing = animation && Boolean(contentContainerAtClose);
      if (collapsing) {
        // Now, while the content is still fully laid out — the collapsing
        // track uncovers a content frozen at that size.
        freezeContentSize();
      }
      flushSyncRendering(() => {
        setOpened(false);
        setSettled(!collapsing);
      });
      if (restoreFocus) {
        restoreFocus(closeEvent);
      } else if (
        focusedBeforeClose &&
        contentContainerAtClose &&
        contentContainerAtClose.contains(focusedBeforeClose)
      ) {
        const uiElement = uiRef.current;
        if (uiElement) {
          moveFocusTo(uiElement);
        } else {
          // Nothing of the expandable's own can hold the keyboard (no UI
          // part): the focus only has to leave the content becoming inert.
          focusedBeforeClose.blur();
        }
      }
      if (collapsing) {
        watchSettle();
      }
      rootRef.current.dispatchEvent(createToggleEvent(false));
    };
  };

  const toggle = (event) => {
    if (openController.opened) {
      openController.requestClose(event, { isCancel: true });
    } else {
      openController.open(event);
    }
  };

  const findFirstFocusableInContent = () => {
    const contentContainer = contentContainerRef.current;
    if (!contentContainer) {
      return null;
    }
    return findAfter(contentContainer, elementIsFocusable, {
      root: contentContainer,
    });
  };

  // closedContentSized (column + mount="always"): the closed content sizes
  // the height (see the CSS), which is only right if it lies at its OPEN
  // width — at its natural closed width (a 0-wide track) it would wrap
  // against nothing and stack word by word. So while closed, its width is
  // frozen to a silently measured open width.
  useLayoutEffect(() => {
    if (!closedContentSized || opened || !settled || !contentMounted) {
      return;
    }
    const contentContainer = contentContainerRef.current;
    const contentElement = contentContainer.firstElementChild.firstElementChild;
    contentContainer.style.transitionProperty = "none";
    contentContainer.style.gridTemplateColumns = "1fr";
    contentElement.style.width = "";
    const openRect = contentElement.getBoundingClientRect();
    contentElement.style.width = `${openRect.width}px`;
    contentContainer.style.gridTemplateColumns = "";
    // The closed frame must be committed while transitions are still off —
    // re-enabled in the same recalc, the 1fr-to-0fr trip back from the silent
    // measurement above would play as a second closing animation.
    contentContainer.getBoundingClientRect();
    contentContainer.style.transitionProperty = "";
  }, [closedContentSized, opened, settled, contentMounted]);

  const onRootKeyDown = (keyboardEvent) => {
    if (!arrowKeyShortcuts) {
      return;
    }
    // The shortcuts all speak about the UI part — opening from it, stepping
    // into the content, stepping back to it. Without one the expandable is
    // driven from outside and the keys belong to whatever drives it.
    if (!uiRef.current) {
      return;
    }
    // A nested expandable (deeper, so heard first) already answered this key.
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    // Leave the key to whatever native use its target has for it (moving the
    // caret in a field, changing a slider) — only a press with nothing else
    // to do drives the expandable.
    const defaultAction = getKeyboardEventDefaultAction(keyboardEvent);
    if (defaultAction && defaultAction !== "scroll") {
      return;
    }
    const { key } = keyboardEvent;
    if (key === openKeyShortcut) {
      if (document.activeElement !== uiRef.current) {
        return;
      }
      if (!openController.opened) {
        keyboardEvent.preventDefault();
        openController.open(keyboardEvent);
        return;
      }
      const firstFocusableElementInContent = findFirstFocusableInContent();
      if (!firstFocusableElementInContent) {
        return;
      }
      keyboardEvent.preventDefault();
      moveFocusTo(firstFocusableElementInContent);
      return;
    }
    if (key === closeKeyShortcut) {
      if (!openController.opened) {
        return;
      }
      const uiElement = uiRef.current;
      keyboardEvent.preventDefault();
      if (document.activeElement === uiElement) {
        openController.requestClose(keyboardEvent, { isCancel: true });
      } else {
        moveFocusTo(uiElement);
      }
    }
  };

  const onUIClick = (clickEvent) => {
    // A navi control inside the UI part cancels the click it consumed (see
    // click_to_expand.js — the UI part's own aria-expanded is what it finds).
    if (clickEvent.defaultPrevented) {
      return;
    }
    const { target } = clickEvent;
    if (target.nodeType === 1) {
      const interactiveElement = target.closest(UI_INTERACTIVE_SELECTOR);
      if (
        interactiveElement &&
        interactiveElement !== uiRef.current &&
        uiRef.current.contains(interactiveElement)
      ) {
        return;
      }
    }
    toggle(clickEvent);
  };

  // Space/Enter on the UI part itself (role button) — a key pressed on a
  // control inside it belongs to that control.
  const onUIKeyDown = (keyboardEvent) => {
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (keyboardEvent.target !== uiRef.current) {
      return;
    }
    const { key } = keyboardEvent;
    if (key === " " || key === "Enter") {
      keyboardEvent.preventDefault();
      toggle(keyboardEvent);
    }
  };

  // Only the two directions the layout has room for: a column layout reveals
  // sideways, a stacked one vertically.
  const revealDirection = isColumn
    ? openDirection === "left"
      ? "left"
      : "right"
    : openDirection === "up"
      ? "up"
      : "down";
  // While open the marker points at the content, while closed always right.
  // In a column layout it points back toward the UI part whichever side the
  // content took, "right" being the closed direction already.
  const markerDirection = isColumn ? "left" : revealDirection;

  const expandableContextValue = {
    opened,
    loading: loading || (hasAction && actionLoading),
    contentMounted,
    hasAction,
    effectiveAction,
    markerDirection,
    openController,
    onUIClick,
    onUIPointerDown,
    onUIKeyDown,
    uiRef,
    contentContainerRef,
    contentId,
  };

  // The `ui` prop is the shorthand for the common shape: it names the UI part
  // and children are the content. Without it the children ARE the parts.
  const body =
    ui === undefined ? (
      children
    ) : (
      <>
        <ExpandableUI>{ui}</ExpandableUI>
        <ExpandableContent>{children}</ExpandableContent>
      </>
    );

  return (
    <Box
      ref={rootRef}
      baseClassName="navi_expandable"
      aria-expanded={opened ? "true" : "false"}
      data-layout={isColumn ? "column" : undefined}
      data-open-direction={revealDirection}
      data-animation={animation ? "" : undefined}
      data-settled={settled ? "" : undefined}
      data-content-scrolls={maxContentHeight === undefined ? undefined : ""}
      data-closed-content-sized={closedContentSized ? "" : undefined}
      {...rest}
      // The protocol every command target answers (see commands.js): a
      // `--navi-toggle`/`--navi-open`/`--navi-close` lands here as a
      // navi_command whose implementation dispatches the request events below.
      onnavi_command={(e) => {
        rest.onnavi_command?.(e);
        onNaviCommand(e);
      }}
      onnavi_request_open={(e) => {
        rest.onnavi_request_open?.(e);
        openController.open(e);
      }}
      onnavi_request_close={(e) => {
        rest.onnavi_request_close?.(e);
        const closing = openController.requestClose(e, {
          isCancel: e.detail?.isCancel,
        });
        if (!closing) {
          // Said back to whoever asked: --navi-close:all stops climbing here.
          e.preventDefault();
        }
      }}
      onKeyDown={(e) => {
        rest.onKeyDown?.(e);
        onRootKeyDown(e);
      }}
      style={
        maxContentHeight === undefined
          ? rest.style
          : {
              "--navi-expandable-max-content-height": stringifyStyle(
                maxContentHeight,
                "maxHeight",
              ),
              ...rest.style,
            }
      }
    >
      <ExpandableContext.Provider value={expandableContextValue}>
        {body}
      </ExpandableContext.Provider>
    </Box>
  );
};

/**
 * The always-visible part that reveals the content: the focusable toggle
 * itself (role button — click, Space/Enter, arrow keys), holding the marker
 * plus whatever it is given — any markup, a function of `{ open }` included.
 * Controls inside it keep their own behavior and do not toggle. A Box, so it
 * takes the layout and style props every Box takes.
 *
 * @type {import("preact").FunctionComponent<{
 *   marker?: false | import("preact").ComponentChildren,
 *   children?: import("preact").ComponentChildren | ((state: { open: boolean }) => import("preact").ComponentChildren),
 * }>}
 * @param marker - The chevron drawn before the label. `false` removes it (a UI
 *   part that is already an icon has no room for one); any node replaces it.
 */
const ExpandableUI = ({ marker, children, ...rest }) => {
  const {
    opened,
    loading,
    markerDirection,
    openController,
    onUIClick,
    onUIPointerDown,
    onUIKeyDown,
    uiRef,
    contentId,
  } = useExpandableContext("UI");
  return (
    <Box
      ref={uiRef}
      baseClassName="navi_expandable_ui"
      role="button"
      tabIndex={0}
      aria-expanded={opened}
      aria-controls={contentId}
      onClick={onUIClick}
      onPointerDown={onUIPointerDown}
      onKeyDown={onUIKeyDown}
      // A command from a control inside the UI part resolves its target to
      // the closest [aria-expanded] — this very element (see commands.js's
      // resolveClosestExpandable) — so it answers the protocol too. Spread as
      // an object: eslint's known-DOM-property check doesn't apply to navi's
      // own custom events.
      {...{
        onnavi_command: (e) => {
          onNaviCommand(e);
        },
        onnavi_request_open: (e) => {
          openController.open(e);
        },
        onnavi_request_close: (e) => {
          openController.requestClose(e, { isCancel: e.detail?.isCancel });
        },
      }}
      {...rest}
    >
      {marker === false ? null : (
        <span className="navi_expandable_marker" aria-hidden="true">
          {marker === undefined ? (
            <SummaryMarker
              open={opened}
              loading={loading}
              openDirection={markerDirection}
            />
          ) : (
            marker
          )}
        </span>
      )}
      <div className="navi_expandable_ui_label">
        {typeof children === "function" ? children({ open: opened }) : children}
      </div>
    </Box>
  );
};

/**
 * The revealed part, a Box like the UI part. With an `action` on the
 * Expandable, children may be a function `(data) => ui` or a branches object —
 * see ActionRenderer.
 *
 * @type {import("preact").FunctionComponent<{}>}
 */
const ExpandableContent = ({ children, ...rest }) => {
  const {
    opened,
    contentMounted,
    hasAction,
    effectiveAction,
    contentContainerRef,
    contentId,
  } = useExpandableContext("Content");

  let content = children;
  if (hasAction) {
    content = (
      <ActionRenderer action={effectiveAction}>{children}</ActionRenderer>
    );
  }
  return (
    <Box
      ref={contentContainerRef}
      id={contentId}
      baseClassName="navi_expandable_content_container"
      inert={opened ? undefined : true}
      {...rest}
    >
      <div className="navi_expandable_content_sizer">
        <div className="navi_expandable_content">
          {contentMounted ? content : null}
        </div>
      </div>
    </Box>
  );
};

Expandable.UI = ExpandableUI;
Expandable.Content = ExpandableContent;

// What a click inside the UI part must not toggle: it was aimed at the
// control, not at the row. The UI part itself matches [role='button'] and is
// the one exception, excluded at the call site.
const UI_INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "[role='button']",
  "[contenteditable='']",
  "[contenteditable='true']",
  "audio[controls]",
  "video[controls]",
].join(", ");

const createToggleEvent = (open) => {
  const newState = open ? "open" : "closed";
  const oldState = open ? "closed" : "open";
  if (typeof window.ToggleEvent === "function") {
    return new window.ToggleEvent("toggle", { newState, oldState });
  }
  const toggleEvent = new CustomEvent("toggle");
  toggleEvent.newState = newState;
  toggleEvent.oldState = oldState;
  return toggleEvent;
};
