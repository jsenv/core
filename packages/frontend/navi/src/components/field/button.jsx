import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { getActionPrivateProperties } from "../../action_private_properties.js";
import { useActionStatus } from "../../use_action_status.js";
import { forwardActionRequested } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { FormActionContext } from "../action_execution/form_context.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { initCustomField } from "./custom_field.js";
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
  @layer navi {
    .navi_button {
      position: relative;
      display: inline-flex;
      width: fit-content;
      height: fit-content;
      padding: 0;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      cursor: pointer;

      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      --outline-color: light-dark(#4476ff, #3b82f6);

      --border-radius: 2px;
      --border-color: light-dark(#767676, #8e8e93);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);

      --background-color: light-dark(#f3f4f6, #2d3748);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --background-color-readonly: var(--background-color);
      --background-color-disabled: var(--background-color);

      --color: currentColor;
      --color-readonly: color-mix(in srgb, currentColor 30%, transparent);
      --color-disabled: var(--color-readonly);
    }
    .navi_button_content {
      position: relative;
      display: inline-flex;
      width: 100%;
      padding-top: var(--padding-y);
      padding-right: var(--padding-x);
      padding-bottom: var(--padding-y);
      padding-left: var(--padding-x);
      color: var(--color);
      background-color: var(--background-color);
      border-width: var(--outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--border-radius);
      outline-width: var(--border-width);
      outline-style: solid;
      outline-color: var(--border-color);
      outline-offset: calc(-1 * (var(--border-width)));
      transition-property: transform;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    .navi_button_shadow {
      position: absolute;
      inset: calc(-1 * var(--outer-width));
      border-radius: inherit;
      pointer-events: none;
    }
    /* Focus */
    .navi_button[data-focus-visible] .navi_button_content {
      --border-color: var(--outline-color);
      outline-width: var(--outer-width);
      outline-offset: calc(-1 * var(--outer-width));
    }
    /* Hover */
    .navi_button[data-hover] .navi_button_content {
      --border-color: var(--border-color-hover);
      --background-color: var(--background-color-hover);
    }
    /* Active */
    .navi_button[data-active] .navi_button_content {
      --outline-color: var(--border-color-active);
      transform: scale(0.9);
    }
    .navi_button[data-active] .navi_button_shadow {
      box-shadow:
        inset 0 3px 6px rgba(0, 0, 0, 0.2),
        inset 0 1px 2px rgba(0, 0, 0, 0.3),
        inset 0 0 0 1px rgba(0, 0, 0, 0.1),
        inset 2px 0 4px rgba(0, 0, 0, 0.1),
        inset -2px 0 4px rgba(0, 0, 0, 0.1);
    }
    /* Readonly */
    .navi_button[data-readonly] .navi_button_content {
      --border-color: var(--border-color-disabled);
      --outline-color: var(--border-color-readonly);
      --background-color: var(--background-color-readonly);
      --color: var(--color-readonly);
    }
    /* Disabled */
    .navi_button[data-disabled] {
      cursor: default;
    }
    .navi_button[data-disabled] .navi_button_content {
      --border-color: var(--border-color-disabled);
      --background-color: var(--background-color-disabled);
      --color: var(--color-disabled);
      transform: none; /* no active effect */
    }
    .navi_button[data-disabled] .navi_button_shadow {
      box-shadow: none;
    }
    /* Callout (info, warning, error) */
    .navi_button[data-callout] .navi_button_content {
      --border-color: var(--callout-color);
    }

    /* Discrete variant */
    .navi_button[data-discrete] .navi_button_content {
      --background-color: transparent;
      --border-color: transparent;
    }
    .navi_button[data-discrete][data-hover] .navi_button_content {
      --border-color: var(--border-color-hover);
    }
    .navi_button[data-discrete][data-readonly] .navi_button_content {
      --border-color: transparent;
    }
    .navi_button[data-discrete][data-disabled] .navi_button_content {
      --border-color: transparent;
    }
    button[data-discrete] {
      background-color: transparent;
      border-color: transparent;
    }
    button[data-discrete]:hover {
      border-color: revert;
    }
    button[data-discrete][data-readonly],
    button[data-discrete][data-disabled] {
      border-color: transparent;
    }
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

    // visual
    appearance = "navi",
    discrete,
    className,

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

  const innerClassName = withPropsClassName(
    appearance === "navi" ? "navi_button" : undefined,
    className,
  );
  const [remainingProps, innerStyle, naviButtonStyle] = withPropsStyle(
    rest,
    {
      layout: true,
      visual: false,
      innerSpacing: false,
    },
    {
      visual: true,
      innerSpacing: true,
    },
  );

  let buttonChildren;
  if (appearance === "navi") {
    buttonChildren = (
      <NaviButton buttonRef={innerRef} style={naviButtonStyle}>
        {children}
      </NaviButton>
    );
  } else {
    buttonChildren = children;
  }

  return (
    <button
      {...remainingProps}
      ref={innerRef}
      className={innerClassName}
      style={innerStyle}
      disabled={innerDisabled}
      data-discrete={discrete ? "" : undefined}
      data-readonly={innerReadOnly ? "" : undefined}
      data-readonly-silent={innerLoading ? "" : undefined}
      data-disabled={innerDisabled ? "" : undefined}
      data-callout-arrow-x="center"
      aria-busy={innerLoading}
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        color="light-dark(#355fcc, #3b82f6)"
      />
      {buttonChildren}
    </button>
  );
});
const NaviButton = ({ buttonRef, children, ...rest }) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(buttonRef.current, buttonRef.current);
  }, []);

  return (
    <span ref={ref} className="navi_button_content" {...rest}>
      {children}
      <span className="navi_button_shadow"></span>
    </span>
  );
};

const ButtonWithAction = forwardRef((props, ref) => {
  const {
    action,
    loading,
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

  const innerLoading = loading || actionLoading;

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onRequested: (e) => forwardActionRequested(e, boundAction),
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <ButtonBasic
      // put data-action first to help find it in devtools
      data-action={boundAction.name}
      {...rest}
      ref={innerRef}
      loading={innerLoading}
    >
      {children}
    </ButtonBasic>
  );
});

const ButtonInsideForm = forwardRef((props, ref) => {
  const {
    // eslint-disable-next-line no-unused-vars
    formContext,
    type,
    children,
    loading,
    readOnly,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerLoading = loading;
  const innerReadOnly = readOnly;

  return (
    <ButtonBasic
      {...rest}
      ref={innerRef}
      type={type}
      loading={innerLoading}
      readOnly={innerReadOnly}
    >
      {children}
    </ButtonBasic>
  );
});

const ButtonWithActionInsideForm = forwardRef((props, ref) => {
  const formAction = useContext(FormActionContext);
  const {
    // eslint-disable-next-line no-unused-vars
    formContext, // to avoid passing it to the button element
    type,
    action,
    loading,
    children,
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
  const formParamsSignal = getActionPrivateProperties(formAction).paramsSignal;
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
      onactionrequested={(e) => {
        forwardActionRequested(e, actionBoundToFormParams, e.target.form);
      }}
    >
      {children}
    </ButtonBasic>
  );
});
