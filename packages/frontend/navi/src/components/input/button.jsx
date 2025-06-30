import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../actions.js";
import { useFormActionRef, useIsInsideForm } from "../form/use_form_status.js";
import { useAction } from "../use_action.js";
import { useActionReload } from "../use_action_reload.js";

export const Button = forwardRef(
  ({ action, children, disabled, confirmMessage, onClick, ...rest }, ref) => {
    action = useAction(action);
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    const isInsideForm = useIsInsideForm();
    const formActionRef = useFormActionRef();
    const { pending } = useActionStatus(action);
    const reload = useActionReload(innerRef);

    return (
      <button
        ref={innerRef}
        {...rest}
        onClick={async (clickEvent) => {
          if (onClick) {
            onClick(clickEvent);
          }
          if (confirmMessage) {
            // eslint-disable-next-line no-alert
            const confirmResult = window.confirm(confirmMessage);
            if (!confirmResult) {
              clickEvent.preventDefault();
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
        }}
        disabled={pending || disabled}
      >
        {children}
      </button>
    );
  },
);
