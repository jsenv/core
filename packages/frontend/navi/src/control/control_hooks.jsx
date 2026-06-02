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
  useDebugFocus,
  useDebugInteraction,
} from "@jsenv/navi/src/navi_debug.jsx";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { isSignal } from "@jsenv/navi/src/utils/is_signal.js";
import {
  ActionContext,
  ActionRequesterContext,
  ControlNameContext,
  ControlToInterfaceContext,
  DisabledContext,
  LoadingContext,
  MessagePropsRefContext,
  ReadOnlyContext,
  RequiredContext,
} from "./control_context.js";
import { findControlProxyTarget } from "./control_proxy.js";
import { readControlValue } from "./control_value.js";
import { addInputEffect } from "./input_effect.js";
import { resolveActionProp } from "./string_actions.js";
import {
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
  ParentUIStateControllerContext,
  useUIGroupStateController,
  useUIStateController,
} from "./ui_state_controller.js";
import { useConstraintMessages } from "./validation/hooks/use_constraint_messages.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

// Resets field-specific contexts so nested fields inside this component
// don't inherit the current field's id, message props, or interface reporting.
const ControlChildrenWrapper = ({ children }) => (
  <MessagePropsRefContext.Provider value={undefined}>
    <ControlToInterfaceContext.Provider value={undefined}>
      {children}
    </ControlToInterfaceContext.Provider>
  </MessagePropsRefContext.Provider>
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
    <ControlToInterfaceContext.Provider value={undefined}>
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
    </ControlToInterfaceContext.Provider>
  </MessagePropsRefContext.Provider>
);

