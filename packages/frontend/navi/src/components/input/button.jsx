import { resolveCSSSize } from "@jsenv/dom";
import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import "./field_css.js";

/**
 * We need a content the visually shrink (scale down) but the button interactive are must remain intact
 * Otherwise a click on the edges of the button cannot not trigger the click event (mouseup occurs outside the button)
 **/

/**
 * We have to re-define the CSS of button because getComputedStyle(button).borderColor returns
 * rgb(0, 0, 0) while being visually grey in chrome
 * So we redefine chrome styles so that loader can keep up with the actual color visible to the user
 */
import.meta.css = /* css */ `
  button[data-custom] {
    border: none;
    background: none;
    display: inline-block;
    padding: 0;
  }

  button[data-custom] .button-content {
    transition-duration: 0.15s;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-property: transform;
    display: inline-flex;
    position: relative;
    padding-block: 1px;
    padding-inline: 6px;
  }

  button[data-custom]:active .button-content {
    transform: scale(0.9);
  }

  button[data-custom]:disabled .button-content {
    transform: none;
  }

  button[data-custom] .button-content > .shadow {
    position: absolute;
    inset: calc(
      -1 * (var(--button-border-width) + var(--button-outline-width))
    );
    pointer-events: none;
    border-radius: inherit;
  }
  button[data-custom]:active > .button-content > .shadow {
    box-shadow:
      inset 0 3px 6px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(0, 0, 0, 0.1),
      inset 2px 0 4px rgba(0, 0, 0, 0.1),
      inset -2px 0 4px rgba(0, 0, 0, 0.1);
  }
  button[data-custom]:disabled > .button-content > .shadow {
    box-shadow: none;
  }
`;
export const Button = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: ButtonBasic,
    WithAction: ButtonWithAction,
    InsideForm: ButtonInsideForm,
    WithActionInsideForm: ButtonWithActionInsideForm,
  });
});

const ButtonBasic = forwardRef((props, ref) => {
  const {
    readOnly,
    loading,
    constraints = [],
    autoFocus,
    appearance = "custom",
    discrete,
    style = {},
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  let {
    border,
    borderWidth = border === "none" || discrete ? 0 : 1,
    outlineWidth = discrete ? 0 : 1,
    borderColor = "light-dark(#767676, #8e8e93)",
    ...restStyle
  } = style;
  borderWidth = resolveCSSSize(borderWidth);
  outlineWidth = resolveCSSSize(outlineWidth);

  return (
    <button
      ref={innerRef}
      {...rest}
      data-custom={appearance === "custom" ? "" : undefined}
      aria-busy={loading}
      style={{
        ...restStyle,
        "--button-border-width": `${borderWidth}px`,
        "--button-outline-width": `${outlineWidth}px`,
        "--button-border-color": borderColor,
      }}
    >
      <LoadableInlineElement
        loading={loading}
        inset={
          borderWidth -
          // -1 is the outline offset thing
          1
        }
        color="light-dark(#355fcc, #3b82f6)"
      >
        <span
          className="button-content"
          data-field=""
          data-field-with-background=""
          data-field-with-hover=""
          data-field-with-border={borderWidth ? "" : undefined}
          data-field-with-border-hover={discrete ? "" : undefined}
          data-field-with-background-hover={discrete ? "" : undefined}
          data-validation-message-arrow-x="center"
          data-readonly={readOnly ? "" : undefined}
        >
          {children}
          <span className="shadow"></span>
        </span>
      </LoadableInlineElement>
    </button>
  );
});

const ButtonWithAction = forwardRef((props, ref) => {
  const {
    action,
    loading,
    readOnly,
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
  const { loading: actionLoading } = useActionStatus(boundAction);
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
    requestAction(event.target, boundAction, { event });
  };
  const innerLoading = loading || actionLoading;

  return (
    <ButtonBasic
      data-action={boundAction.name}
      ref={innerRef}
      {...rest}
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
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
  const { formContext, type, loading, readOnly, onClick, children, ...rest } =
    props;
  const { formAction, formIsBusy, formIsReadOnly, formActionRequester } =
    formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const wouldSubmitFormByType = type === "submit" || type === "image";
  const innerReadOnly = readOnly || formIsReadOnly;

  const handleClick = (event) => {
    const buttonElement = event.target;
    const { form } = buttonElement;
    let wouldSubmitForm = wouldSubmitFormByType;
    if (!wouldSubmitForm && type === undefined) {
      const formSubmitButton = form.querySelector(
        "button[type='submit'], input[type='submit'], input[type='image']",
      );
      const wouldSubmitFormBecauseSingleButtonWithoutType = !formSubmitButton;
      wouldSubmitForm = wouldSubmitFormBecauseSingleButtonWithoutType;
    }
    if (!wouldSubmitForm) {
      if (innerReadOnly) {
        event.preventDefault();
      }
      return;
    }
    // prevent default behavior that would submit the form
    // we want to go through the action execution process (with validation and all)
    event.preventDefault();
    requestAction(form, formAction, {
      event,
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
      readOnly={innerReadOnly}
      data-readonly-silent={formIsReadOnly ? "" : undefined}
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
    readOnly,
    children,
    onClick,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionAbort,
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

  const { formIsReadOnly, formParamsSignal } = formContext;
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const { loading: actionLoading } = useActionStatus(actionBoundToFormParams);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: (e) => {
      e.target.form.dispatchEvent(
        new CustomEvent("actionstart", { detail: e.detail }),
      );
      onActionStart?.(e);
    },
    onAbort: (e) => {
      e.target.form.dispatchEvent(
        new CustomEvent("actionabort", { detail: e.detail }),
      );
      onActionAbort?.(e);
    },
    onError: (e) => {
      e.target.form.dispatchEvent(
        new CustomEvent("actionerror", { detail: e.detail }),
      );
      onActionError?.(e);
    },
    onEnd: (e) => {
      e.target.form.dispatchEvent(
        new CustomEvent("actionend", { detail: e.detail }),
      );
      onActionEnd?.(e);
    },
  });

  const handleClick = (event) => {
    event.preventDefault();
    // lorsque cette action s'éxecute elle doit mettre le form en mode busy
    // je vois pas encore comment je vais faire ca mais a priori
    // on va juste le faire "manuellement"
    // en utilisnt un truc du formContext
    requestAction(event.target, actionBoundToFormParams, { event });
  };

  return (
    <ButtonBasic
      data-action={actionBoundToFormParams.name}
      ref={innerRef}
      {...rest}
      type={type}
      loading={loading || actionLoading}
      readOnly={readOnly || formIsReadOnly}
      data-readonly-silent={!readOnly && formIsReadOnly ? "" : undefined}
      onClick={(event) => {
        handleClick(event);
        onClick?.(event);
      }}
    >
      {children}
    </ButtonBasic>
  );
});
