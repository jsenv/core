import { useLayoutEffect } from "preact/hooks";
import { useActionStatus } from "../actions.js";
import { useFormActionRef, useIsInsideForm } from "./form/use_form_status.js";
import { useAction } from "./use_action.js";
import { useActionReload } from "./use_action_reload.js";

export const useActionOrFormAction = (elementRef, action) => {
  action = useAction(action);
  const isInsideForm = useIsInsideForm();
  const formActionRef = useFormActionRef();
  const reload = useActionReload(elementRef);
  const actionStatus = useActionStatus(action);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (isInsideForm) {
      return element.form.addEventListener("execute", () => {
        // <form> will user this action
        formActionRef.current = action;
      });
    }
    if (action) {
      return addEventListener(element, "execute", () => {
        reload(action);
      });
    }
    return null;
  }, [isInsideForm, action, reload]);

  return [actionStatus];
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
