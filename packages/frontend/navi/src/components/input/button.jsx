import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionOrFormAction } from "../use_action_or_form_action.js";

export const Button = forwardRef(
  ({ action, children, disabled, confirmMessage, onClick, ...rest }, ref) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    const [{ pending }, performAction] = useActionOrFormAction(
      innerRef,
      action,
      confirmMessage,
    );

    return (
      <button
        ref={innerRef}
        data-validation-message-arrow-x="center"
        {...rest}
        disabled={pending || disabled}
        onClick={async (clickEvent) => {
          if (onClick) {
            onClick(clickEvent);
          }
          performAction(clickEvent);
        }}
      >
        {children}
      </button>
    );
  },
);
