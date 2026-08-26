/**
 * Core hooks for wiring navi field components to the action/validation system.
 *
 * Why this exists instead of using native events directly:
 *
 * 1. Preact maps `onChange` to the native `change` event, not `input`. For text inputs
 *    this means the handler fires only on blur, not on every keystroke. All navi fields
 *    use `onInput` internally and route through `dispatchRequestAction` so the behavior
 *    is consistent regardless of input type.
 *
 * 2. Any field (text, checkbox, radio, picker…) can opt into debounce simply by passing
 *    a debounced action. The request-action event chain handles the timing centrally
 *    rather than each component having to manage its own debounce logic.
 */
import {
  findFocusDelegateTarget,
  getElementSignature,
  getKeyboardEventDefaultAction,
} from "@jsenv/dom";
import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { isMatchingFocusVisible } from "@jsenv/navi/src/box/pseudo_styles.js";
import { useComposeElementRef } from "@jsenv/navi/src/box/ref_composition/use_element_ref.js";
import {
  dispatchRequestAction,
  tryActionAfterInteractionAllowed,
  watchActionCompletion,
} from "@jsenv/navi/src/control/rules/control_action.js";
import {
  dispatchRequestInteraction,
  onRequestInteraction,
} from "@jsenv/navi/src/control/rules/control_interaction.js";
import {
  useDebugAction,
  useDebugCommand,
  useDebugFocus,
  useDebugInteraction,
  useDebugUIState,
} from "@jsenv/navi/src/navi_debug.jsx";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { onNaviCommand, triggerNaviCommand } from "./commands.js";
import {
  ActionContext,
  ActionRequesterContext,
  CONTROL_ATTRIBUTE_SET,
  CONTROL_PROP_SET,
  ControlIdContext,
  ControlNameContext,
  DisabledContext,
  LoadingContext,
  MessagePropsRefContext,
  ReadOnlyContext,
  RequiredContext,
} from "./control_context.js";
import { findControlHost } from "./control_dom.js";
import { interactionsDisputeThePress } from "./interaction/interactions.js";
import {
  publishControlStateToLabels,
  unpublishControlStateToLabels,
} from "./control_label_state.js";
import { findControlProxyTarget } from "./control_proxy.js";
import { readControlValue, warnSignalCollision } from "./control_value.js";
import {
  onUIStateControllerCreated,
  toDomValue,
} from "./controller_registry.js";
import { FormContext } from "./form_context.js";
import { addInputEffect } from "./input_effect.js";
import {
  ParentUIStateControllerContext,
  useUIFacadeStateController,
  useUIGroupStateController,
  useUIStateController,
} from "./ui_state_controller.js";
import {
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "./ui_state_dom.js";

// Sentinel used as the initial value of lastActionValueRef.
// Distinct from undefined so that undefined (e.g. unchecked radio) can itself
// be stored as a valid "last action value" and trigger the dedup logic.
const NO_ACTION_YET = Symbol("no_action_yet");

// Resets field-specific contexts so nested fields inside this component
// don't inherit the current field's id, message props, or interface reporting.
// Sets ParentUIStateControllerContext to the leaf's own uiStateController so
// that a nested control sees its direct parent (the leaf) and can bubble up
// through it if the leaf rejects it.
export const ControlChildrenWrapper = ({ children, uiStateController }) => (
  <ParentUIStateControllerContext.Provider value={uiStateController}>
    <MessagePropsRefContext.Provider value={undefined}>
      <ControlIdContext.Provider value={undefined}>
        <RequiredContext.Provider value={undefined}>
          <ControlNameContext.Provider value={undefined}>
            {children}
          </ControlNameContext.Provider>
        </RequiredContext.Provider>
      </ControlIdContext.Provider>
    </MessagePropsRefContext.Provider>
  </ParentUIStateControllerContext.Provider>
);
export const ControlgroupChildrenWrapper = ({
  children,
  uiGroupStateController,
  name,
  required,
  disabled,
  readOnly,
  loading,
  boundAction,
  actionRequester,
}) => (
  <MessagePropsRefContext.Provider value={undefined}>
    <ControlIdContext.Provider value={undefined}>
      <ParentUIStateControllerContext.Provider value={uiGroupStateController}>
        <ControlNameContext.Provider value={name}>
          <DisabledContext.Provider value={disabled}>
            <ReadOnlyContext.Provider value={readOnly}>
              <RequiredContext.Provider value={required}>
                <LoadingContext.Provider value={loading}>
                  <ActionContext.Provider value={boundAction}>
                    <ActionRequesterContext.Provider value={actionRequester}>
                      {children}
                    </ActionRequesterContext.Provider>
                  </ActionContext.Provider>
                </LoadingContext.Provider>
              </RequiredContext.Provider>
            </ReadOnlyContext.Provider>
          </DisabledContext.Provider>
        </ControlNameContext.Provider>
      </ParentUIStateControllerContext.Provider>
    </ControlIdContext.Provider>
  </MessagePropsRefContext.Provider>
);

/**
 * Core hook for interactive field components (InputText, InputCheckbox, etc.).
 *
 * Sets up the full field lifecycle:
 * - Creates a UI state controller that manages state divergence between props and user interactions
 * - Binds the field's action to its current UI state via a signal
 * - Wires up all DOM event handlers (navi_set_ui_state, navi_reset_ui_state,
 *   navi_action_allowed, navi_action_abort, navi_action_error, navi_action_end, navi_cancel, etc.)
 * - Resolves inherited context (disabled, readOnly, required, loading) including action loading state
 * - Handles constraint validation and message props
 *
 * All state changes route through DOM events on the field element so that
 * external subscribers (e.g. useUIState, Selectable) receive every update.
 *
 * @returns {[controlRootProps, controlHostProps, { uiStateController }]}
 */
export const useControlProps = (
  props,
  {
    controlType,
    allowNameless: allowNamelessByDefault,
    persists,
    uiActionInternal,
  },
) => {
  const debugUIState = useDebugUIState();
  const debugAction = useDebugAction();

  // A control that is not a field: it opens something, it goes somewhere, and
  // the group around it must expect no value from it — no name, and no warning
  // about the missing name. Buttons and links say so from inside navi; the prop
  // is how a control used as a door says the same thing from the outside.
  const allowNameless = props.allowNameless ?? allowNamelessByDefault;
  delete props.allowNameless;

  const idDefault = useId();
  const controlId = useContext(ControlIdContext);
  props.id = props.id || controlId || idDefault;
  const controlName = useContext(ControlNameContext);
  props.name = props.name || controlName;

  const isCheckable = isCheckableInput(controlType, props.type);
  const toDomProps = (newUIState) => {
    if (isCheckable) {
      const domValue = toDomValue(props.value, {
        controlType,
        id: props.id,
        type: props.type,
      });
      return {
        value: domValue,
        checked: newUIState !== undefined,
      };
    }

    const domValue = toDomValue(newUIState, {
      controlType,
      id: props.id,
      type: props.type,
      inputMode: props.inputMode,
      // How the value is WRITTEN where it is held one way and shown another —
      // a number on two digits ("07" for 7). See asControlHostValue.
      pad: props["navi-value-pad"],
    });
    return {
      value: domValue,
    };
  };
  const syncDomState = (newUIState, e) => {
    const el = props.ref.current;
    if (!el) {
      return;
    }
    // The field one is typing in is where the value comes FROM, and what is in
    // it already says this: writing it back in the form it is shown in ("07"
    // for a 7 just typed) would move the caret and stop the person mid-number.
    // What is shown is derived again when the field is left (see below).
    if (document.activeElement === el && readControlValue(el) === newUIState) {
      return;
    }
    const domProps = toDomProps(newUIState);
    Object.assign(el, domProps);
    debugUIState(
      e,
      `syncDomState: updated to ${getElementSignature(el)}`,
      domProps,
    );
  };

  const controlInfo = createControlInfo(props, { controlType });
  const readOnlyUncontrolled = useReadOnlyUncontrolled(props, controlInfo);
  controlInfo.readOnlyUncontrolled = readOnlyUncontrolled;
  const uiStateController = useUIStateController(props, {
    controlInfo,
    syncDomState,
    allowNameless,
    persists,
    uiActionInternal,
  });
  const [boundAction] = useActionBoundToOneParam(
    props.action,
    uiStateController.uiStateSignal,
  );
  const [controlRootProps, controlHostProps] = useInteractiveProps(props, {
    uiStateController,
    boundAction,
    controlInfo,
  });

  reactions: {
    const debugInteraction = useDebugInteraction();
    const {
      ref,
      actionEvent,
      actionOnMouseDown = actionEvent === "mousedown",
      actionAfterChange = actionEvent === "change",
      actionDebounce,
    } = props;
    // Asking for the action on the press is only right while the press means
    // one thing. A gesture declared on the same control (interactions={{ grab,
    // land }}, a swipe, a hold) is still deciding what that press IS, so the
    // control waits for the click instead — see interactionsDisputeThePress.
    const actsOnMouseDown =
      actionOnMouseDown && !interactionsDisputeThePress(props.interactions);

    const transferFocusToTarget = (pointerEvent) => {
      const naviProxyTarget =
        findFocusDelegateTarget(pointerEvent.currentTarget) ||
        findControlProxyTarget(pointerEvent.currentTarget);
      if (!naviProxyTarget) {
        return false;
      }
      // We also transfer on click even if mousedown is there because:
      // - it's possible to receive a click without a mousedown (<label>)
      // - so it's possible to end up focused by the browser without having a chance to preventDefault on the mousedown
      // -> We do it also on click
      // No need to preventDefault here though
      // -> This ensure browser don't complain we try to focus a aria-hidden element
      // and ensure the focus ends up where it should
      if (pointerEvent.type === "mousedown") {
        pointerEvent.preventDefault();
      }
      naviProxyTarget.focus({ focusVisible: false });
      return true;
    };
    const syncUIStateWithDOM = (e) => {
      const controlEl = e.currentTarget || uiStateController.ref.current;
      const value = readControlValue(controlEl);
      uiStateController.setUIState(value, e);
    };
    // trigger a no-op state update to ensure that any listeners (e.g. commands) are notified of the interaction
    // not every interaction is a uiAction
    // (arrow keys inside an input, tab etc -> not a ui action for instance)
    const triggerUIAction = (e) => {
      syncUIStateWithDOM(e);
    };

    const getDefaultEventReactionDefinitions = () => {
      const keyDownDefault = (e) => {
        const defaultAction = getKeyboardEventDefaultAction(e);
        if (defaultAction === "type" || defaultAction === "value_change") {
          return {
            name: `keydown to ${defaultAction}`,
            prevented: () => e.preventDefault(),
          };
        }
        if (defaultAction === "activate") {
          // activating the control (e.g. space on a button/range)
          return {
            name: `keydown to activate`,
            prevented: () => e.preventDefault(),
            allowed: () => {
              triggerUIAction(e);
              if (controlType === "button" && e.key === " ") {
                // prevent browser dispatching click
                // it could lead to duplicates as we explicitely handled the space to click here
                e.preventDefault();
              }
            },
          };
        }
        if (defaultAction === "scroll") {
          // on a readonly input arrow keys would scroll the page
          // which could be fine to let as is but I found disturbing that an interaction
          // the is usually caught by the control becomes a page scroll when readonly
          // I prefer input to keep eating this interaction while readonly
          return {
            name: `keydown to ${defaultAction}`,
            prevented: () => e.preventDefault(),
            // scrolling does not concern the value of the control so no need to trigger a uiAction
          };
        }
        // cursor_move (arrow keys on text), scroll (space to scroll), focus_nav (tab),
        // form_submit, dismiss, copy (ctrl+c), etc.
        // These don't interact with the field's value or activation → no validation needed.
        return null;
      };

      // Space activates a control — unless the key already means something
      // where it was pressed. Typing a space into a text field is not an
      // interaction anything else may claim: the field is what the user is
      // aiming at, and a control ABOVE it (a picker holding a search box, a
      // link wrapping one) stealing that key would swallow the character.
      const isSpaceToActivate = (e) => {
        if (e.key !== " ") {
          return false;
        }
        const defaultAction = getKeyboardEventDefaultAction(e);
        return defaultAction !== "type" && defaultAction !== "value_change";
      };

      if (controlType === "link") {
        return {
          keyDown: (e) => {
            if (isSpaceToActivate(e)) {
              return {
                name: "space to click",
                allowed: () => {
                  ref.current.click();
                },
                always: () => {
                  e.preventDefault(); // prevent page scroll
                },
              };
            }
            return keyDownDefault(e);
          },
          click: (e) => {
            return {
              name: "click",
              prevented: () => {
                e.preventDefault();
              },
            };
          },
        };
      }

      if (controlType === "button") {
        const onButtonInteractionAllowed = (e) => {
          // A command that follows the control's OWN action has to wait for it:
          // `<Button action={remove} command="--navi-clear">` means "remove it,
          // then clear the field" — clearing first would empty the field over a
          // request that can still fail, and a confirm popup refusing the action
          // would leave the clear standing. Same rule the form counterpart
          // already has (data-after-send, see resolveAfterSend in commands.js).
          //
          // Armed here, around the ui action, because the command fires from
          // there (see the command trigger in ui_state_controller). A button is
          // where this arises: its press IS the ui action, the action and the
          // command, in one breath. A field's ui action and its action are two
          // different moments (typing, then change/blur), and its command
          // belongs to the first — there is nothing to wait for.
          let deferredCommand = null;
          if (props.action && props.command) {
            uiStateController.commandDeferral = (runCommand) => {
              deferredCommand = runCommand;
            };
          }
          try {
            triggerUIAction(e);
          } finally {
            uiStateController.commandDeferral = null;
          }
          const control = ref.current;
          if (!control) {
            // What the button just did took the button away: a command that
            // navigates, a popup closing over it. There is no control left to
            // ask for an action, and nothing is lost by not asking — what the
            // press was for has already happened.
            return;
          }
          const completion = watchActionCompletion(control, () =>
            tryActionAfterInteractionAllowed(control, {
              event: e,
              action: boundAction,
              requester: control,
            }),
          );
          if (!deferredCommand) {
            return;
          }
          if (completion.result === false) {
            // The action was turned down (a failing constraint, a gate saying
            // no) — nothing happened, so nothing follows.
            return;
          }
          if (completion.isRunning) {
            completion.whenSucceeded(deferredCommand);
            return;
          }
          // Synchronous: already settled, and how it ended still decides. An
          // action that never started (nothing to run) leaves no outcome, and
          // the command runs as it always did.
          let succeeded = true;
          completion.whenSettled(({ error, aborted }) => {
            succeeded = !error && !aborted;
          });
          if (succeeded) {
            deferredCommand();
          }
        };

        return {
          keyDown: keyDownDefault,
          mouseDown: (e) => {
            if (actsOnMouseDown) {
              return {
                name: "mousedown",
                allowed: () => onButtonInteractionAllowed(e),
              };
            }
            return null;
          },
          click: (e) => {
            if (actsOnMouseDown) {
              return null;
            }
            return {
              name: "click",
              allowed: () => onButtonInteractionAllowed(e),
            };
          },
        };
      }

      if (controlType === "picker") {
        return {
          keyDown: (e) => {
            if (isSpaceToActivate(e)) {
              return {
                name: "space to click",
                allowed: () => {
                  ref.current.click();
                },
                always: () => {
                  e.preventDefault(); // prevent page scroll
                },
              };
            }
            return keyDownDefault(e);
          },
          input: (e) => {
            return {
              name: "input",
              allowed: () => syncUIStateWithDOM(e),
            };
          },
          naviChange: (e) => {
            return {
              name: "navi_change",
              allowed: () => {
                // The state, but only when nobody has read it yet. navi_change
                // is dispatched by input_effect, which listens to the very
                // "input" event the reaction above already answered — syncing
                // again there is the same gesture read twice, and uiAction fired
                // twice with it. Everything else it reports (a "change" with no
                // input before it: autocomplete, a value set from code, a form
                // restored; a paste; a reset) never reached that reaction, so
                // this is where those get in.
                if (e.type !== "input") {
                  syncUIStateWithDOM(e);
                }
                requestActionOnAllowed(e);
              },
            };
          },
        };
      }

      const enterToSend = (e) => {
        const control = e.currentTarget;
        return {
          name: "enter to send closest control group",
          bypassInteractivity: true, // allow to dispatch --navi-send even if readonly
          allowed: () => triggerNaviCommand(control, "--navi-send", e),
          // prevent dispatching click as result of this enter
          prevented: () => e.preventDefault(),
        };
      };

      if (controlType === "select") {
        return {
          keyDown: (e) => {
            if (e.key === "Enter") {
              return enterToSend(e);
            }
            if (getKeyboardEventDefaultAction(e) === "activate") {
              // Space opens the list. Nothing has been chosen at that point, so
              // there is no ui action to trigger — only whether the list is
              // allowed to open at all.
              return {
                name: "keydown to open the option list",
                prevented: () => e.preventDefault(),
              };
            }
            return null;
          },
          mouseDown: (e) => {
            // Same as the keydown above: opening the list is the interaction to
            // ask about, and refusing it is what keeps a read-only select shut.
            return {
              name: "mousedown to open the option list",
              prevented: () => e.preventDefault(),
            };
          },
          input: (e) => {
            return {
              name: "input",
              allowed: () => syncUIStateWithDOM(e),
              // The keyboard moves the selection on a closed select, and the
              // platform's own list can hand back a choice, both before anything
              // was asked. A refused change puts the element back on the state it
              // never left.
              prevented: () => syncDomState(uiStateController.uiState, e),
            };
          },
          naviChange: (e) => {
            return {
              name: "navi_change",
              allowed: () => requestActionOnAllowed(e),
            };
          },
        };
      }

      const keyDownDefaultOnInput = (e) => {
        if (e.key === "Enter") {
          if (actionDebounce) {
            // The input has its own debounced action; Enter fires it directly
            // (input_effect.js cancels the debounce and triggers the action via the change event).
            // Don't propagate to --navi-send, which would cause a double action call.
            return null;
          }
          return enterToSend(e);
        }
        return keyDownDefault(e);
      };

      if (isCheckable) {
        const isRadio = props.type === "radio";

        // I've decided that enter on radio/checkbox would not submit form like browser does but
        // - trigger ui action on checked radio
        // - radio
        //      - check unchecked radio
        //      - trigger ui action on checked radio
        // - chekcbox: toggle checkbox (like space key does)
        // It's useful on selectable list, especially inside picker where it would be strange to
        // close picker on enter
        return {
          keyDown: (e) => {
            if (e.key === "Enter") {
              const inputEl = ref.current;
              const checked = inputEl.checked;
              const always = () => {
                if (inputEl.form) {
                  e.preventDefault();
                }
              };

              if (isRadio) {
                if (checked) {
                  return {
                    name: "enter on checked radio",
                    allowed: () => triggerUIAction(e),
                    always,
                  };
                }
                return {
                  name: "enter to check radio",
                  allowed: () =>
                    dispatchRequestSetUIState(
                      inputEl,
                      uiStateController.value,
                      {
                        event: e,
                      },
                    ),
                  always,
                };
              }
              return {
                name: checked
                  ? "enter to uncheck checkbox"
                  : "enter to check checkbox",
                allowed: () =>
                  dispatchRequestSetUIState(
                    inputEl,
                    checked ? undefined : uiStateController.value,
                    { event: e },
                  ),
                always,
              };
            }
            if (isRadio && e.key === " ") {
              const inputEl = e.currentTarget;
              if (inputEl.checked) {
                // allow space to still trigger uiState and commands
                // on checked radios (won't update the ui state but will notify of interaction)
                return {
                  name: "space to activate checked radio",
                  allowed: () => triggerUIAction(e),
                };
              }
              // let browser perform "space to check radio"
            }
            return keyDownDefault(e);
          },
          click: (e) => {
            // When a radio is already checked and gets clicked, the browser does NOT
            // fire an input event (state doesn't change), so syncUIStateWithDOM never
            // runs. We still want uiAction + command to fire. We can tell whether the
            // click is on an already-checked radio by comparing our own tracked
            // uiState (value when checked, undefined when not — see toDomProps) to
            // this radio's value: it's still the PRE-click value here, since it's
            // only updated later by the "input" handler. Reading the DOM `.checked`
            // instead would not work: the browser applies the checked toggle before
            // dispatching "click", so `.checked` is already the POST-click value
            // whether or not this was already the checked radio — and worse, a click
            // that lands on the <label> (not the <input>) never fires "mousedown" on
            // the input at all, so a DOM-snapshot-at-mousedown approach misses it.
            if (isRadio && uiStateController.uiState !== undefined) {
              return {
                name: `click on checked radio`,
                allowed: () => triggerUIAction(e),
                prevented: () => e.preventDefault(),
              };
            }
            return {
              name: `click on ${props.type}`,
              // click is requesting to check/uncheck from browser perspective
              // Do NOT call triggerUIAction here: the browser will fire its own "input" event
              // after the click which will sync the state and trigger uiAction.
              // Calling triggerUIAction here would dispatch a synthetic input + the browser
              // dispatches a real input → two uiAction calls for a single click.
              prevented: () => e.preventDefault(),
            };
          },
          input: (e) => {
            return {
              name: "input",
              allowed: () => {
                syncUIStateWithDOM(e);
                requestActionOnAllowed(e);
              },
            };
          },
        };
      }

      const isInputRange = controlType === "input" && props.type === "range";
      if (isInputRange) {
        return {
          keyDown: keyDownDefaultOnInput,
          mouseDown: (e) => {
            return {
              name: "mousedown",
              allowed: () => syncUIStateWithDOM(e),
            };
          },
          // Range fires "input" on pointer release, not during drag.
          // The dismissal behavior for ranges is handled differently and is excluded here.
          input: (e) => {
            return {
              name: "input",
              allowed: () => syncUIStateWithDOM(e),
            };
          },
          naviChange: (e) => {
            return {
              name: "navi_change",
              allowed: () => {
                requestActionOnAllowed(e);
              },
            };
          },
        };
      }

      const isInputTextual = controlType === "input";
      if (isInputTextual) {
        return {
          keyDown: (e) => {
            const blocked = uiStateController.rules.guard.checkKeydown(
              e,
              ref.current,
            );
            if (blocked) {
              e.preventDefault();
              return null;
            }
            return keyDownDefaultOnInput(e);
          },
          input: (e) => {
            return {
              name: "input",
              allowed: () => syncUIStateWithDOM(e),
            };
          },
          naviChange: (e) => {
            return {
              name: "navi_change",
              allowed: () => requestActionOnAllowed(e),
            };
          },
        };
      }

      return null;
    };
    const defaultEventReactionDefinitions =
      getDefaultEventReactionDefinitions();
    const { eventReactionDefinitions } = props;
    const lastActionValueRef = useRef(NO_ACTION_YET);
    const requestActionOnAllowed = (e) => {
      if (actionEvent === "custom") {
        return false;
      }
      const control = ref.current;
      const currentValue = readControlValue(control);
      // For checkables: skip value dedup. The browser only fires `input` when state
      // actually changes, so there is no spurious double-dispatch to guard against.
      // Dedup would wrongly block re-try after a failed action: resetOnError unchecks
      // the box but lastActionValueRef still holds the checked value, preventing the
      // next user click from firing the action.
      // Same for radio siblings: when a sibling check unchecks this radio
      // (radio_sibling_uncheck, internal event, no synthetic input), lastActionValueRef
      // keeps the stale value and blocks the user from re-checking this radio.
      if (!isCheckable) {
        const lastActionValue = lastActionValueRef.current;
        const valueSameAsLastAction =
          lastActionValue !== NO_ACTION_YET &&
          compareTwoJsValues(currentValue, lastActionValue);
        if (valueSameAsLastAction) {
          debugAction(e, `skipping action: value same as last action`);
          return false;
        }
      }
      const dispatched = tryActionAfterInteractionAllowed(control, {
        event: e,
        action: boundAction,
        requester: control,
      });
      if (dispatched) {
        lastActionValueRef.current = currentValue;
      }
      return dispatched;
    };

    const applyEventReaction = (eventName, e) => {
      const defaultEventReactionDefinition =
        defaultEventReactionDefinitions?.[eventName];
      const customEventReactionDefinition =
        eventReactionDefinitions?.[eventName];
      const reaction =
        customEventReactionDefinition?.(e) ??
        defaultEventReactionDefinition?.(e);
      if (!reaction) {
        return false;
      }
      const {
        name,
        intent,
        bypassInteractivity = false,
        allowed,
        prevented,
        always,
      } = reaction;
      const control = ref.current;
      return dispatchRequestInteraction(control, {
        event: e,
        name,
        intent,
        bypassInteractivity,
        prevented: () => {
          debugInteraction(e, `interaction not allowed`);
          if (e.type === "keydown") {
            e.preventDefault();
          }
          prevented?.();
        },
        allowed: () => {
          allowed?.();
        },
        always,
      });
    };
    const onMouseDown = (e) => {
      props.onMouseDown?.(e);
      applyEventReaction("mouseDown", e);
      transferFocusToTarget(e);
    };
    const onClick = (e) => {
      props.onClick?.(e);
      applyEventReaction("click", e);
      transferFocusToTarget(e);
    };
    const onKeyDown = (e) => {
      props.onKeyDown?.(e);
      applyEventReaction("keyDown", e);
    };
    const onInput = (e) => {
      props.onInput?.(e);
      applyEventReaction("input", e);
    };
    // a custom concept being combination of "input", "change" and may other events
    // this even if trigerred when value changes and can be controlled by actionDebounce and actionAfterChange
    const hasNaviChangeEventReaction = Boolean(
      eventReactionDefinitions?.naviChange ||
      defaultEventReactionDefinitions?.naviChange,
    );
    // The input effect is installed once per element/options while the reaction
    // closures (boundAction, custom reactions) are per-render: read through a
    // ref so the effect always fires the current render's reaction.
    const applyEventReactionRef = useRef();
    applyEventReactionRef.current = applyEventReaction;
    const refCallback = useCallback(
      (field) => {
        if (!hasNaviChangeEventReaction || actionEvent === "custom") {
          return undefined;
        }
        return addInputEffect(
          field,
          (e) => applyEventReactionRef.current("naviChange", e),
          {
            waitForChange: actionAfterChange,
            debounce: actionDebounce,
            debugInteraction,
          },
        );
      },
      [
        actionEvent,
        actionAfterChange,
        actionDebounce,
        hasNaviChangeEventReaction,
        ref,
      ],
    );
    const refComposed = useComposeElementRef(refCallback, ref);
    const onPaste = (e) => {
      props.onPaste?.(e);
      dispatchRequestInteraction(ref.current, {
        event: e,
        name: "paste",
        prevented: () => e.preventDefault(),
        allowed: () => {
          const pastedText = e.clipboardData?.getData("text") ?? "";
          const el = ref.current;
          const selStart = el.selectionStart ?? el.value.length;
          const selEnd = el.selectionEnd ?? el.value.length;
          const newValue =
            el.value.slice(0, selStart) + pastedText + el.value.slice(selEnd);
          const guardResult = uiStateController.rules.guard.checkUIState(
            newValue,
            e,
          );
          if (guardResult?.blocked) {
            e.preventDefault();
            return;
          }
          if (guardResult?.fixedValue !== undefined) {
            // Pass newValue (not fixedValue) so setUIState's guard shows the
            // truncation callout and applies the truncated value itself.
            e.preventDefault();
            uiStateController.setUIState(newValue, e);
            return;
          }
          // valid — let the browser paste; the input event will sync UI state
        },
      });
    };
    Object.assign(controlHostProps, {
      ref: refComposed,
      onMouseDown,
      onClick,
      onKeyDown,
      onPaste,
      onInput,
    });
    // A value written in a form of its own ("07" for the number 7) is derived
    // again when the field is left: while it is being typed into, what is in
    // the field is what the person is writing and nothing rewrites it (see
    // syncDomState). Only for such a control — for every other one the field
    // already shows exactly what is held, and there is nothing to derive.
    if (props["navi-value-pad"]) {
      const onBlurFromProps = controlHostProps.onBlur;
      controlHostProps.onBlur = (e) => {
        onBlurFromProps?.(e);
        // Read from the field: what was just typed is in there, whatever the
        // control has had time to settle on.
        const el = e.currentTarget;
        syncDomState(readControlValue(el), e);
      };
    }
  }

  const uiState = uiStateController.uiStateSignal.peek();
  const domProps = toDomProps(uiState);
  {
    // Same as syncDomState: a field being typed into keeps its own text, so a
    // render happening mid-number does not put the caret back at the end.
    const el = props.ref.current;
    if (
      el &&
      document.activeElement === el &&
      readControlValue(el) === uiState
    ) {
      domProps.value = el.value;
    }
  }
  Object.assign(controlHostProps, domProps);

  return [controlRootProps, controlHostProps, { uiStateController }];
};
/**
 * Whether the caller has told this control what it holds. Three ways, and only
 * three — the controlled `value`, the uncontrolled `defaultValue`, a bound
 * `signal` — the same three createControlInfo below reads, in that precedence
 * order, to seed the state.
 *
 * None of them and the control starts with nothing: whatever it ends up holding
 * has to come from somewhere else — a parent form distributing its own value,
 * or, for a picker, the control sitting in its popup (see
 * useUIFacadeStateController). Anyone who needs to know whether a control can
 * answer for itself before anything mounts asks this rather than re-listing the
 * props, which is how `signal` came to be forgotten.
 */
export const isControlValueGivenByProps = (props) =>
  Object.hasOwn(props, "value") ||
  Object.hasOwn(props, "defaultValue") ||
  Object.hasOwn(props, "signal");

const createControlInfo = (props, { controlType }) => {
  let statePropName;
  let defaultStatePropName;
  let stateInitial;
  let readOnlySupported = false;
  let readOnlyOpens = false;
  let disabledSupported = false;
  let hasStateProp;
  let value;
  const typeProp = props.type || "text";
  // A bound signal: its value seeds the state, and onUIAction writes the state
  // back into it (see ui_state_controller.js). It replaces the value/checked prop
  // — reading it here makes the control re-render (and re-sync) when it changes.
  const signal = Object.hasOwn(props, "signal") ? props.signal : undefined;
  // For a checkbox/radio the signal holds the boolean checked state, not the value.
  let signalHoldsChecked = false;
  // What the signal says the control shows, re-read on every render. A signal
  // carrying a default of its own seeds `defaultValue` (resolveInputProps), so
  // such a control is uncontrolled — but the binding still has to work in both
  // directions: whoever writes the signal from the outside expects the control
  // to move. This is what the controller re-syncs on (see useUIStateController),
  // and an emptied signal puts the control back on its suggestion.
  let stateFromSignal;

  if (controlType === "input") {
    if (typeProp === "checkbox" || typeProp === "radio") {
      statePropName = "checked";
      defaultStatePropName = "defaultChecked";
      // "on" is what HTML sends for a checkbox given no value of its own — the
      // default of an ABSENT prop, not of a falsy one: `value={false}` and
      // `value={0}` are values, and two rows holding true and false are how a
      // list asks a yes/no question.
      value = props.value === undefined ? "on" : props.value;
      signalHoldsChecked = true;
      if (signal) {
        // The signal is the source of truth: a `checked` passed alongside is
        // ignored, not merged (warnSignalCollision says so in dev).
        warnSignalCollision(props, controlType, "checked");
        if (props.defaultChecked) {
          // resolveInputProps may seed defaultChecked from a bound signal's
          // default: the control stays uncontrolled and follows the signal
          // through stateFromSignal.
          hasStateProp = false;
          stateInitial = value;
          stateFromSignal = signal.value ? value : undefined;
        } else {
          // A bound signal with no resolved default: its live value seeds state.
          hasStateProp = true;
          stateInitial = signal.value ? value : undefined;
        }
      } else if (Object.hasOwn(props, "checked")) {
        hasStateProp = true;
        stateInitial = props.checked ? value : undefined;
      } else if (props.defaultChecked) {
        hasStateProp = false;
        stateInitial = value;
      } else {
        hasStateProp = false;
        stateInitial = undefined;
      }
    } else {
      statePropName = "value";
      defaultStatePropName = "defaultValue";
      ({ hasStateProp, stateInitial, stateFromSignal } = resolveValueState(
        props,
        controlType,
        signal,
      ));
      if (hasStateProp) {
        value = stateInitial;
      }

      readOnlySupported = INPUT_TYPE_SUPPORTING_READONLY_SET.has(typeProp);
    }

    disabledSupported = true;
  } else if (controlType === "button") {
    statePropName = "value";
    stateInitial = props.value;

    disabledSupported = true;
  } else if (controlType === "details") {
    statePropName = "open";
    defaultStatePropName = "defaultOpen";
    stateInitial = props.open || props.defaultOpen;
    value = props.value || "open";
  } else if (controlType === "picker" || controlType === "select") {
    statePropName = "value";
    defaultStatePropName = "defaultValue";
    ({ hasStateProp, stateInitial, stateFromSignal } = resolveValueState(
      props,
      controlType,
      signal,
    ));

    disabledSupported = true;
    // A native <select> has no readonly attribute. What says it is read-only is
    // aria-readonly plus a refused interaction — see the select reactions in
    // getDefaultEventReactionDefinitions.
    readOnlySupported =
      controlType === "picker" &&
      INPUT_TYPE_SUPPORTING_READONLY_SET.has(typeProp);
    // A picker's popup is content of its own — a plan with one tile ringed, a
    // wheel stopped on a time, a list showing what was chosen — so read-only
    // does not close it: it opens, and everything in it is held read-only in
    // turn (see the ReadOnlyContext in picker.jsx). Two pickers this is not
    // true of: one with no popup of its own, which opens the browser's and
    // cannot hold that read-only (see PickerNative), and one whose caller says
    // its popup is a form with nothing to read (openWhileReadOnly={false}).
    readOnlyOpens =
      controlType === "picker" &&
      props.children !== undefined &&
      props.openWhileReadOnly !== false;
  }

  // The suggestion the control starts on, as opposed to what it holds — what a
  // reset goes back to, and what tells a field left on its default from one
  // carrying an answer (see isUIStateHeld in held_ui_state.js).
  let defaultValue;
  if (!hasStateProp) {
    if (signalHoldsChecked) {
      defaultValue = props.defaultChecked ? value : undefined;
    } else if (Object.hasOwn(props, "defaultValue")) {
      defaultValue = props.defaultValue;
    }
  }

  return {
    controlType,
    statePropName,
    defaultStatePropName,
    hasStateProp,
    stateInitial,
    state: stateInitial,
    value,
    defaultValue,
    signal,
    signalHoldsChecked,
    stateFromSignal,

    readOnlySupported,
    readOnlyOpens,
    disabledSupported,
  };
};
// Who says what a value-holding control is worth — a bound signal, a `value`,
// a `defaultValue` — resolved the same way for every control holding one value
// (text input, picker, select). The checkbox/radio branch has its own
// resolution: `checked` speaks in booleans and translates to the value.
const resolveValueState = (props, controlType, signal) => {
  if (signal) {
    // The signal is the source of truth: a `value` passed alongside is
    // ignored, not merged (warnSignalCollision says so in dev).
    warnSignalCollision(props, controlType, "value");
    if (Object.hasOwn(props, "defaultValue")) {
      // A bound signal's own default is seeded into `defaultValue` (see
      // resolveInputProps), so such a control is uncontrolled-with-default;
      // the signal only receives write-backs (onUIAction).
      // A signal holding something wins over the default: `defaultValue` is
      // a suggestion of what to start from (and what a reset goes back to),
      // not an answer — while the signal's value IS the answer, restored
      // from the url or set by whoever owns it. Taking the default here
      // would show a suggestion in place of the value on every reload.
      const stateInitial =
        signal.value !== undefined ? signal.value : props.defaultValue;
      return {
        hasStateProp: false,
        stateInitial,
        stateFromSignal: stateInitial,
      };
    }
    // A plain bound signal with no default (e.g. Wheel): its live value
    // seeds and controls the state.
    return { hasStateProp: true, stateInitial: signal.value };
  }
  if (Object.hasOwn(props, "value")) {
    return { hasStateProp: true, stateInitial: props.value };
  }
  if (Object.hasOwn(props, "defaultValue")) {
    return { hasStateProp: false, stateInitial: props.defaultValue };
  }
  return { hasStateProp: false, stateInitial: undefined };
};
// color, radio, image, file etc do not support readonly
const INPUT_TYPE_SUPPORTING_READONLY_SET = new Set([
  "text",
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "time",
  "url",
  "week",
]);
// Who, if anyone, is listening to what this control is worth: a handler of its
// own, a bound signal, a command — or the form/group around it, which is the
// one that will send the value and hand a new one back. Held apart from the
// warning below so a group can ask the same question a single control does: a
// control with a `value` and nobody listening cannot be changed by hand, and
// that is true whatever the control is.
const useIsControlListenedTo = (props) => {
  const isProxy = Boolean(props["navi-control-proxy-for"]);
  const formContext = useContext(FormContext);
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  return Boolean(
    props.signal || // a bound signal is written back on uiAction → interactive
    props.uiAction ||
    props.action ||
    formContext ||
    parentUIStateController ||
    isProxy ||
    props.command,
  );
};
const useReadOnlyUncontrolled = (props, controlInfo) => {
  const listenedTo = useIsControlListenedTo(props);
  const warnedRef = useRef(false);
  if (!controlInfo.hasStateProp) {
    return false;
  }
  if (listenedTo) {
    return false;
  }
  if (
    // explicit readonly is ok
    !props.readOnly &&
    import.meta.dev &&
    !warnedRef.current
  ) {
    warnedRef.current = true;
    const { controlType, statePropName, defaultStatePropName } = controlInfo;
    console.warn(
      `"${controlType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or pass "uiAction"/"action" to make field interactive.`,
    );
    console.log(props);
  }
  return true;
};

/**
 * Core hook for field group components (SelectableList, CheckboxList, etc.).
 * - Creates a UI group state controller that aggregates child states into one group state
 * - Binds the group's action to the aggregated state signal
 * - Provides context to children: ParentUIStateController, FieldName, Disabled, ReadOnly,
 *   Required, Loading, Action, ActionRequester
 * - Overrides `onnavi_reset_ui_state` to cascade resets to all monitored children
 *   by dispatching `navi_reset_ui_state` DOM events on each child's DOM element
 * - Overrides `onnavi_action_allowed` to track the action requester
 *
 * @returns {[controlRootProps, controlgroupProps, controlgroupChildrenWrapperProps]}
 */
export const useControlgroupProps = (
  props,
  {
    controlType,
    stateType,
    childControlFilter,
    aggregateChildStates,
    distributeChildUIState,
    distributeChildStates,
    wantRequesterButtonState,
    uiActionInternal,
    allowCapture = false,
    cascadeValidationToChildren = false,
  },
) => {
  const { action } = props;

  const uiGroupStateController = useUIGroupStateController(props, controlType, {
    stateType,
    childControlFilter,
    aggregateChildStates,
    distributeChildUIState,
    distributeChildStates,
    wantRequesterButtonState,
    uiActionInternal,
    allowCapture,
    cascadeValidationToChildren,
  });
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiGroupStateController.uiStateSignal,
  );
  // Mirror single-input behaviour: a controlled value with nobody listening
  // makes the group read-only so children don't appear interactive when they
  // can't change. A form or a group around it IS someone listening — that is
  // what will send the value and hand a new one back.
  const listenedTo = useIsControlListenedTo(props);
  const implicitReadOnlyWarnedRef = useRef(false);
  const implicitReadOnly = uiGroupStateController.hasValueProp && !listenedTo;
  if (implicitReadOnly && !props.readOnly) {
    if (import.meta.dev && !implicitReadOnlyWarnedRef.current) {
      implicitReadOnlyWarnedRef.current = true;
      console.warn(
        `[${controlType}] is controlled (has "value" prop) but has no action handler. ` +
          `Use "defaultValue" for uncontrolled mode, or provide "action"/"uiAction".`,
      );
    }
    props.readOnly = true;
  }

  const [actionRequester, setActionRequester] = useState();
  const [controlRootProps, controlgroupProps] = useInteractiveProps(props, {
    uiStateController: uiGroupStateController,
    boundAction,
    // here the state is derived from the children
    // so we don't have a value concept, nor readonly etc
    controlInfo: { controlType },
  });

  const { basePseudoState } = controlgroupProps;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];

  const controlgroupChildrenWrapperProps = useMemo(
    () => ({
      uiGroupStateController,
      name: controlgroupProps.name,
      required: controlgroupProps.required,
      disabled,
      readOnly,
      loading,
      boundAction,
      actionRequester,
    }),
    [
      uiGroupStateController,
      controlgroupProps.name,
      controlgroupProps.required,
      disabled,
      readOnly,
      loading,
      boundAction,
      actionRequester,
    ],
  );

  return [
    controlRootProps,
    {
      ...controlgroupProps,
      "name": undefined, // useful to children, not the group itself
      "required": undefined, // useful to children, not the group itself
      // How many items the group accepts, read by its controller and by the
      // children asking whether there is still room for them. Not an attribute
      // any element wears: a <fieldset maxlength> means nothing.
      "maxLength": undefined,
      "onnavi_action_allowed": (e) => {
        setActionRequester(e.detail.requester);
        controlgroupProps.onnavi_action_allowed(e);
      },
      "navi-control-group": "",
    },
    controlgroupChildrenWrapperProps,
  ];
};

