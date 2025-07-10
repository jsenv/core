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

const CUSTOM_CHECKBOX_COLORS = {
  borders: {
    default: "#6b7280",
    hover: "#9ca3af",
    disabled: "rgba(118, 118, 118, 0.3)",
    checked: "#3b82f6",
    checkedAndHover: "#1d4ed8",
    disabledAndChecked: "#D3D3D3",
  },
  outline: {
    default: "light-dark(#1d4ed8, #3b82f6)",
  },
  background: {
    checked: "#3b82f6",
    checkedAndHover: "#1d4ed8",
    disabled: "light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3))",
    disabledAndChecked: "#D3D3D3",
  },
  checkmark: {
    default: "white",
    disabled: "#EEEEEE",
  },
};

import.meta.css = /* css */ `
  .custom_checkbox_wrapper {
    display: inline-flex;
    box-sizing: content-box;
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
    border: 1px solid ${CUSTOM_CHECKBOX_COLORS.borders.default};
    border-radius: 2px;
    transition: all 0.15s ease;
    box-sizing: border-box;
    display: inline-flex;
    margin: 3px 3px 3px 4px;
  }
  .custom_checkbox svg {
    width: 100%;
    height: 100%;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.15s ease;
    pointer-events: none;
  }
  .custom_checkbox svg path {
    stroke: ${CUSTOM_CHECKBOX_COLORS.checkmark.default};
  }

  .custom_checkbox_wrapper:hover .custom_checkbox {
    border-color: ${CUSTOM_CHECKBOX_COLORS.borders.hover};
  }
  .custom_checkbox_wrapper:hover input:checked + .custom_checkbox {
    background: ${CUSTOM_CHECKBOX_COLORS.background.checkedAndHover};
    border-color: ${CUSTOM_CHECKBOX_COLORS.borders.checkedAndHover};
  }
  .custom_checkbox_wrapper input:checked + .custom_checkbox {
    background: ${CUSTOM_CHECKBOX_COLORS.background.checked};
    border-color: ${CUSTOM_CHECKBOX_COLORS.borders.checked};
  }
  .custom_checkbox_wrapper input:checked + .custom_checkbox svg {
    opacity: 1;
    transform: scale(1);
  }

  .custom_checkbox_wrapper input[data-readonly] + .custom_checkbox {
    border-style: dashed;
    background: light-dark(#f3f4f6, #2d3748);
  }
  .custom_checkbox_wrapper input[data-readonly]:checked + .custom_checkbox {
    border-style: dashed;
    border-color: #3b82f6;
    background: light-dark(#60a5fa, #2563eb);
  }
  .custom_checkbox_wrapper:hover input[data-readonly] + .custom_checkbox {
    border-color: #6b7280;
  }
  .custom_checkbox_wrapper:hover
    input[data-readonly]:checked
    + .custom_checkbox {
    background: light-dark(#60a5fa, #2563eb); /* Same as non-hover */
    border-color: #3b82f6;
  }

  .custom_checkbox_wrapper input:focus-visible + .custom_checkbox {
    outline: 2px solid ${CUSTOM_CHECKBOX_COLORS.outline.default};
    outline-offset: 1px;
  }

  .custom_checkbox_wrapper input[disabled] + .custom_checkbox {
    background-color: ${CUSTOM_CHECKBOX_COLORS.background.disabled};
    border-color: ${CUSTOM_CHECKBOX_COLORS.borders.disabled};
  }
  .custom_checkbox_wrapper input[disabled]:checked + .custom_checkbox {
    background: ${CUSTOM_CHECKBOX_COLORS.background.disabledAndChecked};
    border-color: ${CUSTOM_CHECKBOX_COLORS.borders.disabledAndChecked};
  }
  .custom_checkbox_wrapper
    input[disabled]:checked
    + .custom_checkbox
    .custom_checkbox_marker {
    stroke: ${CUSTOM_CHECKBOX_COLORS.checkmark.disabled};
  }
`;

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionableComponent(
    props,
    ref,
    InputCheckboxBasic,
    InputCheckboxWithAction,
    InputCheckboxInsideForm,
  );
});

const InputCheckboxBasic = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    value = "on",
    checked,
    loading,
    readOnly,
    disabled,
    onClick,
    onChange,
    appeareance = "custom", // "custom" or "default"
    ...rest
  } = props;

  const innerRef = useRef();
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

  const inputCheckbox = (
    <input
      ref={innerRef}
      type="checkbox"
      value={value}
      checked={innerChecked}
      data-readonly={readOnly && !disabled ? "" : undefined}
      data-validation-message-arrow-x="center"
      disabled={disabled}
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

  const inputCheckboxDisplayed =
    appeareance === "custom" ? (
      <CustomCheckbox>{inputCheckbox}</CustomCheckbox>
    ) : (
      inputCheckbox
    );

  const inputCheckboxWithLoader = (
    <LoaderBackground
      loading={loading}
      inset={-1}
      targetSelector={appeareance === "custom" ? ".custom_checkbox" : ""}
    >
      {inputCheckboxDisplayed}
    </LoaderBackground>
  );

  return inputCheckboxWithLoader;
});
const CustomCheckbox = ({ children }) => {
  return (
    <div className="custom_checkbox_wrapper">
      {children}
      <div className="custom_checkbox">
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
  const {
    id,
    name,
    value = "on",
    checked: initialChecked = false,
    action,
    readOnly,
    loading,
    onCancel,
    onChange,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart =
    navStateValue === undefined ? initialChecked : Boolean(navStateValue);

  const [boundAction, getCheckedValue, setCheckedValue, resetChecked] =
    useActionBoundToOneParam(action, name, checkedAtStart ? value : undefined);
  const { pending, error, aborted } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const checkedInAction = Boolean(getCheckedValue());
  const checked = error || aborted ? checkedAtStart : checkedInAction;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      setNavStateValue(undefined);
      resetChecked();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: onActionError,
    onError: onActionError,
    onEnd: (e) => {
      setNavStateValue(undefined);
      onActionEnd?.(e);
    },
  });

  const innerLoading = loading || pending;

  return (
    <InputCheckboxBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      checked={checked}
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
      onChange={(e) => {
        const checkboxIsChecked = e.target.checked;
        setCheckedValue(checkboxIsChecked ? value : undefined);
        requestAction(boundAction, { event: e });
        onChange?.(e);
      }}
    />
  );
});

const InputCheckboxInsideForm = forwardRef((props, ref) => {
  const {
    formContext,
    id,
    name,
    value = "on",
    checked: initialChecked,
    readOnly,
    onChange,
    ...rest
  } = props;
  const { formIsReadOnly } = formContext;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart =
    navStateValue === undefined ? initialChecked : navStateValue;
  const [getChecked, setChecked] = useOneFormParam(name, checkedAtStart);
  const checked = getChecked();

  return (
    <InputCheckboxBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      checked={checked}
      readOnly={readOnly || formIsReadOnly}
      onChange={(e) => {
        const checkboxIsChecked = e.target.checked;
        if (checkedAtStart) {
          setNavStateValue(checkboxIsChecked ? false : undefined);
        } else {
          setNavStateValue(checkboxIsChecked ? true : undefined);
        }
        setChecked(checkboxIsChecked ? value : undefined);
        onChange?.(e);
      }}
    />
  );
});
