import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useActionBoundToParentParams } from "../action_execution/use_action.js";
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

[name="element_with_loader_wrapper"] button:hover {
  outline-color: light-dark(#505050, #7e7e83);
  background: light-dark(#e6e6e6, #2a2a2c);
}


[name="element_with_loader_wrapper"] button:active {
  outline-color: light-dark(#808080, #707070);
}

[name="element_with_loader_wrapper"] button[aria-busy="true"] {
  outline-color: light-dark(#a0a0a0, #909090);
  background: light-dark(rgba(240, 240, 240, 0.6), rgba(26, 26, 26, 0.6)); 
  color: light-dark(rgba(107, 114, 128, 0.6), rgba(156, 163, 175, 0.6)); 
}

[name="element_with_loader_wrapper"] button:focus-visible {
  outline-width: calc(var(--button-border-width) + 1px);
  outline-offset: calc(-1 * (var(--button-border-width) + 1px));
  outline-color: light-dark(#1d4ed8, #3b82f6);
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
      inset={
        borderWidth -
        // -1 is the outline offset thing
        1
      }
    >
      <button
        ref={innerRef}
        data-validation-message-arrow-x="center"
        aria-busy={Boolean(loading)}
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
  const hasEffectOnForm =
    type === "submit" || type === "reset" || type === "image";
  if (import.meta.dev && hasEffectOnForm && action) {
    console.warn(
      "Button with type submit/reset/image should not have their own action",
    );
  }

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const effectiveAction = useActionBoundToParentParams(action);
  const { pending } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const actionRequesterRef = useRef();
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const requester = actionEvent.detail.requester;
      actionRequesterRef.current = requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  // seulement si c'est le requester / un type submit dans un form
  const actionRequester = actionRequesterRef.current;
  const innerLoading =
    loading || (pending && actionRequester === innerRef.current);

  const handleClick = (event) => {
    const buttonElement = event.target;
    const { form } = buttonElement;
    if (action || !form) {
      // custom action -> request it
      // no form but a parent action -> request it
      event.preventDefault();
      requestAction(effectiveAction, { event });
      return;
    }
    if (!form) {
      // no form nor own action -> nothing to do
      return;
    }
    let wouldSubmitForm = type === "submit" || type === "image";
    if (!wouldSubmitForm) {
      const formSubmitButton = form.querySelector(
        "button[type='submit'], input[type='submit'], input[type='image']",
      );
      if (!formSubmitButton) {
        wouldSubmitForm = true;
      }
    }
    if (!wouldSubmitForm) {
      return;
    }
    // prevent default behavior that would submit the form
    // we want to go through the action execution process (with validation and all)
    event.preventDefault();
    requestAction(effectiveAction, {
      event,
      target: form,
      requester: event.target,
    });
  };

  return (
    <SimpleButton
      ref={innerRef}
      {...rest}
      type={type}
      loading={innerLoading}
      onClick={(event) => {
        handleClick(event);
        onClick?.(event);
      }}
    >
      {children}
    </SimpleButton>
  );
});
