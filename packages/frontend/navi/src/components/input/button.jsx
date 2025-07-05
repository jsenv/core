import { dispatchRequestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";

export const Button = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, SimpleButton, ActionButton);
});

const SimpleButton = forwardRef((props, ref) => {
  const { autoFocus, constraints = [], loading, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  return (
    <LoaderBackground loading={loading}>
      <button ref={innerRef} {...rest}>
        {children}
      </button>
    </LoaderBackground>
  );
});

const ActionButton = forwardRef((props, ref) => {
  const {
    type,
    action,
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
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      if (action) {
        const requester = actionEvent.detail.requester;
        actionRequesterRef.current = requester;
        executeAction(effectiveAction, { requester });
      }
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  // seulement si c'est le requester / un type submit dans un form
  const actionRequester = actionRequesterRef.current;
  const innerLoading = pending && actionRequester === innerRef.current;

  return (
    <SimpleButton
      ref={innerRef}
      data-validation-message-arrow-x="center"
      {...rest}
      type={type}
      loading={innerLoading}
      disabled={disabled || pending}
      onClick={(event) => {
        const buttonElement = event.target;
        if (action) {
          event.preventDefault();
          dispatchRequestAction(buttonElement, event, {
            action: effectiveAction,
          });
        } else {
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
        }
        onClick?.(event);
      }}
    >
      {children}
    </SimpleButton>
  );
});
