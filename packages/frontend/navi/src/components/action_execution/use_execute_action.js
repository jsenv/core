import { addCustomMessage, removeCustomMessage } from "@jsenv/validation";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useResetErrorBoundary } from "../error_boundary_context.js";

let debug = false;

export const useExecuteAction = (
  elementRef,
  {
    errorEffect = "show_validation_message", // "show_validation_message" or "throw"
  } = {},
) => {
  // see https://medium.com/trabe/catching-asynchronous-errors-in-react-using-error-boundaries-5e8a5fd7b971
  // and https://codepen.io/dmail/pen/XJJqeGp?editors=0010
  // To change if https://github.com/preactjs/preact/issues/4754 lands
  const [error, setError] = useState(null);
  const resetErrorBoundary = useResetErrorBoundary();
  useLayoutEffect(() => {
    if (error) {
      error.__handled__ = true; // prevent jsenv from displaying it
      throw error;
    }
  }, [error]);

  const validationMessageTargetRef = useRef(null);
  const addErrorMessage = (error) => {
    const validationMessageTarget = validationMessageTargetRef.current;
    addCustomMessage(validationMessageTarget, "action_error", error, {
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

  const executeAction = useCallback((actionEvent) => {
    const { action, requester, event, method } = actionEvent.detail;

    if (debug) {
      console.debug(
        "executing action, requested by",
        requester,
        `(event: ${event?.type})`,
      );
    }

    const dispatchCustomEvent = (type, options) => {
      const element = elementRef.current;
      const customEvent = new CustomEvent(type, options);
      element.dispatchEvent(customEvent);
    };
    if (resetErrorBoundary) {
      resetErrorBoundary();
    }
    removeErrorMessage();
    setError(null);

    const validationMessageTarget = requester || elementRef.current;
    validationMessageTargetRef.current = validationMessageTarget;

    dispatchCustomEvent("actionstart");

    return action[method]({
      onEnd: () => {
        if (
          elementRef.current // at this stage the action side effect might have removed the <element> from the DOM
        ) {
          dispatchCustomEvent("actionend", { detail: { data: action.data } });
        }
      },
      onAbort: (reason) => {
        if (
          elementRef.current // at this stage the action side effect might have removed the <element> from the DOM
        ) {
          dispatchCustomEvent("actionabort", { detail: { reason } });
        }
      },
      onError: (error) => {
        if (
          elementRef.current // at this stage the action side effect might have removed the <element> from the DOM
        ) {
          dispatchCustomEvent("actionerror", { detail: { error } });
        }
        if (errorEffect === "show_validation_message") {
          addErrorMessage(error);
        } else if (errorEffect === "throw") {
          setError(error);
        }
      },
    });
  }, []);

  return executeAction;
};
