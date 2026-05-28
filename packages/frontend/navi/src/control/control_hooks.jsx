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
  findEvent,
  getElementSignature,
} from "@jsenv/dom";
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useComposeElementRef } from "@jsenv/navi/src/box/use_element_ref.js";
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
import { getControlProxyTarget } from "./control_dom.js";
import { addInputEffect } from "./input_effect.js";
import { resolveActionProp, STRING_ACTIONS } from "./string_actions.js";
import {
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
  ParentUIStateControllerContext,
  useUIGroupStateController,
  useUIStateController,
} from "./ui_state_controller.js";
import { useConstraintMessages } from "./validation/hooks/use_constraint_messages.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

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
    primaryInteractionMode, // "pointer", "keyboard"
    controlType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    allowNameless,
    persists,

    getUIValue,
    uiActionInternal,
    paramsSignal,
    externalBoundAction,
    readOnlySupported,
  },
) => {
  const debugInteraction = useDebugInteraction();
  const state = props[statePropName];
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
    debugInteraction,
    uiActionInternal,
  });

  paramsSignal = paramsSignal || uiStateController.uiStateSignal;
  const [internalBoundAction] = useActionBoundToOneParam(
    externalBoundAction ? undefined : resolveActionProp(props.action),
    paramsSignal,
  );
  const boundAction = externalBoundAction || internalBoundAction;
  const [controlProps, remainingProps] = useInteractiveProps(props, {
    readOnlySupported,
    boundAction,
    uiStateController,
    getUIValue,
  });

  interactions: {
    const { ref } = props;
    const hasPointerDownInteraction = controlType === "input_range";
    const onMouseDown = (e) => {
      props.onMouseDown?.(e);
      if (primaryInteractionMode === "pointer") {
        const field = ref.current;
        const allowed = dispatchRequestInteraction(
          field,
          e,
          "mousedown to interact with input",
        );
        if (hasPointerDownInteraction && !allowed) {
          e.preventDefault();
        }
      }
    };
    const onClick = (e) => {
      props.onClick?.(e);
      if (primaryInteractionMode === "pointer") {
        const field = ref.current;
        if (hasPointerDownInteraction) {
          // click on range input does nothing if interaction is not allowed, so we can just ignore it here
          return;
        }
        const allowed = dispatchRequestInteraction(
          field,
          e,
          "click to interact with input",
        );
        if (!allowed) {
          // Here we want to prevent:
          // - toggle of radio/checkbox on click
          debugInteraction(e, "click.preventDefault()");
          e.preventDefault();
        }
      }
    };
    const onKeyDown = (e) => {
      props.onKeyDown?.(e);
      if (e.key === "Enter") {
        STRING_ACTIONS.submit(e);
        return;
      }
      const input = e.currentTarget;
      const allowed = dispatchRequestInteraction(
        input,
        e,
        "keydown to interact with field",
      );
      if (!allowed) {
        // Here we want to prevent
        // - space to toggle radio/checkbox
        // - space to scroll scrollable container (usually document)
        // - any keyboard interaction that would affect input value
        // or would not make sense on a readonly field
        debugInteraction(e, "keydown.preventDefault()");
        e.preventDefault();
      }
    };
    const onPaste = (e) => {
      props.onPaste?.(e);
      const allowed = dispatchRequestInteraction(ref.current, e);
      if (!allowed) {
        e.preventDefault();
      }
    };
    const {
      actionInteraction = "input",
      actionAfterChange = actionInteraction === "change",
      actionDebounce,
    } = props;
    const lastEventRequestingActionRef = useRef();
    const lastActionValueRef = useRef();
    const onInput = (e) => {
      props.onInput?.(e);
      if (!e.isTrusted) {
        return;
      }
      const field = ref.current;
      const eventSameAsAction = e === lastEventRequestingActionRef.current;
      // Ignore input events that carry the same value as the last action we dispatched.
      // This avoids showing a spurious "read-only" callout for redundant input events
      // that browsers fire with no UI change — e.g. range inputs fire several input
      // events around mouse release even though the value hasn't moved.
      const valueSameAsLastAction =
        lastActionValueRef.current !== undefined &&
        e.currentTarget.value === lastActionValueRef.current;
      const allowed =
        eventSameAsAction ||
        valueSameAsLastAction ||
        dispatchRequestInteraction(field, e);
      if (allowed) {
        uiStateController.requestUIAction(e);
      } else {
        e.preventDefault();
      }
    };
    const refCallback = useCallback(
      (input) => {
        if (actionInteraction === "manual") {
          return undefined;
        }
        return addInputEffect(
          input,
          (e) => {
            lastEventRequestingActionRef.current = e;
            lastActionValueRef.current = input.value;
            dispatchRequestAction(input, { event: e });
          },
          {
            waitForChange: actionAfterChange,
            debounce: actionDebounce,
            debugInteraction,
          },
        );
      },
      [actionInteraction, actionAfterChange, actionDebounce],
    );
    const refComposed = useComposeElementRef(refCallback, ref);
    Object.assign(controlProps, {
      ref: refComposed,
      onMouseDown,
      onClick,
      onKeyDown,
      onPaste,
      onInput,
    });
  }

  return [controlProps, remainingProps];
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
 * @param {{ controlType: string, childComponentType: string, aggregateChildStates: Function }} config
 * @returns {Object} Props to spread onto the group's root element
 */
