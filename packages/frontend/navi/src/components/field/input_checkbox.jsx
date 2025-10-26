import { pickLightOrDark } from "@jsenv/dom";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { requestAction } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import {
  LoadableInlineElement,
  LoaderBackground,
} from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { initCustomField } from "./custom_field.js";
import {
  ReportDisabledOnLabelContext,
  ReportReadOnlyOnLabelContext,
} from "./label.jsx";
import "./navi_css_vars.js";
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

import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-checkmark-color-light: white;
      --navi-checkmark-color-dark: rgb(55, 55, 55);
      --navi-checkmark-color: var(--navi-checkmark-light-color);
    }

    .navi_checkbox {
      position: relative;
      display: inline-flex;
      box-sizing: content-box;

      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      /* --color: currentColor; */
      --checkmark-color: var(--navi-checkmark-color);

      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-checked-readonly: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-checked-readonly: var(
        --navi-background-color-readonly
      );
      --background-color-checked-disabled: var(
        --navi-background-color-disabled
      );
      --checkmark-color-readonly: var(--navi-color-readonly);
      --checkmark-color-disabled: var(--navi-color-disabled);
    }
    .navi_checkbox input {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      opacity: 0;
      cursor: inherit;
    }
    .navi_checkbox_field {
      display: inline-flex;
      box-sizing: border-box;
      width: var(--width);
      height: var(--height);
      margin: 3px 3px 3px 4px;
      background-color: var(--background-color);
      border-width: var(--border-width);
      border-style: solid;
      border-color: var(--border-color);
      border-radius: var(--border-radius);
      outline-width: var(--outline-width);

      outline-style: none;

      outline-color: var(--outline-color);
      outline-offset: var(--outline-offset);
      /* color: var(--color); */
    }
    .navi_checkbox_marker {
      width: 100%;
      height: 100%;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.15s ease;
      pointer-events: none;
    }

    /* Focus */
    .navi_checkbox[data-focus-visible] .navi_checkbox_field {
      outline-style: solid;
    }
    /* Hover */
    .navi_checkbox[data-hover] .navi_checkbox_field {
      --border-color: var(--border-color-hover);
    }
    /* Checked */
    .navi_checkbox[data-checked] .navi_checkbox_field {
      --background-color: var(--accent-color);
      --border-color: var(--accent-color);
    }
    .navi_checkbox[data-checked] .navi_checkbox_marker {
      opacity: 1;
      stroke: var(--checkmark-color);
      transform: scale(1);
    }
    /* Readonly */
    .navi_checkbox[data-readonly] .navi_checkbox_field,
    .navi_checkbox[data-readonly][data-hover] .navi_checkbox_field {
      --border-color: var(--border-color-readonly);
      --background-color: var(--background-color-readonly);
    }
    .navi_checkbox[data-checked][data-readonly] .navi_checkbox_field {
      --background-color: var(--background-color-checked-readonly);
      --border-color: var(--border-color-checked-readonly);
    }
    .navi_checkbox[data-checked][data-readonly] .navi_checkbox_marker {
      stroke: var(--checkmark-color-readonly);
    }
    /* Disabled */
    .navi_checkbox[data-disabled] .navi_checkbox_field {
      --background-color: var(--background-color-disabled);
      --border-color: var(--border-color-disabled);
    }
    .navi_checkbox[data-checked][data-disabled] .navi_checkbox_field {
      --border-color: var(--border-color-checked-disabled);
      --background-color: var(--background-color-checked-disabled);
    }

    .navi_checkbox[data-checked][data-disabled] .navi_checkbox_marker {
      stroke: var(--checkmark-color-disabled);
    }
  }
`;

export const InputCheckbox = forwardRef((props, ref) => {
  const { value = "on" } = props;
  const uiStateController = useUIStateController(props, "checkbox", {
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? value : undefined),
    getPropFromState: Boolean,
  });
  const uiState = useUIState(uiStateController);

  const checkbox = renderActionableComponent(props, ref, {
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
});

const InputCheckboxBasic = forwardRef((props, ref) => {
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
    name,
    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    constraints = [],
    appeareance = "navi", // "navi" or "default"
    accentColor,
    onClick,
    onInput,
    style,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || contextFieldName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading =
    loading || (contextLoading && loadingElement === innerRef.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const checked = Boolean(uiState);
  const actionName = rest["data-action"];
  if (actionName) {
    delete rest["data-action"];
  }
  const inputCheckbox = (
    <input
      {...rest}
      ref={innerRef}
      type="checkbox"
      style={appeareance === "default" ? style : undefined}
      name={innerName}
      checked={checked}
      readOnly={innerReadOnly}
      disabled={innerDisabled}
      required={innerRequired}
      data-validation-message-arrow-x="center"
      onClick={(e) => {
        if (innerReadOnly) {
          e.preventDefault();
        }
        onClick?.(e);
      }}
      onInput={(e) => {
        const checkbox = e.target;
        const checkboxIsChecked = checkbox.checked;
        uiStateController.setUIState(checkboxIsChecked, e);
        onInput?.(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    />
  );
  const loaderProps = {
    loading: innerLoading,
    inset: -1,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
    },
    color: "var(--accent-color)",
  };
  if (appeareance === "navi") {
    return (
      <NaviCheckbox
        data-action={actionName}
        inputRef={innerRef}
        accentColor={accentColor}
        readOnly={readOnly}
        disabled={innerDisabled}
        style={style}
      >
        <LoaderBackground
          {...loaderProps}
          targetSelector=".navi_checkbox_field"
        >
          {inputCheckbox}
        </LoaderBackground>
      </NaviCheckbox>
    );
  }

  return (
    <LoadableInlineElement {...loaderProps} data-action={actionName}>
      {inputCheckbox}
    </LoadableInlineElement>
  );
});
const NaviCheckbox = ({
  accentColor,
  readOnly,
  disabled,
  inputRef,
  style,
  children,
  ...rest
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const naviCheckbox = ref.current;
    const colorPicked = pickLightOrDark(
      naviCheckbox,
      "var(--accent-color)",
      "var(--navi-checkmark-color-light)",
      "var(--navi-checkmark-color-dark)",
    );
    naviCheckbox.style.setProperty("--checkmark-color", colorPicked);
  }, [accentColor]);

  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);

  return (
    <div
      {...rest}
      ref={ref}
      className="navi_checkbox"
      style={{
        ...(accentColor ? { "--accent-color": accentColor } : {}),
        ...style,
      }}
      data-readonly={readOnly ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      {children}
      <div className="navi_checkbox_field">
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="navi_checkbox_marker"
        >
          <path d="M10.5 2L4.5 9L1.5 5.5" fill="none" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};

const InputCheckboxWithAction = forwardRef((props, ref) => {
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
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(actionBoundToUIState);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  // In this situation updating the ui state === calling associated action
  // so cance/abort/error have to revert the ui state to the one before user interaction
  // to show back the real state of the checkbox (not the one user tried to set)
  useActionEvents(innerRef, {
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
      ref={innerRef}
      loading={loading || actionLoading}
      onChange={(e) => {
        requestAction(e.target, actionBoundToUIState, {
          event: e,
          actionOrigin: "action_prop",
        });
        onChange?.(e);
      }}
    />
  );
});
const InputCheckboxInsideForm = InputCheckboxBasic;
