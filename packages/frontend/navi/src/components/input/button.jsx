import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useParentAction } from "../action_execution/action_context.js";
import { useAction } from "../action_execution/use_action.js";
import { useAutoFocus } from "../use_auto_focus.js";

export const Button = forwardRef((props, ref) => {
  const {
    action,
    autoFocus,
    constraints = [],
    disabled,
    children,
    onClick,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const parentAction = useParentAction();
  const effectiveAction = action ? useAction(action) : parentAction;
  const { pending } = effectiveAction
    ? useActionStatus(effectiveAction)
    : { pending: false };

  return (
    <button
      ref={innerRef}
      data-validation-message-arrow-x="center"
      {...rest}
      disabled={disabled || pending}
      onClick={(event) => {
        if (action) {
          event.target.requestAction();
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
});