/**
 * What a control holds, read from the control itself.
 *
 * For a component built AROUND a control rather than instead of one — a
 * stepper wrapping a picker, a preview beside a field: the control keeps the
 * whole value story (`value` vs `defaultValue` vs `signal`, and what a form
 * makes of each), and this is how the wrapper knows what is in it without
 * having to tell that story a second time.
 *
 * Read from the DOM rather than from props on purpose: a value set from
 * anywhere — the control's own popup, a signal moved elsewhere, a paste —
 * comes back the same way, because every one of them ends in the same
 * navi_ui_state_change.
 *
 * @param {{current: HTMLElement}} ref - the control's own ref (the element
 *   given the `ref` prop, whatever the control renders around it).
 * @param {any} [uiStateInitial] - what to say before the control has mounted,
 *   which is the one moment the DOM cannot be asked.
 */
export const useControlUIState = (ref, uiStateInitial) => {
  const [uiState, setUIState] = useState(uiStateInitial);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    // The host, not the box around it: a control is a whole little tree (a
    // picker is a box holding an input) and the state is announced on the one
    // element that holds it. Same resolution every request goes through, see
    // ui_state_dom.js.
    const host = findControlHost(element) || element;
    // Asked once here rather than trusted from the props above: between the
    // first render and this effect the control has read its own value prop, its
    // defaultValue and any signal it was bound to, and settled which of them
    // wins — the answer to that is on the element, not in what we were handed.
    setUIState(getUIStateFromElement(host));
    const onUIStateChange = (e) => {
      setUIState(e.detail.value);
    };
    host.addEventListener("navi_ui_state_change", onUIStateChange);
    return () => {
      host.removeEventListener("navi_ui_state_change", onUIStateChange);
    };
  }, [ref]);
  return uiState;
};

