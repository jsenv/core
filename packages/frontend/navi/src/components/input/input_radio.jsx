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
import "../checked_programmatic_change.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";

const CUSTOM_RADIO_COLORS = {
  borders: {
    default: "#6b7280",
    hover: "#9ca3af",
    disabled: "rgba(118, 118, 118, 0.3)",
    checked: "#3b82f6",
    checkedAndHover: "#1a56db",
    disabledAndChecked: "#D3D3D3",
  },
  outline: {
    default: "light-dark(#1d4ed8, #3b82f6)",
  },
  background: {
    default: "white",
    disabled: "light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3))",
  },
  checkmark: {
    default: "#3b82f6",
    hover: "#1d4ed8",
    disabled: "#D3D3D3",
  },
};
import.meta.css = /* css */ `
  .custom_radio_wrapper {
    display: inline-flex;
    box-sizing: content-box;
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
    border: 1px solid ${CUSTOM_RADIO_COLORS.borders.default};
    border-radius: 50%; /* ✅ Rond comme Chrome */
    background: ${CUSTOM_RADIO_COLORS.background.default};
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
    fill: ${CUSTOM_RADIO_COLORS.checkmark.default};
  }

  /* États hover */
  .custom_radio_wrapper:hover .custom_radio {
    border-color: ${CUSTOM_RADIO_COLORS.borders.hover};
  }
  .custom_radio_wrapper:hover .custom_radio svg circle {
    fill: ${CUSTOM_RADIO_COLORS.checkmark.hover};
  }

  .custom_radio_wrapper:hover input:checked + .custom_radio {
    background: ${CUSTOM_RADIO_COLORS.background.checkedAndHover};
    border-color: ${CUSTOM_RADIO_COLORS.borders.checkedAndHover};
  }

  /* État checked */
  .custom_radio_wrapper input:checked + .custom_radio {
    background: ${CUSTOM_RADIO_COLORS.background.checked};
    border-color: ${CUSTOM_RADIO_COLORS.borders.checked};
  }

  .custom_radio_wrapper input:checked + .custom_radio svg {
    opacity: 1;
    transform: scale(1);
  }

  /* États disabled */
  .custom_radio_wrapper input[disabled] + .custom_radio {
    background-color: ${CUSTOM_RADIO_COLORS.background.disabled};
    border-color: ${CUSTOM_RADIO_COLORS.borders.disabled};
  }

  .custom_radio_wrapper input[disabled]:checked + .custom_radio {
    border-color: ${CUSTOM_RADIO_COLORS.borders.disabledAndChecked};
  }

  .custom_radio_wrapper
    input[disabled]:checked
    + .custom_radio
    .custom_radio_marker {
    fill: ${CUSTOM_RADIO_COLORS.checkmark.disabled};
  }

  .custom_radio_wrapper input[data-readonly] + .custom_radio {
    border-style: dashed;
    background: light-dark(#f3f4f6, #2d3748);
  }
  .custom_radio_wrapper input[data-readonly]:checked + .custom_radio {
    border-style: dashed;
    border-color: #3b82f6;
  }
  .custom_radio_wrapper:hover input[data-readonly] + .custom_radio {
    border-color: #6b7280;
  }
  .custom_radio_wrapper:hover input[data-readonly]:checked + .custom_radio {
    border-color: #3b82f6;
  }

  /* Focus state avec outline */
  .custom_radio_wrapper input:focus-visible + .custom_radio {
    outline: 2px solid ${CUSTOM_RADIO_COLORS.outline.default};
    outline-offset: 1px;
  }
`;

export const InputRadio = forwardRef((props, ref) => {
  return renderActionableComponent(
    props,
    ref,
    InputRadioBasic,
    InputRadioWithAction,
    InputRadioInsideForm,
  );
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
    <div className="custom_radio_wrapper">
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
  const { pending, error, aborted } = useActionStatus(boundAction);
  const checkedInAction = getCheckedValue() === value;
  const checked = error || aborted ? checkedAtStart : checkedInAction;

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

  const innerLoading = loading || pending;

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
    checked: initialChecked,
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
    navStateValue === undefined ? initialChecked : navStateValue;
  const [getCheckedValue, setCheckedValue] = useOneFormParam(
    name,
    checkedAtStart,
  );
  const checkedInFormAction = getCheckedValue() === value;
  const checked =
    formActionError || formActionAborted ? checkedAtStart : checkedInFormAction;

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
