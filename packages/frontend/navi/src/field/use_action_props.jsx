import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useOnRequestAction } from "./use_action_events.js";
import { UIStateControllerContext } from "./use_ui_state_controller.js";

export const ActionRequesterContext = createContext();
export const ActionContext = createContext();

export const useActionProps = (
  props,
  {
    paramsSignal,
    externalBoundAction,
    provideAction,
    provideActionRequester,
  } = {},
) => {
  const {
    ref,
    action,
    loading: propLoading,
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
    children,
    ...rest
  } = props;
  const uiStateController = useContext(UIStateControllerContext);
  paramsSignal = paramsSignal || uiStateController.uiStateSignal;
  // Always call the hook (hook call count must be stable), but when an
  // externalBoundAction is provided we pass undefined so a noop is created
  // internally, then we override with the external action below.
  const [internalBoundAction] = useActionBoundToOneParam(
    externalBoundAction ? undefined : action,
    paramsSignal,
  );
  const boundAction = externalBoundAction || internalBoundAction;
  const { loading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const onRequestAction = useOnRequestAction();

  const [actionRequester, setActionRequester] = useState();
  let effectiveChildren = children;
  if (provideAction || provideActionRequester) {
    effectiveChildren = (
      <ActionContext.Provider value={boundAction}>
        <ActionRequesterContext.Provider value={actionRequester}>
          {children}
        </ActionRequesterContext.Provider>
      </ActionContext.Provider>
    );
  }

  return {
    "loading": propLoading || loading,
    ...rest,
    "children": effectiveChildren,
    ref,
    "data-action": boundAction.callSource,
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
      onRequestAction(boundAction, e);
    },
    "onnavi_action_prevented": onActionPrevented,
    "onnavi_action_ready": (e) => {
      setActionRequester(e.detail.requester);
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
