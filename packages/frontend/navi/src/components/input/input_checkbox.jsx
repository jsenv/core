import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";

import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
  FieldGroupOnFieldChangeContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
} from "../field_group_context.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useInitialValue } from "../use_initial_value.js";
import { ReadOnlyContext } from "./label.jsx";
import { useFormEvents } from "./use_form_events.js";

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
  const { onCheckedChange } = props;
  const [uiChecked, setUiChecked] = useCheckedController(props);

  return (
    <InputCheckboxControlled
      {...props}
      ref={ref}
      checked={uiChecked}
      readOnly={!onCheckedChange}
      onCheckedChange={(checked, e) => {
        setUiChecked(checked);
        onCheckedChange?.(checked, e);
      }}
    />
  );
});
const useCheckedController = (props) => {
  const { id, defaultChecked, checked } = props;
  const hasCheckedProp = Object.hasOwn(props, "checked");
  const [navState, setNavState] = useNavState(id);
  const externalStateInitial = useInitialValue(() => {
    if (hasCheckedProp) {
      // controlled by "checked" prop
      return Boolean(checked);
    }
    if (defaultChecked) {
      return true;
    }
    if (navState) {
      return true;
    }
    return false;
  });
  const externalStateRef = useRef(externalStateInitial);
  const [uiState, setUIState] = useState(externalStateInitial);
  const checkedRef = useRef(checked);
  if (hasCheckedProp && checked !== checkedRef.current) {
    checkedRef.current = checked;
    externalStateRef.current = checked;
    setUIState(checked);
  }
  const externalState = externalStateRef.current;

  const onCheckedChange = (checked) => {
    if (externalState) {
      setNavState(checked ? undefined : false);
    } else {
      setNavState(checked ? true : undefined);
    }
    setUIState(checked);
  };

  return [uiState, onCheckedChange, externalState];
};

const InputCheckboxControlled = forwardRef((props, ref) => {
  const {
    name,
    onCheckedChange,
    value = "on",
    readOnly,
    disabled,
    required,
    loading,

    autoFocus,
    constraints = [],
    appeareance = "custom", // "custom" or "default"
    onClick,
    onInput,
    ...rest
  } = props;
  const groupName = useContext(FieldGroupNameContext);
  const groupOnFieldChange = useContext(FieldGroupOnFieldChangeContext);
  const groupReadOnly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupRequired = useContext(FieldGroupRequiredContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const groupActionRequester = useContext(FieldGroupActionRequesterContext);
  const setInputReadOnly = useContext(ReadOnlyContext);
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || groupName;
  const innerOnCheckedChange = onCheckedChange || groupOnFieldChange;
  const innerDisabled = disabled || groupDisabled;
  const innerRequired = required || groupRequired;
  const innerLoading =
    loading || (groupLoading && groupActionRequester === innerRef.current);
  const innerReadOnly =
    readOnly || groupReadOnly || innerLoading || !innerOnCheckedChange;
  if (setInputReadOnly) {
    setInputReadOnly(innerReadOnly);
  }
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  if (import.meta.dev) {
    if (Object.hasOwn(props, "checked") && !innerOnCheckedChange) {
      console.warn(
        `<input type="checkbox" /> is controlled by "checked" prop. Use "onCheckedChange" or "defaultChecked" prop too to make it interactive.`,
      );
    }
  }

  const inputCheckbox = (
    <input
      {...rest}
      ref={innerRef}
      type="checkbox"
      name={innerName}
      value={value}
      data-readonly={innerReadOnly ? "" : undefined}
      disabled={innerDisabled}
      required={innerRequired}
      data-validation-message-arrow-x="center"
      onClick={(e) => {
        if (readOnly) {
          e.preventDefault();
        }
        onClick?.(e);
      }}
      onInput={(e) => {
        const checkbox = e.target;
        const checkboxIsChecked = checkbox.checked;
        innerOnCheckedChange?.(checkboxIsChecked, e);
        onInput?.(e);
      }}
    />
  );

  const inputCheckboxDisplayed =
    appeareance === "custom" ? (
      <CustomCheckbox>{inputCheckbox}</CustomCheckbox>
    ) : (
      inputCheckbox
    );

  return (
    <LoadableInlineElement
      loading={innerLoading}
      inset={-1}
      targetSelector={appeareance === "custom" ? ".custom_checkbox" : ""}
      color="light-dark(#355fcc, #3b82f6)"
    >
      {inputCheckboxDisplayed}
    </LoadableInlineElement>
  );
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
    name,
    value = "on",
    onCheckedChange,

    action,
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
  const [checked, setChecked, initialChecked] = useCheckedController(props);
  const [boundAction, , setActionValue] = useActionBoundToOneParam(
    action,
    checked,
    initialChecked,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const innerOnCheckedChange = (uiChecked, e) => {
    setChecked(uiChecked);
    setActionValue(uiChecked ? value : undefined);
    onCheckedChange?.(uiChecked, e);
  };
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      innerOnCheckedChange(initialChecked, e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: (e) => {
      innerOnCheckedChange(initialChecked, e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      innerOnCheckedChange(initialChecked, e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      onActionEnd?.(e);
    },
  });

  return (
    <FieldGroupLoadingContext.Provider value={actionLoading}>
      <InputCheckboxControlled
        {...rest}
        ref={innerRef}
        name={name}
        checked={checked}
        onCheckedChange={innerOnCheckedChange}
        value={value}
        data-action={boundAction}
        onChange={(e) => {
          requestAction(e.target, boundAction, { event: e });
          onChange?.(e);
        }}
      />
    </FieldGroupLoadingContext.Provider>
  );
});
const InputCheckboxInsideForm = forwardRef((props, ref) => {
  const { name, value = "on", onCheckedChange, ...rest } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [checked, setChecked, initialChecked] = useCheckedController(props);
  const [, setFormParam] = useOneFormParam(name, checked, initialChecked);

  const innerOnCheckedChange = (uiChecked, e) => {
    setChecked(uiChecked);
    setFormParam(uiChecked ? value : undefined);
    onCheckedChange?.(uiChecked, e);
  };
  useFormEvents(innerRef, {
    onFormActionAbort: (e) => {
      innerOnCheckedChange(initialChecked, e);
    },
    onFormActionError: (e) => {
      innerOnCheckedChange(initialChecked, e);
    },
  });

  return (
    <InputCheckboxControlled
      {...rest}
      ref={innerRef}
      name={name}
      checked={checked}
      onCheckedChange={innerOnCheckedChange}
      value={value}
    />
  );
});
