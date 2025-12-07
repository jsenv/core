import { isValidElement } from "preact";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import { useResetErrorBoundary } from "../error_boundary_context.js";
import {
  addCustomMessage,
  removeCustomMessage,
} from "../field/validation/custom_message.js";

let debug = false;

export const useExecuteAction = (
  elementRef,
  {
    errorEffect = "show_validation_message", // "show_validation_message" or "throw"
    errorMapping,
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
      const { action, actionOrigin, requester, event, method } =
        actionEvent.detail;
      const sharedActionEventDetail = {
        action,
        actionOrigin,
        requester,
        event,
        method,
      };

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

      dispatchCustomEvent("actionstart", {
        detail: sharedActionEventDetail,
      });

      return action[method]({
        reason: `"${event.type}" event on ${(() => {
          const target = event.target;
          const tagName = target.tagName.toLowerCase();

          if (target.id) {
            return `${tagName}#${target.id}`;
          }

          const uiName = target.getAttribute("data-ui-name");
          if (uiName) {
            return `${tagName}[data-ui-name="${uiName}"]`;
          }

          return `<${tagName}>`;
        })()}`,
        onAbort: (reason) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionabort", {
              detail: {
                ...sharedActionEventDetail,
                reason,
              },
            });
          }
        },
        onError: (error) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionerror", {
              detail: {
                ...sharedActionEventDetail,
                error,
              },
            });
          }
          if (errorEffect === "show_validation_message") {
            addErrorMessage(error);
          } else if (errorEffect === "throw") {
            setError(error);
          }
        },
        onComplete: (data) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionend", {
              detail: {
                ...sharedActionEventDetail,
                data,
              },
            });
          }
        },
      });
    },
    [errorEffect],
  );

  return executeAction;
};
