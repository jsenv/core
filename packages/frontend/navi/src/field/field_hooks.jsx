import { dispatchInternalCustomEvent } from "@jsenv/dom";
import { useContext, useLayoutEffect } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { useState } from "preact/hooks";
import { useDebugAction, useDebugInteraction } from "../navi_debug.jsx";
import {
  ActionContext,
  ActionRequesterContext,
  DisabledContext,
  FieldContext,
  FieldNameContext,
  LoadingContext,
  ReadOnlyContext,
  RequiredContext,
} from "./field_context.js";
import { resolveActionProp } from "./string_actions.js";
import {
  ParentUIStateControllerContext,
  useUIGroupStateController,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";
import {
  onRequestAction,
  onRequestInteraction,
} from "./validation/custom_constraint_validation.js";
import { useConstraintMessages } from "./validation/hooks/use_constraint_messages.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

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

  return useActionProps(props, {
    action: boundAction,
    uiStateController,
    readUIState,
    getDisplayValue,
    normalizeUIState,
  });
};

export const useFieldgroupInterfaceProps = (
  props,
  { fieldType, childComponentType, aggregateChildStates },
) => {
  const { action, name, required } = props;
  const debugAction = useDebugAction();
  const uiGroupStateController = useUIGroupStateController(props, fieldType, {
    childComponentType,
    aggregateChildStates,
    debugAction,
  });
  // const uiState = useUIState(uiGroupStateController);
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
        <FieldNameContext.Provider value={name}>
          <DisabledContext.Provider value={disabled}>
            <ReadOnlyContext.Provider value={readOnly}>
              <RequiredContext.Provider value={required}>
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
  const fieldContext = useContext(FieldContext);
  const fieldDisabled = useContext(DisabledContext);
  const fieldReadOnly = useContext(ReadOnlyContext);
  const fieldRequired = useContext(RequiredContext);
  const fieldLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);

  const idResolved = id || fieldContext?.id;
  const nameResolved = name || fieldContext?.name;
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

  // infom any <Field> parent of our readOnly state + that we are interactive
  useLayoutEffect(() => {
    if (fieldContext) {
      fieldContext.setInteractive(true);
      fieldContext.setDisabled(disabledResolved);
      fieldContext.setReadOnly(readOnlyResolved);
    }
  }, [fieldContext, disabledResolved, readOnlyResolved]);

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
    /* We are a field ourselve, which can contain other fields that should not inherit our field */
    /* at least not the id/name and readonly/required reporting which belongs to this field only */
    childrenWithContext = (
      <FieldContext.Provider value={undefined}>
        {children}
      </FieldContext.Provider>
    );
  }

  const uiState = useUIState(uiStateController);
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
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e, { debugInteraction });
    },
    "onnavi_cancel": (e) => {
      const { reason } = e.detail;

      if (resetOnCancel) {
        if (reason.startsWith("blur_invalid")) {
          return;
        }
        uiStateController.resetUIState(e);
        onCancel?.(e, reason);
        return;
      }
      if (reason.startsWith("blur_invalid")) {
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
        // keyboard shotcut give the action and action is irrelevant here, the kayboard shortcut must win
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
      uiStateController.setUIState(uiState, e);
      executeAction(e);
    },
    "onnavi_action_abort": (e) => {
      if (resetOnAbort) {
        uiStateController.resetUIState(e);
      }
      onActionAborted?.(e);
    },
    "onnavi_action_error": (e) => {
      const { error } = e.detail;
      if (resetOnError) {
        uiStateController.resetUIState(e);
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
