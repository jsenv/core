import {
  chainEvent,
  dispatchCustomEvent,
  isPressDisputedByDrag,
} from "@jsenv/dom";
import { useContext, useId, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { CalloutStatusIcon } from "../rules/callout/callout_status_icon.jsx";
import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { useNavState } from "@jsenv/navi/src/nav/browser_integration/browser_integration.js";
import { useDebugFocus, useDebugPopup } from "@jsenv/navi/src/navi_debug.jsx";
import {
  useOpenController,
  useOpenPropsEffectOnOpenController,
} from "@jsenv/navi/src/layout/open_controller.js";
import {
  PopupModeContext,
  useResolvedPopupMode,
} from "@jsenv/navi/src/layout/popup_mode.jsx";
import {
  MOUNT_DEFAULT,
  usePopupContentMount,
} from "@jsenv/navi/src/layout/popup_content_mount.js";
import { Popup } from "@jsenv/navi/src/layout/popup.jsx";
import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { interactionsDisputeThePress } from "../interaction/interactions.js";
import { LONGPRESS_ATTRIBUTE } from "../interaction/interaction_press.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { ControlIdContext } from "../control_context.js";
import { isControlValueGivenByProps } from "../control_hooks.jsx";
import { commitUIStateAsAnswer, isUIStateHeld } from "../held_ui_state.js";
import { dispatchRequestAction } from "../rules/control_action.js";
import { createOpenToken } from "../rules/control_callout.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import { getUIStateFromElement } from "../ui_state_dom.js";

const css = /* css */ `
  /* Popover and Dialog size, pad and scroll themselves. What is written here
     is the little the trigger says about the popup it opens — its corners,
     its edge and its focus ring echo the field's — plus what is specific to a
     picker's popup: the cursor, the stacking, the list that scrolls inside.

     Keyed on the attribute the picker writes on its own popup, never on
     descent from the picker: the popup's content is a page of its own, and
     it holds other pickers and dialogs of other kinds (a SidePanel is a
     .navi_dialog). A rule reaching every popup below the picker would paint
     them all with what this picker says about ITS popup. For the same reason
     the caller's popup props (popupBackgroundColor, dialogMaxWidth…) are not
     vars on the picker at all — a var on the picker inherits into everything
     the popup holds, and the pickers in there would read it as their own —
     but props on the popup element, see PickerContentInsidePopup. */

  /* callout: the content is docked in the picker between two opens (see
     PickerCalloutPopup), where it is not shown. */
  .navi_picker_callout_dock > [data-picker-content] {
    display: none;
  }

  /* popover */
  .navi_popover[data-picker-popup] {
    --popover-border-radius: var(--picker-border-radius);
    --popover-border-width: var(--picker-border-width);
    --popover-border-color: var(--x-picker-border-color);
    --popover-outline-width: var(--picker-outline-width);
    --popover-outline-color: var(--picker-outline-color);
    cursor: default; /* Reset pointer cursor within the select */

    /* Popover itself has no opinion on its content's own layout (plain div,
       block by default) — the picker's content needs to stack vertically.
       Only while shown: an authored display on a closed popover would defeat
       the browser's own display: none (see [navi-hidden] in popover.jsx). */
    &:not([navi-hidden]) {
      display: flex;
      flex-direction: column;
    }

    /* The list scrolls inside the popover */
    .navi_list_container {
      width: 100%;
      /* The list's radius var, not border-radius itself: the longhands it
         feeds are what read the --x-corner-*-radius claims coming from
         outside (a header/footer covering a corner, a flush body — see
         box.jsx). Writing the shorthand here would flatten those four
         longhands back to one curve and square nothing. */
      --list-border-radius: max(
        0px,
        var(--popover-border-radius) - var(--popover-border-width)
      );
      overscroll-behavior: none;

      /* Skipped when the list asks for overflow="visible": that ask is
         about escaping every box the list sits in, and this selector is
         specific enough to win over the list's own rules and silently put
         the scroll back. */
      &:not([data-overflow-visible]) {
        overflow: auto;
      }
    }
  }

  .navi_picker[aria-haspopup="listbox"][aria-expanded="true"][navi-popover-mode="overlay"] {
    /* When sizes uses float AND the border uses border-radius it's possible it's possible to see some pixels
    of the underlying select borders. We hide them to ensure this cannot happen.  */
    border-color: transparent;
  }

  /* dialog */
  .navi_dialog[data-picker-popup] {
    --dialog-border-radius: var(--picker-border-radius);
    --dialog-border-color: var(--x-picker-border-color);
    --dialog-outline-width: var(--picker-outline-width);
    --dialog-outline-color: var(--picker-outline-color);

    /* Nothing bridges the trigger's width in here: a dialog does not follow
       its anchor's box by itself (dialog.jsx, sizeFromAnchor) — it is not
       visually attached to the trigger, so it is sized by its content;
       dialogMinWidth/dialogMinHeight are how a caller says otherwise, and
       dialogSizeFromAnchor how they ask for the trigger's own box. Only the
       cursor reset below is picker-specific here. */
    cursor: default; /* Reset pointer cursor within the select */

    /* Dialog already applies display: flex to [open] itself, but
       defaults to row — the picker's content needs to stack vertically. */
    &[open] {
      flex-direction: column;
    }

    /* The list scrolls inside the dialog — same as the popover branch
       above, including why this is the var and not the shorthand. */
    .navi_list_container {
      width: 100%;
      --list-border-radius: max(
        0px,
        var(--dialog-border-radius) - var(--dialog-border-width)
      );
      overscroll-behavior: none;

      &:not([data-overflow-visible]) {
        overflow: auto;
      }
    }
  }
`;

export const PickerCustomResolver = (props) => {
  import.meta.css = css;

  if (props.children === undefined) {
    return renderResolver(PickerNative, props);
  }
  if (props.mode === "callout") {
    // A tooltip is an icon one presses, unless told otherwise. Own-property
    // rather than undefined: an explicit variant={undefined} asks for the
    // field-like drawing back. "circle" is the icon variant with the status
    // icon drawn round — a word about the trigger, not a drawing of its own.
    if (!Object.hasOwn(props, "variant")) {
      props.variant = "icon";
    }
    const circle = props.variant === "circle";
    if (circle) {
      props.variant = "icon";
    }
    // A door, never a field (see `standalone`): the form around it expects no
    // value from it. So the trigger answers to "button" — it is pressed to read
    // something, never typed into — the same thing a confirm picker says
    // through `picksNothing` (see picker.jsx). Said as the role here rather
    // than through that prop: `picksNothing` also takes the right slot away,
    // and the status icon a callout trigger draws sits in it.
    props.standalone = true;
    if (props.role === undefined) {
      props.role = "button";
    }
    // A word in a sentence asks for a plain tooltip — no icon in the callout,
    // no status color; an icon one presses is the callout's own status icon,
    // and says "info" like the callout it opens.
    if (props.calloutStatus === undefined) {
      props.calloutStatus = props.variant === "text" ? "none" : "info";
    }
    if (props.calloutIcon === undefined) {
      props.calloutIcon = props.variant !== "text";
    }
    // A door's content is never where its value comes from (see `standalone`
    // above), so nothing needs it before the first open: built then, like a
    // popup's. A name in a list wrapped in a tooltip is otherwise a card in
    // the DOM per name, and each one asks the layout whether it is on screen.
    if (props.mount === undefined) {
      props.mount = MOUNT_DEFAULT;
    }
    if (props.rightSlotIcon === undefined) {
      props.rightSlotIcon = (
        <CalloutStatusIcon
          status={props.calloutStatus}
          shape={circle ? "circle" : "square"}
        />
      );
    }
    // The arrow on the middle of what was pressed — an icon, a word — rather
    // than on where its text starts, which is where a callout points at a
    // field by default (see the anchor attributes in callout.js).
    if (props["data-callout-arrow-x"] === undefined) {
      props["data-callout-arrow-x"] = "center";
    }
  }
  if (props.type === undefined) {
    // A picker with a popup of its own holds whatever the control inside it
    // holds — a boolean, a number, an id — and a field with no type is read
    // back off the DOM, where every value is a string. "false" then matches no
    // row, the popup empties, and that emptiness climbs back into the picker:
    // a value survives its own round trip only while it is text. "navi_js" is
    // how a field says its value is a JS one, kept beside the DOM (see
    // controller_registry.js) — the same thing type="array"/"object" already
    // say for their shapes.
    return renderResolver(PickerCustom, { ...props, type: "navi_js" });
  }
  return renderResolver(PickerCustom, props);
};

const PickerNative = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      {...props}
      // When the picker has its own action we want to run it when native "change" event occur (native picker dialog closes)
      // not on every change of color while user is selecting a color for instance
      // (it would cause too many calls and would likely not be what the user expects)
      // (uiAction can be used to react live)
      actionEvent={props.action ? "change" : undefined}
      resetOnCancel
      resetOnAbort
      resetOnError
      onnavi_request_open={(e) => {
        const pickerEl = props.ref.current;
        const pickerInput = getPickerInput(pickerEl);
        if (!pickerInput) {
          e.preventDefault();
          return;
        }
        dispatchRequestInteraction(pickerInput, {
          event: e,
          name: "navi_request_open to show native picker",
          // No "read" intent here, unlike a picker holding a popup of its own
          // (see PickerCustom): the browser's picker cannot be held read-only,
          // whichever way its type falls. Where `readonly` applies (date, time,
          // month, number…) the input is not mutable and showPicker() refuses
          // it — there is nothing to open. Where it does not (color, file) the
          // browser opens all the same and writes whatever is chosen straight
          // into the input, which is read-only in name only. So a read-only
          // native picker says why instead, on the trigger.
          prevented: () => {
            e.preventDefault();
          },
          allowed: () => {
            try {
              pickerInput.showPicker();
            } catch {
              pickerInput.click();
            }
          },
        });
      }}
      eventReactionDefinitions={{
        click: (e) => {
          return {
            name: "click to show native picker",
            prevented: () => {
              e.preventDefault();
            },
            allowed: () => {
              const pickerEl = props.ref.current;
              const pickerInput = getPickerInput(pickerEl);
              if (pickerInput.type === "color") {
                // nothing to do, color picker whole surface is opening the picker
              } else {
                // other picker might not open the picker when clicking the input surface (only the calendar picker for instance would open)
                try {
                  pickerInput.showPicker();
                } catch {
                  pickerInput.click();
                }
              }
            },
          };
        },
      }}
    />
  );
};

