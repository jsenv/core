import { dispatchInternalCustomEvent } from "@jsenv/dom";
import { useContext, useLayoutEffect } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { useDebugAction, useDebugInteraction } from "../navi_debug.jsx";
import { FieldContext } from "./field.jsx";
import {
  ActionRequesterContext,
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
} from "./field_context.js";
import { resolveActionProp } from "./string_actions.js";
import { useUIState, useUIStateController } from "./use_ui_state_controller.js";
import {
  onRequestAction,
  onRequestInteraction,
} from "./validation/custom_constraint_validation.js";
import { useConstraintMessages } from "./validation/hooks/use_constraint_messages.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

export const UI_STATE_NOT_AVAILABLE = Symbol("UI_STATE_NOT_AVAILABLE");
export const useFieldProps = (
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

export const useActionProps = (
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

    constraints,
    loading,
    readOnly,
    disabled,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    basePseudoState,
    children,

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
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);

  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const debugAction = useDebugAction();
  const debugInteraction = useDebugInteraction();

  const innerLoading =
    loading ||
    actionStatus.loading ||
    (contextLoading && parentActionRequester === ref.current);
  const innerReadOnly =
    readOnly ||
    contextReadOnly ||
    innerLoading ||
    uiStateController.readOnly ||
    fieldContext?.readOnly;
  const innerDisabled = disabled || contextDisabled || fieldContext?.disabled;

  // infom any <Field> parent of our readOnly state + that we are interactive
  useLayoutEffect(() => {
    if (fieldContext) {
      fieldContext.setReadOnly(innerReadOnly);
      fieldContext.setDisabled(innerDisabled);
      fieldContext.setInteractive(true);
    }
  }, [fieldContext, innerReadOnly, innerDisabled]);

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
    childrenWithContext = (
      <FieldContext.Provider value={null}>{children}</FieldContext.Provider>
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
    "action": undefined,
    "data-action":
      props.action === undefined
        ? undefined
        : typeof props.action === "string"
          ? props.action
          : action.callSource,
    [statePropName]: statePropValue,
    "navi-autofocus": autoFocus ? "" : undefined,
    "aria-busy": innerLoading,
    "aria-readonly": innerReadOnly,
    "basePseudoState": {
      ...basePseudoState,
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading,
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