/**
 * Core hook for interactive field components (InputText, InputCheckbox, etc.).
 *
 * Sets up the full field lifecycle:
 * - Creates a UI state controller that manages state divergence between props and user interactions
 * - Binds the field's action to its current UI state via a signal
 * - Wires up all DOM event handlers (navi_set_ui_state, navi_request_reset_ui_state,
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
    picker,
  },
) => {
  const debugInteraction = useDebugInteraction();
  const controlName = useContext(ControlNameContext);
  const state = props[statePropName];
  if (isSignal(state)) {
    props = {
      ...props,
      [statePropName]: state.value,
    };
  }
  if (!props.name && controlName) {
    props.name = controlName;
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
    debugInteraction,
    uiActionInternal,
  });
  const [boundAction] = useActionBoundToOneParam(
    resolveActionProp(props.action),
    uiStateController.uiStateSignal,
  );
  const [controlProps, remainingProps, ControlChildrenWrapper] =
    useInteractiveProps(props, {
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
    // Effect to run when the Enter key is pressed.
    // For most inputs Enter submits the surrounding form; for checkables Enter
    // synthesizes a click so the browser's native checkbox/radio activation runs
    // (which then fires input -> goes through the action pipeline).
    let enterEffect;

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
        debugInteraction(e, `${e.type}.preventDefault()`);
        e.preventDefault();
        return false;
      }
      interaction.effect?.(e);
      return true;
    };
    const asBrowserAction = (interaction, e) => {
      return asInteraction(interaction, e);
    };
    const lastEventRequestingActionRef = useRef();
    const lastActionValueRef = useRef();
    // Keep lastActionValueRef in sync with state changes that happen outside of asAction
    // (e.g. radio_sibling_uncheck when another radio in the group becomes checked).
    // Otherwise the dedup below would wrongly skip a real user click that re-checks a radio
    // whose lastActionValueRef still matched a value from a previous interaction.
    controlProps.onnavi_ui_state_change = (e) => {
      lastActionValueRef.current = e.detail.value;
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
          lastActionValue !== undefined &&
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
        debugInteraction(e, `${e.type}.preventDefault()`);
        e.preventDefault();
        return false;
      }
      interaction.effect?.(e);
      return true;
    };
    const applyInteraction = (interaction, e, { ifValueModified } = {}) => {
      if (!interaction) {
        return false;
      }
      return interaction.callback(interaction, e, { ifValueModified });
    };

    let mousedownInteraction;
    let clickInteraction;
    let inputInteraction;
    let keydownInteraction = {
      name: "keydown",
      effect: asBrowserAction,
    };
    // a custom concept being combination of "input", "change" and may other events
    // this even if trigerred when value changes and can be controlled by actionDebounce and actionAfterChange
    let naviChangeInteraction;
    if (controlType === "button") {
      mousedownInteraction = {
        name: "mousedown",
        callback: actionOnMouseDown ? asAction : asInteraction,
      };
      clickInteraction = {
        name: "click",
        callback: actionOnMouseDown ? asInteraction : asAction,
      };
    } else if (controlType === "input") {
      isCheckable = props.type === "radio" || props.type === "checkbox";
      // on input we just check if we can do stuff (readonly)
      inputInteraction = {
        name: "input",
        callback: asInteraction,
        effect: updateUIState,
      };
      naviChangeInteraction = {
        name: "navi_change",
        callback: asAction,
      };
      enterEffect = (e) => resolveActionProp("submit")(e);
      if (picker) {
        mousedownInteraction = {
          name: "mousedown to open picker",
          callback: asInteraction,
        };
        clickInteraction = {
          name: "click to open picker",
          callback: asInteraction,
        };
      }
      if (isCheckable) {
        // For checkables, click does NOT update state — it only gates the
        // browser's native check/uncheck via interaction constraints (e.g.
        // readOnly). State actually changes via the "input" event that the
        // browser fires right after, which routes through asAction so the
        // full action pipeline (constraints, navi_action_allowed, sibling
        // uncheck for radios…) runs in one place.
        clickInteraction = {
          name: "click",
          callback: asBrowserAction,
        };
        inputInteraction = {
          name: "input",
          callback: asAction,
        };
        naviChangeInteraction = undefined;
        enterEffect = (e) => e.currentTarget.click();
      } else if (props.type === "range") {
        mousedownInteraction = {
          name: "mousedown",
          callback: asBrowserAction,
        };
      } else if (props.type === "color") {
        // inputInteraction.effect = undefined;
      }
    }

    const onMouseDown = (e) => {
      props.onMouseDown?.(e);
      applyInteraction(mousedownInteraction, e);
      transferFocusToTarget(e);
    };
    const onClick = (e) => {
      props.onClick?.(e);
      applyInteraction(clickInteraction, e);
      transferFocusToTarget(e);
    };
    const onKeyDown = (e) => {
      props.onKeyDown?.(e);
      if (e.key === "Enter" && enterEffect) {
        enterEffect(e);
        return;
      }
      applyInteraction(keydownInteraction, e);
    };
    const onInput = (e) => {
      props.onInput?.(e);
      applyInteraction(inputInteraction, e, { ifValueModified: true });
    };
    const hasNaviChangeInteraction = Boolean(naviChangeInteraction);
    const refCallback = useCallback(
      (field) => {
        if (!hasNaviChangeInteraction || actionInteraction === "custom") {
          return undefined;
        }
        return addInputEffect(
          field,
          (e) => {
            applyInteraction(naviChangeInteraction, e, {
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
        hasNaviChangeInteraction,
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
    Object.assign(controlProps, {
      ref: refComposed,
      onMouseDown,
      onClick,
      onKeyDown,
      onPaste,
      onInput,
    });
  }

  return [controlProps, remainingProps, ControlChildrenWrapper];
};

/**
 * Core hook for field group components (SelectableList, CheckboxList, etc.).
 *
 * Coordinates a collection of child fields:
 * - Creates a UI group state controller that aggregates child states into one group state
 * - Binds the group's action to the aggregated state signal
 * - Provides context to children: ParentUIStateController, FieldName, Disabled, ReadOnly,
 *   Required, Loading, Action, ActionRequester
 * - Overrides `onnavi_request_reset_ui_state` to cascade resets to all monitored children
 *   by dispatching `navi_request_reset_ui_state` DOM events on each child's DOM element
 * - Overrides `onnavi_action_ready` to track the action requester
 *
 * @param {{ controlType: string, childControlType: string, aggregateChildStates: Function }} config
 * @returns {Object} Props to spread onto the group's root element
 */
export const useControlgroupProps = (
  props,
  { stateType, controlType, childControlFilter, aggregateChildStates },
) => {
  const { action } = props;
  const debugAction = useDebugAction();
  const uiGroupStateController = useUIGroupStateController(props, controlType, {
    stateType,
    childControlFilter,
    aggregateChildStates,
    debugAction,
  });
  const [boundAction] = useActionBoundToOneParam(
    resolveActionProp(action),
    uiGroupStateController.uiStateSignal,
  );
  const [actionRequester, setActionRequester] = useState();
  const [controlgroupProps, remainingProps] = useInteractiveProps(props, {
    uiStateController: uiGroupStateController,
    boundAction,
  });

  const { basePseudoState } = controlgroupProps;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];

  const childrenWrapperProps = useMemo(
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
    {
      ...controlgroupProps,
      name: undefined, // useful to children, not the the group itself
      required: undefined, // useful to children, not the the group itself
      onnavi_action_allowed: (e) => {
        setActionRequester(e.detail.requester);
        controlgroupProps.onnavi_action_allowed(e);
      },
    },
    remainingProps,
    childrenWrapperProps,
    uiGroupStateController,
  ];
};

