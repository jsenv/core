import { dispatchCustomEvent } from "@jsenv/dom";
import { useContext, useId, useRef } from "preact/hooks";

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
import { Popup } from "@jsenv/navi/src/layout/popup.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { interactionsDisputeThePress } from "../interaction/interactions.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { ControlIdContext } from "../control_context.js";
import { isControlValueGivenByProps } from "../control_hooks.jsx";
import { commitUIStateAsAnswer, isUIStateHeld } from "../held_ui_state.js";
import { dispatchRequestAction } from "../rules/control_action.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";

const css = /* css */ `
  .navi_picker {
    /* Sizing ceilings (maxmax), background, box-shadow, outline, padding,
       overflow... are already handled correctly by Popup/Popover/Dialog
       themselves — nothing to redefine here. Only the picker's own look
       (border color/radius/width, background) needs bridging into the vars
       Popover/Dialog actually consume, plus a couple of genuinely
       picker-specific bits below (anchor-width min-width, the nested list). */

    /* popover */
    &[aria-haspopup="listbox"] {
      .navi_popover {
        --popover-border-radius: var(
          --picker-popup-border-radius,
          var(--picker-border-radius)
        );
        --popover-border-width: var(--picker-border-width);
        --popover-border-color: var(--x-picker-border-color);
        /* The sheet is the popup's own, never the trigger's paint: a variant
           that takes the box away from the trigger (icon, discrete, headless
           all paint it transparent) must not take the sheet with it. The trim
           above still echoes the field — a transparent edge still leaves a
           readable surface; the surface does not.

           With an explicit fallback, unlike --popover-max-height below: the
           popover paints background-color from this var with no fallback of
           its own, so a declaration invalid at computed-value time would not
           step aside for the @layer default — it makes the var guaranteed-
           invalid, and the sheet goes transparent. */
        --popover-background-color: var(
          --picker-popup-background-color,
          var(--navi-popup-background-color)
        );
        --popover-outline-width: var(--picker-outline-width);
        --popover-outline-color: var(--picker-outline-color);
        /* No fallback on purpose: when the picker's own popoverMaxHeight prop
           is unset this declaration is invalid at computed-value time, which
           leaves --popover-max-height unset and lets the popover fall back to
           --popover-max-height-default. */
        --popover-max-height: var(--picker-popover-max-height);

        /* At least as wide as the trigger — unless popupWidthFitContent, then
           let the content (e.g. a Wheel) size the popover (see picker.jsx). */
        min-width: var(--picker-popover-min-width, var(--anchor-width, 0px));
        cursor: default; /* Reset pointer cursor within the select */

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
            var(--picker-border-radius) - var(--picker-border-width)
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

      &[aria-expanded="true"] {
        &[navi-popover-mode="overlay"] {
          /* When sizes uses float AND the border uses border-radius it's possible it's possible to see some pixels
          of the underlying select borders. We hide them to ensure this cannot happen.  */
          border-color: transparent;
        }

        /* Popover itself has no opinion on its content's own layout (plain
           div, block by default) — the picker's content needs to stack
           vertically. */
        .navi_popover {
          display: flex;
          flex-direction: column;
        }
      }
    }

    /* dialog */
    &[aria-haspopup="dialog"] {
      .navi_dialog {
        --dialog-border-radius: var(
          --picker-popup-border-radius,
          var(--picker-border-radius)
        );
        --dialog-border-width: var(--picker-dialog-border-width);
        --dialog-border-color: var(--x-picker-border-color);
        /* The picker's own surface is not this one — see the popover branch,
           including why the fallback is spelled out. */
        --dialog-background-color: var(
          --picker-popup-background-color,
          var(--navi-popup-background-color)
        );
        --dialog-outline-width: var(--picker-outline-width);
        --dialog-outline-color: var(--picker-outline-color);

        /* No fallback on purpose (same as --popover-max-height above): unset
           picker props leave these declarations invalid at computed-value
           time, so the dialog keeps its own floors/ceilings. */
        --dialog-min-width: var(--picker-dialog-min-width);
        --dialog-min-height: var(--picker-dialog-min-height);
        --dialog-max-width: var(--picker-dialog-max-width);
        --dialog-max-height: var(--picker-dialog-max-height);

        /* Nothing bridges the trigger's width in here: a dialog does not
           follow its anchor's box (dialog.jsx, sizeFromAnchor) — it is not
           visually attached to the trigger, so it is sized by its content,
           and dialogMinWidth/dialogMinHeight are how a caller says otherwise.
           Only the cursor reset below is picker-specific here. */
        cursor: default; /* Reset pointer cursor within the select */

        /* Dialog already applies display: flex to [open] itself, but
           defaults to row — the picker's content needs to stack vertically. */
        &[open] {
          flex-direction: column;
        }
      }

      .navi_list_container {
        width: 100%;
        /* See the popover block above: the var, not the shorthand, so the
           corner claims survive. */
        --list-border-radius: max(
          0px,
          var(--picker-border-radius) - var(--picker-border-width)
        );
        overscroll-behavior: none;

        /* See the popover block above: overflow="visible" on the list must not
           be overridden back into a scroll by this rule. */
        &:not([data-overflow-visible]) {
          overflow: auto;
        }
      }
    }

    /* popupWidthFitContent (picker.jsx): drop the trigger-width floor so the
       popup shrinks to its content. Popover-only — the dialog has no such
       floor to drop (see the dialog block above). */
    &[data-popup-width-fit-content] {
      --picker-popover-min-width: 0px;
    }
  }
`;

