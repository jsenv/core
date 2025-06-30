import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../actions.js";
import { useFormActionRef, useFormStatus } from "../form/use_form_status.js";

export const Button = forwardRef(
  ({ action, children, disabled, confirmMessage, onClick, ...rest }, ref) => {
    const formStatus = useFormStatus();
    const formActionRef = useFormActionRef();
    if (!action) {
      action = formStatus.action;
    }
    const { pending } = useActionStatus(action);
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    return (
      <button
        ref={innerRef}
        {...rest}
        onClick={(clickEvent) => {
          if (confirmMessage) {
            // eslint-disable-next-line no-alert
            const confirmResult = window.confirm(confirmMessage);
            if (!confirmResult) {
              clickEvent.preventDefault();
              return;
            }
          }

          formActionRef.current = action;

          if (onClick) {
            onClick(clickEvent);
          }
        }}
        disabled={pending || formStatus.pending || disabled}
      >
        {children}
      </button>
    );
  },
);
