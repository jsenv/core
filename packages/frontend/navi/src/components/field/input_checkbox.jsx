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
import { forwardFieldPseudoSelectors } from "./field_pseudo_selectors.js";
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
    --navi-checkmark-light-color: white;
    --navi-checkmark-dark-color: darkgrey;
    --navi-checkmark-color: var(--navi-checkmark-light-color);
  }

  .navi_custom_checkbox {
    display: inline-flex;
    box-sizing: content-box;
    border-radius: 2px;
  }
  .navi_custom_checkbox input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  .navi_custom_checkbox {
    --navi-outline-width: 2px;
    --navi-outline-offset: 1px;
    --navi-border-width: 1px;

    --navi-outline-color: light-dark(#355fcc, #3b82f6);
    --navi-border-color: light-dark(#767676, #8e8e93);
    --navi-background-color: white;
    --navi-accent-color: light-dark(#355fcc, #3b82f6);
    --navi-border-color-readonly: color-mix(
      in srgb,
      var(--navi-border-color) 30%,
      white
    );
    --navi-border-color-disabled: var(--navi-border-color-readonly);
    --navi-border-color-hover: color-mix(
      in srgb,
      var(--navi-border-color) 70%,
      black
    );
    --navi-border-color-checked-disabled: #d3d3d3;
    --navi-background-color-checked-disabled: #d3d3d3;
    --navi-checkmark-color-readonly: grey;
    --navi-checkmark-color-disabled: #eeeeee;
  }

  .navi_custom_checkbox_field svg {
    width: 100%;
    height: 100%;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.15s ease;
    pointer-events: none;
  }

  .navi_custom_checkbox_field {
    display: inline-flex;
    margin: 3px 3px 3px 4px;

    outline-width: var(--navi-outline-width);
    outline-offset: var(--navi-outline-offset);
    border-width: var(--navi-border-width);
    width: 13px;
    height: 13px;
    box-sizing: border-box;

    outline-style: none;
    border-style: solid;
    border-radius: inherit;

    outline-color: var(--navi-outline-color);
    border-color: var(--navi-border-color);
    background-color: var(--navi-background-color);
    color: var(--navi-color);
  }
  .navi_custom_checkbox[data-hover] {
    --navi-border-color: var(--navi-border-color-hover);
  }
  .navi_custom_checkbox[data-focus-visible] [data-field] {
    outline-style: solid;
  }

  /* Readonly */
  .navi_custom_checkbox[data-readonly] [data-field],
  .navi_custom_checkbox[data-readonly][data-hover] [data-field] {
    --navi-border-color: var(--navi-border-color-readonly);
    --navi-background-color: var(--navi-background-color-readonly);
  }
  /* Disabled */
  .navi_custom_checkbox[data-disabled] [data-field] {
    --navi-background-color: var(--navi-background-color-disabled);
    --navi-border-color: var(--navi-border-color-disabled);
  }

  /* Checked state */
  .navi_custom_checkbox[data-checked] [data-field] svg {
    opacity: 1;
    transform: scale(1);
  }
  .navi_custom_checkbox[data-checked] .navi_custom_checkbox_marker {
    stroke: var(--navi-checkmark-color);
  }
  .navi_custom_checkbox[data-checked] [data-field] {
    --navi-background-color: var(--navi-accent-color);
    --navi-border-color: var(--navi-accent-color);
  }
  .navi_custom_checkbox[data-checked][data-hover] [data-field] {
    --navi-background-color: color-mix(
      in srgb,
      var(--navi-accent-color) 70%,
      black
    );
    --navi-border-color: color-mix(
      in srgb,
      var(--navi-accent-color) 70%,
      black
    );
  }
  .navi_custom_checkbox[data-checked][data-readonly] [data-field] {
    --navi-background-color: var(--navi-background-color-disabled);
    --navi-border-color: var(--navi-border-color-disabled);
  }
  .navi_custom_checkbox[data-checked][data-readonly]
    .navi_custom_checkbox_marker {
    stroke: var(--navi-checkmark-color-readonly);
  }
  .navi_custom_checkbox[data-checked][data-disabled]
    .navi_custom_checkbox_marker {
    stroke: var(--navi-checkmark-color-disabled);
  }
  .navi_custom_checkbox[data-checked][data-disabled] [data-field] {
    --navi-border-color: var(--navi-border-color-checked-disabled);
    --navi-background-color: var(--navi-background-color-checked-disabled);
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
      targetSelector={
        appeareance === "custom" ? ".navi_custom_checkbox_field" : ""
      }
      color="var(--navi-accent-color)"
      style={{
        ...(accentColor ? { "--navi-accent-color": accentColor } : {}),
      }}
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
  children,
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const customCheckbox = ref.current;
    const colorPicked = pickLightOrDark(
      customCheckbox,
      "var(--navi-accent-color)",
      "var(--navi-checkmark-light-color)",
      "var(--navi-checkmark-dark-color)",
    );
    customCheckbox.style.setProperty("--navi-checkmark-color", colorPicked);
  }, [accentColor]);

  useLayoutEffect(() => {
    return forwardFieldPseudoSelectors(inputRef.current, ref.current);
  }, []);

  return (
    <div
      ref={ref}
      className="navi_custom_checkbox"
      data-readonly={readOnly ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      {children}
      <div className="navi_custom_checkbox_field" data-field="">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path
            className="navi_custom_checkbox_marker"
            d="M10.5 2L4.5 9L1.5 5.5"
            fill="none"
            strokeWidth="2"
          />
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
