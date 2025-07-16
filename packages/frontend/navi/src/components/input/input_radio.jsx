import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";

import.meta.css = /* css */ `
  .custom_radio_wrapper {
    display: inline-flex;
    box-sizing: content-box;

    --checkmark-color: var(--field-strong-color);
    --checkmark-disabled-color: var(--field-disabled-text-color);
    --checked-color: var(--field-strong-color);
    --checked-disabled-color: var(--field-disabled-border-color);
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
    border: 1px solid var(--field-border-color);
    border-radius: 50%;
    background: white;
    transition: all 0.15s ease;
    box-sizing: border-box;
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
    opacity: 0;
    transform: scale(0.3);
    transition: all 0.15s ease;
    pointer-events: none;
  }

  .custom_radio svg circle {
    fill: var(--checkmark-color);
  }

  /* États hover */
  .custom_radio_wrapper:hover .custom_radio {
    border-color: var(--field-hover-border-color);
  }
  .custom_radio_wrapper:hover .custom_radio svg circle {
    fill: var(--field-strong-color);
  }

  .custom_radio_wrapper:hover input:checked + .custom_radio {
    background: white;
    border-color: var(--field-strong-color);
  }

  /* État checked */
  .custom_radio_wrapper input:checked + .custom_radio {
    background: white;
    border-color: var(--checked-color);
  }

  .custom_radio_wrapper input:checked + .custom_radio svg {
    opacity: 1;
    transform: scale(1);
  }

  /* États disabled */
  .custom_radio_wrapper input[disabled] + .custom_radio {
    background-color: light-dark(
      rgba(239, 239, 239, 0.3),
      rgba(59, 59, 59, 0.3)
    );
    border-color: var(--field-disabled-border-color);
  }

  .custom_radio_wrapper input[disabled]:checked + .custom_radio {
    background-color: light-dark(
      rgba(239, 239, 239, 0.3),
      rgba(59, 59, 59, 0.3)
    );
    border-color: var(--checked-disabled-color);
  }

  .custom_radio_wrapper
    input[disabled]:checked
    + .custom_radio
    .custom_radio_marker {
    fill: var(--checkmark-disabled-color);
  }

  .custom_radio_wrapper input[data-readonly] + .custom_radio {
    border-style: dashed;
    background: white;
  }
  .custom_radio_wrapper input[data-readonly]:checked + .custom_radio {
    border-style: dashed;
    border-color: var(--field-strong-color);
    background: white;
  }
  .custom_radio_wrapper:hover input[data-readonly] + .custom_radio {
    border-color: var(--field-readonly-hover-border-color);
  }
  .custom_radio_wrapper:hover input[data-readonly]:checked + .custom_radio {
    background: white;
    border-color: var(--field-strong-color);
  }

  /* Focus state avec outline */
  .custom_radio_wrapper input:focus-visible + .custom_radio {
    outline: 2px solid var(--field-outline-color);
    outline-offset: 1px;
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
    autoFocus,
    constraints = [],
    checked,
    readOnly,
    disabled,
    loading,
    onClick,
    onChange,
    appeareance = "custom", // "custom" or "default"
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const [innerChecked, setInnerChecked] = useState(checked);
  const checkedRef = useRef(checked);
  if (checkedRef.current !== checked) {
    setInnerChecked(checked);
    checkedRef.current = checked;
  }

  const handleChange = (e) => {
    const isChecked = e.target.checked;
    setInnerChecked(isChecked);
    onChange?.(e);
  };

  const inputRadio = (
    <input
      ref={innerRef}
      type="radio"
      checked={innerChecked}
      data-readonly={readOnly && !disabled ? "" : undefined}
      disabled={disabled}
      data-validation-message-arrow-x="center"
      onClick={(e) => {
        if (readOnly) {
          e.preventDefault();
        }
        onClick?.(e);
      }}
      onChange={handleChange}
      {...rest}
    />
  );
  const inputRadioDisplayed =
    appeareance === "custom" ? (
      <CustomRadio>{inputRadio}</CustomRadio>
    ) : (
      inputRadio
    );

  const inputRadioWithLoader = (
    <LoaderBackground
      loading={loading}
      targetSelector={appeareance === "custom" ? ".custom_radio" : ""}
      inset={-1}
    >
      {inputRadioDisplayed}
    </LoaderBackground>
  );

  return inputRadioWithLoader;
});
const CustomRadio = ({ children }) => {
  return (
    <div className="custom_radio_wrapper" data-field-wrapper="">
      {children}
      <div className="custom_radio">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <circle className="custom_radio_marker" cx="6" cy="6" r="4.25" />
        </svg>
      </div>
    </div>
  );
};

const InputRadioWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value = "",
    checked: initialChecked = false,
    action,
    loading,
    readOnly,
    onCancel,
    onChange,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  if (import.meta.dev && value === "") {
    console.warn(
      `InputRadio: value is an empty string, this is probably not what you want`,
    );
  }

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart = initialChecked || navStateValue === value;

  const [boundAction, getCheckedValue, setCheckedValue] =
    useActionBoundToOneParam(action, name, checkedAtStart ? value : undefined);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const {
    loading: actionLoading,
    error,
    aborted,
  } = useActionStatus(boundAction);
  const checkedInAction = getCheckedValue() === value;
  const checked = aborted || error ? checkedAtStart : checkedInAction;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      if (checked) {
        setNavStateValue(value);
      }
      if (checkedAtStart) {
        setCheckedValue(value);
      }
      onCancel?.(e);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: (e) => {
      setNavStateValue(undefined);
      onActionEnd?.(e);
    },
  });

  const innerLoading = loading || actionLoading;

  return (
    <InputRadioBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      checked={checked}
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
      onChange={(e) => {
        const radioIsChecked = e.target.checked;
        if (radioIsChecked) {
          setNavStateValue(value);
          setCheckedValue(value);
          requestAction(boundAction, {
            event: e,
          });
        }
        onChange?.(e);
      }}
    />
  );
});

const InputRadioInsideForm = forwardRef((props, ref) => {
  const {
    formContext,
    id,
    name,
    value = "",
    checked: initialChecked = false,
    readOnly,
    onChange,
    ...rest
  } = props;
  const { formIsReadOnly, formActionError, formActionAborted } = formContext;

  if (import.meta.dev && value === "") {
    console.warn(
      `InputRadio: value is an empty string, this is probably not what you want`,
    );
  }

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart =
    navStateValue === undefined ? initialChecked : navStateValue === value;
  const [getCheckedValue, setCheckedValue] = useOneFormParam(
    name,
    checkedAtStart ? value : undefined,
  );
  const checkedInFormAction = getCheckedValue() === value;
  const checked =
    formActionAborted || formActionError ? checkedAtStart : checkedInFormAction;

  return (
    <InputRadioBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      checked={checked}
      readOnly={readOnly || formIsReadOnly}
      onChange={(e) => {
        const radioIsChecked = e.target.checked;
        if (radioIsChecked) {
          setNavStateValue(value);
          setCheckedValue(value);
        }
        onChange?.(e);
      }}
    />
  );
});
