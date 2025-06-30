import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../actions.js";
import { useFormActionRef, useFormStatus } from "../form/use_form_status.js";

export const Button = forwardRef(
  ({ action, children, disabled, onClick, ...rest }, ref) => {
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
          formActionRef.current = action;
          if (onClick) {
            onClick(clickEvent);
          }
        }}
        disabled={pending || disabled}
      >
        {children}
      </button>
    );
  },
);
