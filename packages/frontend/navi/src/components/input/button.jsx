import { resolveCSSSize } from "@jsenv/dom";
import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useAction,
  useActionBoundToFormParams,
} from "../action_execution/use_action.js";
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
import.meta.css = /* css */ `
  button[data-custom] {
    --button-border-width: 1px;
    --button-border-color: light-dark(#767676, #8e8e93);
    --button-outline-width: 1px;

    border-radius: 2px;
    border-width: calc(
      var(--button-border-width) + var(--button-outline-width)
    );
    border-style: solid;
    border-color: transparent;
    outline: var(--button-border-width) solid var(--button-border-color);
    outline-offset: calc(-1 * (var(--button-border-width)));
    transition-duration: 0.15s;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-property: transform;
  }

  button[data-custom]:hover {
    outline-color: color-mix(in srgb, var(--button-border-color) 70%, black);
    background: light-dark(#e6e6e6, #2a2a2c);
  }

  button[data-custom]:active {
    outline-color: color-mix(in srgb, var(--button-border-color) 90%, black);
    transform: scale(0.9);
  }

  button[data-custom] > .shadow {
    position: absolute;
    inset: calc(
      -1 * (var(--button-border-width) + var(--button-outline-width))
    );
    pointer-events: none;
    border-radius: inherit;
  }

  button[data-custom]:active > .shadow {
    box-shadow:
      inset 0 3px 6px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(0, 0, 0, 0.1),
      inset 2px 0 4px rgba(0, 0, 0, 0.1),
      inset -2px 0 4px rgba(0, 0, 0, 0.1);
  }

  button[data-custom][data-readonly] {
    outline-color: light-dark(#d1d5db, #4b5563);
    background: light-dark(#f3f4f6, #2d3748);
    color: light-dark(#374151, #cbd5e0);
  }
  button[data-custom][data-readonly]:hover {
    outline-color: light-dark(#c4c4c7, #525252);
    background: light-dark(#f1f5f9, #334155);
    color: light-dark(#374151, #cbd5e0);
  }

  button[data-custom]:focus-visible {
    outline-width: calc(
      var(--button-border-width) + var(--button-outline-width)
    );
    outline-offset: calc(
      -1 * (var(--button-border-width) + var(--button-outline-width))
    );
    outline-color: light-dark(#355fcc, #3b82f6);
  }

  button[data-custom]:disabled,
  button[data-custom]:disabled:hover {
    outline-color: light-dark(#a0a0a050, #90909050);
    background-color: rgb(239, 239, 239);
    color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
    transform: none;
    box-shadow: none;
  }
`;
export const Button = forwardRef((props, ref) => {
  return renderActionableComponent(
    props,
    ref,
    ButtonBasic,
    ButtonWithAction,
    ButtonInsideForm,
    ButtonWithActionInsideForm,
  );
});

const ButtonBasic = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    loading,
    readonly,
    children,
    appearance = "custom",
    style = {},
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  let {
    borderWidth = 1,
    outlineWidth = 1,
    borderColor = "light-dark(#767676, #8e8e93)",
    ...restStyle
  } = style;
  borderWidth = resolveCSSSize(borderWidth);
  outlineWidth = resolveCSSSize(outlineWidth);

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
        {...rest}
        data-custom={appearance === "custom" ? "" : undefined}
        data-validation-message-arrow-x="center"
        data-readonly={readonly || loading ? "" : undefined}
        aria-busy={loading}
        style={{
          ...restStyle,
          "--button-border-width": `${borderWidth}px`,
          "--button-outline-width": `${outlineWidth}px`,
          "--button-border-color": borderColor,
          "position": "relative",
        }}
      >
        {children}
        <div className="shadow"></div>
      </button>
    </LoaderBackground>
  );
});

const ButtonWithAction = forwardRef((props, ref) => {
  const {
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

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const boundAction = useAction(action);
  const { pending } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  const handleClick = (event) => {
    event.preventDefault();
    requestAction(boundAction, { event });
  };

  return (
    <ButtonBasic
      action={`javascript:void(\`${boundAction.name}\`)`}
      ref={innerRef}
      {...rest}
      loading={loading || pending}
      onClick={(event) => {
        handleClick(event);
        onClick?.(event);
      }}
    >
      {children}
    </ButtonBasic>
  );
});

const ButtonWithActionInsideForm = forwardRef((props, ref) => {
  const {
    formContext,
    type,
    action,
    loading,
    readonly,
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
  if (import.meta.dev && hasEffectOnForm) {
    throw new Error(
      "Button with type submit/reset/image should not have their own action",
    );
  }

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const { formIsReadonly } = formContext;
  const actionBoundToForm = useActionBoundToFormParams(action);
  const { pending } = useActionStatus(actionBoundToForm);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  const handleClick = (event) => {
    event.preventDefault();
    // lorsque cette action s'éxecute elle doit mettre le form en mode busy
    // je vois pas encore comment je vais faire ca mais a priori
    // on va juste le faire "manuellement"
    // en utilisnt un truc du formContext
    requestAction(actionBoundToForm, { event });
  };

  return (
    <ButtonBasic
      data-action={actionBoundToForm.name}
      ref={innerRef}
      {...rest}
      type={type}
      loading={loading || pending}
      readonly={readonly || formIsReadonly}
      onClick={(event) => {
        handleClick(event);
        onClick?.(event);
      }}
    >
      {children}
    </ButtonBasic>
  );
});

const ButtonInsideForm = forwardRef((props, ref) => {
  const { formContext, type, loading, readonly, onClick, children, ...rest } =
    props;
  const { formAction, formIsBusy, formIsReadonly, formActionRequester } =
    formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const wouldSubmitFormByType = type === "submit" || type === "image";
  const innerReadonly = readonly || formIsReadonly;

  const handleClick = (event) => {
    const buttonElement = event.target;
    const { form } = buttonElement;
    let wouldSubmitForm = wouldSubmitFormByType;
    if (!wouldSubmitForm) {
      const formSubmitButton = form.querySelector(
        "button[type='submit'], input[type='submit'], input[type='image']",
      );
      const wouldSubmitFormBecauseSingleButton = !formSubmitButton;
      wouldSubmitForm = wouldSubmitFormBecauseSingleButton;
    }
    if (!wouldSubmitForm) {
      if (innerReadonly) {
        event.preventDefault();
      }
      return;
    }
    // prevent default behavior that would submit the form
    // we want to go through the action execution process (with validation and all)
    event.preventDefault();
    requestAction(formAction, {
      event,
      target: form,
      requester: buttonElement,
      meta: { isSubmit: true },
    });
  };

  return (
    <ButtonBasic
      ref={innerRef}
      {...rest}
      type={type}
      loading={
        loading || (formIsBusy && formActionRequester === innerRef.current)
      }
      readonly={innerReadonly}
      onClick={(event) => {
        handleClick(event);
        onClick?.(event);
      }}
    >
      {children}
    </ButtonBasic>
  );
});
