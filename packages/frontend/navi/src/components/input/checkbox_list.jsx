import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneArrayParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useNavState } from "../use_nav_state.js";
import { Field } from "./field.jsx";
import { InputCheckbox } from "./input_checkbox.jsx";

import.meta.css = /* css */ `
  .checkbox_list {
    display: flex;
    flex-direction: column;
  }
`;

export const CheckboxList = forwardRef((props, ref) => {
  return renderActionableComponent(
    props,
    ref,
    CheckboxListBasic,
    CheckboxListWithAction,
    CheckboxListInsideForm,
  );
});

const CheckboxListControlled = forwardRef((props, ref) => {
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
    <fieldset className="checkbox_list" ref={innerRef} {...rest}>
      {label ? <legend>{label}</legend> : null}
      {children.map((child) => {
        const {
          label: childLabel,
          readOnly: childReadOnly,
          disabled: childDisabled,
          loading: childLoading,
          onChange: childOnChange,
          value: childValue,
          ...childRest
        } = child;

        const checkbox = (
          <InputCheckbox
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

        return <Field key={childValue} input={checkbox} label={childLabel} />;
      })}
    </fieldset>
  );
});

const CheckboxListBasic = forwardRef((props, ref) => {
  const { value: initialValue, id, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const valueAtStart =
    initialValue === undefined ? navStateValue || [] : initialValue;
  const [checkedValueArray, setCheckedValueArray] = useState(valueAtStart);

  const add = (valueToAdd) => {
    setCheckedValueArray((checkedValueArray) => {
      const valueArrayWithThisValue = [];
      let found = false;
      for (const checkedValue of checkedValueArray) {
        if (checkedValue === valueToAdd) {
          found = true;
          continue;
        }
        valueArrayWithThisValue.push(checkedValue);
      }
      return found ? valueArrayWithThisValue : checkedValueArray;
    });
  };
  const remove = (valueToRemove) => {
    setCheckedValueArray((checkedValueArray) => {
      const valueArrayWithoutThisValue = [];
      let found = false;
      for (const checkedValue of checkedValueArray) {
        if (checkedValue === valueToRemove) {
          found = true;
          continue;
        }
        valueArrayWithoutThisValue.push(checkedValue);
      }
      return found ? valueArrayWithoutThisValue : checkedValueArray;
    });
  };

  return (
    <CheckboxListControlled
      ref={innerRef}
      value={checkedValueArray}
      onChange={(event) => {
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          add(checkboxValue);
        } else {
          remove(checkboxValue);
        }
        setNavStateValue(checkedValueArray);
      }}
      {...rest}
    >
      {children}
    </CheckboxListControlled>
  );
});

const CheckboxListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: initialValue,
    action,
    label,
    children,
    actionErrorEffect,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue, resetNavState] = useNavState(id);
  const valueAtStart =
    initialValue === undefined ? navStateValue || [] : initialValue;

  const [
    boundAction,
    getCheckedValueArray,
    addToCheckedValues,
    removeFromCheckedValues,
    resetCheckedValueArray,
  ] = useActionBoundToOneArrayParam(action, name, valueAtStart);
  const { pending } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef();

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      resetCheckedValueArray();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      actionRequesterRef.current = actionEvent.detail.requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: onActionAbort,
    onError: onActionError,
    onEnd: (e) => {
      resetNavState();
      onActionEnd?.(e);
    },
  });

  return (
    <CheckboxListControlled
      {...rest}
      ref={innerRef}
      onChange={(event) => {
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          addToCheckedValues(checkboxValue);
        } else {
          removeFromCheckedValues(checkboxValue);
        }
        setNavStateValue();
        const checkboxListContainer = innerRef.current;
        requestAction(boundAction, {
          event,
          target: checkboxListContainer,
          requester: checkbox,
        });
      }}
    >
      {children.map((child) => {
        const childRef = useRef();
        return {
          ...child,
          loading:
            child.loading ||
            (pending && actionRequesterRef.current === childRef.current),
          readOnly: child.readOnly || pending,
        };
      })}
    </CheckboxListControlled>
  );
});

const CheckboxListInsideForm = () => {};
