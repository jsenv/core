import { dispatchRequestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
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
    type,
    action,
    autoFocus,
    constraints = [],
    disabled,
    children,
    onClick,
    actionPendingEffect = "loading",
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

  const hasEffectOnForm =
    type === "submit" || type === "reset" || type === "image";
  const [effectiveAction] = useAction(action, {
    preferSelf: !hasEffectOnForm,
  });
  const { pending } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef();

  const button = (
    <button
      ref={innerRef}
      data-validation-message-arrow-x="center"
      {...rest}
      type={type}
      disabled={disabled || pending}
      onClick={(event) => {
        const buttonElement = event.target;
        if (action) {
          event.preventDefault();
          dispatchRequestAction(buttonElement, event, {
            action: effectiveAction,
          });
        }
        const { form } = buttonElement;
        if (form) {
          let wouldSubmitForm = type === "submit" || type === "image";
          if (!wouldSubmitForm) {
            const formSubmitButton = form.querySelector(
              "button[type='submit'], input[type='submit'], input[type='image']",
            );
            if (!formSubmitButton) {
              wouldSubmitForm = true;
            }
          }
          if (wouldSubmitForm) {
            // prevent default behavior that would submit the form
            // we want to go through the action execution process (with validation and all)
            event.preventDefault();
            actionRequesterRef.current = buttonElement;
            dispatchRequestAction(form, event, { action: effectiveAction });
          }
        }
        onClick?.(event);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (action) {
          const requester = actionEvent.details.requester;
          actionRequesterRef.current = requester;
          executeAction(effectiveAction, {
            requester,
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

  if (actionPendingEffect === "loading") {
    // seulement si c'est le requester / un type submit dans un form
    const actionRequester = actionRequesterRef.current;
    return (
      <LoaderBackground
        pending={pending && actionRequester === innerRef.current}
      >
        {button}
      </LoaderBackground>
    );
  }

  return button;
});
