import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useRefArray } from "../../use_ref_array.js";
import { useStateArray } from "../../use_state_array.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneArrayParam,
  useOneFormArrayParam,
} from "../action_execution/use_action.js";
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
  return renderActionableComponent(props, ref, {
    Basic: CheckboxListBasic,
    WithAction: CheckboxListWithAction,
    InsideForm: CheckboxListInsideForm,
  });
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
    <fieldset
      {...rest}
      className="checkbox_list"
      ref={innerRef}
      data-checkbox-list
    >
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
            checked={value.includes(childValue)}
            readOnly={readOnly || childReadOnly}
            disabled={disabled || childDisabled}
            loading={loading || childLoading}
            onChange={(event) => {
              onChange(event, child);
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
  const [valueArray, addValue, removeValue] = useStateArray(valueAtStart);

  useEffect(() => {
    setNavStateValue(valueArray);
  }, [valueArray]);

  return (
    <CheckboxListControlled
      ref={innerRef}
      value={valueArray}
      onChange={(event) => {
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          addValue(checkboxValue);
        } else {
          removeValue(checkboxValue);
        }
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

  const [boundAction, getValueArray, addValue, removeValue, resetValueArray] =
    useActionBoundToOneArrayParam(action, name, valueAtStart);
  const { pending, aborted, error } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef(null);

  const valueArrayInAction = getValueArray();
  useEffect(() => {
    setNavStateValue(valueArrayInAction);
  }, [valueArrayInAction]);
  const valueArray = aborted || error ? valueAtStart : valueArrayInAction;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      resetValueArray();
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

  const childRefArray = useRefArray(children, (child) => child.value);

  return (
    <CheckboxListControlled
      {...rest}
      name={name}
      value={valueArray}
      ref={innerRef}
      onChange={(event) => {
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          addValue(checkboxValue, valueArray);
        } else {
          removeValue(checkboxValue, valueArray);
        }
        const checkboxListContainer = innerRef.current;
        requestAction(boundAction, {
          event,
          target: checkboxListContainer,
          requester: checkbox,
        });
      }}
    >
      {children.map((child, i) => {
        const childRef = childRefArray[i];
        const loading =
          child.loading ||
          (pending && actionRequesterRef.current === childRef.current);

        return {
          ...child,
          ref: childRef,
          loading,
          readOnly: child.readOnly || pending,
        };
      })}
    </CheckboxListControlled>
  );
});

const CheckboxListInsideForm = forwardRef((props, ref) => {
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
    initialValue === undefined ? navStateValue || [] : initialValue;
  const [getValueArray, addValue, removeValue] = useOneFormArrayParam(
    name,
    valueAtStart,
  );

  const valueArrayInAction = getValueArray();
  const valueArray =
    formActionAborted || formActionError ? valueAtStart : valueArrayInAction;
  useEffect(() => {
    setNavStateValue(valueArrayInAction);
  }, [valueArrayInAction]);

  return (
    <CheckboxListControlled
      ref={innerRef}
      name={name}
      value={valueArray}
      readOnly={readOnly || formIsReadOnly}
      onChange={(event) => {
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          addValue(checkboxValue, valueArray);
        } else {
          removeValue(checkboxValue, valueArray);
        }
      }}
      {...rest}
    >
      {children}
    </CheckboxListControlled>
  );
});
