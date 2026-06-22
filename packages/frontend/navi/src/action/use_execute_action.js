import {
  createPubSub,
  dispatchInternalCustomEvent,
  getElementSignature,
} from "@jsenv/dom";
import { isValidElement } from "preact";
import { useCallback, useLayoutEffect, useState } from "preact/hooks";

import { registerGlobalConstraint } from "../control/validation/control_validity.js";
import { useResetErrorBoundary } from "../error_boundary_context.js";
import { useDebugAction } from "../navi_debug.jsx";

const actionErrorWeakMap = new WeakMap();
const NAVI_ACTION_ERROR_CONSTRAINT = {
  name: "navi_action_error",
  check: (controller) => {
    const errorInfo = actionErrorWeakMap.get(controller);
    if (!errorInfo) {
      return null;
    }
    const { target, message } = errorInfo;
    return {
      status: "error",
      target,
      message,
    };
  },
  // This should not prevent <form> submission
  // so whenever user tries to submit the form again the error is cleared
  // (Hitting enter key, clicking on submit button, etc. would allow to re-submit the form in error state)
  autoResetOnAction: true,
  onAutoResetOnAction: (controller) => {
    actionErrorWeakMap.delete(controller);
  },
};
registerGlobalConstraint(NAVI_ACTION_ERROR_CONSTRAINT);
const setActionError = (controller, message, { target } = {}) => {
  actionErrorWeakMap.set(controller, { message, target });
};
const clearActionError = (controller) => {
  if (actionErrorWeakMap.has(controller)) {
    actionErrorWeakMap.delete(controller);
  }
};

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

  const addErrorMessage = (error, { requester } = {}) => {
    // The error is stored on the element that owns the action (the form/element itself).
    // The requester (e.g. submit button) is stored as the callout display target
    // so the validation message appears on the button, not the form.
    const element = elementRef.current;
    let target = requester;
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
        target = errorMappingResult.target || target;
      }
    } else {
      message = error;
    }
    const controller = element.__uiStateController__;
    if (controller) {
      setActionError(controller, message, { requester, target });
    }
  };
  const removeErrorMessage = () => {
    const element = elementRef.current;
    const controller = element.__uiStateController__;
    if (controller) {
      clearActionError(controller);
      controller.controlValidity.checkValidity();
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
      // removeErrorMessage might be superfluous here because we autoResetOnActio
      // which is basically doing this but sooner to allow the action to be re-executed
      // (error is non blocking otherwise we could not ever re-submit)
      // removeErrorMessage();
      setError(null);

      const element = elementRef.current;
      if (!element) {
        throw new Error(
          "useExecuteAction: elementRef.current is null, make sure to pass a ref to an element",
        );
      }
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
        error: (error) => {
          if (errorEffect === "show_validation_message") {
            addErrorMessage(error, { requester });
          } else if (errorEffect === "throw") {
            setError(error);
          }

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
