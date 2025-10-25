import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { initCustomField } from "./custom_field.js";
import { ReportReadOnlyOnLabelContext } from "./label.jsx";
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
    --navi-radiomark-color: light-dark(#355fcc, #3b82f6);
  }

  .navi_radio {
    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    border-radius: inherit;
  }
  .navi_radio input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    padding: 0;
  }
  .navi_radio_field {
    width: 13px;
    height: 13px;
    background: transparent;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 5px;
    margin-top: 3px;
    margin-right: 3px;
  }

  .navi_radio_marker {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .navi_radio_dashed_border {
    display: none;
  }

  .navi_radio_marker {
    fill: var(--navi-checkmark-color);
    opacity: 0;
    transform-origin: center;
    transform: scale(0.3);
  }

  .custom_radio[data-transition] .navi_radio_marker {
    transition: all 0.15s ease;
  }
  .custom_radio[data-transition] .navi_radio_dashed_border {
    transition: all 0.15s ease;
  }
  .custom_radio[data-transition] .navi_radio_border {
    transition: all 0.15s ease;
  }

  /* Focus state avec outline */
  .navi_radio[data-focus-visible] .navi_radio_field {
    outline: 2px solid var(--outline-color);
    outline-offset: 1px;
    border-radius: 50%;
  }

  /* États hover */
  .navi_radio[data-hover] .navi_radio_border {
    stroke: var(--border-color-hover);
  }
  .navi_radio[data-hover] .navi_radio_marker {
    fill: var(--accent-color);
  }

  /* États disabled */
  .navi_radio[data-disabled] .navi_radio_border {
    fill: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
    stroke: var(--navi-field-disabled-border-color);
  }
  .navi_radio[data-disabled][data-checked] .navi_radio_border {
    stroke: var(--navi-checked-disabled-color);
  }

  .navi_radio[data-disabled][data-checked] .navi_radio_marker {
    fill: var(--navi-radiomark-color-disabled);
  }

  .navi_radio[data-readonly] .navi_radio_border {
    fill: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
    stroke: var(--navi-field-disabled-border-color);
  }
  .navi_radio[data-readonly] .navi_radio_dashed_border {
    display: none;
  }
  .navi_radio[data-readonly][data-checked] .navi_radio_border {
    stroke: var(--navi-checked-disabled-color);
  }
  .navi_radio[data-readonly][data-checked] .navi_radio_marker {
    fill: var(--navi-checkmark-disabled-color);
  }
  .navi_radio[data-hover][data-readonly] .navi_radio_border {
    fill: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
    stroke: var(--navi-field-disabled-border-color);
  }
  .navi_radio[data-hover][data-readonly][data-checked] .navi_radio_border {
    stroke: var(--navi-checked-disabled-color);
  }

  /* État checked */
  .navi_radio[data-checked] .navi_radio_border {
    stroke: var(--navi-field-strong-color);
  }
  .navi_radio[data-checked] .navi_radio_marker {
    opacity: 1;
    transform: scale(1);
  }
  .navi_radio[data-checked][data-hover] .navi_radio_border {
    stroke: var(--navi-field-strong-color);
  }
`;

export const InputRadio = forwardRef((props, ref) => {
  const { value = "on" } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? value : undefined),
    getPropFromState: Boolean,
  });
  const uiState = useUIState(uiStateController);

  const radio = renderActionableComponent(props, ref, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
    InsideForm: InputRadioInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{radio}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
});

const InputRadioBasic = forwardRef((props, ref) => {
  const contextName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
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

  const innerName = name || contextName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === innerRef.current);
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

  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = () => {
    const thisRadio = innerRef.current;
    const radioList = thisRadio.closest("[data-radio-list]");
    if (!radioList) {
      return;
    }
    const radioInputs = radioList.querySelectorAll(
      `input[type="radio"][name="${thisRadio.name}"]`,
    );
    for (const radioInput of radioInputs) {
      if (radioInput === thisRadio) {
        continue;
      }
      radioInput.dispatchEvent(
        new CustomEvent("setuistate", { detail: false }),
      );
    }
  };
  useLayoutEffect(() => {
    if (checked) {
      updateOtherRadiosInGroup();
    }
  }, [checked]);

  const inputRadio = (
    <input
      {...rest}
      ref={innerRef}
      type="radio"
      style={appeareance === "custom" ? undefined : style}
      name={innerName}
      checked={checked}
      data-readonly={innerReadOnly ? "" : undefined}
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
        const radio = e.target;
        const radioIsChecked = radio.checked;
        if (radioIsChecked) {
          updateOtherRadiosInGroup();
        }
        uiStateController.setUIState(radioIsChecked, e);
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
  const inputRadioDisplayed =
    appeareance === "custom" ? (
      <CustomRadio
        inputRef={innerRef}
        accentColor={accentColor}
        readOnly={readOnly}
        disabled={innerDisabled}
        style={style}
      >
        {inputRadio}
      </CustomRadio>
    ) : (
      inputRadio
    );

  return (
    <LoadableInlineElement
      data-action={actionName}
      loading={innerLoading}
      targetSelector={appeareance === "custom" ? ".navi_radio_field" : ""}
      style={{
        "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
      }}
      color="var(--accent-color)"
    >
      {inputRadioDisplayed}
    </LoadableInlineElement>
  );
});
const CustomRadio = ({
  inputRef,
  accentColor,
  readOnly,
  disabled,
  style,
  children,
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);

  return (
    <div
      ref={ref}
      className="navi_radio"
      style={{
        ...(accentColor ? { "--accent-color": accentColor } : {}),
        ...style,
      }}
      data-readonly={readOnly ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      {children}
      <div className="navi_radio_field">
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Border circle - always visible */}
          <circle
            className="navi_radio_border"
            cx="6"
            cy="6"
            r="5.5"
            fill="white"
            stroke="var(--border-color)"
            strokeWidth="1"
          />
          {/* Dashed border for readonly - calculated for even distribution */}
          <circle
            className="navi_radio_dashed_border"
            cx="6"
            cy="6"
            r="5.5"
            fill="var(--background-color-readonly)"
            stroke="var(--border-color)"
            strokeWidth="1"
            strokeDasharray="2.16 2.16"
            strokeDashoffset="0"
          />
          {/* Inner fill circle - only visible when checked */}
          <circle className="navi_radio_marker" cx="6" cy="6" r="3.5" />
        </svg>
      </div>
    </div>
  );
};

const InputRadioWithAction = () => {
  throw new Error(
    `<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`,
  );
};

const InputRadioInsideForm = InputRadio;
