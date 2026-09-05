import {
  chainEvent,
  findEvent,
  getKeyboardEventDefaultAction,
  isTouchDrivenEvent,
} from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { useDebugInteraction } from "@jsenv/navi/src/navi_debug.jsx";
import { canNavBackSignal } from "../nav/browser_integration/document_back_and_forward.js";
import {
  navBack,
  navTo,
  useNavState,
} from "../nav/browser_integration/browser_integration.js";
import { warnSignalCollision } from "../control/control_value.js";
import {
  prepareFocusTransfer,
  markAutofocusRestoreOnClose,
} from "../utils/focus/focus_transfer.js";
import { isEditableTarget } from "@jsenv/navi/src/box/pseudo_styles.js";
import { useStableCallback } from "../utils/use_stable_callback.js";

/*
 * How many presses the page has seen, and which one a popup opened during.
 *
 * A popup dismisses itself on a `mousedown` outside, and the release of a TOUCH
 * ends with mouse events too: a tap synthesizes `mousedown`, `mouseup` and
 * `click` after `touchend`, at the place the finger left. For a popup opened by
 * that same press — a menu under a held finger, which is what a long press is
 * for — the backdrop did not exist when the finger landed and does exist when it
 * leaves, so it is handed a press it never saw begin and reads it as somebody
 * dismissing it. The popup closes on the release of the press that opened it.
 *
 * What tells them apart is not the device and not the clock: it is whether
 * ANOTHER press has begun since the popup opened. So presses are counted — a
 * pointerdown is a press — and a popup remembers the count it opened at. Equal
 * counts mean no hand has been put down since, and the mouse events arriving are
 * the tail of the press that opened it. A compatibility mouse event never brings
 * a `pointerdown` of its own (the pointer events for that finger were fired when
 * it landed), which is exactly what makes the count stand still through it.
 *
 * Read at module scope, in capture, so it is true before any handler asks.
 */
let pressCount = 0;
document.addEventListener(
  "pointerdown",
  () => {
    pressCount++;
  },
  { capture: true },
);

/**
 * Whether the popup was opened by the press whose mouse events are landing now
 * — the one thing that must not dismiss it (see above).
 *
 * Asked by every path that dismisses on an outside press: the backdrop of both
 * renderers, the document-level listener a native dialog uses, and the outside
 * regions a caller declares inside its own box.
 */
export const openedDuringThisPress = (openController) =>
  openController.pressCountAtOpen === pressCount;

// How long a popup waits before handing the focus to a field, when giving it
// is what raises the on-screen keyboard.
//
// The focus is normally given as early as possible. But a popup places itself
// against the viewport, and on a phone the keyboard takes a third of that
// viewport away the moment a field receives focus — so the two landing in the
// same tick means the popup is still arriving when the room under it changes,
// and it re-places itself mid-entrance. Waiting lets it settle first, and the
// keyboard then shrinks a box that has stopped moving.
//
// Long enough to outlast an entrance transition rather than merely reaching
// the next frame: what has to be over is the popup MOVING, not one paint of
// it.
const FOCUS_DELAY_ON_KEYBOARD_MS = 250;

/**
 * Owns open/close decision-making for a popup (Dialog or Popover): guards
 * against duplicate requests and notifies the popup owner's own reactions.
 *
 * `controller.openEffect` is implemented by the controlled element (Dialog or
 * Popover), reassigned on every render so it always closes over the latest
 * props (scrollCapture, anchor, etc.). It performs whatever DOM side effects
 * are needed to make the element actually open (`showModal()`/`showPopover()`,
 * focus transfer, positioning, traps...) and returns its cleanup —
 * the matching side effects to sync back to closed (`close()`/
 * `hidePopover()`, releasing traps...). That cleanup is kept private to the
 * controller (not exposed as a property) and invoked when the popup actually
 * closes, however that happens.
 *
 * Dialog/Popover also call `openController.requestClose(e, { isCancel })` for
 * their own internal triggers (backdrop click, Escape).
 *
 * `openHandler` is the popup owner's own business logic, passed once to
 * `createOpenController`. Its return value is `{ onRequestClose, onClose }`,
 * in the spirit of CloseWatcher
 * (https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher) but with
 * clearer naming than its cancel/close pair:
 * - `onRequestClose(e)`: about to close — call `e.preventDefault()` to stay
 *   open. Validation lives here.
 * - `onClose(e)`: actually closing, not preventable — final reactions live here.
 *
 * The controller exposes matching action methods:
 * - `open()`: requests opening — calls the caller's `onOpen` (see below), then
 *   `mountContent`/`openEffect`, then `openHandler`.
 * - `requestClose()`: requests closing — calls `onRequestClose` then `onClose`,
 *   stopping after the first if denied. The popup may choose to stay open,
 *   which is what a `false` return says (`true`: closed, or closed already).
 * - `close()`: closes for real — calls only `onClose`, skipping
 *   `onRequestClose` entirely. Used when there really is no choice (e.g. the
 *   popup unmounting).
 */
