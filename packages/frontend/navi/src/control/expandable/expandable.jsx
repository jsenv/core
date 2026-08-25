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
 *   expands above; `layout="column"` puts the parts side by side instead, the
 *   content then expanding horizontally. The common shape has a shorthand:
 *   `ui` prop + children as content.
 * - the UI part accepts any markup (buttons, links, fields) — only the small
 *   marker is a real <button>, carrying the aria for the whole row
 *   (aria-expanded/aria-controls, labelled by the UI part), so nested
 *   interactive content never ends up inside an interactive element.
 *
 * What <details> gives for free is rebuilt here:
 * - a "toggle" event (a real ToggleEvent when the browser has it) dispatched on
 *   the root whenever the state actually changes — but never on mount, unlike
 *   the native one (see the workaround comment in details.jsx);
 * - `--navi-toggle`/`--navi-open`/`--navi-close` commands work against it: the
 *   root carries `aria-expanded` (what the command system reads) and answers
 *   the `navi_command`/`navi_request_open`/`navi_request_close` events.
 *
 * Content is not built until the first expansion and stays built afterwards —
 * same policy, same prop names as popups (see popup_content_mount.js):
 * `mountWhenClosed` builds it right away, `unmountWhenClosed` throws it away
 * once the collapse settles (so a closing animation still plays on real
 * content).
 *
 * The expansion animates the content's grid track (0fr <-> 1fr — rows for the
 * stacked layout, columns for `layout="column"`) rather than `height`/`width`:
 * the open size is "auto" (content-sized), which a length transition cannot
 * interpolate to, while a fr track can. The content is clipped only while the
 * track moves; once settled open it overflows normally again, so a popover or
 * focus ring inside is not cut at the edges.
 */
