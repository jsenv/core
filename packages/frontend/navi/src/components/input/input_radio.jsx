import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useContext, useImperativeHandle, useRef } from "preact/hooks";

import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
  FieldGroupOnValueChangeContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
} from "../field_group_context.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { ReadOnlyContext } from "./label.jsx";

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
  return renderActionableComponent(props, ref, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
    InsideForm: InputRadioInsideForm,
  });
});

const InputRadioBasic = forwardRef((props, ref) => {
  const {
    name,
    value,
    onValueChange,
    checked,

    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    constraints = [],

    onClick,
    appeareance = "custom", // "custom" or "default"
    ...rest
  } = props;
  const groupName = useContext(FieldGroupNameContext);
  const groupOnValueChange = useContext(FieldGroupOnValueChangeContext);
  const groupReadOnly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupRequired = useContext(FieldGroupRequiredContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const groupActionRequester = useContext(FieldGroupActionRequesterContext);
  const setInputReadOnly = useContext(ReadOnlyContext);
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || groupName;
  const innerOnValueChange = onValueChange || groupOnValueChange;
  const innerDisabled = disabled || groupDisabled;
  const innerRequired = required || groupRequired;
  const innerLoading =
    loading || (groupLoading && groupActionRequester === innerRef.current);
  const innerReadOnly =
    readOnly || groupReadOnly || !innerOnValueChange || innerLoading;
  if (setInputReadOnly) {
    setInputReadOnly(innerReadOnly);
  }
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const inputRadio = (
    <input
      ref={innerRef}
      type="radio"
      name={innerName}
      value={value}
      checked={checked}
      data-readonly={innerReadOnly && !disabled ? "" : undefined}
      disabled={innerDisabled}
      required={innerRequired}
      data-validation-message-arrow-x="center"
      onClick={(e) => {
        if (innerReadOnly) {
          e.preventDefault();
        }
        onClick?.(e);
      }}
      onInput={
        innerOnValueChange
          ? (e) => {
              const radio = innerRef.current;
              const radioValueOrUndefined = radio.checked
                ? radio.value
                : undefined;
              innerOnValueChange(radioValueOrUndefined, e);
            }
          : undefined
      }
      {...rest}
    />
  );
  const inputRadioDisplayed =
    appeareance === "custom" ? (
      <CustomRadio>{inputRadio}</CustomRadio>
    ) : (
      inputRadio
    );

  return (
    <LoadableInlineElement
      loading={innerLoading}
      targetSelector={appeareance === "custom" ? ".custom_radio" : ""}
      inset={-2.5}
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
    `Do not use <Input type="radio" />, use <RadioList /> instead`,
  );
};

const InputRadioInsideForm = () => {
  throw new Error(
    `Do not use <Input type="radio" />, use <RadioList /> instead`,
  );
};
