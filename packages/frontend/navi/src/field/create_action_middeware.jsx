import { useContext } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useOnRequestAction } from "./use_action_events.js";
import { UIStateControllerContext } from "./use_ui_state_controller.js";

export const createActionMiddleware = (ActionVariant) => {
  const ActionMiddleware = (props) => {
    if (props.action || props.uiAction) {
      return <ActionVariant {...props} />;
    }
    return null;
  };
  return ActionMiddleware;
};

export const useActionProps = (props) => {
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
    ...rest
  } = props;

  const uiStateController = useContext(UIStateControllerContext);
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiStateController.uiStateSignal,
  );
  const { loading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  const onRequestAction = useOnRequestAction();

  return {
    loading,
    ...rest,
    ref,
    "data-action": boundAction.name || "anonymous",
    "data-action-debounce": actionDebounce,
    "data-action-after-change": actionAfterChange ? "" : undefined,
    "onnavi_cancel": (e) => {
      const { reason } = e.detail;
      onCancel?.(e, reason);
    },
    "onnavi_request_action": (e) => {
      onRequestAction(boundAction, e);
    },
    "onnavi_action_prevented": onActionPrevented,
    "onnavi_action_ready": executeAction,
    "onnavi_action_abort": onActionAborted,
    "onnavi_action_error": onActionError,
    "onnavi_action_end": onActionEnd,
    "action": undefined,
    "uiAction": undefined,
  };
};
