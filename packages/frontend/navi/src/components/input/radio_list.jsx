import { requestAction } from "@jsenv/validation";
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
import { useActionEvents } from "../use_action_events.js";
import { useRefArray } from "../use_ref_array.js";
import { Field } from "./field.jsx";
import { InputRadio } from "./input_radio.jsx";
import { useFormEvents } from "./use_form_event.js";

import.meta.css = /* css */ `
  .radio_list {
    display: flex;
    flex-direction: column;
  }
`;

export const RadioList = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction,
    InsideForm: RadioListInsideForm,
  });
});

const RadioListControlled = forwardRef((props, ref) => {
  const {
    name,
    value,
    label,
    loading,
    disabled,
    readOnly,
    children,
    onChange,
    required,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  return (
    <fieldset className="radio_list" ref={innerRef} {...rest}>
      {label ? <legend>{label}</legend> : null}
      {children.map((child) => {
        const {
          label,
          readOnly: childReadOnly,
          disabled: childDisabled,
          loading: childLoading,
          onChange: childOnChange,
          value: childValue,
          ...childRest
        } = child;

        const radio = (
          <InputRadio
            {...childRest}
            // ignoreForm: each input is controller by this list
            // we don't want the input to try to update the form because it's already done here
            ignoreForm
            name={name}
            value={childValue}
            checked={childValue === value}
            readOnly={readOnly || childReadOnly}
            disabled={disabled || childDisabled}
            loading={loading || childLoading}
            required={required}
            onChange={(event) => {
              onChange(event);
              childOnChange?.(event);
            }}
          />
        );

        return <Field key={childValue} input={radio} label={label} />;
      })}
    </fieldset>
  );
});

const RadioListBasic = forwardRef((props, ref) => {
  const { value: initialValue, id, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const valueAtStart = navState === undefined ? initialValue : navState;
  const [value, setValue] = useState(valueAtStart);
  useEffect(() => {
    setNavState(value);
  }, [value]);

  return (
    <RadioListControlled
      ref={innerRef}
      value={value}
      onChange={(event) => {
        const radio = event.target;
        const radioIsChecked = radio.checked;
        if (!radioIsChecked) {
          return;
        }
        const value = radio.value;
        setValue(value);
      }}
      {...rest}
    >
      {children}
    </RadioListControlled>
  );
});

const RadioListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    action,
    children,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState, resetNavState] = useNavState(id);
  const [boundAction, value, setValue, resetValue] = useActionBoundToOneParam(
    action,
    name,
    externalValue,
    navState,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef(null);
  useEffect(() => {
    setNavState(value);
  }, [value]);

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      resetValue();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      actionRequesterRef.current = actionEvent.detail.requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      resetValue();
      onActionAbort?.(e);
    },
    onError: (error) => {
      resetValue();
      onActionError?.(error);
    },
    onEnd: (e) => {
      resetNavState();
      onActionEnd?.(e);
    },
  });

  const childRefArray = useRefArray(children, (child) => child.value);

  return (
    <RadioListControlled
      ref={innerRef}
      name={name}
      value={value}
      onChange={(event) => {
        const radio = event.target;
        const radioIsChecked = radio.checked;
        if (!radioIsChecked) {
          return;
        }
        const value = radio.value;
        setValue(value);
        const radioListContainer = innerRef.current;
        requestAction(boundAction, {
          event,
          target: radioListContainer,
          requester: radio,
        });
      }}
      {...rest}
    >
      {children.map((child, i) => {
        const childRef = childRefArray[i];
        return {
          ...child,
          ref: childRef,
          loading:
            child.loading ||
            (actionLoading && actionRequesterRef.current === childRef.current),
          readOnly: child.readOnly || actionLoading,
        };
      })}
    </RadioListControlled>
  );
});

const RadioListInsideForm = forwardRef((props, ref) => {
  const {
    formContext,
    id,
    name,
    readOnly,
    value: externalValue,
    children,
    ...rest
  } = props;
  const { formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [value, setValue, resetValue] = useOneFormParam(
    name,
    externalValue,
    navState,
  );
  useEffect(() => {
    setNavState(value);
  }, [value]);

  useFormEvents(innerRef, {
    onFormReset: () => {
      setValue(undefined);
    },
    onFormActionAbort: () => {
      resetValue();
    },
    onFormActionError: () => {
      resetValue();
    },
  });

  return (
    <RadioListControlled
      ref={innerRef}
      name={name}
      value={value}
      readOnly={readOnly || formIsReadOnly}
      onChange={(event) => {
        const radio = event.target;
        const radioIsChecked = radio.checked;
        if (!radioIsChecked) {
          return;
        }
        const value = radio.value;
        setValue(value);
      }}
      {...rest}
    >
      {children}
    </RadioListControlled>
  );
});
