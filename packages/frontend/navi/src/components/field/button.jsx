import { useContext, useRef } from "preact/hooks";

import { getActionPrivateProperties } from "../../action_private_properties.js";
import { useActionStatus } from "../../use_action_status.js";
import { forwardActionRequested } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { FormActionContext } from "../action_execution/form_context.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { Box } from "../layout/box.jsx";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { applyContentSpacingOnTextChildren } from "../text/text.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
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
      display: flex;
      width: fit-content;
      height: fit-content;
      padding: 0;
      flex-direction: inherit;
      align-items: inherit;
      justify-content: inherit;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      cursor: pointer;

      --outline-width: 1px;
      --border-width: 1px;
      --border-radius: 2px;
      --padding-x: 6px;
      --padding-y: 1px;
      --outline-color: light-dark(#4476ff, #3b82f6);
      --background-color: light-dark(#f3f4f6, #2d3748);
      --border-color: light-dark(#767676, #8e8e93);
      --color: currentColor;
    }
    .navi_button_content {
      /* Internal css vars are the one controlling final values */
      /* allowing to override them on interactions (like hover, disabled, etc.) */
      --x-outline-width: var(--outline-width);
      --x-border-radius: var(--border-radius);
      --x-border-width: var(--border-width);
      --x-outer-width: calc(var(--x-border-width) + var(--x-outline-width));

      --x-outline-color: var(--outline-color);
      --x-background-color: var(--background-color);
      --x-border-color: var(--border-color);
      --x-color: var(--color);

      --x-background-color-hover: var(
        --background-color-hover,
        color-mix(in srgb, var(--background-color) 95%, black)
      );
      --x-background-color-readonly: var(
        --background-color-readonly,
        var(--x-background-color)
      );
      --x-background-color-disabled: var(
        --background-color-disabled,
        var(--background-color)
      );
      --x-border-color-hover: var(
        --border-color-hover,
        color-mix(in srgb, var(--border-color) 70%, black)
      );
      --x-border-color-active: var(
        --border-color-active,
        color-mix(in srgb, var(--border-color) 90%, black)
      );
      --x-border-color-readonly: var(
        --border-color-readonly,
        color-mix(in srgb, var(--border-color) 30%, white)
      );
      --x-border-color-disabled: var(
        --border-color-disabled,
        var(--x-border-color-readonly)
      );
      --x-color-hover: var(--color-hover, var(--x-color));
      --x-color-readonly: var(
        --color-readonly,
        color-mix(in srgb, var(--color) 30%, transparent)
      );
      --x-color-disabled: var(--color-disabled, var(--x-color-readonly));

      position: relative;
      padding-top: var(--padding-top, var(--padding-y));
      padding-right: var(--padding-right, var(--padding-x));
      padding-bottom: var(--padding-bottom, var(--padding-y));
      padding-left: var(--padding-left, var(--padding-x));
      color: var(--x-color);
      background-color: var(--x-background-color);
      border-width: var(--x-outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--x-border-radius);
      outline-width: var(--x-border-width);
      outline-style: solid;
      outline-color: var(--x-border-color);
      outline-offset: calc(-1 * (var(--x-border-width)));
      transition-property: transform;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    .navi_button_shadow {
      position: absolute;
      inset: calc(-1 * var(--x-outer-width));
      border-radius: inherit;
      pointer-events: none;
    }
    /* Hover */
    .navi_button[data-hover] .navi_button_content {
      --x-color: var(--x-color-hover);
      --x-border-color: var(--x-border-color-hover);
      --x-background-color: var(--x-background-color-hover);
    }
    /* Focus */
    .navi_button[data-focus-visible] .navi_button_content {
      --x-border-color: var(--x-outline-color);
      outline-width: var(--x-outer-width);
      outline-offset: calc(-1 * var(--x-outer-width));
    }
    /* Active */
    .navi_button[data-active] .navi_button_content {
      --x-outline-color: var(--x-border-color-active);
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
      --x-border-color: var(--x-border-color-disabled);
      --x-outline-color: var(--x-border-color-readonly);
      --x-background-color: var(--x-background-color-readonly);
      --x-color: var(--x-color-readonly);
    }
    /* Disabled */
    .navi_button[data-disabled] {
      color: unset;
      cursor: default;
    }
    .navi_button[data-disabled] .navi_button_content {
      --x-border-color: var(--x-border-color-disabled);
      --x-background-color: var(--x-background-color-disabled);
      --x-color: var(--x-color-disabled);
      transform: none; /* no active effect */
    }
    .navi_button[data-disabled] .navi_button_shadow {
      box-shadow: none;
    }
    /* Callout (info, warning, error) */
    .navi_button[data-callout] .navi_button_content {
      --x-border-color: var(--callout-color);
    }

    /* Discrete variant */
    .navi_button[data-discrete] .navi_button_content {
      --x-background-color: transparent;
      --x-border-color: transparent;
    }
    .navi_button[data-discrete][data-hover] .navi_button_content {
      --x-border-color: var(--x-border-color-hover);
    }
    .navi_button[data-discrete][data-readonly] .navi_button_content {
      --x-border-color: transparent;
    }
    .navi_button[data-discrete][data-disabled] .navi_button_content {
      --x-border-color: transparent;
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
export const Button = (props) => {
  return renderActionableComponent(props, {
    Basic: ButtonBasic,
    WithAction: ButtonWithAction,
    InsideForm: ButtonInsideForm,
    WithActionInsideForm: ButtonWithActionInsideForm,
  });
};

const ButtonPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
const ButtonPseudoElements = ["::-navi-loader"];
const ButtonManagedByCSSVars = {
  outlineWidth: "--outline-width",
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  backgroundColor: "--background-color",
  borderColor: "--border-color",
  textColor: "--color",
};
const ButtonBasic = (props) => {
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
    discrete,
    className,
    contentSpacing = " ",

    children,
    ref = useRef(),
    ...rest
  } = props;

  useAutoFocus(ref, autoFocus);
  useConstraints(ref, constraints);
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;
  const innerClassName = withPropsClassName("navi_button", className);

  return (
    <Box
      {...rest}
      as="button"
      ref={ref}
      className={innerClassName}
      data-discrete={discrete ? "" : undefined}
      data-readonly-silent={innerLoading ? "" : undefined}
      data-callout-arrow-x="center"
      aria-busy={innerLoading}
      // style management
      contentSelector=".navi_button_content"
      pseudoClasses={ButtonPseudoClasses}
      pseudoElements={ButtonPseudoElements}
      managedByCSSVars={ButtonManagedByCSSVars}
      disabled={innerDisabled}
      readOnly={innerReadOnly}
      loading={innerLoading}
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        color="light-dark(#355fcc, #3b82f6)"
      />
      <span className="navi_button_content">
        {applyContentSpacingOnTextChildren(children, contentSpacing)}
        <span className="navi_button_shadow"></span>
      </span>
    </Box>
  );
};

const ButtonWithAction = (props) => {
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
  const ref = useRef();
  const boundAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });

  const innerLoading = loading || actionLoading;

  useActionEvents(ref, {
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
      ref={ref}
      loading={innerLoading}
    >
      {children}
    </ButtonBasic>
  );
};
const ButtonInsideForm = (props) => {
  const {
    // eslint-disable-next-line no-unused-vars
    formContext,
    type,
    children,
    loading,
    readOnly,
    ...rest
  } = props;
  const innerLoading = loading;
  const innerReadOnly = readOnly;

  return (
    <ButtonBasic
      {...rest}
      type={type}
      loading={innerLoading}
      readOnly={innerReadOnly}
    >
      {children}
    </ButtonBasic>
  );
};
const ButtonWithActionInsideForm = (props) => {
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
  const ref = useRef();
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const { loading: actionLoading } = useActionStatus(actionBoundToFormParams);

  const innerLoading = loading || actionLoading;
  useFormEvents(ref, {
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
      ref={ref}
      type={type}
      loading={innerLoading}
      onactionrequested={(e) => {
        forwardActionRequested(e, actionBoundToFormParams, e.target.form);
      }}
    >
      {children}
    </ButtonBasic>
  );
};