export const createOpenController = (
  openHandler,
  { debugInteraction } = {},
) => {
  let closeHandlers = null; // { onRequestClose, onClose } returned by openHandler
  let openEffectCleanup = null; // function returned by openEffect, undoes its DOM side effects
  let focusedAtClose = null; // what held the focus when the close was decided, see performClose

  // Set true while we're waiting to see whether the click that follows a
  // mousedown-close will land back on whatever would reopen us — see
  // armSuppressNextOpenRequest below.
  let suppressNextOpenRequest = false;
  let disarmSuppressNextOpenRequest = null;

  // When the popup closes because of a mousedown (e.g. clicking the
  // backdrop), the browser still dispatches the matching "click" afterward.
  // If that click lands back on the element that triggers open() (e.g. the
  // picker button), it would immediately reopen the popup. We cannot
  // preventDefault/stopPropagation the mousedown to stop that — the browser
  // dispatches the click regardless.
  //
  // Instead: arm a capture-phase "click" listener on document. Capture fires
  // before the click reaches its target, so by the time any bubble-phase
  // click handler (e.g. the trigger button's onClick, which calls
  // controller.open()) runs, `suppressNextOpenRequest` is already true and
  // open() ignores the request — no need to know *which* element triggers
  // it. A bubble-phase listener (runs after everything else, once the click
  // reaches document) clears the flag if nothing consumed it, meaning this
  // click never resulted in an open() call. A timeout is a last-resort safety
  // net in case the click never reaches document at all (e.g. some ancestor
  // called stopPropagation()) — a *task*, never a microtask: a microtask
  // checkpoint runs between two listeners of the same trusted event dispatch,
  // so it would clear the flag before the bubble-phase handler this is meant
  // to block ever runs, which is precisely the case it exists for.
  const armSuppressNextOpenRequest = () => {
    disarmSuppressNextOpenRequest?.();
    let safetyTimeout = null;
    const onCaptureClick = () => {
      document.removeEventListener("click", onCaptureClick, {
        capture: true,
      });
      suppressNextOpenRequest = true;
      document.addEventListener("click", onBubbleClick);
      safetyTimeout = setTimeout(() => {
        suppressNextOpenRequest = false;
      });
    };
    const onBubbleClick = () => {
      document.removeEventListener("click", onBubbleClick);
      clearTimeout(safetyTimeout);
      suppressNextOpenRequest = false;
    };
    disarmSuppressNextOpenRequest = () => {
      clearTimeout(safetyTimeout);
      document.removeEventListener("click", onCaptureClick, {
        capture: true,
      });
      document.removeEventListener("click", onBubbleClick);
    };
    document.addEventListener("click", onCaptureClick, { capture: true });
  };

  // The DOM change a popup asked to have photographed (see
  // controller.transitionChange), waiting for the browser to take the picture
  // of the state being left. Anything the controller is asked to do meanwhile
  // happens after it: the change is run on the spot, and the transition holding
  // it finds nothing left to do.
  let changeAwaitingTransition = null;
  const flushChangeAwaitingTransition = () => {
    const change = changeAwaitingTransition;
    if (!change) {
      return;
    }
    changeAwaitingTransition = null;
    change();
  };
  const runChange = (change, { opened, event }) => {
    const { transitionChange } = controller;
    if (!transitionChange) {
      change();
      return;
    }
    // What the controller answers about itself does not wait for the picture:
    // whoever just asked reads `opened` on the spot (see
    // useOpenPropsEffectOnOpenController, which writes it back into the
    // caller's own signal), and a request arriving before the change lands
    // runs it first rather than reading a DOM that disagrees.
    controller.opened = opened;
    changeAwaitingTransition = change;
    transitionChange(
      () => {
        if (changeAwaitingTransition === change) {
          flushChangeAwaitingTransition();
        }
      },
      { opened, event },
    );
  };

  const performClose = (closeEvent) => {
    controller.opened = false;
    // Read before any close effect touches the DOM: closing a native <dialog>
    // hands the focus back to whatever held it at showModal() time, so by the
    // time the close cleanup runs, the popup's content has already lost the
    // focus and could not be remembered for the next open.
    focusedAtClose = document.activeElement;

    prevent_reopen: {
      // Either event means the same thing here — a press closed this popup and
      // its click is still to come. Two of them because a press whose
      // `pointerdown` was cancelled downstream (a drag source arbitrating it,
      // a control keeping the focus) never produces a `mousedown` at all, and
      // that is exactly the press a popup with no backdrop hears (see
      // armOutsidePressClose).
      const pressEvent =
        findEvent(closeEvent, "mousedown") ||
        findEvent(closeEvent, "pointerdown");
      if (pressEvent) {
        debugInteraction(
          closeEvent,
          `closed by ${pressEvent.type} -> ignore next click`,
        );
        armSuppressNextOpenRequest();
        break prevent_reopen;
      }

      // The keyboard counterpart of the mousedown case above: a key press that
      // closes the popup and then goes on to activate the trigger, reopening it
      // on the spot. Space and Enter both get there, but not the same way and
      // not always — preventing the key unconditionally would eat presses that
      // were never going to activate anything (a space typed in a field, an
      // Enter the popup's own handler already consumed), so each is verified
      // before being prevented.

      // Space: pressed on the trigger itself, which still has focus (closing
      // does not move it away from an element outside the popup). The browser
      // turns that press into a click on keyup, and that click lands back on
      // the trigger. Asked of the browser's own default action rather than
      // guessed from the tag name: a space that scrolls, or types into a field
      // inside the popup, has no activation to prevent and preventing it would
      // swallow the scroll / the character.
      const spaceKeyEvent = findEvent(
        closeEvent,
        (e) => e.type === "keydown" && e.key === " ",
      );
      if (
        spaceKeyEvent &&
        getKeyboardEventDefaultAction(spaceKeyEvent) === "activate"
      ) {
        debugInteraction(
          closeEvent,
          `closed by space on <${spaceKeyEvent.target.tagName.toLowerCase()}> -> prevent the click it would produce (space.preventDefault())`,
        );
        // The browser won't dispatch the click, and our "space_to_open" sees
        // defaultPrevented too so it won't try to open the picker either.
        spaceKeyEvent.preventDefault();
        break prevent_reopen;
      }

      // Enter: pressed inside the popup (its own submit button, or implicit
      // submission from a field it contains). The popup closes synchronously
      // and focus is restored to the trigger, so the activation the browser
      // still owes this press is delivered to the trigger instead.
      //
      // Verified on two counts: the press still owes an activation (the
      // browser's default action for it is one — "activate" on a submit button,
      // "form_submit" on a field — and nothing has consumed it yet), and it came
      // from inside the popup. An Enter from outside is not this case at all.
      const enterKeyEvent = findEvent(
        closeEvent,
        (e) => e.type === "keydown" && e.key === "Enter",
      );
      if (
        enterKeyEvent &&
        !enterKeyEvent.defaultPrevented &&
        ENTER_ACTIVATING_DEFAULT_ACTION_SET.has(
          getKeyboardEventDefaultAction(enterKeyEvent),
        ) &&
        isInsideOpenPopup(enterKeyEvent.target)
      ) {
        debugInteraction(
          closeEvent,
          `closed by enter from inside the popup -> prevent the activation it would deliver to the trigger (enter.preventDefault())`,
        );
        enterKeyEvent.preventDefault();
        break prevent_reopen;
      }
    }

    runChange(
      () => {
        // Sync the DOM closed first (releasing the focus trap) — only then run
        // the owner's own reaction (onClose may restore focus to an element
        // outside the popup, which the focus trap would otherwise fight while
        // still active).
        openEffectCleanup?.(closeEvent);
        openEffectCleanup = null;
        closeHandlers?.onClose?.(closeEvent);
        closeHandlers = null;
        // Last: the close effects above are what starts the exit transition the
        // content must outlive (see popup_content_mount.js).
        controller.unmountContent?.();
        controller.onOpenedChange?.(false, closeEvent);
      },
      { opened: false, event: closeEvent },
    );
  };
  const controller = {
    opened: false,
    // Which press the popup opened during, written at every open (see
    // openedDuringThisPress). Never any press before there has been one.
    pressCountAtOpen: null,
    openEffect: null,
    // Set by the controlled element (see popup_content_mount.js) when its
    // content is still waiting for a first open to be built. Called below,
    // before openEffect, so the popup measures and positions the real thing.
    mountContent: null,
    // The caller's own `onOpen`, set by Dialog/Popover from their props on
    // every render (like openEffect). Called BEFORE mountContent, so whatever
    // it decides — which record this dialog is opening on — is already true by
    // the time the content is built, positioned and shown. That order is the
    // whole point: learning it afterwards means the content mounted on the
    // previous subject first.
    onOpen: null,
    // The counterpart, set only when the popup was told to throw its content
    // away on close (`mount="while-opened"`). Called from performClose above.
    unmountContent: null,
    // Set by the controlled element when the DOM change that opens or closes
    // it has to be photographed by the browser on both sides — a document view
    // transition, whose update callback is the only place that change can
    // happen (Dialog's animation="growing", see popup_grow.js). Called with
    // the change and where it leads; running it is its job, and it may run it
    // a frame later than it was asked for. That delay is the reason a popup
    // cannot do this from the outside: `--navi-open` runs when navi runs it,
    // and a close arrives once the DOM already holds it.
    transitionChange: null,
    // Told whenever `opened` actually changes, whatever asked for it — an
    // interaction, a command, a prop — with the event that asked. What lets a
    // `signal` prop reflect the popup's real state, and a `navState` prop write
    // it into the history entry (see useOpenPropsEffectOnOpenController);
    // called once the open/close has fully happened rather than mid-sequence.
    onOpenedChange: null,
    open: (e, detail) => {
      flushChangeAwaitingTransition();
      if (controller.opened || !controller.openEffect) {
        return;
      }
      if (suppressNextOpenRequest) {
        suppressNextOpenRequest = false;
        return;
      }
      const requestOpenEvent = new CustomEvent("navi_request_open", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestOpenEvent, e);
      // we prepare focus transfer before actually opening the popover/dialog
      // because opnening dialog makes browser try to transfer focus (which ends up in document.body for instance)
      const focusTransfer = prepareFocusTransfer(
        requestOpenEvent,
        debugInteraction,
      );
      controller.transferFocusOnOpen = (el) => {
        // requestOpenEvent, not the raw `e` — getFocusedBeforeTransfer needs
        // e.detail.eventChain (built by chainEvent above) to recover the
        // element a mousedown/click landed on. `e` itself is usually the raw
        // native event: its own `.detail` is a number (click count) on a
        // MouseEvent, so `e.detail.eventChain` is always undefined and the
        // mousedown/click branches below never matched — silently falling
        // back to `document.activeElement`, which is often `document.body`
        // once mousedown.preventDefault() has kept focus from landing
        // anywhere yet.

        // Two conditions, and both are about THIS opening rather than about
        // the device:
        // - the interaction: only a finger raises a virtual keyboard, and a
        //   hybrid tablet answers "coarse" to every device-level signal
        //   whichever of its two inputs was just used — the open event still
        //   remembers which one it was. An opening with no pointer in it at
        //   all (a keyboard shortcut, defaultOpen, an app calling open()) is
        //   not one either.
        // - the target: focusing a button raises nothing, so there is nothing
        //   to wait for and the focus stays immediate. Only a field the
        //   keyboard comes up for is worth delaying — which is why the
        //   decision is taken on the resolved target, inside transferFocus.
        const openedByTouch = Boolean(
          findEvent(requestOpenEvent, isTouchDrivenEvent),
        );
        const cancelPendingFocus = focusTransfer.transferFocus(e, el, {
          getDelay: (target) =>
            openedByTouch && isEditableTarget(target)
              ? FOCUS_DELAY_ON_KEYBOARD_MS
              : 0,
        });
        return (closeEvent) => {
          // Closed before the delay was up: the focus was never given, so it
          // must not be given now — to a field inside a popup on its way out,
          // raising the keyboard as it goes.
          cancelPendingFocus?.();
          markAutofocusRestoreOnClose(el, closeEvent, focusedAtClose);
          const focusoutEvent = findEvent(closeEvent, "focusout");
          if (focusoutEvent) {
            debugInteraction(
              closeEvent,
              `closed by focusout -> let focus go away`,
            );
          } else {
            // Only the mousedown, deliberately: a popup with no backdrop is
            // closed by a `pointerdown` that belongs to the page (see
            // armOutsidePressClose), and cancelling it would take away the
            // very press it exists to let through — along with the click the
            // page was going to answer. What that press lands on decides the
            // focus then, as it would with no popup open at all.
            const mousedownEvent = findEvent(closeEvent, "mousedown");
            if (mousedownEvent) {
              debugInteraction(
                closeEvent,
                "closed by mousedown -> prevent browser focus (mousedown.preventDefault())",
              );
              mousedownEvent.preventDefault();
            }
            focusTransfer.restoreFocus();
          }
        };
      };
      runChange(
        () => {
          // Before mountContent, which builds the content, and before
          // openEffect, which shows it: what the popup opens ON has to be
          // known before either (see `onOpen` above).
          controller.onOpen?.(requestOpenEvent);
          // After prepareFocusTransfer, which has to record what held the
          // focus before anything inside the popup can claim it, and before
          // openEffect, which measures the popup to place it.
          controller.mountContent?.();
          // Only now — after the content has been built, before openEffect
          // shows it. Dialog/Popover recompute aria-expanded and navi-hidden
          // from this flag on every render, and mountContent above renders
          // synchronously: flipping it any earlier commits an already-open DOM
          // (aria-expanded "true", navi-hidden gone) before openEffect has run
          // a single statement, so the "closed" frame it pins to transition
          // from is in fact the open one and the entrance animation has
          // nothing to play. It also gives the content it just built the
          // opening it is documented to observe — mounted while the popup
          // reads as closed, told it opened right after (see
          // popup_content_mount.js and use_displayed_layout_effect.js).
          controller.opened = true;
          // Which press it opened during, so the release of that press is not
          // read as somebody dismissing it (see openedDuringThisPress).
          controller.pressCountAtOpen = pressCount;
          const openEffectReturnValue =
            controller.openEffect(requestOpenEvent) || null;
          openEffectCleanup = (closeEvent) => {
            openEffectReturnValue?.(closeEvent);
          };
          closeHandlers = openHandler(requestOpenEvent) || null;
          controller.onOpenedChange?.(true, requestOpenEvent);
        },
        { opened: true, event: requestOpenEvent },
      );
    },
    requestClose: (
      e = new CustomEvent("programmatic", { detail: {} }),
      detail,
    ) => {
      flushChangeAwaitingTransition();
      if (!controller.opened) {
        return true;
      }
      const requestCloseEvent = new CustomEvent("navi_request_close", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestCloseEvent, e);
      closeHandlers?.onRequestClose?.(requestCloseEvent);
      if (requestCloseEvent.defaultPrevented) {
        // The native <dialog> "cancel" event (Escape key) closes the dialog
        // by default; prevent that default so denial actually keeps it open.
        const nativeCancelEvent = findEvent(requestCloseEvent, "cancel");
        if (nativeCancelEvent) {
          nativeCancelEvent.preventDefault();
        }
        return false;
      }
      performClose(requestCloseEvent);
      return true;
    },
    close: (e = new CustomEvent("programmatic", { detail: {} }), detail) => {
      flushChangeAwaitingTransition();
      if (!controller.opened) {
        return;
      }
      const closeEvent = new CustomEvent("navi_close", {
        detail: { event: e, ...detail },
      });
      chainEvent(closeEvent, e);
      // Skips onRequestClose entirely — there is no choice here.
      performClose(closeEvent);
    },
  };
  return controller;
};

