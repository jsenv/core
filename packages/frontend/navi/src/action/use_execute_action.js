import {
  createPubSub,
  dispatchInternalCustomEvent,
  getElementSignature,
} from "@jsenv/dom";
import { isValidElement } from "preact";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import {
  addCustomMessage,
  removeCustomMessage,
} from "../control/validation/custom_message.js";
import { useResetErrorBoundary } from "../error_boundary_context.js";
import { useDebugAction } from "../navi_debug.jsx";

export const useExecuteAction = (
  elementRef,
  {
    errorEffect = "show_validation_message", // "show_validation_message" or "throw"
    errorMapping,
  } = {},
) => {
  const debugAction = useDebugAction();

  // see https://medium.com/trabe/catching-asynchronous-errors-in-react-using-error-boundaries-5e8a5fd7b971
  // and https://codepen.io/dmail/pen/XJJqeGp?editors=0010
  // To change if https://github.com/preactjs/preact/issues/4754 lands
  const [error, setError] = useState(null);
  const resetErrorBoundary = useResetErrorBoundary();
  useLayoutEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const validationMessageTargetRef = useRef(null);
  const addErrorMessage = (error, { event } = {}) => {
    let calloutAnchor = validationMessageTargetRef.current;
    let message;
    if (errorMapping) {
      const errorMappingResult = errorMapping(error);
      if (typeof errorMappingResult === "string") {
        message = errorMappingResult;
      } else if (Error.isError(errorMappingResult)) {
        message = errorMappingResult;
      } else if (isValidElement(errorMappingResult)) {
        message = errorMappingResult;
      } else if (
        typeof errorMappingResult === "object" &&
        errorMappingResult !== null
      ) {
        message = errorMappingResult.message || error.message;
        calloutAnchor = errorMappingResult.target || calloutAnchor;
      }
    } else {
      message = error;
    }
    addCustomMessage(calloutAnchor, "action_error", message, {
      event,
      status: "error",
      // This error should not prevent <form> submission
      // so whenever user tries to submit the form the error is cleared
      // (Hitting enter key, clicking on submit button, etc. would allow to re-submit the form in error state)
      removeOnRequestAction: true,
    });
  };
  const removeErrorMessage = () => {
    const validationMessageTarget = validationMessageTargetRef.current;
    if (validationMessageTarget) {
      removeCustomMessage(validationMessageTarget, "action_error");
    }
  };

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const form = element.tagName === "FORM" ? element : element.form;
    if (!form) {
      return null;
    }
    const onReset = () => {
      removeErrorMessage();
    };
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("reset", onReset);
    };
  });

  // const errorEffectRef = useRef();
  // errorEffectRef.current = errorEffect;
  const executeAction = useCallback(
    (actionEvent) => {
      const { action, actionOrigin, requester, event, method, confirmMessage } =
        actionEvent.detail;
      const sharedActionEventDetail = {
        action,
        actionOrigin,
        requester,
        event: actionEvent,
        method,
      };
      debugAction(event, "executing action, requested by", requester);

      if (resetErrorBoundary) {
        resetErrorBoundary();
      }
      removeErrorMessage();
      setError(null);

      const element = elementRef.current;
      if (!element) {
        throw new Error(
          "useExecuteAction: elementRef.current is null, make sure to pass a ref to an element",
        );
      }
      const validationMessageTarget = requester || element;
      validationMessageTargetRef.current = validationMessageTarget;

      const [triggerAbort, addAbortCallback] = createPubSub();
      const [triggerError, addErrorCallback] = createPubSub();
      const [triggerComplete, addCompleteCallback] = createPubSub();
      const addSideEffect = ({ abort, error, complete }) => {
        addAbortCallback(abort);
        addErrorCallback(error);
        addCompleteCallback(complete);
      };
      addSideEffect({
        abort: (reason) => {
          const element = elementRef.current;
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            element
          ) {
            dispatchInternalCustomEvent(element, "navi_action_abort", {
              ...sharedActionEventDetail,
              reason,
            });
          }
        },
        error: (error, { event }) => {
          const element = elementRef.current;
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            element
          ) {
            dispatchInternalCustomEvent(element, "navi_action_error", {
              ...sharedActionEventDetail,
              error,
            });
          }
          if (errorEffect === "show_validation_message") {
            addErrorMessage(error, { event });
          } else if (errorEffect === "throw") {
            setError(error);
          }
        },
        complete: (data) => {
          const element = elementRef.current;
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            element
          ) {
            dispatchInternalCustomEvent(element, "navi_action_end", {
              ...sharedActionEventDetail,
              data,
            });
          }
        },
      });

      const actionStartEventDetail = {
        ...sharedActionEventDetail,
        addSideEffect,
      };
      dispatchInternalCustomEvent(
        element,
        "navi_action_start",
        actionStartEventDetail,
      );

      if (confirmMessage) {
        // eslint-disable-next-line no-alert
        if (!window.confirm(confirmMessage)) {
          debugAction(event, `action aborted (via confirm dialog)`);
          triggerAbort(
            `user cancelled on confirm message: "${confirmMessage}"`,
          );
          return Promise.resolve();
        }
      }

      return action[method]({
        event: actionEvent,
        reason: `"${event.type}" event on ${getElementSignature(event.target)}`,
        onAbort: triggerAbort,
        onError: triggerError,
        onComplete: triggerComplete,
      });
    },
    [elementRef, errorEffect],
  );

  return executeAction;
};
