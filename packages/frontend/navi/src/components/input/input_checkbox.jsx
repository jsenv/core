import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { useNavState } from "../../browser_integration/browser_integration.js";
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
import { useFormEvents } from "./use_form_event.js";

import.meta.css = /* css */ `
  .custom_checkbox_wrapper {
    display: inline-flex;
    box-sizing: content-box;

    --checkmark-color: white;
    --checkmark-disabled-color: #eeeeee;
    --checked-color: #3b82f6;
    --checked-disabled-color: #d3d3d3;
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
    border: 1px solid var(--field-border-color);
    border-radius: 2px;
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
    stroke: var(--checkmark-color);
  }

  .custom_checkbox_wrapper:hover .custom_checkbox {
    border-color: var(--field-hover-border-color);
  }
  .custom_checkbox_wrapper:hover input:checked + .custom_checkbox {
    background: var(--field-strong-color);
    border-color: var(--field-strong-color);
  }
  .custom_checkbox_wrapper input:checked + .custom_checkbox {
    background: var(--checked-color);
    border-color: var(--checked-color);
  }
  .custom_checkbox_wrapper input:checked + .custom_checkbox svg {
    opacity: 1;
    transform: scale(1);
  }

  .custom_checkbox_wrapper input[data-readonly] + .custom_checkbox {
    background-color: var(--field-disabled-background-color);
    border-color: var(--field-disabled-border-color);
  }
  .custom_checkbox_wrapper input[data-readonly]:checked + .custom_checkbox {
    background: var(--checked-disabled-color);
    border-color: var(--checked-disabled-color);
  }
  .custom_checkbox_wrapper:hover input[data-readonly] + .custom_checkbox {
    background-color: var(--field-disabled-background-color);
    border-color: var(--field-disabled-border-color);
  }
  .custom_checkbox_wrapper:hover
    input[data-readonly]:checked
    + .custom_checkbox {
    background: var(--checked-disabled-color);
    border-color: var(--checked-disabled-color);
  }
  .custom_checkbox_wrapper
    input[data-readonly]:checked
    + .custom_checkbox
    .custom_checkbox_marker {
    stroke: var(--checkmark-disabled-color);
  }

  .custom_checkbox_wrapper input:focus-visible + .custom_checkbox {
    outline: 2px solid var(--field-outline-color);
    outline-offset: 1px;
  }

  .custom_checkbox_wrapper input[disabled] + .custom_checkbox {
    background-color: var(--field-disabled-background-color);
    border-color: var(--field-disabled-border-color);
  }
  .custom_checkbox_wrapper input[disabled]:checked + .custom_checkbox {
    background: var(--checked-disabled-color);
    border-color: var(--checked-disabled-color);
  }
  .custom_checkbox_wrapper
    input[disabled]:checked
    + .custom_checkbox
    .custom_checkbox_marker {
    stroke: var(--checkmark-disabled-color);
  }
`;

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: InputCheckboxBasic,
    WithAction: InputCheckboxWithAction,
    InsideForm: InputCheckboxInsideForm,
  });
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
      color="light-dark(#355fcc, #3b82f6)"
    >
      {inputCheckboxDisplayed}
    </LoaderBackground>
  );

  return inputCheckboxWithLoader;
});
const CustomCheckbox = ({ children }) => {
  return (
    <div className="custom_checkbox_wrapper" data-field-wrapper="">
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
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const checkedAtStart =
    navState === undefined ? initialChecked : Boolean(navState);

  const [boundAction, getCheckedValue, setCheckedValue, resetChecked] =
    useActionBoundToOneParam(action, name, checkedAtStart ? value : undefined);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const checked = Boolean(getCheckedValue());
  const innerLoading = loading || actionLoading;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      setNavState(undefined);
      resetChecked();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: (e) => {
      resetChecked();
      onActionAbort?.(e);
    },
    onError: (e) => {
      resetChecked();
      onActionError?.(e);
    },
    onEnd: (e) => {
      setNavState(undefined);
      onActionEnd?.(e);
    },
  });

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

  const [navState, setNavState] = useNavState(id);
  const [getChecked, setChecked, resetChecked] = useOneFormParam(
    name,
    initialChecked,
    navState,
  );
  const checked = getChecked();
  useEffect(() => {
    if (initialChecked) {
      setNavState(checked ? false : undefined);
    } else {
      setNavState(checked ? true : undefined);
    }
  }, [initialChecked, checked]);

  useFormEvents(innerRef, {
    onFormActionAbort: () => {
      resetChecked();
    },
    onFormActionError: () => {
      resetChecked();
    },
  });

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
        setChecked(checkboxIsChecked ? value : undefined);
        onChange?.(e);
      }}
    />
  );
});