// Inside a popup that is open right now — the popup being closed, in practice,
// since that is the one the key press was delivered to.
const isInsideOpenPopup = (element) => {
  if (!element || element.nodeType !== 1) {
    return false;
  }
  return Boolean(element.closest("dialog[open], [popover]:popover-open"));
};

// What Enter is about to do when it is about to activate something: press the
// focused control, or submit the form around it. Anything else it can do
// (typing a newline, nothing at all) leaves no activation behind to land on the
// trigger once focus is restored.
const ENTER_ACTIVATING_DEFAULT_ACTION_SET = new Set([
  "activate",
  "form_submit",
]);

// Created once per popup instance: openHandler is wrapped in a stable callback
// so the controller identity never changes across renders, even though
// Dialog/Popover read fresh closures (scrollTrap, etc.) via
// openController.openEffect on every render.
export const useOpenController = (openHandler) => {
  const debugInteraction = useDebugInteraction();
  const stableOpenHandler = useStableCallback(openHandler);
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createOpenController(stableOpenHandler, {
      debugInteraction,
    });
  }
  // Unmount safety net: if Dialog/Popover unmounts while still open (parent
  // removes it from the tree without going through requestClose()), there is
  // no choice to leave open — close it for real.
  useLayoutEffect(() => {
    return () => {
      // Nothing to photograph on the way out: the popup is leaving the
      // document, so a movement between its box and anything else would be
      // played on an element already detached by the time the browser gets to
      // it (see controller.transitionChange).
      controllerRef.current.transitionChange = null;
      controllerRef.current.close();
    };
  }, []);
  return controllerRef.current;
};