import {
  elementIsFocusable,
  findAfter,
  getKeyboardEventDefaultAction,
  stringifyStyle,
} from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
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

      /* The whole row shows the focus, like a native <summary>, even though
         only the marker button actually holds it. */
      &:has(> .navi_expandable_toggle:focus-visible) {
        border-radius: 4px;
        outline: 2px solid AccentColor;
        outline-offset: 1px;
      }

      > .navi_expandable_toggle {
        display: flex;
        padding: 0;
        align-items: center;
        color: inherit;
        font: inherit;
        background: none;
        border: none;
        cursor: pointer;

        &:focus-visible {
          outline: none;
        }
      }

      > .navi_expandable_ui_label {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 0.2em;
      }
    }

    > .navi_expandable_content_container {
      display: grid;
      grid-template-rows: 0fr;

      > .navi_expandable_content {
        min-height: 0;
        overflow: hidden;
      }
    }
    &[aria-expanded="true"] > .navi_expandable_content_container {
      grid-template-rows: 1fr;
    }

    /* The parts sit side by side: the UI part becomes a vertical strip and
       the content expands horizontally, on the columns track. */
    &[data-layout="column"] {
      flex-direction: row;

      > .navi_expandable_ui {
        flex-direction: column;

        > .navi_expandable_ui_label {
          flex-direction: column;
        }
      }
      > .navi_expandable_content_container {
        grid-template-columns: 0fr;
        grid-template-rows: none;

        > .navi_expandable_content {
          min-width: 0;
          min-height: auto;
        }
      }
      &[aria-expanded="true"] > .navi_expandable_content_container {
        grid-template-columns: 1fr;
        grid-template-rows: none;
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
    /* Settled open: stop clipping, so a popover, a focus ring or a dragged
       element inside the content can spill out — unless the content is given
       a max height, where the clipping IS the feature (it scrolls). */
    &[aria-expanded="true"][data-settled]:not([data-content-scrolls])
      > .navi_expandable_content_container
      > .navi_expandable_content {
      overflow: visible;
    }
    &[data-content-scrolls]
      > .navi_expandable_content_container
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
 * @param animation - Off by default. `true` plays the expand/collapse track
 *   transition; duration comes from `--navi-expandable-animation-duration`
 *   (0.3s).
 * @param layout - `"row"` (default): the parts stack, the content expands
 *   vertically. `"column"`: the parts sit side by side, the content expands
 *   horizontally next to the UI part.
 * @param autoFocus - Off by default (the focus stays on the marker when
 *   opening). `true` moves the focus into the content on open — the
 *   `[autofocus]` element if any, the first focusable otherwise. Whatever the
 *   setting, closing while the focus is inside the content hands it back to
 *   the marker (it would otherwise be lost to the closed, inert content).
 * @param maxContentHeight - Caps the content height; taller content scrolls
 *   inside the expandable instead of growing it.
 * @param mountWhenClosed - Builds the content right away instead of on first
 *   expansion.
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
  const toggleButtonRef = useRef();
  const contentContainerRef = useRef();
  const contentId = useId();
  const uiId = useId();

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
  // blur what it held, so by effect time the focus to hand back to the marker
  // could already be gone.
  const focusedBeforeCloseRef = useRef(null);
  // The pointer press that is about to toggle blurs the focused field before
  // the click ever fires (pressing a non-focusable row moves the focus to
  // body) — so what held the focus has to be remembered at pointerdown time.
  const focusedAtPointerDownRef = useRef(null);
  const onUIPointerDown = () => {
    focusedAtPointerDownRef.current = document.activeElement;
  };

  const toggleTo = (nextOpen) => {
    nextOpen = Boolean(nextOpen);
    if (nextOpen === openedRef.current) {
      return;
    }
    openedRef.current = nextOpen;
    if (nextOpen) {
      setContentMounted(true);
    } else {
      const activeElement = document.activeElement;
      focusedBeforeCloseRef.current =
        !activeElement || activeElement === document.body
          ? focusedAtPointerDownRef.current
          : activeElement;
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
  // follow the transition to know when the movement is over. Skipped on mount —
  // nothing changed, so neither the event nor a transition exists (and a page
  // must not have its focus stolen by an expandable that was simply already
  // open).
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
        toggleButtonRef.current.focus();
      }
    }
    if (!animation) {
      return undefined;
    }
    const cancel = whenTransitionSettles(contentContainerRef.current, () => {
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
      if (document.activeElement !== toggleButtonRef.current) {
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
      const toggleButton = toggleButtonRef.current;
      if (document.activeElement === toggleButton) {
        keyboardEvent.preventDefault();
        toggleTo(false);
      } else {
        keyboardEvent.preventDefault();
        toggleButton.focus();
      }
    }
  };

  const onUIClick = (clickEvent) => {
    // A navi control inside the UI part cancels the click it consumed (see
    // click_to_expand.js — the root's aria-expanded is what it finds).
    if (clickEvent.defaultPrevented) {
      return;
    }
    const { target } = clickEvent;
    if (target.nodeType === 1) {
      const interactiveElement = target.closest(UI_INTERACTIVE_SELECTOR);
      if (
        interactiveElement &&
        interactiveElement !== toggleButtonRef.current &&
        uiRef.current.contains(interactiveElement)
      ) {
        return;
      }
    }
    toggleTo(!openedRef.current);
  };

  const expandableContextValue = {
    opened,
    loading: loading || (hasAction && actionLoading),
    contentMounted,
    hasAction,
    effectiveAction,
    onUIClick,
    onUIPointerDown,
    uiRef,
    toggleButtonRef,
    contentContainerRef,
    contentId,
    uiId,
  };

  // Explicit parts win; the `ui` prop + children is the shorthand for the
  // common shape (UI above, content below).
  const childArray = toChildArray(children);
  const hasParts = childArray.some(
    (child) =>
      child &&
      (child.type === ExpandableUI || child.type === ExpandableContent),
  );
  const body = hasParts ? (
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
      data-layout={layout === "column" ? "column" : undefined}
      data-animation={animation ? "" : undefined}
      data-settled={settled ? "" : undefined}
      data-content-scrolls={maxContentHeight === undefined ? undefined : ""}
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
 * The always-visible part that reveals the content: the marker button plus
 * whatever it is given — any markup, a function of `{ open }` included. Its
 * position among the parts decides where the content goes (before the content:
 * content below/right; after it: content above/left).
 *
 * @type {import("preact").FunctionComponent<{
 *   children?: import("preact").ComponentChildren | ((state: { open: boolean }) => import("preact").ComponentChildren),
 * }>}
 */
const ExpandableUI = ({ children, ...rest }) => {
  const {
    opened,
    loading,
    onUIClick,
    onUIPointerDown,
    uiRef,
    toggleButtonRef,
    contentId,
    uiId,
  } = useExpandableContext("UI");
  return (
    <div
      ref={uiRef}
      className="navi_expandable_ui"
      onClick={onUIClick}
      onPointerDown={onUIPointerDown}
      {...rest}
    >
      <button
        ref={toggleButtonRef}
        type="button"
        className="navi_expandable_toggle"
        aria-expanded={opened}
        aria-controls={contentId}
        aria-labelledby={uiId}
      >
        <SummaryMarker open={opened} loading={loading} />
      </button>
      <div id={uiId} className="navi_expandable_ui_label">
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
      <div className="navi_expandable_content">
        {contentMounted ? content : null}
      </div>
    </div>
  );
};

Expandable.UI = ExpandableUI;
Expandable.Content = ExpandableContent;

// What a click inside the UI part must not toggle: it was aimed at the
// control, not at the row. The marker button is the one exception, excluded at
// the call site.
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
