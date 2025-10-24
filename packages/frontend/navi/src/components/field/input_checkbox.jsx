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
  .custom_checkbox_wrapper {
    display: inline-flex;
    box-sizing: content-box;
    border-radius: 2px;
  }

  .custom_checkbox_wrapper input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  .custom_checkbox {
    width: 13px;
    height: 13px;
    box-sizing: border-box;
    display: inline-flex;
    margin: 3px 3px 3px 4px;
    border-radius: inherit;
    border: 1px solid var(--navi-field-border-color);
  }
  .custom_checkbox svg {
    width: 100%;
    height: 100%;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.15s ease;
    pointer-events: none;
  }

  [data-field-wrapper] {
    --navi-field-background-color: white;
  }
  [data-field-wrapper][data-hover] {
    --navi-field-border-color: var(--navi-field-hover-border-color);
  }
  [data-field-wrapper][data-focus-visible] [data-field] {
    outline: 2px solid var(--navi-field-outline-color);
    outline-offset: 1px;
  }

  /* Readonly */
  [data-field-wrapper][data-readonly] [data-field] {
    --navi-field-border-color: var(--navi-field-readonly-border-color);
    --navi-field-background-color: var(--navi-field-readonly-background-color);
  }
  [data-field-wrapper][data-readonly][data-hover] [data-field] {
    --navi-field-background-color: var(--navi-field-readonly-background-color);
    --navi-field-border-color: var(--navi-field-readonly-border-color);
  }
  /* Disabled */
  [data-field-wrapper][data-disabled] [data-field] {
    --navi-field-background-color: var(--navi-field-disabled-background-color);
    --navi-field-border-color: var(--navi-field-disabled-border-color);
  }

  /* Checked state */
  [data-field-wrapper][data-checked] [data-field] svg {
    opacity: 1;
    transform: scale(1);
  }
  [data-field-wrapper][data-checked] .custom_checkbox_marker {
    stroke: var(--navi-field-foreground-color);
  }
  [data-field-wrapper][data-checked] [data-field] {
    --navi-field-background-color: var(--navi-field-accent-color);
    --navi-field-border-color: var(--navi-field-accent-color);
  }
  [data-field-wrapper][data-checked][data-hover] [data-field] {
    --navi-field-background-color: color-mix(
      in srgb,
      var(--navi-field-accent-color) 70%,
      black
    );
    --navi-field-border-color: color-mix(
      in srgb,
      var(--navi-field-accent-color) 70%,
      black
    );
  }
  [data-field-wrapper][data-checked][data-readonly] [data-field] {
    --navi-field-background-color: var(--navi-field-disabled-background-color);
    --navi-field-border-color: var(--navi-field-disabled-border-color);
    --navi-field-foreground-color: var(--navi-field-disabled-foreground-color);
  }
  [data-field-wrapper][data-checked][data-readonly] {
    stroke: var(--navi-field-disabled-foreground-color);
  }
  [data-field-wrapper][data-checked][data-disabled] .custom_checkbox_marker {
    stroke: var(--navi-field-disabled-foreground-color);
  }
  [data-field-wrapper][data-checked][data-disabled] [data-field] {
    --navi-field-background-color: var(--navi-field-disabled-background-color);
    --navi-field-border-color: var(--navi-field-disabled-background-color);
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
        accentColor={accentColor}
        readOnly={readOnly}
        disabled={innerDisabled}
      >
        {inputCheckbox}
      </CustomCheckbox>
    ) : (
      inputCheckbox
    );

  const containerRef = useRef();
  useLayoutEffect(() => {
    return forwardFieldPseudoSelectors(innerRef.current, containerRef.current);
  }, []);

  return (
    <LoadableInlineElement
      ref={containerRef}
      data-action={actionName}
      data-field-wrapper=""
      data-readonly={readOnly ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      loading={innerLoading}
      inset={-1}
      targetSelector={appeareance === "custom" ? ".custom_checkbox" : ""}
      color={"var(--navi-field-accent-color)"}
    >
      {inputCheckboxDisplayed}
    </LoadableInlineElement>
  );
});
const CustomCheckbox = ({ accentColor, children }) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const customCheckbox = ref.current;
    const colorPicked = pickLightOrDark(
      customCheckbox,
      "var(--navi-field-accent-color)",
      "var(--navi-field-foreground-light-color)",
      "var(--navi-field-foreground-dark-color)",
    );
    customCheckbox.style.setProperty(
      "--navi-field-foreground-color",
      colorPicked,
    );
  }, []);

  return (
    <div
      ref={ref}
      className="custom_checkbox_wrapper"
      style={{
        ...(accentColor ? { "--navi-field-accent-color": accentColor } : {}),
      }}
    >
      {children}
      <div
        className="custom_checkbox"
        data-field=""
        data-field-with-background=""
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path
            className="custom_checkbox_marker"
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