// Nested popups that both mount already-open (`open`/`defaultOpen`) would
// otherwise stack in the wrong order: Preact fires layout effects
// child-first on mount, so a nested popup's own mount-open would call
// showPopover() before its ancestor's — and the top layer stacks *later*
// showPopover() calls above *earlier* ones (see popover.jsx's own openEffect
// comment) — leaving the ancestor on top instead of the nested popup, the
// opposite of what opening them one at a time (ancestor first, by real user
// interaction) would produce. Batching every mount-time silent open queued
// during the same commit's layout-effect phase into one microtask flush,
// then simply running them in *reverse* of their registration order fixes
// this — no need to compare DOM positions: since effects already fire
// child-first, tree-wide, for *any* ancestor/descendant pair the descendant
// is always queued before the ancestor, regardless of what else is in the
// tree, so reversing the whole batch always puts every ancestor before its
// own descendants. Works for any nesting depth for the same reason. Two
// unrelated (sibling) popups both mounting open also get reordered
// relative to each other, but there's no meaningful "correct" order between
// those anyway.
let pendingMountOpens = [];
let mountOpenFlushScheduled = false;
const scheduleMountOpen = (run) => {
  pendingMountOpens.push(run);
  if (mountOpenFlushScheduled) {
    return;
  }
  mountOpenFlushScheduled = true;
  queueMicrotask(() => {
    const entries = pendingMountOpens;
    pendingMountOpens = [];
    mountOpenFlushScheduled = false;
    for (let i = entries.length - 1; i >= 0; i--) {
      entries[i]();
    }
  });
};