const PickerCustom = (props) => {
  const {
    ref,
    mode: modeProp,
    open,
    defaultOpen,
    // What Escape means for this picker. "cancel" (the default) puts back the
    // value the picker had at open and, for a dialog, goes back in history —
    // so everything written to the url while it was open goes back too.
    // "close" makes Escape say the same thing as clicking outside: keep what
    // was chosen, close the popup.
    escapeEffect = "cancel",
    // What a `--navi-confirm` said inside the popup means, once the popup has
    // closed on it. A confirm picker is the one saying something (see
    // picker_confirm.jsx): its press, deferred until the question is answered.
    onConfirm,
    // The popup's lifecycle, the same pair Dialog and Popover take. Taken on
    // the picker and chained into its own openController below: the picker
    // hands the popup that controller, and a controlled Dialog/Popover reads
    // no onOpen/onClose of its own.
    onOpen,
    onClose,
    // What opens the popup — the press, or an interaction navi detects
    // ("longpress", "contextmenu"…, or a list of them). See the JSDoc.
    openOn = "press",
  } = props;
  // Resolve the id the same way useControlProps does (own id > Field's id > generated id)
  // before computing popupId below, so two Pickers without an explicit id never collide.
  // Captured before the fallback chain below overwrites props.id — needed to
  // know whether the id actually came from the caller (stable) or from
  // useId()/ControlIdContext (not guaranteed stable across a reload), see
  // pickerNavType below.
  const hasExplicitId = Boolean(props.id);
  const idDefault = useId();
  const controlId = useContext(ControlIdContext);
  props.id = props.id || controlId || idDefault;
  // Same narrow-container/maxWidth-compact heuristic Popup itself uses (see
  // popup_mode.jsx's own useResolvedPopupMode) — frozen for the lifetime of an opening
  // (computed when closed, stable while open, so a screen resize mid-session
  // doesn't switch between Popover and Dialog), with resetMode called from
  // this picker's own onClose below to re-evaluate on the *next* open.
  // The picker element locates the measurement: a popupLayer="local" popup is
  // confined to the picker's own positioned ancestor, so that box — not the
  // screen — is what "small" means for it.
  const [mode, resetMode] = useResolvedPopupMode(modeProp, props.maxWidth, {
    layer: props.popupLayer,
    elementRef: ref,
  });

  const pickerProps = {
    ...props,
  };
  // Consumed right here (useNavState's own defaultValue above) — not a
  // real DOM/Popup prop, so it must not travel any further down (would
  // otherwise leak through PickerContentInsidePopup's own ...rest).
  delete pickerProps.open;
  delete pickerProps.defaultOpen;
  delete pickerProps.escapeEffect;
  delete pickerProps.onConfirm;
  delete pickerProps.onOpen;
  delete pickerProps.onClose;
  delete pickerProps.openOn;
  // Read below for the popup alone; on the trigger it would land on the DOM as
  // an unknown attribute holding a ref object.
  delete pickerProps.anchor;
  const popupProps = {};
  Object.assign(pickerProps, {
    popupProps,
    actionEvent: "custom",
  });
  if (pickerProps.resetOnError === undefined) {
    // The picker's action fails after its popup closed on the value: nobody is
    // left mid-edit, so the value the server refused rolls back to the last
    // accepted one and the error callout says why — the same default
    // PickerNative takes.
    pickerProps.resetOnError = true;
  }
  // ref
  const popupRef = useRef(null);
  popupProps.ref = popupRef;
  // The `navi_request_confirm` a `--navi-confirm` dispatches right before its
  // `navi_request_close`: remembered here, answered once the popup has really
  // closed (see onClose below) — a press that ran before the close would make
  // the picker busy, and a busy picker refuses the very close that follows.
  const confirmEventRef = useRef(null);
  // aria-controls + id
  const popupId = `${props.id}_picker_popup`;
  id: {
    Object.assign(pickerProps, {
      "aria-controls": popupId,
    });
    Object.assign(popupProps, {
      id: popupId,
    });
  }
  // aria-expanded + open close + interactions to open close
  open_close: {
    const debugFocus = useDebugFocus();
    const debugPopup = useDebugPopup();
    // In "dialog" mode with a stable, caller-provided id, enterExpanded()
    // pushes a history entry so the back button closes it. Every other case
    // (popover mode, or a dialog whose id was auto-generated via useId()/
    // ControlIdContext) replaces the current history state instead — a
    // generated id isn't stable across a reload, so pushing it would either
    // silently drop the entry or, worse, collide with a different
    // component's own generated id (see useNavState's own fallback for the
    // same concern, applied here proactively for the id we control).
    const pickerNavType =
      mode === "dialog" && hasExplicitId ? "push" : "replace";
    const [expanded, enterExpanded, leaveExpanded] = useNavState(popupId, {
      type: pickerNavType,
      defaultValue: open || defaultOpen ? "on" : undefined,
      // onLeave fires only when the state key disappears externally (back button/gesture most of the time).
      onLeave: () => {
        requestClose(new CustomEvent("navi_nav_away", { detail: {} }), {
          isCancel: true,
        });
      },
    });
    // openController centralizes open/close decision-making (validation,
    // focus and value bookkeeping) for the picker. The returned
    // { onRequestClose, onClose } pair is the picker's reaction to close
    // requests — see createOpenController below for the full contract.
    const openController = useOpenController((openEvent) => {
      enterExpanded();

      const valueAtOpen = getPickerInputUIState(ref.current);
      // Whether that value is an ANSWER or only a suggestion. A picker showing
      // a defaultValue holds nothing, so closing on it untouched IS the answer
      // ("yes, 2h15") — the same rule Form applies to an untouched field (see
      // isUIStateHeld). Read at open, before anything inside can change it.
      const heldAtOpen = isUIStateHeld(
        getPickerInput(ref.current)?.__uiStateController__,
      );
      debugPopup(
        openEvent,
        `picker opened, store value at open`,
        valueAtOpen,
        heldAtOpen ? `(held)` : `(a suggestion, not an answer yet)`,
      );
      onOpen?.(openEvent);

      return {
        onRequestClose: (requestCloseEvent) => {
          if (requestCloseEvent.detail.isCancel) {
            // Cancelling always succeeds — nothing to validate.
            return;
          }
          const pickerEl = ref.current;
          const inputEl = getPickerInput(pickerEl);
          const valueAtClose = getUIStateFromElement(inputEl);
          if (
            compareTwoJsValues(valueAtClose, valueAtOpen) &&
            (heldAtOpen || valueAtOpen === undefined)
          ) {
            // Nothing to say on the way out, for one of two reasons. Either the
            // value was already held and has not moved — closing on it repeats
            // what was already the answer. Or there was never anything to
            // confirm: a picker holding nothing AND showing nothing (a menu of
            // gestures — no value, no defaultValue, no signal) has no
            // suggestion to accept, and confirming `undefined` cannot mean
            // anything. A picker on a defaultValue is untouched by this: it
            // shows something, so closing on it still confirms it.
            // No action to run, but still allow the close.
            return;
          }

          dispatchRequestAction(inputEl, {
            event: requestCloseEvent,
            name: "picker request close",
            prevented: () => {
              requestCloseEvent.preventDefault();
            },
            // Always report validation when the picker tries to close so the
            // user sees what is wrong, even if the picker has no action prop.
            reportOnInvalid: true,
            onInvalid: () => {
              requestCloseEvent.preventDefault();
            },
          });
          if (requestCloseEvent.defaultPrevented) {
            // Refused: the popup stays, and the yes that asked for this close
            // goes with the close it belonged to.
            confirmEventRef.current = null;
          }
        },
        onClose: (closeEvent) => {
          if (closeEvent.detail.isCancel) {
            const pickerEl = ref.current;
            const inputEl = getPickerInput(pickerEl);
            debugPopup(
              closeEvent,
              `picker cancel, restoring value at open ${JSON.stringify(valueAtOpen)}`,
            );
            // Put back from the inside ("cancel_rollback" is an internal event
            // type, see ui_state_controller.js): the answer was no, so nobody
            // acted — the picker is returned to the state its owner still
            // holds. Asked for the way a user would, the restore would read as
            // a gesture and fire the picker's `command`, sending a `<Picker
            // type="confirm" action command>` on the "then go there" half of a
            // gesture whose first half never ran.
            const rollbackEvent = new CustomEvent("cancel_rollback", {
              detail: {},
            });
            chainEvent(rollbackEvent, closeEvent);
            inputEl.__uiStateController__.setUIState(
              valueAtOpen,
              rollbackEvent,
            );
          } else if (!heldAtOpen) {
            // Confirmed a suggestion: nothing changed, so nothing has told the
            // control's own bound signal / uiAction that this is now the
            // answer. Say it here — this is the moment the suggestion becomes
            // one. Harmless when the value did change on the way: the state is
            // already what it is, and this only re-runs the same reaction.
            const inputEl = getPickerInput(ref.current);
            const valueAtClose = getUIStateFromElement(inputEl);
            const controller = inputEl?.__uiStateController__;
            if (controller?.controlHostProps.readOnly) {
              // Opened only to be read: what it shows stays the suggestion it
              // was. A look is not an answer, and the signal behind it is not
              // written by one.
              debugPopup(
                closeEvent,
                `picker is read-only -> nothing to commit`,
              );
            } else if (
              valueAtOpen === undefined &&
              compareTwoJsValues(valueAtClose, valueAtOpen)
            ) {
              // Same third case onRequestClose steps around: nothing held,
              // nothing shown, nothing picked. There is no suggestion here to
              // turn into an answer.
              debugPopup(
                closeEvent,
                `picker showed nothing -> nothing to commit`,
              );
            } else {
              debugPopup(
                closeEvent,
                `picker defined a suggestion -> commit it`,
              );
              commitUIStateAsAnswer(controller, closeEvent);
            }
          }
          const confirmEvent = confirmEventRef.current;
          confirmEventRef.current = null;
          if (confirmEvent && !closeEvent.detail.isCancel) {
            onConfirm?.(confirmEvent);
          }
          // After the value bookkeeping above — whoever listens reads the
          // picker's value as it ends up, committed or restored on a cancel —
          // and before leaveExpanded below, which is where the caller's
          // reaction runs for a Dialog too. A close that keeps goes back onto
          // the entry the popup was opened from while KEEPING the url as it
          // stands at that moment (see useNavState's leave()), so what onClose
          // spells into the address — a route param naming what was being
          // edited, cleared now that nothing is — has to be written before,
          // or the landing puts it back.
          onClose?.(closeEvent);
          leaveExpanded({ isBack: closeEvent.detail.isCancel });
          // Reset so the next opening re-evaluates screen size
          resetMode();
        },
      };
    });
    // scroll <button> of the picker into view when opening it
    // -> would be overriden by dialog.jsx or popover.jsx
    // so ideally openEffect should be either protective or a pubSub to allow multiple callbacks
    // openController.openEffect = () => {
    //   const pickerEl = ref.current;
    //   pickerEl.scrollIntoView({ block: "nearest" });
    // };
    const requestOpen = openController.open;
    const requestClose = openController.requestClose;
    // Same skip-if-already-matching / open-or-requestClose control flow as
    // useOpenControllerByProps (see open_controller.js) — the picker's own
    // "open" comes from history state (expanded) rather than a literal
    // `open` prop, so it adapts requestOpen/requestClose to the shape that
    // hook expects instead of driving openController directly.
    useOpenPropsEffectOnOpenController(openController, {
      open: Boolean(expanded),
    });

    const requestInteraction = (options) => {
      dispatchRequestInteraction(ref.current, options);
    };

    const { onActionStart, children, uiAction: uiActionProp } = props;
    Object.assign(pickerProps, {
      "aria-expanded": Boolean(expanded),
      "onActionStart": (e) => {
        onActionStart?.(e);
        // requestClose(e);
      },
      "uiAction": (v, e) => {
        uiActionProp?.(v, e);
      },
      // The picker's own trigger also carries aria-expanded, so
      // resolveClosestExpandable() in commands.js can resolve *it* (not the
      // popup) as the target — e.g. a --navi-open/--navi-close/--navi-toggle
      // command whose source sits inside the trigger but outside the popup's
      // own content. Forward the request down to the popup so its
      // openController (registered above via onnavi_request_open/close on
      // popupProps) is the single place actually deciding open/close.
      "onnavi_request_open": (e) => {
        dispatchCustomEvent(popupRef.current, "navi_request_open", e.detail);
      },
      "onnavi_request_close": (e) => {
        const closing = dispatchCustomEvent(
          popupRef.current,
          "navi_request_close",
          e.detail,
        );
        if (!closing) {
          e.preventDefault();
        }
      },
      children,
    });
    Object.assign(popupProps, {
      // The trigger, unless the caller names something else: a picker whose
      // trigger is a piece of a bigger control (the chevron half of a split
      // button) hangs its popup off the whole control instead.
      anchor: props.anchor || props.ref,
      openController,
      // A picker whose value was never given to it reads it off the control in
      // its popup (see useUIFacadeStateController): the trigger shows what the
      // list inside says is selected, so that list has to exist before anyone
      // opens anything. Told a value — even an empty one — the picker owns it
      // and pushes it down instead, leaving the popup free to build its
      // content only when it is first opened (see popup_content_mount.js).
      // A caller who knows better says so with the popup's own props.
      mount:
        props.mount ??
        (isControlValueGivenByProps(props) ? MOUNT_DEFAULT : "always"),
      // Not on pickerProps (the trigger): commands.js's own
      // resolveClosestExpandable() does `el.closest("[aria-expanded]")` to
      // find where to dispatch navi_request_open/navi_request_close — and
      // the popup itself now carries its own aria-expanded (see
      // popover.jsx/dialog.jsx), which is *closer* than the picker's own
      // aria-expanded for anything dispatched from inside the popup's own
      // content (e.g. a `command="--navi-close"` button rendered as
      // children here). That command lands on the popup element, not the
      // picker — so these listeners have to live here to ever see it.
      onnavi_request_open: (e) => {
        if (openController.opened) {
          return;
        }
        requestInteraction({
          event: e,
          name: "navi_request_open_event",
          // Showing what the picker already holds, in the shape only the popup
          // draws it in — nothing of the value is written on the way in, nor on
          // the way out. Every interaction below says the same, which is what
          // lets a read-only picker be opened and read while everything that
          // would write it (paste, cut, the clear cross) stays refused. See
          // READONLY_CONSTRAINT.
          intent: "read",
          allowed: () => {
            // What the open said travels with it: a picker opened from
            // somewhere else than its own trigger — an object on a map saying
            // `triggerNaviCommand(pickerEl, "--navi-open", event, { anchor,
            // value })` — is opened ON that anchor and told what it is about,
            // exactly as a Popover/Dialog opened by the same command would be.
            requestOpen(e, {
              anchor: e.detail?.anchor,
              source: e.detail?.source,
              value: e.detail?.value,
            });
          },
        });
      },
      onnavi_request_close: (e) => {
        requestInteraction({
          event: e,
          intent: "read",
          allowed: () => {
            const closing = requestClose(e, { isCancel: e.detail.isCancel });
            if (!closing) {
              e.preventDefault();
            }
          },
          prevented: () => {
            confirmEventRef.current = null;
            // Not closing either way; said back to whoever asked.
            e.preventDefault();
          },
        });
      },
      // Said by the popup's own yes button, to the popup (the expandable
      // nearest to it) — see the `--navi-confirm` command.
      onnavi_request_confirm: (e) => {
        confirmEventRef.current = e;
      },
    });

    interactions: {
      // Inside a popup this picker holds — its own, or that of a picker sitting
      // on its façade (a confirm picker in the right slot): a press in there is
      // never a press on this trigger. The nearest content upward, contained
      // in this picker, rather than this picker's first content element: with
      // a picker in the slot, the first one in DOM order is the nested one.
      const isWithinPickerContent = (el) => {
        const pickerEl = ref.current;
        return pickerEl.contains(el.closest("[data-picker-content]"));
      };

      const onKeyDownShortcuts = createOnKeyDownForShortcuts({
        "a-z": (e) => {
          return {
            name: "letter key to open",
            intent: "read",
            allowed: () => {
              requestOpen(e);
            },
          };
        },
        "0-9": (e) => {
          return {
            name: "numeric key to open",
            intent: "read",
            allowed: () => {
              requestOpen(e);
            },
          };
        },
        "arrowdown": (e) => {
          return {
            name: "arrow_down_to_open",
            intent: "read",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent container scroll
            },
          };
        },
        "arrowup": (e) => {
          return {
            name: "arrow_up_to_open",
            intent: "read",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent container scroll
            },
          };
        },
        "space": (e) => {
          return {
            name: "space_to_open",
            intent: "read",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent scroll
            },
          };
        },
        "enter": (e) => {
          if (isWithinPickerContent(e.target)) {
            // Enter within popup should not try to re-open it
            // (enter within input would close popup and this one would try to re-open it)
            return null;
          }
          return {
            name: "enter_to_open",
            intent: "read",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent form submission
            },
          };
        },
        "escape": (e) => {
          if (!openController.opened) {
            return null;
          }
          const isCancel = escapeEffect === "cancel";
          return {
            name: isCancel ? "escape_to_cancel" : "escape_to_close",
            intent: "read",
            allowed: () => {
              requestClose(e, { isCancel });
              e.preventDefault(); // prevent browser from closing the dialog (if any)
            },
          };
        },
      });

      // Opening on the press mimics the native select, and it is only right
      // while nothing else disputes that press. A gesture declared on the same
      // picker (interactions={{ land, grab }}) makes the finger going down the
      // beginning of something that is not yet a choice — opening there would
      // both answer for the user and take the press from the gesture, which
      // could then never form. So the picker steps back and opens on the click,
      // which the browser only delivers if the press stayed a press (a gesture
      // swallows the click it leaves behind).
      // Opening on something else than the press: the hold, the right click.
      // Declared on the picker itself, as the caller would declare their own,
      // so it is read and arbitrated like any other gesture — a swipe on the
      // same card takes the press a hold would have taken — and gated like one:
      // a read-only picker refuses it where the finger is. The press is then
      // nobody's: a tap on the card opens nothing (see the two reactions
      // below), and the keyboard keeps its own ways in (the shortcuts above).
      const openOnList = Array.isArray(openOn) ? openOn : [openOn];
      const opensOnPress = openOnList.includes("press");
      let interactions = props.interactions;
      if (!opensOnPress) {
        interactions = { ...interactions };
        for (const type of openOnList) {
          interactions[type] = (e) => {
            requestOpen(e);
          };
        }
        pickerProps.interactions = interactions;
        pickerProps["data-open-on"] = openOnList.join(" ");
      }
      const interactionsDispute = interactionsDisputeThePress(interactions);

      Object.assign(pickerProps, {
        eventReactionDefinitions: {
          mouseDown: (e) => {
            if (isWithinPickerContent(e.target)) {
              return null;
            }
            if (openController.opened) {
              // Closing stays on the press even then: a gesture starting on an
              // open picker wants the popup out of the way, and there is no
              // choice being taken from anyone.
              return {
                name: "mousedown to close picker",
                intent: "read",
                allowed: () => requestClose(e, { isCancel: true }),
              };
            }
            // The same dispute, said by a box AROUND the picker rather than
            // by the picker itself: a page that travels between tabs under the
            // finger, a panel that swipes closed, a card carried out of a
            // list. Asked of the DOM here rather than of the props at render,
            // because that is where such a box says what it travels by — and
            // asked at every press, since what the picker sits in is not the
            // picker's to know at mount.
            if (
              !opensOnPress ||
              interactionsDispute ||
              isPressDisputedByDrag(e.target) ||
              isPressDisputedByHold(ref.current)
            ) {
              return null;
            }
            return {
              name: "mousedown to open picker",
              intent: "read",
              allowed: () => {
                debugFocus(
                  e,
                  `prevent browser giving focus to button (mousedown.preventDefault())`,
                );
                requestOpen(e);
                e.preventDefault(); // prevent browser trying to give focus to the select (popover will take focus)
              },
            };
          },
          click: (e) => {
            if (isWithinPickerContent(e.target)) {
              return null;
            }
            if (!opensOnPress) {
              // Neither the tap, nor the click a hold leaves behind: the press
              // is not what opens this picker.
              return null;
            }
            // When a label is clicked it transfers focus to the select
            // in that case we want to open it (otherwise we have already opened on mousedown interaction)
            // And when a gesture disputes the press (see the two disputes
            // above), this is where the picker opens for real.
            return {
              name:
                e.detail === 0
                  ? "click (keyboard or progammatic) to open picker"
                  : "click to open picker",
              intent: "read",
              prevented: () => {
                e.preventDefault();
              },
              allowed: () => {
                requestOpen(e);
                e.preventDefault();
              },
            };
          },
          keyDown: (e) => {
            return onKeyDownShortcuts(e);
          },
        },
      });
    }
  }

  return renderResolver(PickerContentInsidePopup, {
    ...pickerProps,
    mode,
  });
};

