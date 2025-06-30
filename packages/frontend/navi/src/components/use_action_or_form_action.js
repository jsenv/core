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
    const oneventrequest = (event) => {
      if (isInsideForm) {
        event.detail.effect = () => {
          // if the request goes through, the <form> will be submitted with this action
          formActionRef.current = action;
        };
      } else if (action) {
        event.detail.effect = () => {
          // if the request goes through, the action is reloaded
          reload(action);
        };
      }
    };

    element.addEventListener("event_request", oneventrequest);
    return () => {
      element.removeEventListener("event_request", oneventrequest);
    };
  }, [action, reload]);

  return [actionStatus];
};