/**
 * Like `useControlProps` but also establishes a 1:1 facade sync between the
 * picker's hidden input and the first child control inside the picker popup.
 *
 * Child → picker input: when the child's UI state changes, the picker input
 * is updated automatically (no `command="--navi-update"` needed on the child).
 *
 * Picker input → child: when the picker input is updated externally (e.g.
 * via `--navi-update` or `--navi-clear` from outside), the change is
 * propagated down to the child automatically.
 *
 * Returns a 3-tuple `[controlRootProps, controlHostProps, facadeChildrenProps]`.
 * Use `ControlFacadeChildrenWrapper` with the third element to wrap the popup
 * children — it resets field contexts and injects the facade controller:
 *
 * ```jsx
 * const [controlRootProps, controlHostProps, facadeChildrenProps] = useControlFacadeProps(props, options);
 * // …
 * <ControlFacadeChildrenWrapper {...facadeChildrenProps}>
 *   {children}
 * </ControlFacadeChildrenWrapper>
 * ```
 */
export const useControlFacadeProps = (props, options) => {
  const [controlRootProps, controlHostProps, { uiStateController }] =
    useControlProps(props, options);
  const facadeController = useUIFacadeStateController(props, uiStateController);
  return [controlRootProps, controlHostProps, { facadeController }];
};

