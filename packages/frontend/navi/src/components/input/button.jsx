import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useParentAction } from "../action_execution/action_context.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useAutoFocus } from "../use_auto_focus.js";

export const Button = forwardRef((props, ref) => {
  const { action } = props;
  const parentAction = useParentAction();
  const hasActionProps = action || parentAction;

  if (hasActionProps) {
    return <ActionButton {...props} parentAction={parentAction} ref={ref} />;
  }

  return <SimpleButton {...props} ref={ref} />;
});

const SimpleButton = forwardRef(
  (
    { autoFocus, constraints = [], disabled, children, onClick, ...rest },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    return (
      <button ref={innerRef} {...rest} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  },
);

const ActionButton = forwardRef(
  (
    {
      action,
      parentAction,
      autoFocus,
      constraints = [],
      disabled,
      children,
      onClick,
      actionErrorEffect = "show_validation_message",
      onActionPrevented,
      onActionStart,
      onActionError,
      onActionEnd,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    const boundAction = useAction(action);
    const effectiveAction = boundAction || parentAction;
    const { pending } = effectiveAction
      ? useActionStatus(effectiveAction)
      : { pending: false };
    const executeAction = useExecuteAction(innerRef, {
      errorEffect: actionErrorEffect,
    });

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
        // eslint-disable-next-line react/no-unknown-property
        onaction={(actionEvent) => {
          if (action) {
            executeAction(effectiveAction, {
              requester: actionEvent.detail.requester,
            });
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionprevented={onActionPrevented}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={onActionError}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={onActionEnd}
      >
        {children}
      </button>
    );
  },
);
