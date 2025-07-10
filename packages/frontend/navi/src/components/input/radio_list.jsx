import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useNavState } from "../use_nav_state.js";
import { Field } from "./field.jsx";
import { InputRadio } from "./input_radio.jsx";

import.meta.css = /* css */ `
  .radio_list {
    display: flex;
    flex-direction: column;
  }
`;

export const RadioList = forwardRef((props, ref) => {
  return renderActionableComponent(
    props,
    ref,
    RadioListBasic,
    RadioListWithAction,
    RadioListInsideForm,
  );
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

  const [navStateValue, setNavStateValue] = useNavState(id);
  const valueAtStart =
    navStateValue === undefined ? initialValue : navStateValue;
  const [value, setValue] = useState(valueAtStart);

  return (
    <RadioListControlled
      ref={innerRef}
      value={value}
      onChange={(event) => {
        const value = event.target.value;
        setValue(value);
        setNavStateValue(value);
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
    value: initialValue,
    action,
    children,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const valueAtStart =
    navStateValue === undefined ? initialValue : navStateValue;
  const [boundAction, getCheckedValue, setCheckedValue] =
    useActionBoundToOneParam(action, name, valueAtStart);
  const { pending, aborted, error } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef(null);

  const valueInAction = getCheckedValue();
  const value = aborted || error ? valueAtStart : valueInAction;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      setNavStateValue(undefined);
      setCheckedValue(valueAtStart);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      actionRequesterRef.current = actionEvent.detail.requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: () => {
      setNavStateValue(undefined);
      onActionEnd?.();
    },
  });

  return (
    <RadioListControlled
      ref={innerRef}
      value={value}
      onChange={(event) => {
        const radio = event.target;
        setCheckedValue(radio.value);
        setNavStateValue(radio.value);
        const radioListContainer = innerRef.current;
        requestAction(boundAction, {
          event,
          target: radioListContainer,
          requester: radio,
        });
      }}
      {...rest}
    >
      {children.map((child) => {
        const childRef = useRef();
        return {
          ...child,
          ref: childRef,
          loading:
            child.loading ||
            (pending && actionRequesterRef.current === childRef.current),
          readOnly: child.readOnly || pending,
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
    value: initialValue,
    children,
    ...rest
  } = props;
  const { formActionAborted, formActionError, formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const valueAtStart =
    navStateValue === undefined ? initialValue : navStateValue;
  const [getCheckedValue, setCheckedValue] = useOneFormParam(
    name,
    valueAtStart,
  );

  const valueInAction = getCheckedValue();
  const value =
    formActionAborted || formActionError ? valueAtStart : valueInAction;

  return (
    <RadioListControlled
      ref={innerRef}
      value={value}
      readOnly={readOnly || formIsReadOnly}
      onChange={(event) => {
        const radio = event.target;
        setCheckedValue(radio.value);
        setNavStateValue(radio.value);
      }}
      {...rest}
    >
      {children}
    </RadioListControlled>
  );
});
