import { useValidationMessage } from "@jsenv/validation";
import { useCallback, useLayoutEffect, useState } from "preact/hooks";
import { useResetErrorBoundary } from "./use_reset_error_boundary.js";

export const useActionReload = (
  innerRef,
  {
    errorEffect = "show_validation_message", // "show_validation_message" or "throw"
    errorTarget,
    errorValidationMessageOptions,
  } = {},
) => {
  const [addErrorMessage, removeErrorMessage] = useValidationMessage(
    innerRef,
    "action_error",
    errorTarget,
    errorValidationMessageOptions,
  );

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

  const dispatchCustomEvent = (type, options) => {
    const element = innerRef.current;
    const customEvent = new CustomEvent(type, options);
    element.dispatchEvent(customEvent);
  };

  const reloadAction = useCallback((action) => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    }
    removeErrorMessage();
    setError(null);

    dispatchCustomEvent("actionstart", {
      bubbles: true,
    });
    const result = performAction(action, {
      onError: (error) => {
        if (
          // at this stage the action side effect might have remove the <form> from the DOM
          innerRef.current
        ) {
          dispatchCustomEvent("actionerror", {
            bubbles: true,
            detail: { error },
          });
        }
        if (errorEffect === "show_validation_message") {
          addErrorMessage(error);
        } else {
          setError(error);
        }
      },
      onSuccess: () => {
        if (
          // at this stage the action side effect might have remove the <element> from the DOM
          innerRef.current
        ) {
          dispatchCustomEvent("actionend", {
            bubbles: true,
          });
        }
      },
    });
    return result;
  }, []);

  return reloadAction;
};

const performAction = (action, { onError, onSuccess }) => {
  const onSettled = () => {
    const aborted = action.aborted;
    const error = action.error;
    return onResult({ aborted, error });
  };

  const onResult = ({ aborted, error }) => {
    if (error) {
      onError(error);
    } else {
      onSuccess();
    }
    return { aborted, error };
  };

  try {
    const result = action.reload();
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
