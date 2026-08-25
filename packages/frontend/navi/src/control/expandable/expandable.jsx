/**
 * Expandable: an in-flow disclosure — a UI part that reveals a content part.
 * It covers the same ground as <Details> with structural differences:
 *
 * - the two parts are explicit and free to order/orient:
 *
 *     <Expandable>
 *       <Expandable.UI>See more</Expandable.UI>
 *       <Expandable.Content>…</Expandable.Content>
 *     </Expandable>
 *
 *   Content after UI expands below (the <details> shape), Content before UI
 *   expands above; `layout="column"` puts the parts side by side (sharing
 *   their height), the content then expanding horizontally. The marker
 *   chevron follows: it points right while closed and toward where the
 *   content went while open (down, up, or left). The common shape has a
 *   shorthand: `ui` prop + children as content.
 * - the UI part is the focusable toggle itself (role button, Space/Enter,
 *   arrow keys) and accepts any markup: controls inside it keep their own
 *   behavior, the marker is purely decorative.
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
 * Content is not built until the first expansion and stays built afterwards —
 * same policy, same prop names as popups (see popup_content_mount.js):
 * `mountWhenClosed` builds it right away, `unmountWhenClosed` throws it away
 * once the collapse settles (so a closing animation still plays on real
 * content).
 *
 * The animation is a REVEAL, not a resize: the expandable's own footprint
 * grows/shrinks progressively (the content's grid track interpolates
 * 0fr <-> 1fr — rows for the stacked layout, columns for `layout="column"`),
 * but the content inside is laid out at its final size for the whole movement
 * (its animated dimension is frozen to the measured final value, see the
 * [opened] effect) and the container simply uncovers it. Text never rewraps
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
import { cloneElement, createContext, toChildArray } from "preact";
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { ActionRenderer } from "../../action/action_renderer.jsx";
import { useAction } from "../../action/use_action.js";
import { useActionStatus } from "../../action/use_action_status.js";
import { Box } from "../../box/box.jsx";
import { whenTransitionSettles } from "../../layout/popup_shared.js";
import { onNaviCommand } from "../commands.js";
import { warnSignalCollision } from "../control_value.js";
import { SummaryMarker } from "../details/summary_marker.jsx";

const css = /* css */ `
  .navi_expandable {
    position: relative;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;

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
    /* Content before the UI: revealed against the UI side — the edge touching
       the UI stays, the far edge is what gets uncovered. Said at BOTH levels:
       a transitioning fr resolves once for the container's own size and once
       more inside it (the row is fraction² high), so the row must be glued to
       the container's UI edge and the oversized frozen content to the row's —
       anchoring only the inner one leaves the content following the drifting
       fraction² row. */
    &[data-content-first]:not([data-layout="column"])
      > .navi_expandable_content_container {
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
      /* mountWhenClosed: the content is built and width-frozen while closed
         (see the component), so it can size the height at all times — the
         expandable then keeps one stable height and only the width reveals. */
      &[data-closed-content-sized] > .navi_expandable_content_container {
        grid-template-rows: none;
      }
      &[data-content-first] > .navi_expandable_content_container {
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
 *   onToggle?: (event: Event) => void,
 *   action?: Function,
 *   loading?: boolean,
 *   animation?: boolean,
 *   layout?: "row" | "column",
 *   autoFocus?: boolean,
 *   maxContentHeight?: string | number,
 *   mountWhenClosed?: boolean,
 *   unmountWhenClosed?: boolean,
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
 *   in between (same semantics as Dialog/Popover's own `open`).
 * @param defaultOpen - Uncontrolled, mount-only initial state.
 * @param signal - Two-way binding: the expandable follows the signal and
 *   writes back into it whenever it toggles on its own. Excludes `open`.
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
 * @param autoFocus - Off by default (the focus stays on the UI part when
 *   opening). `true` moves the focus into the content on open — the
 *   `[autofocus]` element if any, the first focusable otherwise. Whatever the
 *   setting, closing while the focus is inside the content hands it back to
 *   the UI part (it would otherwise be lost to the closed, inert content).
 * @param maxContentHeight - Caps the content height; taller content scrolls
 *   inside the expandable instead of growing it.
 * @param mountWhenClosed - Builds the content right away instead of on first
 *   expansion. In layout="column" it also gives the closed expandable its
 *   content's height (the content is kept laid out at its open width), so
 *   opening only reveals the width instead of changing the height too.
 * @param unmountWhenClosed - Throws the content away once the collapse
 *   settles — after the closing animation, so it still plays on real content —
 *   and rebuilds it from scratch on every expansion.
 */
export const Expandable = (props) => {
  import.meta.css = css;
  const {
    ref,
    ui,
    open,
    defaultOpen,
    signal,
    action,
    loading,
    animation = false,
    layout,
    autoFocus,
    maxContentHeight,
    mountWhenClosed,
    unmountWhenClosed,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    children,
    ...rest
  } = props;

  const defaultRef = useRef();
  const rootRef = ref || defaultRef;
  const uiRef = useRef();
  const contentContainerRef = useRef();
  const contentId = useId();
  const isColumn = layout === "column";
  const closedContentSized = Boolean(isColumn && mountWhenClosed);

  if (signal) {
    warnSignalCollision(props, "expandable", "open");
  }
  // Reading .value during render is what subscribes the expandable to it.
  const openRequested = signal ? signal.value : open;
  const [opened, setOpened] = useState(() =>
    Boolean(openRequested === undefined ? defaultOpen : openRequested),
  );
  const openedRef = useRef(opened);
  openedRef.current = opened;

  const hasAction = Boolean(action);
  const effectiveAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(effectiveAction);

  const [contentMounted, setContentMounted] = useState(
    () => Boolean(mountWhenClosed) || opened,
  );
  // Same exclusion as popup_content_mount.js: content that must exist while
  // closed cannot also be thrown away on close.
  const effectiveUnmountWhenClosed = unmountWhenClosed && !mountWhenClosed;

  // Fully open and no longer moving — what allows overflow to become visible
  // (see the CSS) and what unmountWhenClosed waits for before emptying.
  const [settled, setSettled] = useState(true);

  // Read before the close touches the DOM: flipping the content to inert can
  // blur what it held, so by effect time the focus to hand back to the UI part
  // could already be gone.
  const focusedBeforeCloseRef = useRef(null);
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
    const contentElement = contentContainer
      ? contentContainer.firstElementChild.firstElementChild
      : null;
    if (!contentElement) {
      return;
    }
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

  // Where the last paint left the track, measured before the toggle commits:
  // 0 when fully closed, partway when reopening during a collapse. Read here
  // rather than in the effect — a layout read after the commit would also be
  // the first style recalc of the open state, starting the track transition
  // right there; once canceled (to measure the final size), a new transition
  // to the same end value refuses to start and the reveal jumps.
  const revealStartSizeRef = useRef(null);

  const toggleTo = (nextOpen) => {
    nextOpen = Boolean(nextOpen);
    if (nextOpen === openedRef.current) {
      return;
    }
    openedRef.current = nextOpen;
    if (nextOpen) {
      if (animation) {
        const contentContainer = contentContainerRef.current;
        revealStartSizeRef.current = contentContainer
          ? contentContainer.getBoundingClientRect()
          : null;
      }
      setContentMounted(true);
    } else {
      const activeElement = document.activeElement;
      focusedBeforeCloseRef.current =
        !activeElement || activeElement === document.body
          ? focusedAtPointerDownRef.current
          : activeElement;
      if (animation) {
        // Now, while the content is still fully laid out — by effect time the
        // track is already heading to 0 (the opening case measures in the
        // effect instead, where the just-mounted content exists).
        freezeContentSize();
      }
    }
    focusedAtPointerDownRef.current = null;
    setOpened(nextOpen);
    // Flipped here, before the closing/opening commit, so effects of that very
    // commit already see the movement as started — unmountWhenClosed must not
    // read a stale "settled" and empty the content under a closing animation.
    setSettled(!animation);
    if (signal) {
      signal.value = nextOpen;
    }
    if (hasAction) {
      if (nextOpen) {
        effectiveAction.run();
      } else {
        effectiveAction.abort();
      }
    }
  };

  const findFirstFocusableInContent = () => {
    const contentContainer = contentContainerRef.current;
    if (!contentContainer) {
      return null;
    }
    const autofocusElement = contentContainer.querySelector("[autofocus]");
    if (autofocusElement) {
      return autofocusElement;
    }
    return findAfter(contentContainer, elementIsFocusable, {
      root: contentContainer,
    });
  };

  // Follow `open`/`signal` changes after mount (the initial value is already
  // in the state above). A self-initiated toggle that wrote the signal lands
  // here too and no-ops, since the state already matches.
  const isFirstOpenRequestedRunRef = useRef(true);
  useLayoutEffect(() => {
    if (isFirstOpenRequestedRunRef.current) {
      isFirstOpenRequestedRunRef.current = false;
      return;
    }
    if (openRequested === undefined) {
      return;
    }
    toggleTo(openRequested);
  }, [openRequested]);

  // A state change: tell the world (the "toggle" event), move the focus, and
  // set up the reveal. Skipped on mount — nothing changed, so neither the
  // event nor a transition exists (and a page must not have its focus stolen
  // by an expandable that was simply already open).
  const isFirstOpenedRunRef = useRef(true);
  useLayoutEffect(() => {
    if (isFirstOpenedRunRef.current) {
      isFirstOpenedRunRef.current = false;
      return undefined;
    }
    const root = rootRef.current;
    root.dispatchEvent(createToggleEvent(opened));
    if (opened) {
      if (autoFocus) {
        const firstFocusableElement = findFirstFocusableInContent();
        if (firstFocusableElement) {
          firstFocusableElement.focus();
        }
      }
    } else {
      const focusedBeforeClose = focusedBeforeCloseRef.current;
      focusedBeforeCloseRef.current = null;
      if (
        focusedBeforeClose &&
        contentContainerRef.current &&
        contentContainerRef.current.contains(focusedBeforeClose)
      ) {
        uiRef.current.focus();
      }
    }
    if (!animation) {
      return undefined;
    }
    const contentContainer = contentContainerRef.current;
    const contentElement = contentContainer.firstElementChild.firstElementChild;
    if (opened) {
      // The reveal needs the content at its final size before the track
      // starts moving, and the final size only exists in the open state —
      // the reflow trick (see instructions.md, CSS section), with transitions
      // suppressed BEFORE the first layout read: this effect runs pre-paint,
      // so any earlier read would itself be the first recalc of the open
      // state and would start the track transition (see revealStartSizeRef).
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
      const startRect = revealStartSizeRef.current;
      revealStartSizeRef.current = null;
      const startFrOf = (startSize, finalSize) =>
        finalSize > 0 ? startSize / finalSize : 0;
      if (isColumn) {
        contentContainer.style.gridTemplateColumns = `${startFrOf(
          startRect ? startRect.width : 0,
          finalRect.width,
        )}fr`;
        if (!closedContentSized) {
          // The height opens alongside the width (a closed column expandable
          // is only as tall as its UI) — unless the closed content already
          // sizes it, where only the width has anywhere to go.
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
    }
    // (closing froze the content in toggleTo, while it was still laid out)
    const cancel = whenTransitionSettles(contentContainer, () => {
      contentElement.style.width = "";
      contentElement.style.height = "";
      setSettled(true);
    });
    return cancel;
  }, [opened]);

  useLayoutEffect(() => {
    if (settled && !opened && effectiveUnmountWhenClosed) {
      setContentMounted(false);
    }
  }, [settled, opened, effectiveUnmountWhenClosed]);
  useLayoutEffect(() => {
    if (mountWhenClosed) {
      setContentMounted(true);
    }
  }, [mountWhenClosed]);

  // closedContentSized (column + mountWhenClosed): the closed content sizes
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

  // Mounted already open: the content is visible, its data is due.
  useEffect(() => {
    if (openedRef.current && hasAction) {
      effectiveAction.run();
    }
  }, []);

  const onRootKeyDown = (keyboardEvent) => {
    if (!arrowKeyShortcuts) {
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
      if (!openedRef.current) {
        keyboardEvent.preventDefault();
        toggleTo(true);
        return;
      }
      const firstFocusableElementInContent = findFirstFocusableInContent();
      if (!firstFocusableElementInContent) {
        return;
      }
      keyboardEvent.preventDefault();
      firstFocusableElementInContent.focus();
      return;
    }
    if (key === closeKeyShortcut) {
      if (!openedRef.current) {
        return;
      }
      const uiElement = uiRef.current;
      if (document.activeElement === uiElement) {
        keyboardEvent.preventDefault();
        toggleTo(false);
      } else {
        keyboardEvent.preventDefault();
        uiElement.focus();
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
    toggleTo(!openedRef.current);
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
      toggleTo(!openedRef.current);
    }
  };

  // Where the content went, so the marker can point at it while open (closed
  // always points right): below by default, above when the content part comes
  // first, beside for layout="column" (the chevron then points back toward
  // the UI: left).
  const childArray = toChildArray(children);
  const firstPart = childArray.find(
    (child) =>
      child &&
      (child.type === ExpandableUI || child.type === ExpandableContent),
  );
  const hasParts = Boolean(firstPart);
  const contentFirst = hasParts && firstPart.type === ExpandableContent;
  const openDirection = isColumn ? "left" : contentFirst ? "up" : "down";

  const expandableContextValue = {
    opened,
    loading: loading || (hasAction && actionLoading),
    contentMounted,
    hasAction,
    effectiveAction,
    openDirection,
    toggleTo,
    onUIClick,
    onUIPointerDown,
    onUIKeyDown,
    uiRef,
    contentContainerRef,
    contentId,
  };

  // Explicit parts win; the `ui` prop + children is the shorthand for the
  // common shape (UI above, content below). Parts are cloned on every render:
  // reference-stable children would be bailed out of the commit, leaving
  // their context subscription to re-render them asynchronously — after the
  // [opened] effect above, which measures the content they render.
  const body = hasParts ? (
    childArray.map((child) =>
      child && (child.type === ExpandableUI || child.type === ExpandableContent)
        ? cloneElement(child)
        : child,
    )
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
      data-content-first={contentFirst ? "" : undefined}
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
        toggleTo(true);
      }}
      onnavi_request_close={(e) => {
        rest.onnavi_request_close?.(e);
        toggleTo(false);
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
 * Controls inside it keep their own behavior and do not toggle. Its position
 * among the parts decides where the content goes (before the content: content
 * below/right; after it: content above/left).
 *
 * @type {import("preact").FunctionComponent<{
 *   children?: import("preact").ComponentChildren | ((state: { open: boolean }) => import("preact").ComponentChildren),
 * }>}
 */
const ExpandableUI = ({ children, ...rest }) => {
  const {
    opened,
    loading,
    openDirection,
    toggleTo,
    onUIClick,
    onUIPointerDown,
    onUIKeyDown,
    uiRef,
    contentId,
  } = useExpandableContext("UI");
  return (
    <div
      ref={uiRef}
      className="navi_expandable_ui"
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
        onnavi_request_open: () => {
          toggleTo(true);
        },
        onnavi_request_close: () => {
          toggleTo(false);
        },
      }}
      {...rest}
    >
      <span className="navi_expandable_marker" aria-hidden="true">
        <SummaryMarker
          open={opened}
          loading={loading}
          openDirection={openDirection}
        />
      </span>
      <div className="navi_expandable_ui_label">
        {typeof children === "function" ? children({ open: opened }) : children}
      </div>
    </div>
  );
};

/**
 * The revealed part. With an `action` on the Expandable, children may be a
 * function `(data) => ui` or a branches object — see ActionRenderer.
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
    <div
      ref={contentContainerRef}
      id={contentId}
      className="navi_expandable_content_container"
      inert={opened ? undefined : true}
      {...rest}
    >
      <div className="navi_expandable_content_sizer">
        <div className="navi_expandable_content">
          {contentMounted ? content : null}
        </div>
      </div>
    </div>
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
