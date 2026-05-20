import {
  dispatchInternalCustomEvent,
  findEvent,
  getElementSignature,
} from "@jsenv/dom";
import { useContext, useLayoutEffect, useState } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import {
  useDebugAction,
  useDebugFocus,
  useDebugInteraction,
} from "../navi_debug.jsx";
import {
  ActionContext,
  ActionRequesterContext,
  DisabledContext,
  FieldNameContext,
  FieldToInterfaceContext,
  LoadingContext,
  MessagePropsRefContext,
  ReadOnlyContext,
  RequiredContext,
} from "./field_context.js";
import { resolveActionProp } from "./string_actions.js";
import {
  ParentUIStateControllerContext,
  requestResetUIState,
  requestSetUIState,
  useUIGroupStateController,
  useUIStateController,
} from "./ui_state_controller.js";
import {
  dispatchRequestAction,
  onRequestAction,
  onRequestInteraction,
} from "./validation/custom_constraint_validation.js";
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
export const useFieldInterfaceProps = (
  props,
  {
    fieldType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    allowNameless,
    persists,

    readUIState,
    getDisplayValue,
    normalizeUIState,
    paramsSignal,
    externalBoundAction,
  },
) => {
  const debugAction = useDebugAction();
  const uiStateController = useUIStateController(props, fieldType, {
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    allowNameless,
    persists,
    debugAction,
  });

  paramsSignal = paramsSignal || uiStateController.uiStateSignal;
  const [internalBoundAction] = useActionBoundToOneParam(
    externalBoundAction ? undefined : resolveActionProp(props.action),
    paramsSignal,
  );
  const boundAction = externalBoundAction || internalBoundAction;

  const actionProps = useActionProps(props, {
    action: boundAction,
    uiStateController,
    readUIState,
    getDisplayValue,
    normalizeUIState,
  });
  if (defaultStatePropName) {
    delete actionProps[defaultStatePropName];
  }
  return actionProps;
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
 * @param {{ fieldType: string, childComponentType: string, aggregateChildStates: Function }} config
 * @returns {Object} Props to spread onto the group's root element
 */
export const useFieldgroupInterfaceProps = (
  props,
  { fieldType, childComponentType, aggregateChildStates },
) => {
  const { action } = props;
  const debugAction = useDebugAction();
  const uiGroupStateController = useUIGroupStateController(props, fieldType, {
    childComponentType,
    aggregateChildStates,
    debugAction,
  });
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiGroupStateController.uiStateSignal,
  );
  const [actionRequester, setActionRequester] = useState();
  const actionProps = useActionProps(props, {
    action: boundAction,
    uiStateController: uiGroupStateController,
    readUIState: () => {
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
        <FieldNameContext.Provider value={actionProps.name}>
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
        </FieldNameContext.Provider>
      </ParentUIStateControllerContext.Provider>
    );
  }

  return {
    ...actionProps,
    children: childrenWithContext,
    value: undefined, // field group doesn't have a value
    onnavi_action_ready: (e) => {
      setActionRequester(e.detail.requester);
      actionProps.onnavi_action_ready(e);
    },
  };
};

const useActionProps = (
  props,
  {
    action,
    uiStateController,
    readUIState,
    getDisplayValue = (v) => v,
    normalizeUIState = (v) => v,
  },
) => {
  const {
    ref,

    name,
    id,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    basePseudoState,
    children,

    constraints,
    disabled,
    readOnly,
    required,
    loading,
    onCancel,
    onActionPrevented,
    onActionAborted,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    errorMapping,
    resetOnCancel,
    resetOnAbort,
    resetOnError,
    cancelOnBlurInvalid,
    cancelOnEscape,
    ...rest
  } = props;
  const actionStatus = useActionStatus(action);
  const fieldToInterfaceContext = useContext(FieldToInterfaceContext);
  const fieldName = useContext(FieldNameContext);
  const fieldDisabled = useContext(DisabledContext);
  const fieldReadOnly = useContext(ReadOnlyContext);
  const fieldRequired = useContext(RequiredContext);
  const fieldLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);

  const idResolved = id || fieldToInterfaceContext?.id;
  const nameResolved = name || fieldName;
  const disabledResolved = disabled || fieldDisabled;
  const requiredResolved = required || fieldRequired;
  const loadingResolved =
    loading ||
    actionStatus.loading ||
    (fieldLoading && parentActionRequester === ref.current);
  const readOnlyResolved =
    readOnly || fieldReadOnly || loadingResolved || uiStateController.readOnly;

  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const debugAction = useDebugAction();
  const debugInteraction = useDebugInteraction();
  const debugFocus = useDebugFocus();

  // infom any <Field> parent of our readOnly state + that we are interactive
  useLayoutEffect(() => {
    if (fieldToInterfaceContext) {
      fieldToInterfaceContext.setInteractive(true);
      fieldToInterfaceContext.setDisabled(disabledResolved);
      fieldToInterfaceContext.setReadOnly(readOnlyResolved);
    }
  }, [fieldToInterfaceContext, disabledResolved, readOnlyResolved]);

  useAutoFocus(ref, autoFocus, {
    focusVisible: autoFocusVisible,
    autoSelect,
  });
  useConstraints(ref, constraints);
  const remainingProps = useConstraintMessages(ref, rest);

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
        <FieldToInterfaceContext.Provider value={undefined}>
          {children}
        </FieldToInterfaceContext.Provider>
      </MessagePropsRefContext.Provider>
    );
  }

  const uiState = uiStateController.uiStateSignal.value;
  const { statePropName } = uiStateController;
  const statePropValueRaw = uiStateController.getPropFromState(uiState);
  const statePropValue = getDisplayValue(statePropValueRaw);

  return {
    "children": childrenWithContext,
    ...remainingProps,
    ref,
    "id": idResolved,
    "name": nameResolved,
    "required": requiredResolved,
    "action": undefined,
    "data-action":
      props.action === undefined
        ? undefined
        : typeof props.action === "string"
          ? props.action
          : action.callSource,
    [statePropName]: statePropValue,
    "navi-autofocus": autoFocus ? "" : undefined,
    "aria-readonly": readOnlyResolved,
    "aria-busy": loadingResolved,
    "basePseudoState": {
      ...basePseudoState,
      ":disabled": disabledResolved,
      ":read-only": readOnlyResolved,
      ":-navi-loading": loadingResolved,
    },
    "onnavi_request_reset_ui_state": (e) => {
      uiStateController.resetUIState(e);
    },
    "onnavi_request_ui_state": (e) => {
      e.detail.respondWith(readUIState(e));
    },
    "onnavi_set_ui_state": (e) => {
      const { value } = e.detail;
      uiStateController.setUIState(value, e);
      const naviProxyTarget = getNaviProxyTarget(e);
      if (naviProxyTarget) {
        debugInteraction(
          e,
          `forwarding set_ui_state "${value}" to ${getElementSignature(naviProxyTarget)}`,
        );
        requestSetUIState(naviProxyTarget, value, { event: e.detail.event });
      }
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e, { debugInteraction });
      const naviProxyTarget = getNaviProxyTarget(e);
      if (naviProxyTarget) {
        const mousedownEvent = findEvent(e, "mousedown");
        if (mousedownEvent && !mousedownEvent.defaultPrevented) {
          debugFocus(
            e,
            "move focus to proxy (using preventDefault() + focus({ focusVisible: false })",
          );
          mousedownEvent.preventDefault();
          naviProxyTarget.focus({ focusVisible: false });
        }
      }
    },
    "onnavi_cancel": (e) => {
      const { reason } = e.detail;
      const isBlurInvalid = reason.startsWith("blur_invalid");

      if (resetOnCancel) {
        if (isBlurInvalid) {
          return;
        }
        requestResetUIState(e.currentTarget, e);
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
    "onnavi_request_action": (e) => {
      const naviProxyTarget = getNaviProxyTarget(e);
      if (naviProxyTarget) {
        debugAction(e, "forwarding action request to navi proxy target");
        dispatchRequestAction(naviProxyTarget, { event: e });
        return;
      }
      let uiStateRaw;
      dispatchInternalCustomEvent(e.currentTarget, "navi_request_ui_state", {
        respondWith: (v) => {
          debugAction(
            e,
            `navi_request_ui_state.respondWith(${JSON.stringify(v)})`,
          );
          uiStateRaw = v;
        },
      });
      e.detail.uiState = normalizeUIState(uiStateRaw);

      if (e.detail.action) {
        // keyboard shortcut give the action and action is irrelevant here, the kayboard shortcut must win
      } else {
        e.detail.actionOrigin = "action_prop";
        e.detail.action = action;
      }

      onRequestAction(e, { debugAction });
    },
    "onnavi_action_prevented": onActionPrevented,
    "onnavi_action_ready": (e) => {
      if (e.detail.action === "auto") {
        // special case for the use case where form.submit is called
        e.detail.action = action;
      }

      const { uiState } = e.detail;
      requestSetUIState(e.currentTarget, uiState, { event: e.detail.event });
      executeAction(e);
    },
    "onnavi_action_abort": (e) => {
      if (resetOnAbort) {
        requestResetUIState(e.currentTarget, e);
      }
      onActionAborted?.(e);
    },
    "onnavi_action_error": (e) => {
      const { error } = e.detail;
      if (resetOnError) {
        requestResetUIState(e.currentTarget, e);
      }
      onActionError?.(error, e);
    },
    "onnavi_action_end": (e) => {
      const { data } = e.detail;
      uiStateController.actionEnd(e);
      onActionEnd?.(data, e);
    },
  };
};

const getNaviProxyTarget = (event) => {
  const currentTarget = event.currentTarget;
  const proxyFor = currentTarget.getAttribute("navi-proxy-for");
  if (!proxyFor) {
    return null;
  }
  const realInput = document.getElementById(proxyFor);
  return realInput;
};