// Where the popup's open state is kept, when it is kept anywhere: `navState`
// resolved to the `{ id, type }` useNavState wants.
//
// `true` takes the popup's own id — a popup a `--navi-open` command can name is
// a popup that already has a stable one, and that id is what identifies its
// open state too.
const NO_NAV_STATE = { id: undefined, type: "replace" };
const resolveNavStateProp = (navState, popupId, name) => {
  if (!navState) {
    return NO_NAV_STATE;
  }
  if (navState === true) {
    if (import.meta.dev && !popupId) {
      console.warn(
        `[navi] "${name}" got navState={true} but has no "id" to store its open state under. Give it an id, or pass the key as navState="some_id".`,
      );
    }
    return { id: popupId, type: "replace" };
  }
  if (typeof navState === "string") {
    return { id: navState, type: "replace" };
  }
  return { id: navState.id || popupId, type: navState.type || "replace" };
};

// What a write of the open state is worth in the history, when the signal
// holding it is bound to a url (a route's `searchParams`, see route.js). A
// plain signal has no `set` and takes the value as it always did.
const writeInSignal = (signal, value, { history }) => {
  if (signal.set) {
    signal.set(value, { history });
    return;
  }
  signal.value = value;
};

// The popup says where it is, into a `signal` the caller holds — and when that
// signal lives in a url, saying so is a navigation. It is worth exactly what
// the same move is worth when the open state lives in the history entry
// instead (see useNavState's own leave()):
// - the opening is worth what the state declares (`history: "push"` for a
//   popup one can back out of, the default replacement for one that merely
//   qualifies the screen one is on);
// - the closing is never an entry of its own, and never leaves the pushed
//   entry standing either. Stacking one would leave the entry that carries
//   the popup BEHIND the reader (their next back press walks straight back
//   into the popup they just closed); keeping the pushed entry would leave
//   two entries describing the same closed screen (their next back press
//   appears to do nothing).
// A cancel (Escape, the backdrop, --navi-cancel) goes back to before the
// opening, so everything else written to the url while the popup was open
// goes back with it. A close that is not a cancel goes back too, but keeps
// those writes: they are spelled into the url first (only the signal knows
// how "closed" reads there), and that url is written onto the entry the back
// lands on.
const writeOpenedInSignal = (signal, opened, event) => {
  if (signal.peek() === opened) {
    // The signal already says so, meaning this open/close IS what it asked
    // for: a back press that took the popup out of the url, the application
    // writing it. Nothing to write back — and nothing to go back to either,
    // since the navigation navBack would undo is the one that asked for this.
    return;
  }
  if (opened) {
    signal.value = true;
    return;
  }
  if (
    signal.options?.getHistory?.() === "push" &&
    // Nothing of this document behind: the popup was opened by the url itself
    // (a shared link, a bookmark). navBack would do nothing at all there, so
    // the entry is rewritten in place — the address must not keep saying open
    // about a popup that just closed.
    canNavBackSignal.peek()
  ) {
    if (event?.detail?.isCancel) {
      navBack();
      return;
    }
    writeInSignal(signal, false, { history: "replace" });
    const urlToKeep = window.location.href;
    navBack().then((landed) => {
      if (!landed) {
        return;
      }
      // Often nothing at all: with no other write made while the popup was
      // open, the entry landed on already reads urlToKeep and navTo skips
      // the navigation entirely.
      navTo(urlToKeep, { replace: true });
    });
    return;
  }
  writeInSignal(signal, false, { history: "replace" });
};

