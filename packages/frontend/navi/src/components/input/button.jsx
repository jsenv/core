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
button[data-custom] {
  --button-border-width: 1px;

  border-radius: 2px; 
  border-width: calc(var(--button-border-width) + 1px);
  border-style: solid;
  border-color: transparent;
  outline: var(--button-border-width) solid light-dark(#767676, #8e8e93);
  outline-offset: calc(-1 * var(--button-border-width));
}

button[data-custom]:active {
  outline-color: light-dark(#808080, #707070);
}

button[data-readonly], button[data-custom][data-readonly] {
  outline-color: light-dark(#d1d5db, #4b5563); 
  background: light-dark(#f3f4f6, #2d3748); 
  color: light-dark(#374151, #cbd5e0);
  filter: grayscale(20%);
}

button[data-custom]:hover {
  outline-color: light-dark(#505050, #7e7e83);
  background: light-dark(#e6e6e6, #2a2a2c);
}

button[data-custom]:focus-visible {
  outline-width: calc(var(--button-border-width) + 1px);
  outline-offset: calc(-1 * (var(--button-border-width) + 1px));
  outline-color: light-dark(#1d4ed8, #3b82f6);
}

button[data-custom]:disabled {
  outline-color: light-dark(#a0a0a050, #90909050);
  background-color: rgb(239, 239, 239);
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
    readonly = loading,
    children,
    appearance = "custom",
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
        data-custom={appearance === "custom" ? "" : undefined}
        data-validation-message-arrow-x="center"
        data-readonly={readonly ? "" : undefined}
        aria-busy={loading}
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

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      if (!action || actionEvent.detail.meta.isSubmit) {
        return;
      }
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

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
      meta: { isSubmit: true },
    });
  };

  const innerLoading = loading || pending;

  return (
    <SimpleButton
      action={
        action ? `javascript:void(\`${effectiveAction.name}\`)` : undefined
      }
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