export const useControlgroupProps = (
  props,
  { controlType, childComponentType, aggregateChildStates },
) => {
  const { action } = props;
  const debugAction = useDebugAction();
  const uiGroupStateController = useUIGroupStateController(props, controlType, {
    childComponentType,
    aggregateChildStates,
    debugAction,
  });
  const [boundAction] = useActionBoundToOneParam(
    resolveActionProp(action),
    uiGroupStateController.uiStateSignal,
  );
  const [actionRequester, setActionRequester] = useState();
  const [actionProps, remainingProps] = useInteractiveProps(props, {
    boundAction,
    uiStateController: uiGroupStateController,
    getUIValue: () => {
      return uiGroupStateController.uiStateSignal.peek();
    },
  });
  let childrenWithContext;
  if (actionProps.children === undefined) {
    childrenWithContext = undefined;
  } else {
    const { basePseudoState } = actionProps;
    const disabled = basePseudoState[":disabled"];
    const readOnly = basePseudoState[":read-only"];
    const loading = basePseudoState[":-navi-loading"];

    childrenWithContext = (
      <ParentUIStateControllerContext.Provider value={uiGroupStateController}>
        <ControlNameContext.Provider value={actionProps.name}>
          <DisabledContext.Provider value={disabled}>
            <ReadOnlyContext.Provider value={readOnly}>
              <RequiredContext.Provider value={actionProps.required}>
                <LoadingContext.Provider value={loading}>
                  <ActionContext.Provider value={boundAction}>
                    <ActionRequesterContext.Provider value={actionRequester}>
                      {actionProps.children}
                    </ActionRequesterContext.Provider>
                  </ActionContext.Provider>
                </LoadingContext.Provider>
              </RequiredContext.Provider>
            </ReadOnlyContext.Provider>
          </DisabledContext.Provider>
        </ControlNameContext.Provider>
      </ParentUIStateControllerContext.Provider>
    );
  }
  return [
    {
      ...actionProps,
      name: undefined, // useful to children, not the the group itself
      required: undefined, // useful to children, not the the group itself
      children: childrenWithContext,
      onnavi_action_allowed: (e) => {
        setActionRequester(e.detail.requester);
        actionProps.onnavi_action_allowed(e);
      },
    },
    remainingProps,
  ];
};

