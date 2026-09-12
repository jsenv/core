import {
  createInternalCustomEvent,
  createPubSub,
  dispatchInternalCustomEvent,
  getElementSignature,
} from "@jsenv/dom";
import { isValidElement } from "preact";
import { useCallback, useLayoutEffect, useState } from "preact/hooks";

import { registerGlobalConstraint } from "../control/rules/control_validation.js";
import { useResetErrorBoundary } from "../error_boundary_context.js";
import { useDebugAction } from "../navi_debug.jsx";
import { runUnwatched } from "./run_unwatched.js";

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
    // The error is stored on the element that owns the action (the form/element
    // itself). The requester — the submit button that sent, the row of a list
    // whose command sent — is stored as the callout display target, so the
    // message appears on whoever asked rather than on the whole control.
    const element = elementRef.current;
    if (!element) {
      // The control left the page while its run was out (its own answer can
      // unmount it, see the outcome events below): there is no box to hang
      // the refusal on. onActionError is still told, by the run's side effect.
      return;
    }
    let target = requester;
    // A requester that is no longer on the page is not a place to show
    // anything: the clear cross leaves with the value it optimistically
    // cleared, and by the time the refusal comes back there is nothing left to
    // point at — the callout would anchor on a detached node. The control that
    // ran the action is still there, and the error is about it, so it takes it.
    if (target && !target.isConnected) {
      target = undefined;
    }
    let message;
    if (errorMapping) {
      const errorMappingResult = errorMapping(error);
      // Anything the chain below does not recognize — nothing returned, above
      // all — leaves `message` undefined and the control displays nothing. That
      // is the contract, and both halves of it are useful:
      // - returning nothing says "don't show this one", per error, where
      //   actionErrorEffect="none" says it once for the whole control;
      // - not handling an error means returning it untouched (`return error`),
      //   and it is then shown exactly as if there were no mapping at all.
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
      setActionError(controller, message, { target });
    }
  };
  const removeErrorMessage = () => {
    const element = elementRef.current;
    const controller = element.__uiStateController__;
    if (controller) {
      clearActionError(controller);
      controller.rules.validation.checkValidity();
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
      // Either three callbacks, one per outcome, or a single one for "however
      // this ends" — it receives `{ aborted, reason }`, `{ error }` or
      // `{ data }`, so a caller that only needs to know the action settled
      // (and whether it worked) does not have to register three. Each also
      // receives the outcome event (navi_action_abort/error/end) as its
      // second argument.
      const addSideEffect = (sideEffect) => {
        if (typeof sideEffect === "function") {
          addAbortCallback((reason, outcomeEvent) =>
            sideEffect({ aborted: true, reason }, outcomeEvent),
          );
          addErrorCallback((error, outcomeEvent) =>
            sideEffect({ error }, outcomeEvent),
          );
          addCompleteCallback((data, outcomeEvent) =>
            sideEffect({ data }, outcomeEvent),
          );
          return;
        }
        const { abort, error, complete } = sideEffect;
        addAbortCallback(abort);
        addErrorCallback(error);
        addCompleteCallback(complete);
      };

      const actionStartEventDetail = {
        ...sharedActionEventDetail,
        addSideEffect,
      };
      dispatchInternalCustomEvent(
        element,
        "navi_action_start",
        actionStartEventDetail,
      );

      // The outcome is told twice: to the element, when there still is one,
      // and to the side effects registered at navi_action_start, always. A
      // run can outlive its control — the run's own answer, written to a
      // store the parent reads to decide what it draws, unmounts the control
      // one microtask before the run settles — and the element is then no
      // place to dispatch to: Preact drops a detached element's listeners.
      // The side effects are the run's, not the element's, so the event
      // reaches them either way.
      const tellOutcome = (outcomeEventName, outcomeEventDetail, trigger) => {
        const outcomeEvent = createInternalCustomEvent(outcomeEventName, {
          ...sharedActionEventDetail,
          ...outcomeEventDetail,
        });
        const element = elementRef.current;
        if (element) {
          element.dispatchEvent(outcomeEvent);
        }
        trigger(outcomeEvent);
      };

      const runAction = () => {
        return action[method]({
          event: actionEvent,
          reason: `"${event.type}" event on ${getElementSignature(event.target)}`,
          onAbort: (reason) => {
            tellOutcome("navi_action_abort", { reason }, (outcomeEvent) => {
              triggerAbort(reason, outcomeEvent);
            });
          },
          onError: (error) => {
            if (errorEffect === "show_validation_message") {
              addErrorMessage(error, { requester });
            } else if (errorEffect === "throw") {
              setError(error);
            }
            tellOutcome("navi_action_error", { error }, (outcomeEvent) => {
              triggerError(error, outcomeEvent);
            });
          },
          onComplete: (data) => {
            tellOutcome("navi_action_end", { data }, (outcomeEvent) => {
              triggerComplete(data, outcomeEvent);
            });
          },
        });
      };

      // The control is already holding the failure — the error side effect
      // above drew the callout, or threw it at the boundary — so nothing here
      // is waiting on the rejection.
      return runUnwatched(runAction);
    },
    [elementRef, errorEffect],
  );

  return executeAction;
};
