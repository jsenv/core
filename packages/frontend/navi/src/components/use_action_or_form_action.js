import { useLayoutEffect } from "preact/hooks";
import { useActionStatus } from "../actions.js";
import {
  useFormActionRef,
  useFormActionStatus,
  useIsInsideForm,
} from "./form/form_context.js";
import { useAction } from "./use_action.js";
import { useExecuteAction } from "./use_execute_action.js";

export const useActionOrFormAction = (
  elementRef,
  action,
  actionParamsSignal,
) => {
  action = useAction(action, actionParamsSignal);
  const isInsideForm = useIsInsideForm();
  const formActionRef = useFormActionRef();
  const executeAction = useExecuteAction(elementRef);
  const actionStatus = useActionStatus(action);
  const formActionStatus = useFormActionStatus();

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (isInsideForm) {
      return element.form.addEventListener("execute", () => {
        // <form> will use this action
        formActionRef.current = action;
      });
    }
    if (action) {
      return addEventListener(element, "execute", () => {
        executeAction(action);
      });
    }
    return null;
  }, [isInsideForm, action, executeAction]);

  return action ? actionStatus : formActionStatus;
};

export const useOnExecute = (elementRef, callback) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    return addEventListener(element, "execute", callback);
  }, [callback]);
};

const addEventListener = (element, eventName, listener) => {
  element.addEventListener(eventName, listener);
  return () => {
    element.removeEventListener(eventName, listener);
  };
};
