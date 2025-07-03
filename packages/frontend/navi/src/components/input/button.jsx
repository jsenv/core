import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useParentAction } from "../action_execution/action_context.js";
import { useAutoFocus } from "../use_auto_focus.js";

export const Button = forwardRef(
  (
    {
      action,
      children,
      // confirmMessage, // TODO
      ...rest
    },
    ref,
  ) => {
    if (action) {
      return (
        <ButtonWithOwnAction action={action} ref={ref} {...rest}>
          {children}
        </ButtonWithOwnAction>
      );
    }

    const parentAction = useParentAction();
    if (parentAction) {
      return (
        <ButtonWithParentAction parentAction={parentAction} ref={ref} {...rest}>
          {children}
        </ButtonWithParentAction>
      );
    }

    return (
      <ButtonWithoutAction ref={ref} {...rest}>
        {children}
      </ButtonWithoutAction>
    );
  },
);

const ButtonWithOwnAction = forwardRef(
  (
    { action, autoFocus, constraints = [], disabled, children, ...rest },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    const { pending } = useActionStatus(innerRef, action);

    return (
      <button
        ref={innerRef}
        data-validation-message-arrow-x="center"
        {...rest}
        disabled={disabled || pending}
        onClick={(event) => {
          event.target.requestAction();
        }}
      >
        {children}
      </button>
    );
  },
);

const ButtonWithParentAction = forwardRef(
  (
    { parentAction, autoFocus, constraints = [], disabled, children, ...rest },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    const { pending } = useActionStatus(innerRef, parentAction);

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

const ButtonWithoutAction = forwardRef(
  ({ children, autoFocus, constraints = [], ...rest }, ref) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    return (
      <button ref={innerRef} data-validation-message-arrow-x="center" {...rest}>
        {children}
      </button>
    );
  },
);