/**
 * Wrapper for the popup children of a facade-backed picker.
 *
 * Resets all inherited field contexts (same as `ControlChildrenWrapper`) so
 * that children don't accidentally register as form participants of the outer
 * field. Additionally injects the facade controller as
 * `ParentUIStateControllerContext` so the first child control automatically
 * stays in sync with the picker input (bidirectional, without any explicit
 * `command` prop).
 *
 * Receives `facadeChildrenProps` — the third element of the tuple returned by
 * `useControlFacadeProps` — spread directly onto this component.
 */
export const ControlFacadeChildrenWrapper = ({
  children,
  facadeController,
}) => (
  <ControlChildrenWrapper uiStateController={facadeController}>
    {children}
  </ControlChildrenWrapper>
);

const useInteractiveProps = (
  props,
  { uiStateController, boundAction, controlInfo },
) => {
  const { ref } = props;
  const [controlRootProps, controlHostProps] = splitControlProps(props);
  controlRootProps["navi-control"] = controlInfo.controlType;
  const { "navi-control-proxy-for": naviProxyFor } = props;
  controlHostProps["navi-control-proxy-for"] = naviProxyFor;
  controlHostProps["navi-control-host"] = controlInfo.controlType;

  const debugCommand = useDebugCommand();
  const debugAction = useDebugAction();
  const debugInteraction = useDebugInteraction();
  const debugFocus = useDebugFocus();

  autofocus: {
    const { autoFocus, autoFocusVisible, autoFocusSelect } = props;
    const autoFocusProps = useAutoFocus(ref, autoFocus, {
      focusVisible: autoFocusVisible,
      autoSelect: autoFocusSelect,
    });
    Object.assign(controlHostProps, autoFocusProps);
  }
  main_props: {
    const { id, name, type } = props;
    Object.assign(controlHostProps, {
      id,
      name,
      type,
    });
  }
  control_state_props: {
    const controlDisabled = useContext(DisabledContext);
    const controlReadOnly = useContext(ReadOnlyContext);
    const controlRequired = useContext(RequiredContext);
    const controlLoading = useContext(LoadingContext);
    const parentActionRequester = useContext(ActionRequesterContext);
    const actionStatus = useActionStatus(boundAction);
    const { disabled, required, readOnly, loading, optimistic } = props;

    const disabledResolved = disabled || controlDisabled;
    const requiredResolved = required || controlRequired;
    // Busy because the group above is running the action THIS control asked
    // for (a submit button wearing its form's submission), as opposed to busy
    // on its own say-so.
    const loadingFromParent = Boolean(
      controlLoading && parentActionRequester === ref.current,
    );
    const loadingBase = loading || loadingFromParent;
    // Read-only because the selection above guards its length
    // (`maxLengthGuard`) and this one would make it longer: it can be pointed
    // at, focused and pressed — and answers why (see readonly_constraint.js) —
    // but cannot be taken.
    const readOnlyFromParentMaxLengthGuard = Boolean(
      uiStateController.parentUIStateController?.isChildBlockedByMaxLengthGuard?.(
        uiStateController,
      ),
    );
    const readOnlyBase =
      readOnly ||
      controlReadOnly ||
      loadingBase ||
      readOnlyFromParentMaxLengthGuard ||
      controlInfo.readOnlyUncontrolled;
    // An optimistic control trusts its action to succeed: the state the user
    // just set stays visible and interactive while the action runs — no
    // loading, no readonly. On failure resetOnError rolls the state back and
    // the error callout says why.
    const actionLoading = optimistic ? false : actionStatus.loading;
    const loadingResolved = loadingBase || actionLoading;
    const readOnlyResolved = readOnlyBase || actionLoading;
    // Read-only, and what this control opens still opens: reading what is in
    // there changes nothing. Read by READONLY_CONSTRAINT, which lets an
    // interaction that only reads through on it.
    uiStateController.readOnlyOpens = Boolean(controlInfo.readOnlyOpens);
    // Both halves of "busy" that do not come from the bound action, kept apart
    // from each other and from it: BUSY_CONSTRAINT answers each from its own
    // live source rather than from the rendered aria-busy, which conflates all
    // three and is a frame behind. See its own comment.
    uiStateController.loadingFromOwnProp = Boolean(loading);
    uiStateController.loadingFromParent = loadingFromParent;
    // Read by BUSY_CONSTRAINT: an optimistic control stays interactive while
    // its bound action runs (a new toggle replaces the run instead of waiting).
    uiStateController.optimistic = Boolean(optimistic);

    Object.assign(controlHostProps, {
      "required": requiredResolved,
      "aria-busy": loadingResolved ? "true" : "false",
      "basePseudoState": {
        ":disabled": disabledResolved,
        ":read-only": readOnlyResolved,
        ":-navi-loading": loadingResolved,
        ...props.basePseudoState,
      },
    });
    if (controlInfo.readOnlySupported) {
      controlHostProps.readOnly = readOnlyResolved;
    } else {
      controlHostProps["aria-readonly"] = readOnlyResolved ? "true" : "false";
    }
    if (controlInfo.disabledSupported) {
      controlHostProps.disabled = disabledResolved;
    } else {
      controlHostProps["aria-disabled"] = disabledResolved ? "true" : "false";
      if (disabledResolved) {
        controlHostProps["inert"] = "";
      }
    }
    // Inform any associated label of our state (connected, disabled, readOnly,
    // required — a Label with requiredIndicator marks itself from it rather
    // than being told twice what the control already knows), through both
    // channels a label can be reached by: a DOM event on the labels the element
    // itself hands over (a wrapping <label>, or a label[for] on a native form
    // element), and a publication under this control's id for the labels that
    // only know it by that (see control_label_state.js).
    //
    // The id is remembered rather than re-read at unmount time: ref.current is
    // often already null by then, and the labels subscribed under that id would
    // stay told about a control that no longer exists.
    const publishedIdRef = useRef(null);
    useLayoutEffect(() => {
      const element = ref.current;
      if (!element) {
        return;
      }
      const readOnlyForced = element.hasAttribute("data-readonly-forced");
      const readOnly = readOnlyForced ? false : readOnlyResolved;
      const controlState = {
        disabled: disabledResolved,
        readOnly,
        required: requiredResolved,
      };
      for (const label of getAssociatedLabels(element)) {
        label.dispatchEvent(
          new CustomEvent("navi_control_state", { detail: controlState }),
        );
      }
      publishedIdRef.current = element.id;
      publishControlStateToLabels(element.id, controlState);
    }, [disabledResolved, readOnlyResolved, requiredResolved, ref]);
    useLayoutEffect(() => {
      return () => {
        const element = ref.current;
        if (element) {
          for (const label of getAssociatedLabels(element)) {
            label.dispatchEvent(new CustomEvent("navi_control_disconnected"));
          }
        }
        unpublishControlStateToLabels(publishedIdRef.current);
      };
    }, []);
  }
  ui_state_and_value: {
    const isCheckable = isCheckableInput(
      uiStateController.controlType,
      props.type,
    );
    Object.assign(controlHostProps, {
      onnavi_clear_ui_state: (e) => {
        uiStateController.clearUIState(e);
      },
      onnavi_reset_ui_state: (e) => {
        uiStateController.resetUIState(e);
      },
      onnavi_get_ui_state: (e) => {
        // `own`: what this control holds by itself, ignoring what a button
        // inherits from the control around it (see ownUIStateSignal).
        const uiStateSignal =
          e.detail.own && uiStateController.ownUIStateSignal
            ? uiStateController.ownUIStateSignal
            : uiStateController.uiStateSignal;
        e.detail.respondWith(uiStateSignal.peek());
      },
      onnavi_set_ui_state: (e) => {
        uiStateController.setUIState(e.detail.value, e);
      },
      onnavi_request_check: (e) => {
        if (isCheckable) {
          uiStateController.setUIState(uiStateController.value, e);
        } else {
          // warn?
        }
      },
      onnavi_request_uncheck: (e) => {
        if (isCheckable) {
          uiStateController.setUIState(undefined, e);
        } else {
          // warn?
        }
      },
    });
    // Mirror ui state handlers on the root so events dispatched on the root element
    // (e.g. from a commandfor targeting the picker button) reach the controller.
    Object.assign(controlRootProps, {
      onnavi_clear_ui_state: controlHostProps.onnavi_clear_ui_state,
      onnavi_reset_ui_state: controlHostProps.onnavi_reset_ui_state,
      onnavi_get_ui_state: controlHostProps.onnavi_get_ui_state,
      onnavi_set_ui_state: controlHostProps.onnavi_set_ui_state,
      onnavi_request_check: controlHostProps.onnavi_request_check,
      onnavi_request_uncheck: controlHostProps.onnavi_request_uncheck,
    });
  }
  children_prop: {
    const { children } = props;
    // Children are returned raw so callers decide how to wrap them.
    // Use the returned ChildrenContextWrapper to reset field-specific contexts
    // (MessagePropsRef, ControlToInterface) around the content you render.
    Object.assign(controlHostProps, { children });
  }
  command_props: {
    Object.assign(controlHostProps, {
      onnavi_command: (e) => {
        props.onnavi_command?.(e);
        onNaviCommand(e, { debugCommand });
      },
    });
    // The control host (e.g. hidden input inside picker) listens for navi_command
    // via controlHostProps above. But when commandfor targets the control root (e.g.
    // the picker button), the event fires there instead. Putting onnavi_command on
    // controlRootProps — which ends up on the root element — lets the root handle it.
    // When root === host the spread order ensures
    // controlHostProps.onnavi_command takes precedence.
    Object.assign(controlRootProps, {
      onnavi_command: controlHostProps.onnavi_command,
    });
  }
  action_props: {
    const { action, actionErrorEffect, errorMapping } = props;
    const executeAction = useExecuteAction(ref, {
      errorEffect: actionErrorEffect,
      errorMapping,
    });
    const dataAction =
      action === undefined ? undefined : boundAction.callSource;
    Object.assign(controlHostProps, {
      "data-action": dataAction,
    });
    Object.assign(controlRootProps, {
      "data-action": dataAction,
    });

    const {
      onCancel,
      cancelOnBlurInvalid,
      cancelOnEscape,
      onActionPrevented,
      onActionStart,
      onActionAborted,
      onActionError,
      onActionEnd,
      resetOnCancel,
      resetOnAbort,
      resetOnError,
      optimistic,
    } = props;
    Object.assign(controlHostProps, {
      onFocus: (e) => {
        // Transfer programmatic focus to the delegate target (navi-focus-delegate or navi-control-proxy-for)
        const focusProxyTarget =
          findFocusDelegateTarget(e.currentTarget) ||
          findControlProxyTarget(e.currentTarget);
        if (focusProxyTarget) {
          const focusVisible = isMatchingFocusVisible(e.currentTarget);
          debugFocus(
            e,
            `focus event: redirecting to ${getElementSignature(focusProxyTarget)}.focus({ focusVisible: ${focusVisible} })`,
          );
          focusProxyTarget.focus({ focusVisible });
        }
      },
      onnavi_request_interaction: (e) => {
        onRequestInteraction(e, { debugInteraction });
      },
      onnavi_cancel: (e) => {
        const { reason } = e.detail;
        const isBlurInvalid = reason.startsWith("blur_invalid");

        if (resetOnCancel) {
          if (isBlurInvalid) {
            return;
          }
          dispatchRequestResetUIState(e.currentTarget, e);
          onCancel?.(e, reason);
          return;
        }
        if (isBlurInvalid) {
          if (!cancelOnBlurInvalid) {
            return;
          }
          if (
            // error prevent cancellation until the user closes it (or something closes it)
            e.detail.failedConstraintInfo.level === "error" &&
            e.detail.failedConstraintInfo.reportStatus !== "closed"
          ) {
            return;
          }
        }
        if (reason === "escape_key") {
          if (!cancelOnEscape) {
            return;
          }
        }
        onCancel?.(e, reason);
      },
      onnavi_action_prevented: onActionPrevented,
      onnavi_action_allowed: (e) => {
        if (e.detail.action === "auto") {
          // special case for the use case where form.requestSubmit is called
          e.detail.action = boundAction;
        }
        // An optimistic control stays interactive while its action runs, so a
        // second request can arrive mid-run. The server must receive them in
        // order: the new request is queued (latest wins — the bound action
        // reads the UI state signal at run time, so what goes out is always
        // the current state) and goes out once the running one has truly
        // settled (see onnavi_action_start). The running action is asked to
        // abort — its outcome is already outdated — but aborting is only a
        // resource optimization (a fetch wired to the action's signal gets
        // cancelled): the server may have done the work anyway, and only the
        // settlement says which. So even aborted, the underlying work is
        // awaited before the queued request runs. See the abort section in
        // docs/actions.md.
        if (optimistic && uiStateController.actionInFlight) {
          debugAction(e, `queueing action (one already in flight)`);
          uiStateController.queuedActionAllowedEvent = e;
          // The instance captured at navi_action_start, NOT boundAction:
          // boundAction is a proxy following the UI state signal, and the UI
          // state has already moved to the new value by now — the proxy would
          // resolve to the instance for that new value, which is not the one
          // running.
          uiStateController.runningAction?.abort(
            `superseded by a newer request on this control`,
          );
          return;
        }
        debugAction(e, `executing action ${e.detail.action.callSource}`);
        executeAction(e);
      },
      onnavi_action_start: (e) => {
        // The run this control currently waits on, identified by the
        // navi_action_allowed event that launched it (unique per execution,
        // carried by every navi_action_* event of that run).
        uiStateController.pendingActionEvent = e.detail.event;
        uiStateController.actionInFlight = true;
        // The very instance this run uses, resolved now — while the UI state
        // still holds the value the run was made for. detail.action may be a
        // proxy following that state, and by the time anyone wants to abort
        // this run (see the optimistic queue above), the state — and the
        // proxy's resolution — will have moved on.
        const runAction = e.detail.action;
        uiStateController.runningAction =
          runAction.getCurrentAction?.() ?? runAction;
        // Fires when the run's underlying work has settled — even for an
        // aborted run, whose promise is awaited to completion (see
        // performRun in actions.js) — which is exactly what "the server is
        // done with it" means, and therefore when the queued request may go.
        e.detail.addSideEffect((outcome) => {
          uiStateController.actionInFlight = false;
          uiStateController.runningAction = null;
          const queuedEvent = uiStateController.queuedActionAllowedEvent;
          if (!queuedEvent) {
            return;
          }
          if (outcome.error) {
            // A failure abandons the queue: the UI is rolled back to the last
            // known state (resetOnError above), and what was queued was built
            // on top of the state that just failed.
            uiStateController.queuedActionAllowedEvent = null;
            return;
          }
          // A microtask later, not right here: this runs inside the batch()
          // that settles the action (see watchActionCompletion for the same
          // constraint).
          queueMicrotask(() => {
            // Cleared here, right before the dispatch, never earlier: between
            // the outcome and this microtask a render can slip in (the echo
            // of what the settled run committed), and the external-state gate
            // in ui_state_controller.js must still see work in flight or it
            // would overwrite the UI state the queued request is about to
            // send.
            uiStateController.queuedActionAllowedEvent = null;
            executeAction(queuedEvent);
          });
        });
        onActionStart?.(e);
      },
      onnavi_action_abort: (e) => {
        // Only an abort that leaves the control with nothing left to do may
        // reset the UI state. An abort whose run was superseded — a queued
        // request waits behind it (optimistic), or a newer run already
        // started — must leave the state alone: it belongs to the newer
        // request, resetting would throw away what the user just set.
        const superseded =
          Boolean(uiStateController.queuedActionAllowedEvent) ||
          e.detail.event !== uiStateController.pendingActionEvent;
        if (resetOnAbort && !superseded) {
          dispatchRequestResetUIState(e.currentTarget, e);
        }
        onActionAborted?.(e);
      },
      onnavi_action_error: (e) => {
        const { error } = e.detail;
        debugAction(e, `action error`, error);
        if (resetOnError) {
          dispatchRequestResetUIState(e.currentTarget, e);
        }
        onActionError?.(error, e);
        uiStateController.onActionError(e);
      },
      onnavi_action_end: (e) => {
        const { data } = e.detail;
        debugAction(e, `action end with data: ${JSON.stringify(data)}`);
        onActionEnd?.(data, e);
        controlRootProps.onnavi_action_end?.(e);
        uiStateController.onActionEnd(e);

        // Auto-trigger the parent group's action after the leaf action
        // completes, for the groups that ARE one control made of parts: a
        // radio or checkbox group, a wheel group (an hour wheel settling is
        // the time settling). The parent has already aggregated the new
        // state by now, so uiStateSignal is correct. One level only: the
        // parent's own action end does not climb further unless that parent
        // is itself such a group.
        const parentController = uiStateController.parentUIStateController;
        if (
          parentController &&
          (parentController.controlType === "radio_group" ||
            parentController.controlType === "checkbox_group" ||
            parentController.controlType === "wheel_group")
        ) {
          const parentEl = parentController.ref.current;
          if (parentEl) {
            dispatchRequestAction(parentEl, {
              event: e.detail.eventChain[0],
              name: "auto_group_action",
              requester: e.detail.requester,
              // The interactivity gate is not re-asked: the user already
              // interacted — with the child, whose gate said yes — and this
              // follow-up is automatic. Asking again would also answer
              // wrong: this event is dispatched inside the batch() that
              // settles the child's action, where a bound action still
              // READS as running (its state is mirrored through a signal
              // effect the batch defers, see watchActionCompletion) — the
              // busy constraint would refuse the group for an action that
              // is already over. The validity gate still applies.
              bypassInteractivity: true,
            });
          }
        }
      },
    });
  }
  // controlHostProps is a curated subset of props with resolved values applied
  // (e.g. readOnly resolved from context + action loading). The interaction system
  // reads off uiStateController.controlHostProps at runtime (e.g. READONLY_CONSTRAINT
  // checks controlHostProps.readOnly), so pointing the controller at controlHostProps
  // keeps those reads current without any extra bookkeeping.
  const firstRender = uiStateController.controlHostProps === undefined;
  uiStateController.controlHostProps = controlHostProps;
  // The action itself, not just what the last render made of it: its running
  // state is a signal and changes the instant the action settles, while
  // controlHostProps above is a snapshot of the render before that. Anything
  // asked "is this control busy?" in that same tick — the interaction gate, on
  // an action's own completion side effect — has to read the signal to get an
  // answer that is not one frame late (see BUSY_CONSTRAINT).
  uiStateController.boundAction = boundAction;
  if (firstRender) {
    // Deferred from the factory so these run after controlHostProps is set.
    // Constraints like READONLY_CONSTRAINT and findControlProxyTargetController
    // read controlHostProps — calling these earlier would throw or produce wrong results.
    onUIStateControllerCreated(uiStateController);
    uiStateController.rules.validation.checkValidity();
  }

  return [controlRootProps, controlHostProps];
};
const splitControlProps = (props) => {
  const { ref } = props;
  const controlHostProps = {
    ref,
  };
  const controlRootProps = {};
  for (const key of Object.keys(props)) {
    if (CONTROL_PROP_SET.has(key)) {
      if (CONTROL_ATTRIBUTE_SET.has(key)) {
        controlHostProps[key] = props[key];
      }
    } else {
      controlRootProps[key] = props[key];
    }
  }
  return [controlRootProps, controlHostProps];
};

const isCheckableInput = (controlType, typeProp) =>
  controlType === "input" && (typeProp === "radio" || typeProp === "checkbox");

// The labels the DOM itself can hand over: a wrapping <label>, or a label[for]
// pointing at a native form element. Everything else — a label[for] on a
// non-native control — goes through control_label_state.js instead, which knows
// the pairing without asking the document for it.
const getAssociatedLabels = (element) => {
  if (!element || !element.labels) {
    return [];
  }
  return Array.from(element.labels);
};
