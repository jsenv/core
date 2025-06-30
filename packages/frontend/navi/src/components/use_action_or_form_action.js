import { useCallback } from "preact/hooks";
import { useActionStatus } from "../actions.js";
import { useFormActionRef, useIsInsideForm } from "./form/use_form_status.js";
import { useAction } from "./use_action.js";
import { useActionReload } from "./use_action_reload.js";

export const useActionOrFormAction = (innerRef, action, confirmMessage) => {
  action = useAction(action);
  const isInsideForm = useIsInsideForm();
  const formActionRef = useFormActionRef();
  const reload = useActionReload(innerRef);
  const actionStatus = useActionStatus(action);

  const performAction = useCallback(
    async (event) => {
      if (confirmMessage) {
        // eslint-disable-next-line no-alert
        const confirmResult = window.confirm(confirmMessage);
        if (!confirmResult) {
          event.preventDefault();
          return;
        }
      }

      if (isInsideForm) {
        formActionRef.current = action;
        // let the form handle the submit
        return;
      }
      if (action) {
        // perform the action
        await reload(action);
      }
    },
    [confirmMessage],
  );
  return [actionStatus, performAction];
};
