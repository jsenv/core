import { useCallback, useContext, useRef } from "preact/hooks";

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
import { Text } from "../text/text.jsx";
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
      --button-outline-width: 1px;
      --button-border-width: 1px;
      --button-border-radius: 2px;
      /* default */
      --button-outline-color: var(--navi-focus-outline-color);
      --button-loader-color: var(--navi-loader-color);
      --button-border-color: light-dark(#767676, #8e8e93);
      --button-background-color: light-dark(#f3f4f6, #2d3748);
      --button-color: currentColor;

      /* Hover */
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-background-color) 95%,
        black
      );
      --button-color-hover: var(--button-color);
      /* Active */
      --button-border-color-active: color-mix(
        in srgb,
        var(--button-border-color) 90%,
        black
      );
      /* Readonly */
      --button-border-color-readonly: color-mix(
        in srgb,
        var(--button-border-color) 30%,
        white
      );
      --button-background-color-readonly: var(--button-background-color);
      --button-color-readonly: color-mix(
        in srgb,
        var(--button-color) 30%,
        transparent
      );
      /* Disabled */
      --button-border-color-disabled: var(--button-border-color-readonly);
      --button-background-color-disabled: var(
        --button-background-color-readonly
      );
      --button-color-disabled: var(--button-color-readonly);
    }
  }

  .navi_button {
    /* Internal css vars are the one controlling final values */
    /* allowing to override them on interactions (like hover, disabled, etc.) */
    --x-button-outline-width: var(--button-outline-width);
    --x-button-border-radius: var(--button-border-radius);
    --x-button-border-width: var(--button-border-width);
    --x-button-outer-width: calc(
      var(--button-x-border-width) + var(--x-button-outline-width)
    );
    --x-button-outline-color: var(--button-outline-color);
    --x-button-border-color: var(--button-border-color);
    --x-button-background-color: var(--button-background-color);
    --x-button-color: var(--button-color);

    position: relative;
    /* display: inline-flex; */
    box-sizing: border-box;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--x-button-border-radius);
    outline: none;
    cursor: pointer;
  }
  .navi_button_content {
    position: relative;
    display: inherit;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding-top: var(
      --button-padding-top,
      var(--button-padding-y, var(--button-padding, 1px))
    );
    padding-right: var(
      --button-padding-right,
      var(--button-padding-x, var(--button-padding, 6px))
    );
    padding-bottom: var(
      --button-padding-bottom,
      var(--button-padding-y, var(--button-padding, 1px))
    );
    padding-left: var(
      --button-padding-left,
      var(--button-padding-x, var(--button-padding, 6px))
    );
    align-items: inherit;
    justify-content: inherit;
    color: var(--x-button-color);
    background-color: var(--x-button-background-color);
    border-width: var(--x-button-outer-width);
    border-style: solid;
    border-color: transparent;
    border-radius: var(--x-button-border-radius);
    outline-width: var(--x-button-border-width);
    outline-style: solid;
    outline-color: var(--x-button-border-color);
    outline-offset: calc(-1 * (var(--x-button-border-width)));
    transition-property: transform;
    transition-duration: 0.15s;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  .navi_button_shadow {
    position: absolute;
    inset: calc(-1 * var(--x-button-outer-width));
    border-radius: inherit;
    pointer-events: none;
  }

  /* Hover */
  .navi_button[data-hover] {
    --x-button-border-color: var(--button-border-color-hover);
    --x-button-background-color: var(--button-background-color-hover);
    --x-button-color: var(--button-color-hover);
  }
  .navi_button[data-nohover] {
    --x-button-border-color: var(--button-border-color);
    --x-button-background-color: var(--button-background-color);
    --x-button-color: var(--button-color);
  }
  /* Active */
  .navi_button[data-active] {
    --x-button-outline-color: var(--button-border-color-active);
  }
  .navi_button[data-active] .navi_button_content {
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
  .navi_button[data-readonly] {
    --x-button-border-color: var(--button-border-color-readonly);
    --x-button-background-color: var(--button-background-color-readonly);
    --x-button-color: var(--button-color-readonly);
  }
  /* Focus */
  .navi_button[data-focus-visible] {
    --x-button-border-color: var(--x-button-outline-color);
  }
  .navi_button[data-focus-visible] .navi_button_content {
    outline-width: var(--x-button-outer-width);
    outline-offset: calc(-1 * var(--x-button-outer-width));
  }
  /* Disabled */
  .navi_button[data-disabled] {
    color: unset;
    cursor: default;
  }
  .navi_button[data-disabled] {
    --x-border-color: var(--button-border-color-disabled);
    --x-background-color: var(--button-background-color-disabled);
    --x-color: var(--button-color-disabled);
  }
  /* no active effect */
  .navi_button[data-disabled] .navi_button_content {
    transform: none;
  }
  .navi_button[data-disabled] .navi_button_shadow {
    box-shadow: none;
  }
  /* Callout (info, warning, error) */
  .navi_button[data-callout] {
    --x-button-border-color: var(--callout-color);
  }

  /* Discrete variant */
  .navi_button[data-discrete] {
    --x-button-background-color: transparent;
    --x-button-border-color: transparent;
  }
  .navi_button[data-discrete][data-hover] {
    --x-button-border-color: var(--button-border-color-hover);
  }
  .navi_button[data-discrete][data-nohover] {
    --x-button-border-color: transparent;
  }
  .navi_button[data-discrete][data-readonly] {
    --x-button-border-color: transparent;
  }
  .navi_button[data-discrete][data-disabled] {
    --x-button-border-color: transparent;
  }

  .navi_button > img {
    border-radius: inherit;
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

const ButtonStyleCSSVars = {
  "outlineWidth": "--button-outline-width",
  "borderWidth": "--button-border-width",
  "borderRadius": "--button-border-radius",
  "paddingTop": "--button-padding-top",
  "paddingRight": "--button-padding-right",
  "paddingBottom": "--button-padding-bottom",
  "paddingLeft": "--button-padding-left",
  "backgroundColor": "--button-background-color",
  "borderColor": "--button-border-color",
  "color": "--button-color",
  ":hover": {
    backgroundColor: "--button-background-color-hover",
    borderColor: "--button-border-color-hover",
    color: "--button-color-hover",
  },
  ":active": {
    borderColor: "--button-border-color-active",
  },
  ":read-only": {
    backgroundColor: "--button-background-color-readonly",
    borderColor: "--button-border-color-readonly",
    color: "--button-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--button-background-color-disabled",
    borderColor: "--button-border-color-disabled",
    color: "--button-color-disabled",
  },
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

    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  useAutoFocus(ref, autoFocus);
  useConstraints(ref, constraints);
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;

  const renderButtonContent = (buttonProps) => {
    return (
      <Text {...buttonProps} className="navi_button_content">
        {children}
        <span className="navi_button_shadow"></span>
      </Text>
    );
  };
  const renderButtonContentMemoized = useCallback(renderButtonContent, []);

  return (
    <Box
      box="auto"
      {...rest}
      as="button"
      ref={ref}
      data-discrete={discrete ? "" : undefined}
      data-readonly-silent={innerLoading ? "" : undefined}
      data-callout-arrow-x="center"
      aria-busy={innerLoading}
      // style management
      baseClassName="navi_button"
      styleCSSVars={ButtonStyleCSSVars}
      pseudoClasses={ButtonPseudoClasses}
      pseudoElements={ButtonPseudoElements}
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      visualSelector=".navi_button_content"
      hasChildFunction
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        color="var(--button-loader-color)"
      />
      {renderButtonContentMemoized}
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
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
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
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const hasEffectOnForm =
    type === "submit" || type === "reset" || type === "image";
  if (import.meta.dev && hasEffectOnForm) {
    throw new Error(
      `<Button type="${type}" /> should not have their own action`,
    );
  }
  const formParamsSignal = getActionPrivateProperties(formAction).paramsSignal;
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
