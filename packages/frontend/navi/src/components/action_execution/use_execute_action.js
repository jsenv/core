import { addCustomMessage, removeCustomMessage } from "@jsenv/validation";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useResetErrorBoundary } from "../error_boundary_context.js";

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

  const executeAction = useCallback(
    (
      action,
      {
        // "reload", "load"
        method = "reload",
        requester,
      } = {},
    ) => {
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
      const result = performAction(action, {
        method,
        onAbort: () => {},
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
        onSuccess: () => {
          if (
            elementRef.current // at this stage the action side effect might have removed the <element> from the DOM
          ) {
            dispatchCustomEvent("actionend");
          }
        },
      });
      return result;
    },
    [],
  );

  return executeAction;
};

const performAction = (action, { method, onAbort, onError, onSuccess }) => {
  const onSettled = () => {
    const aborted = action.aborted;
    const error = action.error;
    return onResult({ aborted, error });
  };

  const onResult = ({ aborted, error }) => {
    if (aborted) {
      onAbort();
    } else if (error) {
      onError(error);
    } else {
      onSuccess();
    }
    return { aborted, error };
  };

  try {
    const result = action[method]();
    if (result && typeof result.then === "function") {
      return result.then(onSettled, onSettled);
    }
    return onSettled();
  } catch (e) {
    if (e.name === "AbortError") {
      return onResult({ aborted: true, error: null });
    }
    console.error(e);
    return onResult({ aborted: false, error: e });
  }
};
// const applyActionOnFormSubmission = canUseNavigation
//   ? async ({ method, formData, action }) => {
//       // const error = action.errorSignal.peek();
//       // const aborted = action.executionStateSignal.peek() === ABORTED;

//       // hum comment faire pour que chaque form ait son propre action status
//       // qui hérite du status de l'action qu'il s'apprete a call?
//       // je pense qu'il faut fork l'action
//       // sinon ça marche pas

//       // mais on veut potentiellement que l'action soit partagée entre plusieurs form
//       // et dans ce cas qu'on sache qu'une action d'un coté mette en pending in autre coté

//       try {
//         let actionResult;
//         await navigation.navigate(window.location.href, {
//           state: navigation.currentEntry.getState(), // action must preserve the current state of the page
//           history: "replace",
//           info: {
//             method,
//             formAction: action,
//             formActionCallback: (result) => {
//               actionResult = result;
//             },
//             formData,
//           },
//         }).finished;
//         return actionResult;
//       } catch (e) {
//         if (e.name === "AbortError") {
//           return { aborted: true, error: null };
//         }
//         console.error(e);
//         return { aborted: false, error: e };
//       }
//     }
//   : () => {
//       // TODO
//     };
