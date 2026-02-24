import { pickLightOrDark } from "@jsenv/dom";
import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { useStableCallback } from "../utils/use_stable_callback.js";
import {
  ReportDisabledOnLabelContext,
  ReportReadOnlyOnLabelContext,
} from "./label.jsx";
import { useActionEvents } from "./use_action_events.js";
import { useAutoFocus } from "./use_auto_focus.js";
import {
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  RequiredContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";
import { forwardActionRequested } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_checkbox {
      --margin: 3px 3px 3px 4px;
      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 0.815em;
      --height: 0.815em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      --background-color-checked: var(--accent-color);
      --border-color-checked: var(--accent-color);
      --checkmark-color-light: white;
      --checkmark-color-dark: rgb(55, 55, 55);
      --checkmark-color: var(--checkmark-color-light);
      --cursor: pointer;

      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-light);

      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 60%, black);
      --border-color-hover-checked: color-mix(
        in srgb,
        var(--border-color-checked) 80%,
        var(--color-mix)
      );
      --background-color-hover: var(--background-color);
      --background-color-hover-checked: color-mix(
        in srgb,
        var(--background-color-checked) 80%,
        var(--color-mix)
      );
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-readonly-checked: #d3d3d3;
      --background-color-readonly-checked: color-mix(
        in srgb,
        var(--background-color-checked) 30%,
        grey
      );
      --checkmark-color-readonly: #eeeeee;
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: rgba(248, 248, 248, 0.7);
      --checkmark-color-disabled: #eeeeee;
      --border-color-disabled-checked: #d3d3d3;
      --background-color-disabled-checked: #d3d3d3;

      /* Toggle specific */
      --toggle-margin: 2px;
      --toggle-width: 2.5em;
      --toggle-thumb-size: 1.2em;
      /* Padding uses px and not em otherwise it can be resolved to a float which does not play well */
      /* With the translation calc in some configurations. In the end 2px is nice in all sizes and can still be configured for exceptions */
      --toggle-padding: 2px;
      --toggle-border-radius: calc(
        var(--toggle-thumb-size) / 2 + calc(var(--toggle-padding) * 2)
      );
      --toggle-thumb-border-radius: 50%;
      --toggle-background-color: light-dark(#767676, #8e8e93);
      --toggle-background-color-checked: var(--accent-color);
      --toggle-background-color-hover: color-mix(
        in srgb,
        var(--toggle-background-color) 60%,
        white
      );
      --toggle-background-color-readonly: color-mix(
        in srgb,
        var(--toggle-background-color) 40%,
        transparent
      );
      --toggle-background-color-disabled: color-mix(
        in srgb,
        var(--toggle-background-color) 15%,
        #d3d3d3
      );
      --toggle-background-color-hover-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 90%,
        black
      );
      --toggle-background-color-readonly-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 40%,
        transparent
      );
      --toggle-background-color-disabled-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 15%,
        #d3d3d3
      );
      --toggle-thumb-color: white;

      /* Button specific */
      --button-border-color: light-dark(#767676, #8e8e93);
      --button-background-color: light-dark(#f3f4f6, #2d3748);
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

      &[data-dark] {
        --color-mix: var(--color-mix-dark);
        --checkmark-color: var(--checkmark-color-dark);
      }
    }
  }

  .navi_checkbox {
    --x-background-color: var(--background-color);
    --x-border-color: var(--border-color);
    --x-checkmark-color: var(--checkmark-color);
    --x-cursor: var(--cursor);

    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    margin: var(--margin);

    .navi_native_field {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: inherit;
      opacity: 0;
      appearance: none; /* This allows border-radius to have an effect */
      cursor: var(--x-cursor);
    }

    .navi_checkbox_field {
      display: inline-flex;
      box-sizing: border-box;
      width: var(--width);
      height: var(--height);
      background-color: var(--x-background-color);
      border-width: var(--border-width);
      border-style: solid;
      border-color: var(--x-border-color);
      border-radius: var(--border-radius);
      outline-width: var(--outline-width);
      outline-style: none;
      outline-color: var(--outline-color);
      outline-offset: var(--outline-offset);
      pointer-events: none;
    }

    /* Focus */
    &[data-focus-visible] {
      z-index: 1;
      .navi_checkbox_field {
        outline-style: solid;
      }
    }
    /* Hover */
    &[data-hover] {
      --x-background-color: var(--background-color-hover);
      --x-border-color: var(--border-color-hover);

      &[data-checked] {
        --x-border-color: var(--border-color-hover-checked);
        --x-background-color: var(--background-color-hover-checked);
      }
    }
    /* Checked */
    &[data-checked] {
      --x-background-color: var(--background-color-checked);
      --x-border-color: var(--border-color-checked);
    }
    /* Readonly */
    &[data-readonly],
    &[data-readonly][data-hover] {
      --x-border-color: var(--border-color-readonly);
      --x-background-color: var(--background-color-readonly);
      --x-cursor: default;

      &[data-checked] {
        --x-border-color: var(--border-color-readonly-checked);
        --x-background-color: var(--background-color-readonly-checked);
        --x-checkmark-color: var(--checkmark-color-readonly);
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-border-color: var(--border-color-disabled);
      --x-background-color: var(--background-color-disabled);
      --x-cursor: default;

      &[data-checked] {
        --x-border-color: var(--border-color-disabled-checked);
        --x-background-color: var(--background-color-disabled-checked);
        --x-checkmark-color: var(--checkmark-color-disabled);
      }
    }

    /* Checkbox appearance */
    &[data-appearance="checkbox"] {
      .navi_checkbox_marker {
        width: 100%;
        height: 100%;
        opacity: 0;
        stroke: var(--x-checkmark-color);
        transform: scale(0.5);
      }

      &[data-checked] {
        .navi_checkbox_marker {
          opacity: 1;
          transform: scale(1);
          transition-property: opacity, transform;
          transition-duration: 0.15s;
          transition-timing-function: ease;
        }
      }
    }

    /* Toggle appearance */
    &[data-appearance="toggle"] {
      --margin: var(--toggle-margin);
      --padding: var(--toggle-padding);
      --width: var(--toggle-width);
      --height: unset;
      --border-radius: var(--toggle-border-radius);
      --background-color: var(--toggle-background-color);
      --background-color-hover: var(--toggle-background-color-hover);
      --background-color-readonly: var(--toggle-background-color-readonly);
      --background-color-disabled: var(--toggle-background-color-disabled);
      --background-color-checked: var(--toggle-background-color-checked);
      --background-color-hover-checked: var(
        --toggle-background-color-hover-checked
      );
      --background-color-readonly-checked: var(
        --toggle-background-color-readonly-checked
      );
      --background-color-disabled-checked: var(
        --toggle-background-color-disabled-checked
      );

      .navi_checkbox_field {
        position: relative;
        box-sizing: border-box;
        width: var(--width);
        height: var(--height);
        padding: var(--padding);
        background-color: var(--x-background-color);
        border-color: transparent;
        user-select: none;

        .navi_checkbox_toggle {
          width: var(--toggle-thumb-size);
          height: var(--toggle-thumb-size);
          border-radius: var(--toggle-thumb-border-radius);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          fill: var(--toggle-thumb-color);
          transform: translateX(0);
          transition: transform 0.2s ease;
        }
      }

      &[data-checked] {
        .navi_checkbox_toggle {
          /* We remove padding 3 times */
          /* - twice to get real width (box-sizing: border-box) */
          /* - one more to apply right padding to the translation */
          transform: translateX(
            calc(
              var(--toggle-width) - var(--toggle-thumb-size) - var(
                  --toggle-padding
                ) *
                3
            )
          );
        }
      }
    }

    &[data-appearance="icon"] {
      --margin: 0;
      --outline-offset: 0px;
      --width: auto;
      --height: auto;

      .navi_checkbox_field {
        background: none;
        border: none;
      }
    }

    &[data-appearance="button"] {
      --margin: 0;
      --outline-offset: 0px;
      --width: auto;
      --height: auto;
      --padding: 4px;
      --border-color: var(--button-border-color);
      --border-color-hover: var(--button-border-color-hover);
      --background-color: var(--button-background-color);
      --background-color-hover: var(--button-background-color-hover);
      --background-color-readonly: var(--button-background-color-readonly);
      --background-color-disabled: var(--button-background-color-disabled);
      --border-color-checked: var(--button-border-color);
      --background-color-checked: var(--button-background-color);

      .navi_checkbox_field {
        padding-top: var(--padding-top, var(--padding-y, var(--padding)));
        padding-right: var(--padding-right, var(--padding-x, var(--padding)));
        padding-bottom: var(--padding-bottom, var(--padding-y, var(--padding)));
        padding-left: var(--padding-left, var(--padding-x, var(--padding)));
      }
    }
  }
`;

export const InputCheckbox = (props) => {
  const { value = "on" } = props;
  const uiStateController = useUIStateController(props, "checkbox", {
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? value : undefined),
    getPropFromState: Boolean,
  });
  const uiState = useUIState(uiStateController);

  const checkbox = renderActionableComponent(props, {
    Basic: InputCheckboxBasic,
    WithAction: InputCheckboxWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {checkbox}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const CheckboxStyleCSSVars = {
  "width": "--width",
  "height": "--height",
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "accentColor": "--accent-color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
  },
  ":active": {
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
  },
};
const CheckboxToggleStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  width: "--toggle-width",
  height: "--toggle-height",
  borderRadius: "--border-radius",
};
const CheckboxButtonStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  paddingTop: "--padding-top",
  paddingRight: "--padding-right",
  paddingBottom: "--padding-bottom",
  paddingLeft: "--padding-left",
  paddingX: "--padding-x",
  paddingY: "--padding-y",
  padding: "--padding",
};
const CheckboxPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":checked",
  ":-navi-loading",
];
const CheckboxPseudoElements = ["::-navi-loader", "::-navi-checkmark"];
const InputCheckboxBasic = (props) => {
  const contextFieldName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const loadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const reportDisabledOnLabel = useContext(ReportDisabledOnLabelContext);
  const {
    /* eslint-disable no-unused-vars */
    type,
    defaultChecked,
    /* eslint-enable no-unused-vars */

    id,
    name,
    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    onClick,
    onInput,

    accentColor,
    icon,
    appearance = icon ? "icon" : "checkbox", // "checkbox", "toggle", "icon", "button"
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const innerName = name || contextFieldName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading =
    loading || (contextLoading && loadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);

  const checked = Boolean(uiState);
  const innerOnClick = useStableCallback((e) => {
    if (innerReadOnly) {
      e.preventDefault();
    }
    onClick?.(e);
  });
  const innerOnInput = useStableCallback((e) => {
    const checkbox = e.target;
    const checkboxIsChecked = checkbox.checked;
    uiStateController.setUIState(checkboxIsChecked, e);
    onInput?.(e);
  });
  const renderCheckbox = (checkboxProps) => (
    <Box
      {...checkboxProps}
      id={id}
      as="input"
      ref={ref}
      type="checkbox"
      name={innerName}
      checked={checked}
      required={innerRequired}
      baseClassName="navi_native_field"
      data-callout-arrow-x="center"
      onClick={innerOnClick}
      onInput={innerOnInput}
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    />
  );
  const renderCheckboxMemoized = useCallback(renderCheckbox, [
    id,
    innerName,
    checked,
    innerRequired,
  ]);

  const boxRef = useRef();
  useLayoutEffect(() => {
    const naviCheckbox = boxRef.current;
    const lightColor = "var(--checkmark-color-light)";
    const darkColor = "var(--checkmark-color-dark)";
    const colorPicked = pickLightOrDark(
      "var(--accent-color)",
      lightColor,
      darkColor,
      naviCheckbox,
    );
    if (colorPicked === lightColor) {
      naviCheckbox.removeAttribute("data-dark");
    } else {
      naviCheckbox.setAttribute("data-dark", "");
    }
  }, [accentColor]);

  return (
    <Box
      as="span"
      {...remainingProps}
      ref={boxRef}
      data-appearance={appearance}
      baseClassName="navi_checkbox"
      pseudoStateSelector=".navi_native_field"
      styleCSSVars={
        appearance === "toggle"
          ? CheckboxToggleStyleCSSVars
          : appearance === "button"
            ? CheckboxButtonStyleCSSVars
            : CheckboxStyleCSSVars
      }
      pseudoClasses={CheckboxPseudoClasses}
      pseudoElements={CheckboxPseudoElements}
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      accentColor={accentColor}
      hasChildFunction
      preventInitialTransition
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        color="var(--loader-color)"
        targetSelector=".navi_checkbox_field"
      />
      {renderCheckboxMemoized}
      <div className="navi_checkbox_field">
        {icon ? (
          <div className="navi_checkbox_icon" aria-hidden="true">
            {Array.isArray(icon) ? icon[checked ? 1 : 0] : icon}
          </div>
        ) : appearance === "toggle" ? (
          <Box
            className="navi_checkbox_toggle"
            as="svg"
            viewBox="0 0 12 12"
            aria-hidden="true"
            preventInitialTransition
          >
            <circle cx="6" cy="6" r="5"></circle>
          </Box>
        ) : (
          <Box
            className="navi_checkbox_marker"
            as="svg"
            viewBox="0 0 12 12"
            aria-hidden="true"
            preventInitialTransition
          >
            <path d="M10.5 2L4.5 9L1.5 5.5" fill="none" strokeWidth="2" />
          </Box>
        )}
      </div>
    </Box>
  );
};

const InputCheckboxWithAction = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    onCancel,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const actionStatus = useActionStatus(actionBoundToUIState);
  const { loading: actionLoading } = actionStatus;
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });

  // In this situation updating the ui state === calling associated action
  // so cance/abort/error have to revert the ui state to the one before user interaction
  // to show back the real state of the checkbox (not the one user tried to set)
  useActionEvents(ref, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onRequested: (e) => forwardActionRequested(e, actionBoundToUIState),
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: (e) => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      onActionEnd?.(e);
    },
  });

  return (
    <InputCheckboxBasic
      data-action={actionBoundToUIState.name}
      {...rest}
      ref={ref}
      loading={loading || actionLoading}
    />
  );
};
