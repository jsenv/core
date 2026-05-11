import { getElementSignature } from "@jsenv/dom";
import { useLayoutEffect, useState } from "preact/hooks";

import { useDebugAction } from "../navi_debug.jsx";
import { addManyEventListeners } from "../utils/add_many_event_listeners.js";
import { useStableCallback } from "../utils/use_stable_callback.js";

export const useActionEvents = (
  elementRef,
  {
    actionOrigin = "action_prop",
    /**
     * @param {Event} e - L'événement original
     * @param {"form_reset" | "blur_invalid" | "escape_key"} reason - Raison du cancel
     */
    onCancel,
    onRequested,
    onPrevented,
    onAction,
    onStart,
    onAbort,
    onError,
    onEnd,
  },
) => {
  const debugAction = useDebugAction();
  onCancel = useStableCallback(onCancel);
  onRequested = useStableCallback(onRequested);
  onPrevented = useStableCallback(onPrevented);
  onAction = useStableCallback(onAction);
  onStart = useStableCallback(onStart);
  onAbort = useStableCallback(onAbort);
  onError = useStableCallback(onError);
  onEnd = useStableCallback(onEnd);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    return addManyEventListeners(element, {
      navi_cancel: (e) => {
        // cancel don't need to check for actionOrigin because
        // it's actually unrelated to a specific actions
        // in that sense it should likely be moved elsewhere as it's related to
        // interaction and constraint validation, not to a specific action
        onCancel?.(e, e.detail.reason);
      },
      navi_action_requested: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        const requester = e.detail?.requester;
        const initiatorTarget = e.detail?.event?.target;
        const requesterInfo =
          requester && requester !== initiatorTarget
            ? ` requester=${getElementSignature(requester)}`
            : "";
        debugAction(
          e,
          `navi_action_requested (origin=${actionOrigin}${requesterInfo})`,
        );
        e.detail.debugAction = debugAction;
        onRequested?.(e);
      },
      navi_action_prevented: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        debugAction(e, `navi_action_prevented`);
        onPrevented?.(e);
      },
      navi_action: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        const action = e.detail.action;
        debugAction(e, `navi_action (${action})`);
        onAction?.(e);
      },
      navi_action_start: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        debugAction(e, `navi_action_start`);
        onStart?.(e);
      },
      navi_action_abort: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        debugAction(e, `navi_action_abort`);
        onAbort?.(e);
      },
      navi_action_error: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        debugAction(e, `navi_action_error`);
        onError?.(e.detail.error, e);
      },
      navi_action_end: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        debugAction(e, `navi_action_end`);
        onEnd?.(e);
      },
    });
  }, [
    actionOrigin,
    onCancel,
    onRequested,
    onPrevented,
    onAction,
    onStart,
    onAbort,
    onError,
    onEnd,
  ]);
};

export const useRequestedActionStatus = (elementRef, { actionOrigin } = {}) => {
  const [actionRequester, setActionRequester] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionAborted, setActionAborted] = useState(false);
  const [actionError, setActionError] = useState(null);

  useActionEvents(elementRef, {
    actionOrigin,
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
    },
    onStart: () => {
      setActionPending(true);
      setActionAborted(false);
      setActionError(null);
    },
    onAbort: () => {
      setActionPending(false);
      setActionAborted(true);
    },
    onError: (error) => {
      setActionPending(false);
      setActionError(error);
    },
    onEnd: () => {
      setActionPending(false);
    },
  });

  return {
    actionRequester,
    actionPending,
    actionAborted,
    actionError,
  };
};