// A hold declared on something AROUND the picker (a card opened by
// `openOn="longpress"`, holding this one in its drawing): the finger going
// down may be the start of that hold, so this picker opens on the click — which
// the hold, if it completes, swallows — rather than on the press. The picker's
// own hold (its `openOn`) is not "around" it, and has already stepped back.
const isPressDisputedByHold = (pickerEl) =>
  Boolean(pickerEl?.parentElement?.closest(`[${LONGPRESS_ATTRIBUTE}]`));

export const getPickerInput = (pickerEl) => {
  return pickerEl.querySelector(".navi_picker_input");
};
const getPickerInputUIState = (pickerEl) => {
  const pickerInput = getPickerInput(pickerEl);
  return getUIStateFromElement(pickerInput);
};

const PickerContentInsidePopup = (props) => {
  const Next = useNextResolver();
  const {
    popupProps,
    children,
    mode,
    pointerLock,
    scrollCapture,
    // No default here (matches Popover's own default of inactive) — the
    // old, differently-named `focusTrap = true` prop never actually reached
    // Popover's real `focusCapture` prop (see this file's history), so
    // focus-trapping has never really been active for popover-mode pickers;
    // defaulting the now-correctly-named prop to `true` would be a real,
    // unintended behavior change riding along with the rename.
    focusCapture,
    // Popup documents its own `layer` as forwarded as-is to Dialog/Popover,
    // but popupProps is built explicitly here, so it only travels if named.
    // "popupLayer" rather than "layer": the picker itself is not the popup.
    popupLayer,
    // Same reason: a `data-testid` on the picker names the trigger (see
    // docs/testid.md) — this one names the popup.
    popupTestId,
    positionArea,
    popoverMode = "nearby",
    popoverSpacing = popoverMode === "nearby" ? 5 : 0,
    marginWithContainer,
    closeOnFocusOut = false,
    // Clicking outside the popup closes it and COMMITS by default (fires the
    // action if the value changed) — Escape still cancels. Pass "cancel" to make
    // clicking outside revert instead, or "capture" to keep it open.
    pointerInteractionOutsideEffect = "close",
    // Named/forwarded rather than left in ...rest: rest goes to the picker
    // element itself, not the popup, and these belong to the popup.
    backdrop,
    backdropVariant,
    backdropColor,
    backdropFilter,
    dialogExpand,
    dialogExpandX,
    dialogExpandY,
    // Named like the Dialog prop it forwards, not prefixed like dialogExpand*
    // above: those exist because "expand" already means something on the picker
    // itself, and this one does not. Popover ignores it, same as Dialog ignores
    // marginWithAnchor.
    dockedOnSmallTouchScreen,
    // Same again: the dialog takes the trigger's box as a floor (and, with
    // dialogMaxWidth="var(--anchor-width)", as a ceiling) — what keeps a card
    // its own width once lifted. Dialog's own `sizeFromAnchor`.
    dialogSizeFromAnchor,
    // The caller's word on the popup's own box. Written on the popup element,
    // where Popover/Dialog map them to their own vars, rather than as vars on
    // the picker: a var on the picker inherits into everything the popup
    // holds, and the pickers in there would read it as their own.
    popupBackgroundColor,
    popupBorderRadius,
    popupBoxShadow,
    popoverMaxHeight,
    dialogBorderWidth,
    dialogMinWidth,
    dialogMinHeight,
    dialogMaxWidth,
    dialogMaxHeight,
    // The popover is at least as wide as the trigger. True when the CONTENT
    // should size it (a Wheel) instead of being stretched to the trigger.
    popupWidthFitContent,
    animation,
    grow,
    animationDuration,
    // mode="callout": what the callout says about what it holds, and paints
    // in its border and icon — "none" for a plain tooltip (see the callout
    // defaults in PickerCustomResolver). And whether it wears a cross: without
    // one it still closes on Escape, a click outside, or a --navi-close of the
    // content's own.
    calloutStatus,
    calloutIcon,
    calloutCloseButton,
    ...rest
  } = props;
  const isPopover = mode === "popover";
  const isCallout = mode === "callout";

  return (
    <Next
      aria-haspopup={isPopover ? "listbox" : "dialog"}
      navi-popover-mode={isPopover ? popoverMode : undefined}
      {...rest}
      // On popupProps already (see the picker's popup assembly); they mean
      // nothing to the picker element.
      mount={undefined}
      onFocusOut={(e) => {
        if (!isPopover || !closeOnFocusOut) {
          return;
        }
        // Close when focus leaves the select entirely (not just moving between internal elements).
        // relatedTarget is the element receiving focus; if it's inside the select or the popup, keep open.
        const relatedTarget = e.relatedTarget;
        const pickerEl = props.ref.current;
        const popupEl = popupProps.ref.current;
        const focusStaysInside =
          (pickerEl && pickerEl.contains(relatedTarget)) ||
          (popupEl && popupEl.contains(relatedTarget));
        if (focusStaysInside) {
          return;
        }
        dispatchRequestInteraction(pickerEl, {
          event: e,
          name: "blur",
          category: "interaction",
          allowed: () => {
            popupProps.openController.requestClose(e, { isCancel: true });
          },
        });
      }}
    >
      {isCallout ? (
        <PickerCalloutPopup
          {...popupProps}
          pickerRef={props.ref}
          testId={popupTestId}
          status={calloutStatus}
          icon={calloutIcon}
          closeButton={calloutCloseButton}
        >
          <PopupModeContext.Provider value={mode}>
            {children}
          </PopupModeContext.Provider>
        </PickerCalloutPopup>
      ) : (
        <Popup
          {...popupProps}
          data-testid={popupTestId}
          // What the CSS above keys on: this picker's own popup, and no other
          // popup below the picker.
          data-picker-popup=""
          backgroundColor={popupBackgroundColor}
          borderRadius={popupBorderRadius}
          boxShadow={popupBoxShadow}
          borderWidth={isPopover ? undefined : dialogBorderWidth}
          minWidth={
            isPopover
              ? popupWidthFitContent
                ? undefined
                : "var(--anchor-width, 0px)"
              : dialogMinWidth
          }
          minHeight={isPopover ? undefined : dialogMinHeight}
          // As wide as the trigger under dialogSizeFromAnchor: Dialog's own
          // sizeFromAnchor is a floor, this is the ceiling. A dialogMaxWidth of
          // the caller's still wins.
          maxWidth={
            isPopover
              ? undefined
              : dialogMaxWidth === undefined && dialogSizeFromAnchor
                ? "var(--anchor-width)"
                : dialogMaxWidth
          }
          maxHeight={isPopover ? popoverMaxHeight : dialogMaxHeight}
          mode={mode}
          layer={popupLayer}
          animation={animation}
          animationDuration={animationDuration}
          positionArea={
            isPopover
              ? (positionArea ??
                (popoverMode === "nearby" ? "bottom-start" : "inset(top-left)"))
              : positionArea
          }
          marginWithAnchor={isPopover ? popoverSpacing : undefined}
          marginWithContainer={
            marginWithContainer === undefined && isPopover
              ? popoverSpacing
              : marginWithContainer
          }
          scrollCapture={scrollCapture}
          pointerInteractionOutsideEffect={
            pointerLock ? "capture" : pointerInteractionOutsideEffect
          }
          backdrop={backdrop}
          backdropVariant={backdropVariant}
          backdropColor={backdropColor}
          backdropFilter={backdropFilter}
          focusCapture={isPopover ? focusCapture : undefined}
          expand={isPopover ? undefined : dialogExpand}
          expandX={isPopover ? undefined : dialogExpandX}
          expandY={isPopover ? undefined : dialogExpandY}
          dockedOnSmallTouchScreen={
            isPopover ? undefined : dockedOnSmallTouchScreen
          }
          sizeFromAnchor={isPopover ? undefined : dialogSizeFromAnchor}
          grow={isPopover ? undefined : grow}
        >
          {/* Let the popup content branch on the mode via usePopupMode(). */}
          <PopupModeContext.Provider value={mode}>
            {children}
          </PopupModeContext.Provider>
        </Popup>
      )}
    </Next>
  );
};

