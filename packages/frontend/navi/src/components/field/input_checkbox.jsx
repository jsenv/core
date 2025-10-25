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
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { initCustomField } from "./custom_field.js";
import { ReportReadOnlyOnLabelContext } from "./label.jsx";
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
  :root {
    --navi-checkmark-color-light: white;
    --navi-checkmark-color-dark: rgb(55, 55, 55);
    --navi-checkmark-color: var(--navi-checkmark-light-color);
  }

  .navi_checkbox {
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

    --border-color-readonly: color-mix(in srgb, var(--border-color) 30%, white);
    --border-color-disabled: var(--border-color-readonly);
    --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
    --border-color-checked-disabled: #d3d3d3;
    --background-color-checked-disabled: #d3d3d3;
    --checkmark-color-readonly: grey;
    --checkmark-color-disabled: #eeeeee;
  }
  .navi_checkbox input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
  .navi_checkbox_field {
    display: inline-flex;
    margin: 3px 3px 3px 4px;
    box-sizing: border-box;

    outline-offset: var(--outline-offset);
    outline-width: var(--outline-width);
    border-width: var(--border-width);
    border-radius: var(--border-radius);
    width: var(--width);
    height: var(--height);

    outline-style: none;
    border-style: solid;

    outline-color: var(--outline-color);
    border-color: var(--border-color);
    background-color: var(--background-color);
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
  /* Readonly */
  .navi_checkbox[data-readonly] .navi_checkbox_field,
  .navi_checkbox[data-readonly][data-hover] .navi_checkbox_field {
    --border-color: var(--border-color-readonly);
    --background-color: var(--background-color-readonly);
  }
  /* Disabled */
  .navi_checkbox[data-disabled] .navi_checkbox_field {
    --background-color: var(--background-color-disabled);
    --border-color: var(--border-color-disabled);
  }
  /* Checked */
  .navi_checkbox[data-checked] .navi_checkbox_marker {
    opacity: 1;
    transform: scale(1);
    stroke: var(--checkmark-color);
  }
  .navi_checkbox[data-checked] .navi_checkbox_field {
    --background-color: var(--accent-color);
    --border-color: var(--accent-color);
  }
  .navi_checkbox[data-checked][data-hover] .navi_checkbox_field {
    --background-color: color-mix(in srgb, var(--accent-color) 70%, black);
    --border-color: color-mix(in srgb, var(--accent-color) 70%, black);
  }
  .navi_checkbox[data-checked][data-readonly] .navi_checkbox_field {
    --background-color: var(--background-color-disabled);
    --border-color: var(--border-color-disabled);
  }
  .navi_checkbox[data-checked][data-readonly] .navi_checkbox_marker {
    stroke: var(--checkmark-color-readonly);
  }
  .navi_checkbox[data-checked][data-disabled] .navi_checkbox_marker {
    stroke: var(--checkmark-color-disabled);
  }
  .navi_checkbox[data-checked][data-disabled] .navi_checkbox_field {
    --border-color: var(--border-color-checked-disabled);
    --background-color: var(--background-color-checked-disabled);
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
  const {
    name,
    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    constraints = [],
    appeareance = "custom", // "custom" or "default"
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
      style={appeareance === "custom" ? undefined : style}
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

  const inputCheckboxDisplayed =
    appeareance === "custom" ? (
      <CustomCheckbox
        inputRef={innerRef}
        accentColor={accentColor}
        readOnly={readOnly}
        disabled={innerDisabled}
        style={style}
      >
        {inputCheckbox}
      </CustomCheckbox>
    ) : (
      inputCheckbox
    );

  return (
    <LoadableInlineElement
      data-action={actionName}
      loading={innerLoading}
      inset={-1}
      targetSelector={appeareance === "custom" ? ".navi_checkbox_field" : ""}
      style={{
        "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
      }}
      color="var(--accent-color)"
    >
      {inputCheckboxDisplayed}
    </LoadableInlineElement>
  );
});
const CustomCheckbox = ({
  accentColor,
  readOnly,
  disabled,
  inputRef,
  style,
  children,
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const customCheckbox = ref.current;
    const colorPicked = pickLightOrDark(
      customCheckbox,
      "var(--accent-color)",
      "var(--navi-checkmark-color-light)",
      "var(--navi-checkmark-color-dark)",
    );
    customCheckbox.style.setProperty("--checkmark-color", colorPicked);
  }, [accentColor]);

  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);

  return (
    <div
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