/**
 * Keeps an open controller in sync with where the caller says the popup should
 * be: an `open`/`defaultOpen` pair, a `signal`, or a `navState` — the open
 * state written into the history entry, so a screen left and come back to finds
 * its popup as it was.
 *
 * Shared between `useOpenControllerByProps` below (Dialog/Popover driving their
 * own controller), `picker_custom.jsx` (which owns its controller but wants
 * the same skip-if-already-matching / open-or-requestClose control flow) and
 * `expandable.jsx` (open in flow rather than on a layer, same decision).
 *
 * @param {{ open: (e: Event, detail?: object) => void, requestClose: (e: Event, detail?: object) => void, opened: boolean }} openController
 * @param {{ id?: string, open?: boolean|"interaction", defaultOpen?: boolean|"interaction", signal?: import("@preact/signals").Signal<boolean>, navState?: boolean|string|{id?: string, type?: "push"|"replace"} }} props
 * @param {string} [name] What the dev warnings call the thing being opened.
 */
export const useOpenPropsEffectOnOpenController = (
  openController,
  props,
  name = "popup",
) => {
  const { signal, defaultOpen, navState } = props;
  const { id: navStateId, type: navStateType } = resolveNavStateProp(
    navState,
    props.id,
    name,
  );
  // Called unconditionally (it answers with no-ops for an absent id), like
  // every other hook here.
  const [navStateValue, enterNavState, leaveNavState] = useNavState(
    navStateId,
    { type: navStateType },
  );
  if (navStateId) {
    if (import.meta.dev && (signal || Object.hasOwn(props, "open"))) {
      const ignored = signal ? "signal" : "open";
      console.warn(
        `[navi] "${name}" got both "navState" and "${ignored}". "navState" is the source of truth; "${ignored}" is ignored. Pass only one.`,
      );
    }
  } else if (signal) {
    warnSignalCollision(props, name, "open");
  }
  // What the caller holds, however they hold it: the history entry when there
  // is a `navState`, an `open` they re-render themselves, or a `signal` this
  // hook also writes (see onOpenedChange below). Reading .value during render
  // is what subscribes the popup to a signal; reading the document state is
  // what subscribes it to the history entry, back button included.
  const open = navStateId
    ? Boolean(navStateValue)
    : signal
      ? signal.value
      : props.open;
  // Assigned on every render, like openEffect, so it always closes over the
  // latest prop: a popup that opens or closes on its own (Escape, backdrop, a
  // --navi-close command) writes what happened where the caller keeps it, so
  // whoever holds it always reads where the popup is.
  openController.onOpenedChange =
    navStateId || signal
      ? (opened, event) => {
          if (navStateId) {
            if (opened) {
              enterNavState();
            } else {
              // Under type "push" a cancel discards everything written while
              // the popup was open — it goes back with the entry; a confirmed
              // close keeps those writes (see useNavState's own leave()).
              leaveNavState({ isBack: Boolean(event?.detail?.isCancel) });
            }
          }
          if (signal) {
            writeOpenedInSignal(signal, opened, event);
          }
        }
      : null;
  // Tracks whether the effect below has ever run before — only the very
  // first run gets the "mount already open" treatment (`open` truthy from
  // the start, or the uncontrolled, mount-only `defaultOpen`); every
  // subsequent `open` change is a real, later toggle and should animate
  // normally like any other interactive open/close.
  const isFirstRunRef = useRef(true);

  useLayoutEffect(() => {
    const isFirstRun = isFirstRunRef.current;
    isFirstRunRef.current = false;

    if (isFirstRun) {
      const mountOpenReason = open || defaultOpen;
      if (mountOpenReason) {
        // Whether this popup being open is something that just happened, or
        // something that was already true when the page appeared. "interaction"
        // says the mount IS the opening — the popup exists because the user
        // just asked for it — so the entrance plays like any other open. Any
        // other truthy value means it was simply already open: nothing was ever
        // shown as "closed" for the user to see it transition away from, so the
        // entrance is skipped (`silent`, see popover.jsx's own openEffect).
        //
        // Deferred + batched (see scheduleMountOpen above) rather than called
        // directly, so nested popups that both mount already-open end up
        // stacked ancestor-first instead of Preact's own child-first effect
        // order.
        scheduleMountOpen(() =>
          openController.open(new CustomEvent("open_by_prop", { detail: {} }), {
            silent: mountOpenReason !== "interaction",
          }),
        );
      }
      return;
    }

    if (open === undefined) {
      return;
    }
    // Skip when the controller is already in the desired state.
    // openController.opened tracks actual open/close (updated by onopen/onclose,
    // not by renders) so it is the authoritative check against feedback loops.
    if (open === openController.opened) {
      return;
    }
    if (open) {
      openController.open(new CustomEvent("open_by_prop", { detail: {} }));
    } else {
      openController.requestClose(
        new CustomEvent("close_by_prop", { detail: {} }),
        { isCancel: true },
      );
    }
    // The request can be refused (a busy form denying the close): the popup
    // then stays where it was, and whoever holds the open state is told so —
    // otherwise it would keep saying "closed" about a popup still open.
    // Written over rather than stacked on: a refusal corrects the state that
    // asked, it is not a place one came from.
    if (signal) {
      writeInSignal(signal, openController.opened, { history: "replace" });
    }
    if (navStateId && openController.opened) {
      enterNavState();
    }
  }, [open]);
};

export const useOpenControllerByProps = (props, name) => {
  const { onClose } = props;
  // Lets an uncontrolled consumer (no openController of its own) still react
  // to a self-initiated close (Escape, backdrop click, its own close button)
  // without having to own a controller just to observe it — onClose is
  // called on every real close, matching createOpenController's own
  // { onRequestClose, onClose } contract (never denies the close itself).
  const openController = useOpenController(() =>
    onClose ? { onClose } : undefined,
  );
  useOpenPropsEffectOnOpenController(openController, props, name);
  return openController;
};
