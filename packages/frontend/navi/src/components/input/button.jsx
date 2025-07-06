import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";

/**
 * We have to re-define the CSS of button because getComputedStyle(button).borderColor returns
 * rgb(0, 0, 0) while being visually grey in chrome
 * So we redefine chrome styles so that loader can keep up with the actual color visible to the user
 *
 */
import.meta.css = /*css*/ `
[name="element_with_loader_wrapper"] button {
  --button-border-width: 1px;

  border-radius: 2px; 
  border-width: calc(var(--button-border-width) + 1px);
  border-style: solid;
  border-color: transparent;
  outline: var(--button-border-width) solid light-dark(#767676, #8e8e93);
  outline-offset: calc(-1 * var(--button-border-width));
}

[name="element_with_loader_wrapper"] button:hover:not(:disabled) {
  outline-color: light-dark(#505050, #7e7e83);
  background: light-dark(#e6e6e6, #2a2a2c);
}

[name="element_with_loader_wrapper"] button:focus-visible:not(:disabled) {
  outline-width: calc(var(--button-border-width) + 1px);
  outline-offset:calc(-1 * (var(--button-border-width) + 1px));
  outline-color: light-dark(#1d4ed8, #3b82f6);
}

[name="element_with_loader_wrapper"] button:active:not(:disabled) {
  outline-color: light-dark(#808080, #707070);
}

[name="element_with_loader_wrapper"] button:disabled {
  outline-color: light-dark(#a0a0a050, #90909050);
}
`;
export const Button = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, SimpleButton, ActionButton);
});

const SimpleButton = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    disabled,
    loading,
    children,
    borderWidth = 1,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  return (
    <LoaderBackground
      loading={loading}
      // 1px for outline offset, 0.5 for whatever reason to match radius
      // ( I think it's the diff betwen border with and outline width)
      inset={borderWidth - 0.5}
      color={
        disabled
          ? loading
            ? "light-dark(#767676, #8e8e93)"
            : undefined
          : undefined
      }
    >
      <button
        ref={innerRef}
        disabled={disabled}
        style={{ "--button-border-width": `${borderWidth}px` }}
        {...rest}
      >
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
    loading,
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
  const innerLoading =
    loading || (pending && actionRequester === innerRef.current);
  const innerDisabled = disabled || pending;

  return (
    <SimpleButton
      ref={innerRef}
      data-validation-message-arrow-x="center"
      {...rest}
      type={type}
      loading={innerLoading}
      disabled={innerDisabled}
      onClick={(event) => {
        const buttonElement = event.target;
        if (action) {
          event.preventDefault();
          requestAction(event, {
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
              requestAction(event, {
                target: form,
                action: effectiveAction,
              });
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
