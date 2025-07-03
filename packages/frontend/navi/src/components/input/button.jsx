import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useAutoFocus } from "../use_auto_focus.js";

export const Button = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, ActionButton, SimpleButton);
});

const SimpleButton = forwardRef((props, ref) => {
  const { autoFocus, constraints = [], children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  return (
    <button ref={innerRef} {...rest}>
      {children}
    </button>
  );
});

const ActionButton = forwardRef((props, ref) => {
  const {
    action,
    autoFocus,
    constraints = [],
    disabled,
    children,
    onClick,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  // TODO: comment récup les params de l'action parent (si elle existe)
  const [effectiveAction] = useAction(action, { preferSelf: true });
  const { pending } = useActionStatus(effectiveAction);
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
          event.target.requestAction(event, { ignoreForm: true });
        }
        onClick?.(event);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (action) {
          actionEvent.detail.cause.preventDefault(); // prevent submit by click
          executeAction(effectiveAction, {
            requester: actionEvent.target,
          });
        }
      }}
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
});