const controlPropSet = new Set([
  "ref",
  "action",
  "actionInteraction",
  "actionAfterChange",
  "actionOnMouseDown",
  "actionDebounce",
  "children",

  "id",
  "name",
  "type",
  "value",
  "defaultValue",
  "navi-control-proxy-for",
  "checked",
  "defaultChecked",

  "disabled",
  "readOnly",
  "required",
  "loading",
  "basePseudoState",
  "constraints",

  "autoFocus",
  "autoFocusVisible",
  "autoSelect",

  "onMouseDown",
  "onClick",
  "onKeyDown",
  "onPaste",
  "onInput",

  "onCancel",
  "cancelOnBlurInvalid",
  "cancelOnEscape",
  "onActionPrevented",
  "onActionStart",
  "onActionAborted",
  "onActionError",
  "actionErrorEffect",
  "errorMapping",
  "onActionEnd",

  "resetOnCancel",
  "resetOnAbort",
  "resetOnError",
]);
const useInteractiveProps = (
  props,
  { uiStateController, boundAction, readOnlySupported },
) => {
  const { ref } = props;
  const controlProps = {
    ref,
    "navi-control-host": "",
  };
  let remainingProps = {
    "navi-control": uiStateController.controlType,
  };
  const propKeySet = new Set(Object.keys(props));
  for (const key of propKeySet) {
    if (controlPropSet.has(key)) {
    } else {
      remainingProps[key] = props[key];
    }
  }
  const actionStatus = useActionStatus(boundAction);
  const controlToInterfaceContext = useContext(ControlToInterfaceContext);
  const controlDisabled = useContext(DisabledContext);
  const controlReadOnly = useContext(ReadOnlyContext);
  const controlRequired = useContext(RequiredContext);
  const controlLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);
  const debugAction = useDebugAction();
  const debugInteraction = useDebugInteraction();
  const debugFocus = useDebugFocus();

  autofocus: {
    const { autoFocus, autoFocusVisible, autoSelect } = props;
    useAutoFocus(ref, autoFocus, {
      focusVisible: autoFocusVisible,
      autoSelect,
    });
    Object.assign(controlProps, {
      "navi-autofocus": autoFocus ? "" : undefined,
    });
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
    const idResolved = id || controlToInterfaceContext?.id;
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
    Object.assign(controlProps, {
      "id": idResolved,
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
      controlProps.readOnly = readOnlyResolved;
    } else {
      controlProps["aria-readonly"] = readOnlyResolved;
    }
    // infom any <Field> parent of our readOnly state + that we are interactive
    useLayoutEffect(() => {
      if (controlToInterfaceContext) {
        controlToInterfaceContext.setInteractive(true);
        controlToInterfaceContext.setDisabled(disabledResolved);
        controlToInterfaceContext.setReadOnly(readOnlyResolved);
      }
    }, [controlToInterfaceContext, disabledResolved, readOnlyResolved]);

    const { constraints } = controlProps;
    useConstraints(ref, constraints);
    remainingProps = useConstraintMessages(ref, remainingProps);
  }
  ui_state_and_value: {
    const uiState = uiStateController.uiStateSignal.value;
    Object.assign(controlProps, {
      // for some input navi-ui-state differs (like color where ui-state would be "" while value would be "#000000")
      "navi-ui-state": uiState,
      "onnavi_request_reset_ui_state": (e) => {
        uiStateController.resetUIState(e);
      },
      "onnavi_get_ui_state": (e) => {
        e.detail.respondWith(uiStateController.uiStateSignal.peek());
      },
      "onnavi_set_ui_state": (e) => {
        uiStateController.setUIState(e.detail.value, e);
      },
    });

    const { statePropName } = uiStateController;
    if (statePropName) {
      const statePropValueRaw = uiStateController.getPropFromState(uiState);
      controlProps[statePropName] = statePropValueRaw;
      if (statePropName === "checked") {
        const { value } = props;
        controlProps.value = value;
      }
    }
  }
  children_prop: {
    const { children } = props;
    // Children are returned raw so callers decide how to wrap them.
    // Use the returned ChildrenContextWrapper to reset field-specific contexts
    // (MessagePropsRef, ControlToInterface) around the content you render.
    Object.assign(controlProps, { children });
  }
  action_props: {
    const { action, actionErrorEffect, errorMapping } = props;
    const executeAction = useExecuteAction(ref, {
      errorEffect: actionErrorEffect,
      errorMapping,
    });
    const dataAction =
      action === undefined
        ? undefined
        : typeof action === "string"
          ? action
          : boundAction.callSource;
    Object.assign(controlProps, {
      "data-action": dataAction,
    });
    Object.assign(remainingProps, {
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
    Object.assign(controlProps, {
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
        dispatchRequestSetUIState(e.currentTarget, uiState, {
          event: e,
        });
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
        remainingProps.onnavi_action_end?.(e);
      },
    });
  }

  return [controlProps, remainingProps, ControlChildrenWrapper];
};
