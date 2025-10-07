import { useLayoutEffect, useState } from "preact/hooks";

import { addManyEventListeners } from "../../utils/add_many_event_listeners.js";

export const useActionEvents = (
  elementRef,
  {
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
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    return addManyEventListeners(element, {
      cancel: (e) => {
        onCancel?.(e, e.detail.reason);
      },
      actionrequested: onRequested,
      actionprevented: onPrevented,
      action: onAction,
      actionstart: onStart,
      actionabort: onAbort,
      actionerror: (e) => {
        onError?.(e.detail.error, e);
      },
      actionend: onEnd,
    });
  }, [onCancel, onPrevented, onAction, onStart, onError, onEnd]);
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