// One token per picker rather than per instance: a callout manager belongs to
// one control, so the key only has to be distinct from the other reasons that
// control may have to show a callout (a failing constraint, a busy refusal, its
// `error` prop). Those keep working on top of this one: opened while the
// content is up they take the callout over, and give it back when they go.
const PICKER_CALLOUT_CONTENT_TOKEN = createOpenToken();

/**
 * The popup of a `mode="callout"` picker: the picker's own callout — the one
 * its constraints speak in — showing the picker's children instead of a
 * message. A speech bubble on the trigger, for a tooltip that opens on a press.
 *
 * Wired the way Popover and Dialog are, through `openController.openEffect`:
 * opening adds a token to the picker's callout manager, whose cleanup removes
 * it. The callout has ways out of its own (its cross, a click outside, Escape,
 * focus leaving the picker) and says so through the token's `onClose`, which
 * closes the controller for real — the popup is already gone, there is no
 * choice left to offer `requestClose`.
 *
 * The content is rendered into an element this component owns, handed to the
 * callout as its message (a Node, appended as-is) and taken back when the
 * callout closes. Between two opens it is docked, hidden, in the span below:
 * in the document the whole time once built, so what it holds survives a
 * close, and what it measures of itself at mount (a computed color, a
 * light-dark() pair) resolves against a real ancestry. An element with no
 * document has no computed style, and a badge reading its own background
 * there would see nothing at all. When it is built is the popup's own `mount`
 * rule (see popup_content_mount.js) — the first open, for a callout. The
 * element carries data-picker-content: the callout is appended inside the
 * picker root, and a press in there must read as inside the popup, not on the
 * trigger.
 */
