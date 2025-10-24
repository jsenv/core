import { resolveCSSSize } from "@jsenv/dom";
import { forwardRef } from "preact/compat";
import { useContext, useImperativeHandle, useRef } from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { requestAction } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import "./field_css.js";
import { useActionEvents } from "./use_action_events.js";
import { useFormEvents } from "./use_form_events.js";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
} from "./use_ui_state_controller.js";

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

  button[data-custom] .navi_button_content {
    transition-duration: 0.15s;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-property: transform;
    display: inline-flex;
    position: relative;
    padding-block: 1px;
    padding-inline: 6px;
    border-radius: inherit;
  }

  button[data-custom]:active .navi_button_content {
    transform: scale(0.9);
  }

  button[data-custom]:disabled .navi_button_content {
    transform: none;
  }

  button[data-custom] .navi_button_shadow {
    position: absolute;
    inset: calc(-1 * (var(--field-border-width) + var(--field-outline-width)));
    pointer-events: none;
    border-radius: inherit;
  }
  button[data-custom]:active .navi_button_shadow {
    box-shadow:
      inset 0 3px 6px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(0, 0, 0, 0.1),
      inset 2px 0 4px rgba(0, 0, 0, 0.1),
      inset -2px 0 4px rgba(0, 0, 0, 0.1);
  }
  button[data-custom]:disabled > .navi_button_shadow {
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
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const {
    readOnly,
    disabled,
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
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === innerRef.current);
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;
  let {
    border,
    borderWidth = border === "none" || discrete ? 0 : 1,
    outlineWidth = discrete ? 0 : 1,
    borderColor = "light-dark(#767676, #8e8e93)",
    background,
    backgroundColor = "light-dark(#f3f4f6, #2d3748)",
    ...restStyle
  } = style;
  borderWidth = resolveCSSSize(borderWidth);
  outlineWidth = resolveCSSSize(outlineWidth);

  return (
    <button
      {...rest}
      ref={innerRef}
      data-custom={appearance === "custom" ? "" : undefined}
      data-readonly-silent={innerReadOnly ? "" : undefined}
      data-readonly={innerReadOnly ? "" : undefined}
      aria-busy={innerLoading}
      style={{
        ...restStyle,
      }}
    >
      <LoadableInlineElement
        loading={innerLoading}
        inset={-1}
        color="light-dark(#355fcc, #3b82f6)"
      >
        <span
          className="navi_button_content"
          data-field=""
          data-field-with-background={background === "none" ? undefined : ""}
          data-field-with-hover-effect-on-border=""
          data-field-with-border={borderWidth ? "" : undefined}
          data-field-with-border-hover={discrete ? "" : undefined}
          data-field-with-background-hover={discrete ? "" : undefined}
          data-validation-message-arrow-x="center"
          data-readonly={innerReadOnly ? "" : undefined}
          data-disabled={innerDisabled ? "" : undefined}
          style={{
            "--navi-field-border-width": `${borderWidth}px`,
            "--navi-field-outline-width": `${outlineWidth}px`,
            "--navi-field-border-color": borderColor,
            "--navi-field-background-color": backgroundColor,
          }}
        >
          {children}
          <span className="navi_button_shadow"></span>
        </span>
      </LoadableInlineElement>
    </button>
  );
});

const ButtonWithAction = forwardRef((props, ref) => {
  const {
    action,
    loading,
    onClick,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
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
    const button = innerRef.current;
    requestAction(button, boundAction, {
      event,
      actionOrigin: "action_prop",
    });
  };
  const innerLoading = loading || actionLoading;

  return (
    <ButtonBasic
      // put data-action first to help find it in devtools
      data-action={boundAction.name}
      {...rest}
      ref={innerRef}
      loading={innerLoading}
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
  const { formContext, type, onClick, children, loading, ...rest } = props;
  const formLoading = formContext.loading;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const wouldSubmitFormByType = type === "submit" || type === "image";
  const innerLoading = loading || (formLoading && wouldSubmitFormByType);
  const handleClick = (event) => {
    const buttonElement = innerRef.current;
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
      if (buttonElement.hasAttribute("data-readonly")) {
        event.preventDefault();
      }
      return;
    }
    // prevent default behavior that would submit the form
    // we want to go through the action execution process (with validation and all)
    event.preventDefault();
    form.dispatchEvent(
      new CustomEvent("actionrequested", {
        detail: {
          requester: buttonElement,
          event,
          meta: { isSubmit: true },
          actionOrigin: "action_prop",
        },
      }),
    );
  };

  return (
    <ButtonBasic
      {...rest}
      ref={innerRef}
      type={type}
      loading={innerLoading}
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
    children,
    onClick,
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
      `<Button type="${type}" /> should not have their own action`,
    );
  }
  const { formParamsSignal } = formContext;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const { loading: actionLoading } = useActionStatus(actionBoundToFormParams);

  const innerLoading = loading || actionLoading;
  useFormEvents(innerRef, {
    onFormActionPrevented: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionPrevented?.(e);
      }
    },
    onFormActionStart: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionStart?.(e);
      }
    },
    onFormActionAbort: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionAbort?.(e);
      }
    },
    onFormActionError: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionError?.(e.detail.error);
      }
    },
    onFormActionEnd: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionEnd?.(e);
      }
    },
  });

  return (
    <ButtonBasic
      data-action={actionBoundToFormParams.name}
      {...rest}
      ref={innerRef}
      type={type}
      loading={innerLoading}
      onClick={(event) => {
        const button = innerRef.current;
        const form = button.form;
        event.preventDefault();
        requestAction(form, actionBoundToFormParams, {
          event,
          requester: button,
          actionOrigin: "action_prop",
        });
        onClick?.(event);
      }}
    >
      {children}
    </ButtonBasic>
  );
});
