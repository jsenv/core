import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionOrParentActionStatus } from "../use_action_or_parent_action_status.js";
import { useAutoFocus } from "../use_auto_focus.js";

export const Button = forwardRef(
  (
    {
      action,
      autoFocus,
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
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    const { pending } = useActionOrParentActionStatus(innerRef, action);

    return (
      <button
        ref={innerRef}
        data-validation-message-arrow-x="center"
        {...rest}
        disabled={disabled || pending}
      >
        {children}
      </button>
    );
  },
);
