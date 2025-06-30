import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionOrFormAction } from "../use_action_or_form_action.js";

export const Button = forwardRef(
  (
    {
      action,
      children,
      disabled,
      constraints = [],
      // confirmMessage, // TODO
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    useConstraints(innerRef, constraints);
    const [{ pending }] = useActionOrFormAction(innerRef, action);

    return (
      <button
        ref={innerRef}
        data-validation-message-arrow-x="center"
        {...rest}
        disabled={pending || disabled}
      >
        {children}
      </button>
    );
  },
);