export const PickerCustomResolver = (props) => {
  import.meta.css = css;

  if (props.children === undefined) {
    return <PickerNative {...props} />;
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
    return <PickerCustom {...props} type="navi_js" />;
  }
  return <PickerCustom {...props} />;
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
  // Read below for the popup alone; on the trigger it would land on the DOM as
  // an unknown attribute holding a ref object.
  delete pickerProps.anchor;
  const popupProps = {};
  Object.assign(pickerProps, {
    popupProps,
    actionEvent: "custom",
  });
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
            dispatchRequestSetUIState(inputEl, valueAtOpen, {
              event: closeEvent,
            });
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
          leaveExpanded({ isBack: closeEvent.detail.isCancel });
          // Reset so the next opening re-evaluates screen size
          resetMode();
          const confirmEvent = confirmEventRef.current;
          confirmEventRef.current = null;
          if (confirmEvent && !closeEvent.detail.isCancel) {
            onConfirm?.(confirmEvent);
          }
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
        dispatchCustomEvent(popupRef.current, "navi_request_close", e.detail);
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
      mountWhenClosed: !isControlValueGivenByProps(props),
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
            requestOpen(e);
          },
        });
      },
      onnavi_request_close: (e) => {
        requestInteraction({
          event: e,
          intent: "read",
          allowed: () => {
            requestClose(e, { isCancel: e.detail.isCancel });
          },
          prevented: () => {
            confirmEventRef.current = null;
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
      const pressIsDisputed = interactionsDisputeThePress(props.interactions);

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
            if (pressIsDisputed) {
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
            // When a label is clicked it transfers focus to the select
            // in that case we want to open it (otherwise we have already opened on mousedown interaction)
            // And when a gesture disputes the press (see pressIsDisputed
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

  return <PickerContentInsidePopup {...pickerProps} mode={mode} />;
};

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
    // element itself, not the popup, and this belongs to the popup.
    backdropVariant,
    dialogExpand,
    dialogExpandX,
    dialogExpandY,
    // Named like the Dialog prop it forwards, not prefixed like dialogExpand*
    // above: those exist because "expand" already means something on the picker
    // itself, and this one does not. Popover ignores it, same as Dialog ignores
    // marginWithAnchor.
    dockedOnSmallTouchScreen,
    animation,
    ...rest
  } = props;
  const isPopover = mode === "popover";

  return (
    <Next
      aria-haspopup={isPopover ? "listbox" : "dialog"}
      navi-popover-mode={isPopover ? popoverMode : undefined}
      {...rest}
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
      <Popup
        {...popupProps}
        mode={mode}
        layer={popupLayer}
        animation={animation}
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
        backdropVariant={backdropVariant}
        focusCapture={isPopover ? focusCapture : undefined}
        expand={isPopover ? undefined : dialogExpand}
        expandX={isPopover ? undefined : dialogExpandX}
        expandY={isPopover ? undefined : dialogExpandY}
        dockedOnSmallTouchScreen={
          isPopover ? undefined : dockedOnSmallTouchScreen
        }
      >
        {/* Let the popup content branch on the mode via usePopupMode(). */}
        <PopupModeContext.Provider value={mode}>
          {children}
        </PopupModeContext.Provider>
      </Popup>
    </Next>
  );
};
