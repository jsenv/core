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
  dispatchInternalCustomEvent,
  findFocusDelegateTarget,
  getElementSignature,
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
  dispatchRequestInteraction,
  onRequestAction,
  onRequestInteraction,
} from "@jsenv/navi/src/control/validation/custom_constraint_validation.js";
import {
  useDebugAction,
  useDebugCommand,
  useDebugFocus,
  useDebugInteraction,
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
import { useConstraintMessages } from "./validation/hooks/use_constraint_messages.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

// Sentinel used as the initial value of lastActionValueRef.
// Distinct from undefined so that undefined (e.g. unchecked radio) can itself
// be stored as a valid "last action value" and trigger the dedup logic.
const NO_ACTION_YET = Symbol("no_action_yet");

// Resets field-specific contexts so nested fields inside this component
// don't inherit the current field's id, message props, or interface reporting.
// Also cuts the parent state controller chain: children of a regular (leaf)
// field are custom UI — they should never register as form participants.
// A controlgroup is always enough: when a group (SelectableList, etc.) is
// present, the form gets the group's aggregated value; individual controls
// inside the group register to the group, not the form.
export const ControlChildrenWrapper = ({ children }) => (
  <ParentUIStateControllerContext.Provider value={null}>
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
 *   navi_action_ready, navi_action_abort, navi_action_error, navi_cancel, etc.)
 * - Resolves inherited context (disabled, readOnly, required, loading, fieldName)
 * - Handles constraint validation and message props
 *
 * All state changes route through DOM events on the field element so that
 * external subscribers (e.g. useUIState, Selectable) receive every update.
 *
 * @returns {Object} Props to spread onto the field's root/input element
 */
export const useControlProps = (
  props,
  {
    controlType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    allowNameless,
    persists,

    uiActionInternal,
    readOnlySupported,
  },
) => {
  const idDefault = useId();
  const debugInteraction = useDebugInteraction();
  const controlName = useContext(ControlNameContext);
  const controlId = useContext(ControlIdContext);
  const state = props[statePropName];

  props.name = props.name || controlName;
  props.id = props.id || controlId || idDefault;
  if (isSignal(state)) {
    props = {
      ...props,
      [statePropName]: state.value,
    };
  }
  const uiStateController = useUIStateController(props, controlType, {
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
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
    readOnlySupported,
  });

  interactions: {
    const {
      ref,
      actionInteraction,
      actionOnMouseDown = actionInteraction === "mousedown",
      actionAfterChange = actionInteraction === "change",
      actionDebounce,
    } = props;
    let isCheckable = false;

    const updateUIState = (e) => {
      const value = readControlValue(ref.current);
      uiStateController.setUIState(value, e);
    };

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
    const asInteraction = (interaction, e) => {
      const control = ref.current;
      const allowed = dispatchRequestInteraction(control, e, interaction.name);
      if (!allowed) {
        debugInteraction(
          e,
          `interaction not allowed -> ${e.type}.preventDefault()`,
        );
        e.preventDefault();
        return false;
      }
      interaction.effect?.(e);
      return true;
    };
    const lastEventRequestingActionRef = useRef();
    const lastActionValueRef = useRef(NO_ACTION_YET);
    const wasCheckedAtMousedownRef = useRef(false);
    // Keep lastActionValueRef in sync with state changes that happen outside of asAction
    // (e.g. radio_sibling_uncheck, or external programmatic set via navi_set_ui_state).
    // Otherwise the dedup below would wrongly skip a real user click that re-checks a radio
    // whose lastActionValueRef still matched a value from a previous interaction.
    //
    // For checkables (radio/checkbox): sync on any external state change — not just
    // radio_sibling_uncheck. When a programmatic set (e.g. --navi-unselect) unchecks a
    // radio, setUIState dispatches a synthetic input event. Without syncing here, asAction
    // would run again from that synthetic input and fire the action a second time.
    //
    // We do NOT sync when the change originated from the checkable's own user input event,
    // because at that point asAction hasn't run yet and we must not pre-empt its dedup.
    controlHostProps.onnavi_ui_state_change = (e) => {
      const originatingEvent = e.detail.event;
      if (isCheckable) {
        const sourceIsOwnInput =
          originatingEvent?.type === "input" &&
          originatingEvent?.target === ref.current;
        if (!sourceIsOwnInput) {
          lastActionValueRef.current = e.detail.value;
        }
      } else if (originatingEvent?.type === "radio_sibling_uncheck") {
        lastActionValueRef.current = e.detail.value;
      }
    };
    const asAction = (interaction, e, { ifValueModified }) => {
      if (actionInteraction === "custom") {
        return false;
      }
      const control = ref.current;
      const currentValue = readControlValue(control);
      if (ifValueModified) {
        // Ignore input events that carry the same value as the last action we dispatched.
        // This avoids showing a spurious "read-only" callout for redundant input events
        // that browsers fire with no UI change — e.g. range inputs fire several input
        // events around mouse release even though the value hasn't moved.
        const lastActionValue = lastActionValueRef.current;
        const valueSameAsLastAction =
          lastActionValue !== NO_ACTION_YET &&
          compareTwoJsValues(currentValue, lastActionValue);
        if (valueSameAsLastAction) {
          e.preventDefault();
          return false;
        }
      }
      lastEventRequestingActionRef.current = e;
      lastActionValueRef.current = currentValue;
      const allowed = dispatchRequestAction(control, {
        event: e,
        uiState: currentValue,
      });
      if (!allowed) {
        debugInteraction(e, `action not allowed -> ${e.type}.preventDefault()`);
        e.preventDefault();
        return false;
      }
      interaction.effect?.(e);
      return true;
    };

    const getDefaultInteractionDefinitions = () => {
      const keyDownDefault = () => {
        return {
          name: "keydown",
          type: "interaction",
        };
      };

      if (controlType === "button") {
        return {
          keyDown: keyDownDefault,
          mouseDown: () => {
            return {
              name: "mousedown",
              type: actionOnMouseDown ? "action" : "interaction",
            };
          },
          click: () => {
            return {
              name: "click",
              type: actionOnMouseDown ? "interaction" : "action",
              always: (e) => {
                const button = e.currentTarget;
                if (button.form) {
                  e.preventDefault(); // prevent form submission
                }
              },
            };
          },
        };
      }

      if (controlType === "input") {
        if (props.type === "radio" || props.type === "checkbox") {
          const isRadio = props.type === "radio";

          return {
            keyDown: (e) => {
              if (e.key === "Enter") {
                const inputEl = ref.current;
                const isRadio = props.type === "radio";
                const always = () => {
                  if (inputEl.form) {
                    e.preventDefault();
                  }
                };

                if (isRadio) {
                  return {
                    name: "enter to check radio",
                    effect: (e) => {
                      dispatchRequestSetUIState(inputEl, true, {
                        event: e,
                      });
                    },
                    always,
                  };
                }
                const checked = inputEl.checked;
                if (checked) {
                  return {
                    name: "enter to uncheck checkbox",
                    effect: (e) => {
                      dispatchRequestSetUIState(inputEl, undefined, {
                        event: e,
                      });
                    },
                    always,
                  };
                }
                return {
                  name: "enter to check",
                  effect: (e) => {
                    dispatchRequestSetUIState(inputEl, true, {
                      event: e,
                    });
                  },
                  always,
                };
              }
              if (isRadio && e.key === " ") {
                const inputEl = e.currentTarget;
                if (inputEl.checked) {
                  wasCheckedAtMousedownRef.current = true;
                  onClick(e);
                }
              }
              return keyDownDefault();
            },
            mouseDown: (e) => {
              if (isRadio) {
                wasCheckedAtMousedownRef.current = e.currentTarget.checked;
              }
            },
            // For checkables, click does NOT update state — it only gates the
            // browser's native check/uncheck via interaction constraints (e.g.
            // readOnly). State actually changes via the "input" event that the
            // browser fires right after, which routes through asAction so the
            // full action pipeline (constraints, navi_action_allowed, sibling
            // uncheck for radios…) runs in one place.
            click: () => {
              return {
                name: `click on ${props.type}`,
                type: "interaction",
                // When a radio is already checked and gets clicked, the browser does NOT
                // fire an input event (state doesn't change), so asAction never runs.
                // We still want uiAction + command to fire. We can tell whether the click
                // is on an already-checked radio by looking at wasCheckedAtMousedownRef:
                // if it was checked at mousedown, the input event won't come, so we do it here.
                effect: isRadio
                  ? (e) => {
                      if (wasCheckedAtMousedownRef.current) {
                        updateUIState(e);
                      }
                    }
                  : undefined,
              };
            },
            input: () => {
              return {
                name: "input",
                type: "action",
              };
            },
          };
        }

        const keyDownDefaultOnInput = (e) => {
          if (e.key === "Enter") {
            const input = e.currentTarget;
            return {
              name: "enter to --navi-send",
              effect: () => {
                triggerNaviCommand(input, "--navi-send", e);
              },
            };
          }
          return keyDownDefault();
        };

        if (props.type === "range") {
          return {
            keyDown: keyDownDefaultOnInput,
            mouseDown: () => {
              return {
                name: "mousedown",
                type: "interaction",
                effect: updateUIState,
              };
            },
            input: {
              name: "input",
              type: "interaction",
              effect: updateUIState,
            },
            naviChange: () => {
              return {
                name: "navi_change",
                type: "action",
              };
            },
          };
        }

        return {
          keyDown: keyDownDefaultOnInput,
          input: () => {
            return {
              name: "input",
              type: "interaction",
              effect: updateUIState,
            };
          },
          naviChange: () => {
            return {
              name: "navi_change",
              type: "action",
            };
          },
        };
      }

      if (controlType === "picker") {
        return {
          input: () => {
            return {
              name: "input",
              type: "interaction",
              effect: updateUIState,
            };
          },
          naviChange: () => {
            return {
              name: "navi_change",
              type: "action",
            };
          },
        };
      }

      return null;
    };

    const defaultInteractionDefinitions = getDefaultInteractionDefinitions();
    const { interactionDefinitions } = props;
    const applyInteraction = (interactionName, e, { ifValueModified } = {}) => {
      const defaultInteractionDefinition =
        defaultInteractionDefinitions?.[interactionName];
      const customInteractionDefinition =
        interactionDefinitions?.[interactionName];
      const interaction =
        customInteractionDefinition?.(e) ?? defaultInteractionDefinition?.(e);
      if (!interaction) {
        return false;
      }
      const { name, effect, type = "interaction", always } = interaction;
      const dispatchFn = type === "action" ? asAction : asInteraction;
      const applied = dispatchFn({ name, effect }, e, { ifValueModified });
      always?.(e);
      return applied;
    };
    const onMouseDown = (e) => {
      props.onMouseDown?.(e);
      applyInteraction("mouseDown", e);
      transferFocusToTarget(e);
    };
    const onClick = (e) => {
      props.onClick?.(e);
      applyInteraction("click", e);
      transferFocusToTarget(e);
    };
    const onKeyDown = (e) => {
      props.onKeyDown?.(e);
      applyInteraction("keyDown", e);
    };
    const onInput = (e) => {
      props.onInput?.(e);
      applyInteraction("input", e, { ifValueModified: true });
    };
    // a custom concept being combination of "input", "change" and may other events
    // this even if trigerred when value changes and can be controlled by actionDebounce and actionAfterChange
    const hasNaviChangeInteractionDefinition = Boolean(
      interactionDefinitions?.naviChange ||
      defaultInteractionDefinitions?.naviChange,
    );
    const refCallback = useCallback(
      (field) => {
        if (
          !hasNaviChangeInteractionDefinition ||
          actionInteraction === "custom"
        ) {
          return undefined;
        }
        return addInputEffect(
          field,
          (e) => {
            applyInteraction("naviChange", e, {
              ifValueModified: true,
            });
          },
          {
            waitForChange: actionAfterChange,
            debounce: actionDebounce,
            debugInteraction,
          },
        );
      },
      [
        actionInteraction,
        actionAfterChange,
        actionDebounce,
        hasNaviChangeInteractionDefinition,
      ],
    );
    const refComposed = useComposeElementRef(refCallback, ref);
    const onPaste = (e) => {
      props.onPaste?.(e);
      const allowed = dispatchRequestInteraction(ref.current, e);
      if (!allowed) {
        e.preventDefault();
      }
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

  return [controlRootProps, controlHostProps, uiStateController];
};

/**
 * Core hook for field group components (SelectableList, CheckboxList, etc.).
 * - Creates a UI group state controller that aggregates child states into one group state
 * - Binds the group's action to the aggregated state signal
 * - Provides context to children: ParentUIStateController, FieldName, Disabled, ReadOnly,
 *   Required, Loading, Action, ActionRequester
 * - Overrides `onnavi_reset_ui_state` to cascade resets to all monitored children
 *   by dispatching `navi_reset_ui_state` DOM events on each child's DOM element
 * - Overrides `onnavi_action_ready` to track the action requester
 *
 * @param {{ controlType: string, childControlType: string, aggregateChildStates: Function }} config
 * @returns {Object} Props to spread onto the group's root element
 */
export const useControlgroupProps = (
  props,
  {
    controlType,
    stateType,
    childControlFilter,
    aggregateChildStates,
    wantRequesterButtonState,
    uiActionInternal,
  },
) => {
  const { ref, action } = props;
  const uiGroupStateController = useUIGroupStateController(props, controlType, {
    stateType,
    childControlFilter,
    aggregateChildStates,
    wantRequesterButtonState,
    uiActionInternal,
  });

  const [boundAction] = useActionBoundToOneParam(
    action,
    uiGroupStateController.uiStateSignal,
  );
  const [actionRequester, setActionRequester] = useState();
  const [controlRootProps, controlgroupProps] = useInteractiveProps(props, {
    uiStateController: uiGroupStateController,
    boundAction,
    // Group state is set before dispatching navi_ui_state_change → dispatchRequestAction,
    // so onnavi_action_allowed must not call dispatchRequestSetUIState again (it would
    // re-trigger uiAction + command a second time).
    skipSetUIStateOnActionAllowed: true,
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

  // Auto-trigger the group action when a checkable child (radio/checkbox) changes.
  // For other inputs (text, range…) the action must be triggered explicitly via
  // a submit button or Enter — same as a regular form field.
  if (
    action &&
    (controlType === "radio_group" || controlType === "checkbox_group")
  ) {
    controlgroupProps.onnavi_ui_state_change = (e) => {
      const el = ref.current;
      if (el) {
        dispatchRequestAction(el, {
          event: e.detail.event,
          uiState: e.detail.value,
        });
      }
    };
  }

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
  const [controlRootProps, controlHostProps, uiStateController] =
    useControlProps(props, options);
  const facadeController = useUIFacadeStateController(props, uiStateController);
  return [controlRootProps, controlHostProps, { value: facadeController }];
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
export const ControlFacadeChildrenWrapper = ({ children, value }) => (
  <ParentUIStateControllerContext.Provider value={value}>
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
  {
    uiStateController,
    boundAction,
    readOnlySupported,
    skipSetUIStateOnActionAllowed,
  },
) => {
  const { ref } = props;
  const controlHostProps = {
    ref,
    "navi-control-host": "",
  };
  let controlRootProps = {
    "navi-control": uiStateController.controlType,
  };
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
  const actionStatus = useActionStatus(boundAction);
  const controlDisabled = useContext(DisabledContext);
  const controlReadOnly = useContext(ReadOnlyContext);
  const controlRequired = useContext(RequiredContext);
  const controlLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);
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
  form_props: {
    const {
      id,
      "navi-control-proxy-for": naviProxyFor,
      name,
      type,
      disabled,
      required,
      readOnly,
      loading,
    } = props;
    const disabledResolved = disabled || controlDisabled;
    const requiredResolved = required || controlRequired;
    const loadingResolved =
      loading ||
      actionStatus.loading ||
      (controlLoading && parentActionRequester === ref.current);
    const readOnlyResolved =
      readOnly ||
      controlReadOnly ||
      loadingResolved ||
      uiStateController.readOnly;
    Object.assign(controlHostProps, {
      id,
      "navi-control-proxy-for": naviProxyFor,
      name,
      type,
      "required": requiredResolved,
      "disabled": disabledResolved,
      "aria-busy": loadingResolved,
      "basePseudoState": {
        ":disabled": disabledResolved,
        ":read-only": readOnlyResolved,
        ":-navi-loading": loadingResolved,
        ...props.basePseudoState,
      },
    });
    if (readOnlySupported) {
      controlHostProps.readOnly = readOnlyResolved;
    } else {
      controlHostProps["aria-readonly"] = readOnlyResolved;
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
      for (const label of labels) {
        label.dispatchEvent(
          new CustomEvent("navi_control_state", {
            detail: {
              disabled: disabledResolved,
              readOnly: readOnlyResolved,
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

    const { constraints } = controlHostProps;
    useConstraints(ref, constraints);
    controlRootProps = useConstraintMessages(ref, controlRootProps);
  }
  ui_state_and_value: {
    const uiState = uiStateController.uiStateSignal.value;
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
        e.detail.respondWith(uiStateController.uiStateSignal.peek());
      },
      onnavi_set_ui_state: (e) => {
        uiStateController.setUIState(e.detail.value, e);
      },
      onnavi_request_check: (e) => {
        if (isCheckable) {
          uiStateController.setUIState(true, e);
        }
      },
      onnavi_request_uncheck: (e) => {
        if (isCheckable) {
          uiStateController.setUIState(false, e);
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

    const { statePropName } = uiStateController;
    if (statePropName) {
      const statePropValueRaw = uiStateController.getPropFromState(uiState);
      const statePropValueDom =
        uiStateController.toControlHostValue(statePropValueRaw);
      controlHostProps[statePropName] = statePropValueDom;
      if (statePropName === "checked") {
        const { value } = props;
        controlHostProps.value = value;
      }
    }
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
      onnavi_request_action: (e) => {
        let uiState;
        if (Object.hasOwn(e.detail, "uiState")) {
          // uiState was forwarded by a proxy — use it directly to avoid
          // re-computing from the element's own state (which may already reflect
          // the optimistic update and return undefined for radio)
          uiState = e.detail.uiState;
        } else {
          dispatchInternalCustomEvent(e.currentTarget, "navi_get_ui_state", {
            respondWith: (v) => {
              debugAction(
                e,
                `navi_get_ui_state.respondWith(${JSON.stringify(v)})`,
              );
              uiState = v;
            },
          });
          // If this is a form submit and the requester is a named button, ensure
          // its value wins over any other button sharing the same name.
          // Native browser behavior: only the clicked/activated submit button
          // contributes its name+value to form data.
          const { requester } = e.detail;
          if (
            uiStateController.wantRequesterButtonState &&
            requester.tagName === "BUTTON" &&
            requester.name &&
            requester !== e.currentTarget
          ) {
            const requesterUIState = getUIStateFromElement(requester);
            const requesterValue =
              requesterUIState !== undefined
                ? requesterUIState
                : requester.value;
            uiState = { ...uiState, [requester.name]: requesterValue };
          }
          e.detail.uiState = uiState;
        }
        const naviProxyTarget = findControlProxyTarget(e.currentTarget);
        if (naviProxyTarget) {
          // Apply the proxy's desired uiState optimistically before dispatching so
          // the target's UI updates immediately, then forward the action.
          // uiState is included explicitly so the target's onnavi_request_action
          // can detect it via Object.hasOwn and skip re-computing from its own
          // navi_request_ui_state (which would return undefined for an already-set radio).
          debugAction(
            e,
            `${getElementSignature(naviProxyTarget)}.dispatchEvent("navi_set_ui_state", ${JSON.stringify(uiState)})`,
          );
          dispatchRequestSetUIState(naviProxyTarget, uiState, { event: e });
          return;
        }
        if (e.detail.action) {
          // keyboard shortcut give the action and action is irrelevant here, the kayboard shortcut must win
        } else {
          e.detail.actionOrigin = "action_prop";
          e.detail.action = boundAction;
        }
        onRequestAction(e, { debugAction });
      },
      onnavi_action_prevented: onActionPrevented,
      onnavi_action_allowed: (e) => {
        if (e.detail.action === "auto") {
          // special case for the use case where form.submit is called
          e.detail.action = boundAction;
        }
        const { uiState } = e.detail;
        if (!skipSetUIStateOnActionAllowed) {
          // For leaf controls: set the UI state optimistically before executing the action.
          // For groups: state is already set by the group's setUIState (which ran before
          // dispatching navi_ui_state_change → dispatchRequestAction), so we skip this
          // to avoid calling uiAction + command a second time.
          dispatchRequestSetUIState(e.currentTarget, uiState, {
            event: e,
          });
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
        if (resetOnError) {
          dispatchRequestResetUIState(e.currentTarget, e);
        }
        onActionError?.(error, e);
      },
      onnavi_action_end: (e) => {
        const { data } = e.detail;
        uiStateController.actionEnd(e);
        debugAction(e, `action end with data: ${JSON.stringify(data)}`);
        onActionEnd?.(data, e);
        controlRootProps.onnavi_action_end?.(e);
      },
    });
  }

  return [controlRootProps, controlHostProps];
};

const getAssociatedLabels = (element) => {
  if (!element) {
    return [];
  }
  const closestPicker = element.closest('[navi-control="picker"]');
  const insidePicker = closestPicker && element !== closestPicker;
  const formElement = insidePicker ? closestPicker : element;
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