const PickerCalloutPopup = ({
  ref,
  id,
  anchor,
  openController,
  pickerRef,
  testId,
  status,
  icon,
  closeButton,
  onnavi_request_open,
  onnavi_request_close,
  onnavi_request_confirm,
  mount,
  children: childrenProp,
}) => {
  const hostRef = useRef(null);
  // The dock is what the content finds as its openable ancestor (the
  // aria-expanded below), which is what the mount marks as being built for
  // its own opening.
  const contentMounted = usePopupContentMount(openController, ref, {
    mount,
    anchor,
  });
  const children = contentMounted ? childrenProp : null;
  // Reassigned on every render, like Popover's own, so it closes over the
  // latest props.
  openController.getElement = () => pickerRef.current;
  openController.openEffect = (openEvent) => {
    const pickerEl = pickerRef.current;
    const host = hostRef.current;
    // Where the content sits while the callout is closed (the span below);
    // the callout takes the element out of it and the cleanup puts it back.
    const dock = host.parentNode;
    const calloutManager =
      getPickerInput(pickerEl).__uiStateController__.rules.callout;
    // Only an anchor the caller named: left unsaid, the manager anchors on the
    // picker's own input — which is where the data-callout-* attributes a
    // caller puts on the picker land, and where the callout reads them.
    const anchorElement =
      anchor === pickerRef
        ? undefined
        : anchor && "current" in anchor
          ? anchor.current
          : anchor;
    calloutManager.addOpenToken(PICKER_CALLOUT_CONTENT_TOKEN, {
      message: host,
      // The popup a `popupTestId` names is this callout: it is the surface the
      // picker opens, drawn by navi, so it is the one thing the caller cannot
      // name from its own children.
      testId,
      // "none" is the picker's word for it; the callout's is no status at all.
      status: status === "none" ? undefined : status,
      icon,
      closeButton,
      anchorElement,
      // The request, chained to the press that made it: the callout reads the
      // mousedown off it to wait for the release before listening for a click
      // outside — the same gesture's own click would close it otherwise.
      event: openEvent,
      // Not skipped: the callout moves the focus into the picker when it is
      // elsewhere, which is what lets Escape find the callout right away.
      skipFocus: false,
      onClose: ({ event }) => {
        openController.close(event);
      },
    });
    // A --navi-confirm said inside the callout is aimed at the callout (its
    // aria-expanded), not at the element the picker listens on: carried over,
    // for a confirm picker whose question is a speech bubble.
    const calloutElement = calloutManager.callout.element;
    const forwardConfirm = (e) => {
      onnavi_request_confirm?.(e);
    };
    calloutElement.addEventListener("navi_request_confirm", forwardConfirm);
    // Said once the content is in the shown callout: what the content defers
    // until it is displayed (useDisplayedLayoutEffect, watching this attribute)
    // then measures it where it is drawn. Same call stack as the open, like
    // Popover's own — see observeAncestorOpenState in @jsenv/dom.
    dock.setAttribute("aria-expanded", "true");
    return (closeEvent) => {
      calloutElement.removeEventListener(
        "navi_request_confirm",
        forwardConfirm,
      );
      calloutManager.removeOpenToken(PICKER_CALLOUT_CONTENT_TOKEN, closeEvent);
      dock.appendChild(host);
      dock.setAttribute("aria-expanded", "false");
    };
  };

  return (
    // What the picker addresses (aria-controls, the request events it
    // forwards); the callout itself lives where the callout manager puts it.
    // aria-expanded here, on the dock rather than on the content element: the
    // openable ancestor the content finds at mount (the only time it looks),
    // and one that is no ancestor of the content once the callout holds it —
    // so a --navi-close said in there still resolves to the callout element,
    // the closest [aria-expanded] from the button. The open effect keeps it
    // current; preact leaves it alone, the prop never changes.
    <Box
      as="span"
      ref={ref}
      id={id}
      className="navi_picker_callout_dock"
      aria-expanded="false"
      style={{ display: "contents" }}
      onnavi_request_open={onnavi_request_open}
      onnavi_request_close={onnavi_request_close}
      onnavi_request_confirm={onnavi_request_confirm}
    >
      {/* A child of the span in the tree, and moved out of it by hand while
          the callout shows it: preact places a matched child again only when
          its siblings reorder, and this one has none. */}
      <div ref={hostRef} data-picker-content="">
        {children}
      </div>
    </Box>
  );
};
