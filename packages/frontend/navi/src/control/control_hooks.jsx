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
import { useComposeElementRef } from "@jsenv/navi/src/box/ref_composition/use_element_ref.js";
import {
  dispatchRequestAction,
  tryActionAfterInteractionAllowed,
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
import { isSignal } from "@jsenv/navi/src/utils/is_signal.js";
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
import { findControlProxyTarget } from "./control_proxy.js";
import { readControlValue } from "./control_value.js";
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
  { controlType, allowNameless, persists, uiActionInternal },
) => {
  const debugUIState = useDebugUIState();
  const debugAction = useDebugAction();

  const idDefault = useId();
  const controlId = useContext(ControlIdContext);
  props.id = props.id || controlId || idDefault;
  const controlName = useContext(ControlNameContext);
  props.name = props.name || controlName;

  const toDomProps = (newUIState) => {
    if (
      controlType === "input" &&
      (props.type === "radio" || props.type === "checkbox")
    ) {
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
      const controlEl = e.currentTarget || uiStateController.elementRef.current;
      const value = readControlValue(controlEl);
      uiStateController.setUIState(value, e);
    };
    // trigger a no-op state update to ensure that any listeners (e.g. commands) are notified of the interaction
    // not every interaction is a uiAction
    // (arrow keys inside an input, tab etc -> not a ui action for instance)
    const triggerUIAction = (e) => {
      syncUIStateWithDOM(e);
    };
    const wasCheckedAtMousedownRef = useRef(false);


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
            name: `keydown to ${defaultAction}`,
            prevented: () => e.preventDefault(),
            allowed: () => triggerUIAction(e),
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

      if (controlType === "link") {
        return {
          keyDown: (e) => {
            if (e.key === " ") {
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
          triggerUIAction(e);
          const control = ref.current;
          tryActionAfterInteractionAllowed(control, {
            event: e,
            action: boundAction,
            requester: control,
          });
        };

        return {
          keyDown: keyDownDefault,
          mouseDown: (e) => {
            if (actionOnMouseDown) {
              return {
                name: "mousedown",
                allowed: () => onButtonInteractionAllowed(e),
              };
            }
            return null;
          },
          click: (e) => {
            if (actionOnMouseDown) {
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
            if (e.key === " ") {
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
                syncUIStateWithDOM(e);
                requestActionOnAllowed(e);
              },
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
          const input = e.currentTarget;
          return {
            name: "enter on input to send closest control group",
            // allow to dispatch --navi-send even if input is readonly
            bypassInteractivity: true,
            allowed: () => triggerNaviCommand(input, "--navi-send", e),
            // prevent dispatching click as result of this enter
            prevented: () => e.preventDefault(),
          };
        }
        return keyDownDefault(e);
      };

      const isInputCheckable =
        controlType === "input" &&
        (props.type === "radio" || props.type === "checkbox");
      if (isInputCheckable) {
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
              const isRadio = props.type === "radio";
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
              if (checked) {
                return {
                  name: "enter to uncheck checkbox",
                  allowed: () =>
                    dispatchRequestSetUIState(inputEl, undefined, {
                      event: e,
                    }),
                  always,
                };
              }
              return {
                name: "enter to check checkbox",
                allowed: () =>
                  dispatchRequestSetUIState(inputEl, uiStateController.value, {
                    event: e,
                  }),
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
          mouseDown: (e) => {
            wasCheckedAtMousedownRef.current = e.currentTarget.checked;
          },
          click: (e) => {
            if (isRadio && wasCheckedAtMousedownRef.current) {
              // When a radio is already checked and gets clicked, the browser does NOT
              // fire an input event (state doesn't change), so asAction never runs.
              // We still want uiAction + command to fire. We can tell whether the click
              // is on an already-checked radio by looking at wasCheckedAtMousedownRef:
              // if it was checked at mousedown, the input event won't come, so we do it here.
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
      const isCheckable =
        controlType === "input" &&
        (props.type === "radio" || props.type === "checkbox");
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
        bypassInteractivity = false,
        allowed,
        prevented,
        always,
      } = reaction;
      const control = ref.current;
      return dispatchRequestInteraction(control, {
        event: e,
        name,
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
    const refCallback = useCallback(
      (field) => {
        if (!hasNaviChangeEventReaction || actionEvent === "custom") {
          return undefined;
        }
        return addInputEffect(
          field,
          (e) => applyEventReaction("naviChange", e),
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
          const guardResult =
            uiStateController.rules.guard.checkUIState(newValue, e);
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
  }

  const uiState = uiStateController.uiStateSignal.peek();
  const domProps = toDomProps(uiState);
  Object.assign(controlHostProps, domProps);

  return [controlRootProps, controlHostProps, { uiStateController }];
};
const createControlInfo = (props, { controlType }) => {
  let statePropName;
  let defaultStatePropName;
  let stateInitial;
  let readOnlySupported = false;
  let disabledSupported = false;
  let hasStateProp;
  let value;
  const typeProp = props.type || "text";

  if (controlType === "input") {
    if (typeProp === "checkbox" || typeProp === "radio") {
      statePropName = "checked";
      defaultStatePropName = "defaultChecked";
      hasStateProp = Object.hasOwn(props, "checked");
      value = props.value || "on";
      if (hasStateProp) {
        let checked = props.checked;
        if (isSignal(checked)) {
          checked = checked.value;
        }
        if (checked) {
          stateInitial = value;
        } else {
          stateInitial = undefined;
        }
      } else if (props.defaultChecked) {
        stateInitial = value;
      } else {
        stateInitial = undefined;
      }
    } else {
      statePropName = "value";
      defaultStatePropName = "defaultValue";
      hasStateProp = Object.hasOwn(props, "value");
      if (hasStateProp) {
        value = props.value;
        if (isSignal(value)) {
          value = value.value;
        }
        stateInitial = value;
      } else if (Object.hasOwn(props, "defaultValue")) {
        stateInitial = props.defaultValue;
      } else {
        stateInitial = undefined;
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
  } else if (controlType === "picker") {
    statePropName = "value";
    defaultStatePropName = "defaultValue";
    hasStateProp = Object.hasOwn(props, "value");
    if (hasStateProp) {
      let value = props.value;
      if (isSignal(value)) {
        value = value.value;
      }
      stateInitial = value;
    } else if (Object.hasOwn(props, "defaultValue")) {
      stateInitial = props.defaultValue;
    } else {
      stateInitial = undefined;
    }

    disabledSupported = true;
    readOnlySupported = INPUT_TYPE_SUPPORTING_READONLY_SET.has(typeProp);
  }

  return {
    controlType,
    statePropName,
    defaultStatePropName,
    hasStateProp,
    stateInitial,
    state: stateInitial,
    value,

    readOnlySupported,
    disabledSupported,
  };
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
const useReadOnlyUncontrolled = (props, controlInfo) => {
  if (!controlInfo.hasStateProp) {
    return false;
  }
  const isProxy = Boolean(props["navi-control-proxy-for"]);
  const formContext = useContext(FormContext);
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const controlled =
    props.uiAction ||
    props.action ||
    formContext ||
    parentUIStateController ||
    isProxy ||
    props.command;
  if (controlled) {
    return false;
  }
  if (
    // explicit readonly is ok
    !props.readOnly &&
    import.meta.dev
  ) {
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
    wantRequesterButtonState,
    uiActionInternal,
    allowCapture,
    cascadeValidationToChildren,
  });
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiGroupStateController.uiStateSignal,
  );
  // Mirror single-input behaviour: a controlled value with no handler makes the
  // group read-only so children don't appear interactive when they can't change.
  const implicitReadOnly =
    uiGroupStateController.hasValueProp && !action && !props.uiAction;
  if (import.meta.dev && implicitReadOnly && !props.readOnly) {
    console.warn(
      `[${controlType}] is controlled (has "value" prop) but has no action handler. ` +
        `Use "defaultValue" for uncontrolled mode, or provide "action"/"uiAction".`,
    );
  }
  const effectiveProps = implicitReadOnly
    ? { ...props, readOnly: props.readOnly || true }
    : props;
  const [actionRequester, setActionRequester] = useState();
  const [controlRootProps, controlgroupProps] = useInteractiveProps(effectiveProps, {
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
      "name": undefined, // useful to children, not the the group itself
      "required": undefined, // useful to children, not the the group itself
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
  <ParentUIStateControllerContext.Provider value={facadeController}>
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
    const { autoFocus, autoFocusVisible, autoSelect } = props;
    const autoFocusProps = useAutoFocus(ref, autoFocus, {
      focusVisible: autoFocusVisible,
      autoSelect,
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
    const { disabled, required, readOnly, loading } = props;

    const disabledResolved = disabled || controlDisabled;
    const requiredResolved = required || controlRequired;
    const loadingBase =
      loading || (controlLoading && parentActionRequester === ref.current);
    const readOnlyBase =
      readOnly ||
      controlReadOnly ||
      loadingBase ||
      controlInfo.readOnlyUncontrolled;
    const loadingResolved = loadingBase || actionStatus.loading;
    const readOnlyResolved = readOnlyBase || actionStatus.loading;

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
    // inform any associated label of our state (connected, disabled, readOnly)
    // dispatched directly on the label — works whether the label wraps the control
    // (Field as label) or is a separate element linked via htmlFor (Label component)
    useLayoutEffect(() => {
      const element = ref.current;
      if (!element) {
        return;
      }
      const labels = getAssociatedLabels(element);
      const readOnlyForced = element.hasAttribute("data-readonly-forced");
      const readOnly = readOnlyForced ? false : readOnlyResolved;
      for (const label of labels) {
        label.dispatchEvent(
          new CustomEvent("navi_control_state", {
            detail: {
              disabled: disabledResolved,
              readOnly,
            },
          }),
        );
      }
    }, [disabledResolved, readOnlyResolved]);
    useLayoutEffect(() => {
      return () => {
        const element = ref.current;
        if (!element) {
          return;
        }
        const labels = getAssociatedLabels(element);
        for (const label of labels) {
          label.dispatchEvent(new CustomEvent("navi_control_disconnected"));
        }
      };
    }, []);
  }
  ui_state_and_value: {
    const isCheckable =
      uiStateController.controlType === "input" &&
      (props.type === "radio" || props.type === "checkbox");
    Object.assign(controlHostProps, {
      onnavi_clear_ui_state: (e) => {
        uiStateController.clearUIState(e);
      },
      onnavi_reset_ui_state: (e) => {
        uiStateController.resetUIState(e);
      },
      onnavi_get_ui_state: (e) => {
        const uiState = uiStateController.uiStateSignal.peek();
        e.detail.respondWith(uiState);
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
    } = props;
    Object.assign(controlHostProps, {
      onFocus: (e) => {
        // Transfer programmatic focus to the delegate target (navi-focus-delegate or navi-control-proxy-for)
        const focusProxyTarget =
          findFocusDelegateTarget(e.currentTarget) ||
          findControlProxyTarget(e.currentTarget);
        if (focusProxyTarget) {
          const focusVisible = e.currentTarget.matches(":focus-visible");
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
        debugAction(e, `executing action ${e.detail.action.callSource}`);
        executeAction(e);
      },
      onnavi_action_start: (e) => {
        onActionStart?.(e);
      },
      onnavi_action_abort: (e) => {
        if (resetOnAbort) {
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

        // For radio/checkbox: auto-trigger the parent group's action after the
        // leaf action completes. The parent (radio_group/checkbox_group) has
        // already aggregated the new state by now, so uiStateSignal is correct.
        const parentController = uiStateController.parentUIStateController;
        if (
          parentController &&
          (parentController.controlType === "radio_group" ||
            parentController.controlType === "checkbox_group")
        ) {
          const parentEl = parentController.elementRef.current;
          if (parentEl) {
            const originalEvent = e.detail.eventChain[0];
            dispatchRequestAction(parentEl, {
              event: originalEvent,
              name: "auto_group_action",
              requester: e.detail.requester,
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
  const propKeySet = new Set(Object.keys(props));
  for (const key of propKeySet) {
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

const getAssociatedLabels = (element) => {
  if (!element) {
    return [];
  }
  // const closestPicker = element.closest('[navi-control="picker"]');
  // const insidePicker = closestPicker && element !== closestPicker;
  // const formElement = insidePicker ? closestPicker : element;
  const formElement = element;
  // Native form elements expose .labels directly
  if (formElement.labels && formElement.labels.length > 0) {
    return Array.from(formElement.labels);
  }
  const id = formElement.id;
  if (id) {
    const byId = Array.from(
      document.querySelectorAll(`label[for="${CSS.escape(id)}"]`),
    );
    if (byId.length > 0) {
      return byId;
    }
  }
  return [];
};
