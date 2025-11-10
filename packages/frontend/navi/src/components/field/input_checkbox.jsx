import { pickLightOrDark } from "@jsenv/dom";
import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { requestAction } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { Box } from "../layout/box.jsx";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useStableCallback } from "../use_stable_callback.js";
import {
  ReportDisabledOnLabelContext,
  ReportReadOnlyOnLabelContext,
} from "./label.jsx";
import { useActionEvents } from "./use_action_events.js";
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

// to finish: la couleur du checkmark: faire un exemple navi/natif
// avec le constraste de couleur
// et voir comment la checkbox se comporte au hover/checked aussi au passage

import.meta.css = /* css */ `
  @layer navi {
    .navi_checkbox {
      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --color: light-dark(#4476ff, #3b82f6);
      --checkmark-color-light: white;
      --checkmark-color-dark: rgb(55, 55, 55);
      --checkmark-color: var(--checkmark-color-light);

      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-light);

      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 60%, black);
      --border-color-hover-checked: color-mix(
        in srgb,
        var(--color) 80%,
        var(--color-mix)
      );
      --background-color-hover-checked: color-mix(
        in srgb,
        var(--color) 80%,
        var(--color-mix)
      );
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-readonly-checked: #d3d3d3;
      --background-color-readonly-checked: grey;
      --checkmark-color-readonly: #eeeeee;
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: rgba(248, 248, 248, 0.7);
      --checkmark-color-disabled: #eeeeee;
      --border-color-disabled-checked: #d3d3d3;
      --background-color-disabled-checked: #d3d3d3;
    }

    .navi_checkbox[data-dark] {
      --color-mix: var(--color-mix-dark);
      --checkmark-color: var(--navi-checkmark-color-dark);
    }
  }

  .navi_checkbox {
    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    margin: 3px 3px 3px 4px;

    --x-border-radius: var(--border-radius);
    --x-outline-offset: var(--outline-offset);
    --x-outline-width: var(--outline-width);
    --x-border-width: var(--border-width);
    --x-width: var(--width);
    --x-height: var(--height);
    --x-outline-color: var(--outline-color);
    --x-background-color: var(--background-color);
    --x-border-color: var(--border-color);
    --x-color: var(--color);
    --x-checkmark-color: var(--checkmark-color);
  }
  .navi_checkbox .navi_native_field {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    border: none;
    opacity: 0;
    cursor: inherit;
  }
  .navi_checkbox .navi_checkbox_field {
    display: inline-flex;
    box-sizing: border-box;
    width: var(--x-width);
    height: var(--x-height);
    background-color: var(--x-background-color);
    border-width: var(--x-border-width);
    border-style: solid;
    border-color: var(--x-border-color);
    border-radius: var(--x-border-radius);
    outline-width: var(--x-outline-width);
    outline-style: none;
    outline-color: var(--x-outline-color);
    outline-offset: var(--x-outline-offset);
  }
  .navi_checkbox_marker {
    width: 100%;
    height: 100%;
    opacity: 0;
    stroke: var(--x-checkmark-color);
    transform: scale(0.5);
    transition: all 0.15s ease;
    pointer-events: none;
  }
  .navi_checkbox[data-checked] .navi_checkbox_marker {
    opacity: 1;
    transform: scale(1);
  }

  /* Focus */
  .navi_checkbox[data-focus-visible] .navi_checkbox_field {
    outline-style: solid;
  }
  /* Hover */
  .navi_checkbox[data-hover] {
    --x-border-color: var(--border-color-hover);
  }
  .navi_checkbox[data-checked][data-hover] {
    --x-border-color: var(--border-color-hover-checked);
    --x-background-color: var(--background-color-hover-checked);
  }
  /* Checked */
  .navi_checkbox[data-checked] {
    --x-background-color: var(--x-color);
    --x-border-color: var(--x-color);
  }
  /* Readonly */
  .navi_checkbox[data-readonly],
  .navi_checkbox[data-readonly][data-hover] {
    --x-border-color: var(--border-color-readonly);
    --x-background-color: var(--background-color-readonly);
  }
  .navi_checkbox[data-readonly][data-checked] {
    --x-border-color: var(--border-color-readonly-checked);
    --x-background-color: var(--background-color-readonly-checked);
    --x-checkmark-color: var(--checkmark-color-readonly);
  }
  /* Disabled */
  .navi_checkbox[data-disabled] {
    --x-border-color: var(--border-color-disabled);
    --x-background-color: var(--background-color-disabled);
  }
  .navi_checkbox[data-disabled][data-checked] {
    --x-border-color: var(--border-color-disabled-checked);
    --x-background-color: var(--background-color-disabled-checked);
    --x-checkmark-color: var(--checkmark-color-disabled);
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
    InsideForm: InputCheckboxInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {checkbox}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const CheckboxManagedByCSSVars = {
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "borderRadius": "--border-radius",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "color": "--color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
    color: "--color-hover",
  },
  ":active": {
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
    color: "--color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
    color: "--color-disabled",
  },
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

    name,
    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    constraints = [],
    onClick,
    onInput,

    color,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
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
  useConstraints(ref, constraints);

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
    innerName,
    checked,
    innerRequired,
  ]);

  useLayoutEffect(() => {
    const naviCheckbox = ref.current;
    const lightColor = "var(--checkmark-color-light)";
    const darkColor = "var(--checkmark-color-dark)";
    const colorPicked = pickLightOrDark(
      "var(--color)",
      lightColor,
      darkColor,
      naviCheckbox,
    );
    if (colorPicked === lightColor) {
      naviCheckbox.removeAttribute("data-dark");
    } else {
      naviCheckbox.setAttribute("data-dark", "");
    }
  }, [color]);

  return (
    <Box
      as="span"
      {...rest}
      ref={ref}
      baseClassName="navi_checkbox"
      pseudoStateSelector=".navi_native_field"
      managedByCSSVars={CheckboxManagedByCSSVars}
      pseudoClasses={CheckboxPseudoClasses}
      pseudoElements={CheckboxPseudoElements}
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      color={color}
      hasChildFunction
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        color="var(--loader-color)"
      />
      {renderCheckboxMemoized}
      <div className="navi_checkbox_field">
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="navi_checkbox_marker"
        >
          <path d="M10.5 2L4.5 9L1.5 5.5" fill="none" strokeWidth="2" />
        </svg>
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
    onChange,
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
  const { loading: actionLoading } = useActionStatus(actionBoundToUIState);
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
      onChange={(e) => {
        requestAction(e.target, actionBoundToUIState, {
          event: e,
        });
        onChange?.(e);
      }}
    />
  );
};
const InputCheckboxInsideForm = InputCheckboxBasic;
