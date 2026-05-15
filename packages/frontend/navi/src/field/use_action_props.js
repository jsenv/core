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
  { paramsSignal, provideAction, provideActionRequester } = {},
) => {
  const {
    ref,
    action,
    actionDebounce,
    actionAfterChange,
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
  const [boundAction] = useActionBoundToOneParam(action, paramsSignal);
  const { loading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const onRequestAction = useOnRequestAction();

  const [actionRequester, setActionRequester] = useState();
  let childrenWithContext;
  if (children === undefined) {
    childrenWithContext = undefined;
  } else if (provideAction || provideActionRequester) {
    childrenWithContext = (
      <ActionContext.Provider value={boundAction}>
        <ActionRequesterContext.Provider value={actionRequester}>
          {children}
        </ActionRequesterContext.Provider>
      </ActionContext.Provider>
    );
  }

  return {
    loading,
    ...rest,
    "children": childrenWithContext,
    ref,
    "uiAction": undefined, // rest of components don't need to know about uiAction
    "data-action": action ? boundAction.name || "anonymous" : undefined,
    "data-action-debounce": actionDebounce,
    "data-action-after-change": actionAfterChange ? "" : undefined,
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