const controlPropSet = new Set([
  "ref",
  "action",
  "actionAfterChange",
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
  { readOnlySupported, boundAction, uiStateController, getUIValue },
) => {
  const controlProps = {};
  let remainingProps = {};
  const propKeySet = new Set(Object.keys(props));
  for (const key of propKeySet) {
    if (controlPropSet.has(key)) {
    } else {
      remainingProps[key] = props[key];
    }
  }

  const actionStatus = useActionStatus(boundAction);
  const controlToInterfaceContext = useContext(ControlToInterfaceContext);
  const controlName = useContext(ControlNameContext);
  const controlDisabled = useContext(DisabledContext);
  const controlReadOnly = useContext(ReadOnlyContext);
  const controlRequired = useContext(RequiredContext);
  const controlLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);
  const debugAction = useDebugAction();
  const debugInteraction = useDebugInteraction();
  const debugFocus = useDebugFocus();

  const { ref } = props;
  Object.assign(controlProps, { ref });

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
    const nameResolved = name || controlName;
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
      "name": nameResolved,
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
        e.detail.respondWith(uiState);
      },
      "onnavi_get_ui_value": (e) => {
        e.detail.respondWith(getUIValue(e));
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
    let childrenWithContext;
    if (children === undefined) {
      childrenWithContext = undefined;
    } else {
      /**
       * We are a field ourselve, which can contain other fields that should not inherit some of the context:
       * - id was used by this field, no other field use it
       * - message props are not meant to be propagated either, they are specific to a given field
       * - readonly/required reporting is specific to this field interface. No other field interface should be able to report to parent
       */
      childrenWithContext = (
        <MessagePropsRefContext.Provider value={undefined}>
          <ControlToInterfaceContext.Provider value={undefined}>
            {children}
          </ControlToInterfaceContext.Provider>
        </MessagePropsRefContext.Provider>
      );
    }
    Object.assign(controlProps, {
      children: childrenWithContext,
    });
  }
  action_props: {
    const { action, actionErrorEffect, errorMapping } = props;
    const executeAction = useExecuteAction(ref, {
      errorEffect: actionErrorEffect,
      errorMapping,
    });
    Object.assign(controlProps, {
      "data-action":
        action === undefined
          ? undefined
          : typeof action === "string"
            ? action
            : boundAction.callSource,
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
      onnavi_request_interaction: (e) => {
        transfer_focus_to_target: {
          const naviProxyTarget = getControlProxyTarget(e.currentTarget);
          if (!naviProxyTarget) {
            break transfer_focus_to_target;
          }
          const mousedownEvent = findEvent(e, "mousedown");
          if (mousedownEvent) {
            if (mousedownEvent.defaultPrevented) {
              // not really used but any code calling preventDefault can also prevent navi custom behaviors
              break transfer_focus_to_target;
            }
            debugFocus(
              e,
              `move focus to proxy (mousedown.preventDefault() + ${getElementSignature(naviProxyTarget)}.focus({ focusVisible: false })`,
            );
            mousedownEvent.preventDefault();
            naviProxyTarget.focus({ focusVisible: false });
            break transfer_focus_to_target;
          }
          // We also transfer on click even if mousedown is there because:
          // - it's possible to receive a click without a mousedown (<label>)
          // - so it's possible to end up focused by the browser without having a chance to preventDefault on the mousedown
          // -> We do it also on click
          // No need to preventDefault here though
          // -> This ensure browser don't complain we try to focus a aria-hidden element
          // and ensure the focus ends up where it should
          const clickEvent = findEvent(e, "click");
          if (clickEvent) {
            if (clickEvent.defaultPrevented) {
              // not really used but any code calling preventDefault can also prevent navi custom behavior
              break transfer_focus_to_target;
            }
            naviProxyTarget.focus({ focusVisible: false });
            break transfer_focus_to_target;
          }
        }
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
          dispatchInternalCustomEvent(e.currentTarget, "navi_get_ui_value", {
            respondWith: (v) => {
              debugAction(
                e,
                `navi_get_ui_value.respondWith(${JSON.stringify(v)})`,
              );
              uiState = v;
            },
          });
          e.detail.uiState = uiState;
        }
        const naviProxyTarget = getControlProxyTarget(e.currentTarget);
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
          event: e.detail.event,
        });
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
        onActionEnd?.(data, e);
        remainingProps.onnavi_action_end?.(e);
      },
    });
  }

  return [controlProps, remainingProps];
};
