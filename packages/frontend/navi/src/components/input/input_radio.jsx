import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
} from "../field_group_context.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { ReadOnlyContext } from "./label.jsx";
import {
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";

import.meta.css = /* css */ `
  .custom_radio_wrapper {
    position: relative;
    display: inline-flex;
    box-sizing: content-box;

    --checked-color: #3b82f6;
    --checked-disabled-color: var(--field-disabled-border-color);

    --checkmark-color: var(--checked-color);
    --checkmark-disabled-color: var(--field-disabled-text-color);
  }

  .custom_radio_wrapper input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  .custom_radio {
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

  .custom_radio svg {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .custom_radio svg .custom_radio_dashed_border {
    display: none;
  }

  .custom_radio svg .custom_radio_marker {
    fill: var(--checkmark-color);
    opacity: 0;
    transform-origin: center;
    transform: scale(0.3);
  }

  .custom_radio[data-transition] svg {
    transition: all 0.15s ease;
  }
  .custom_radio[data-transition] svg .custom_radio_dashed_border {
    transition: all 0.15s ease;
  }
  .custom_radio[data-transition] svg .custom_radio_border {
    transition: all 0.15s ease;
  }

  /* États hover */
  .custom_radio_wrapper:hover .custom_radio svg .custom_radio_border {
    stroke: var(--field-hover-border-color);
  }
  .custom_radio_wrapper:hover .custom_radio svg .custom_radio_marker {
    fill: var(--field-strong-color);
  }

  .custom_radio_wrapper:hover
    input:checked
    + .custom_radio
    svg
    .custom_radio_border {
    stroke: var(--field-strong-color);
  }

  /* État checked */
  .custom_radio_wrapper input:checked + .custom_radio svg .custom_radio_border {
    stroke: var(--field-strong-color);
  }

  .custom_radio_wrapper input:checked + .custom_radio svg .custom_radio_marker {
    opacity: 1;
    transform: scale(1);
  }

  /* États disabled */
  .custom_radio_wrapper
    input[disabled]
    + .custom_radio
    svg
    .custom_radio_border {
    fill: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
    stroke: var(--field-disabled-border-color);
  }

  .custom_radio_wrapper
    input[disabled]:checked
    + .custom_radio
    svg
    .custom_radio_border {
    stroke: var(--checked-disabled-color);
  }

  .custom_radio_wrapper
    input[disabled]:checked
    + .custom_radio
    svg
    .custom_radio_marker {
    fill: var(--checkmark-disabled-color);
  }

  .custom_radio_wrapper
    input[data-readonly]
    + .custom_radio
    svg
    .custom_radio_border {
    fill: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
    stroke: var(--field-disabled-border-color);
  }
  .custom_radio_wrapper
    input[data-readonly]
    + .custom_radio
    svg
    .custom_radio_dashed_border {
    display: none;
  }
  .custom_radio_wrapper
    input[data-readonly]:checked
    + .custom_radio
    svg
    .custom_radio_border {
    stroke: var(--checked-disabled-color);
  }
  .custom_radio_wrapper
    input[data-readonly]:checked
    + .custom_radio
    svg
    .custom_radio_marker {
    fill: var(--checkmark-disabled-color);
  }
  .custom_radio_wrapper:hover
    input[data-readonly]
    + .custom_radio
    svg
    .custom_radio_border {
    fill: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
    stroke: var(--field-disabled-border-color);
  }
  .custom_radio_wrapper:hover
    input[data-readonly]:checked
    + .custom_radio
    svg
    .custom_radio_border {
    stroke: var(--checked-disabled-color);
  }

  /* Focus state avec outline */
  .custom_radio_wrapper input:focus-visible + .custom_radio {
    outline: 2px solid var(--field-outline-color);
    outline-offset: 1px;
    border-radius: 50%;
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
  const groupName = useContext(FieldGroupNameContext);
  const groupReadOnly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupRequired = useContext(FieldGroupRequiredContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const groupActionRequester = useContext(FieldGroupActionRequesterContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const setInputReadOnly = useContext(ReadOnlyContext);
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

  const innerName = name || groupName;
  const innerDisabled = disabled || groupDisabled;
  const innerRequired = required || groupRequired;
  const innerLoading =
    loading || (groupLoading && groupActionRequester === innerRef.current);
  const innerReadOnly =
    readOnly || groupReadOnly || innerLoading || uiStateController.readOnly;
  if (setInputReadOnly) {
    setInputReadOnly(innerReadOnly);
  }
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
      <CustomRadio accentColor={accentColor}>{inputRadio}</CustomRadio>
    ) : (
      inputRadio
    );

  return (
    <LoadableInlineElement
      data-action={actionName}
      loading={innerLoading}
      targetSelector={appeareance === "custom" ? ".custom_radio" : ""}
      inset={-1}
      color="light-dark(#355fcc, #3b82f6)"
    >
      {inputRadioDisplayed}
    </LoadableInlineElement>
  );
});
const CustomRadio = ({ children }) => {
  return (
    <div className="custom_radio_wrapper" data-field-wrapper="">
      {children}
      <div className="custom_radio">
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Border circle - always visible */}
          <circle
            className="custom_radio_border"
            cx="6"
            cy="6"
            r="5.5"
            fill="white"
            stroke="var(--field-border-color)"
            strokeWidth="1"
          />
          {/* Dashed border for readonly - calculated for even distribution */}
          <circle
            className="custom_radio_dashed_border"
            cx="6"
            cy="6"
            r="5.5"
            fill="var(--field-readonly-background-color)"
            stroke="var(--field-border-color)"
            strokeWidth="1"
            strokeDasharray="2.16 2.16"
            strokeDashoffset="0"
          />
          {/* Inner fill circle - only visible when checked */}
          <circle className="custom_radio_marker" cx="6" cy="6" r="3.5" />
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

const InputRadioInsideForm = () => {
  throw new Error(
    `<Input type="radio" /> must be used wrapped by <RadioList /> when inside a <Form />`,
  );
};
