import { useLayoutEffect, useState } from "preact/hooks";

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
      cancel: (e) => {
        // cancel don't need to check for actionOrigin because
        // it's actually unrelated to a specific actions
        // in that sense it should likely be moved elsewhere as it's related to
        // interaction and constraint validation, not to a specific action
        onCancel?.(e, e.detail.reason);
      },
      actionrequested: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onRequested?.(e);
      },
      actionprevented: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onPrevented?.(e);
      },
      action: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onAction?.(e);
      },
      actionstart: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onStart?.(e);
      },
      actionabort: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onAbort?.(e);
      },
      actionerror: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onError?.(e.detail.error, e);
      },
      actionend: onEnd,
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

export const useRequestedActionStatus = (elementRef) => {
  const [actionRequester, setActionRequester] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionAborted, setActionAborted] = useState(false);
  const [actionError, setActionError] = useState(null);

  useActionEvents(elementRef, {
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
