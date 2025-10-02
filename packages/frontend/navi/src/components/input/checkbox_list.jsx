import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef } from "preact/hooks";
import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneArrayParam,
  useOneFormArrayParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useRefArray } from "../use_ref_array.js";
import { useStateArray } from "../use_state_array.js";
import { Field } from "./field.jsx";
import { InputCheckbox } from "./input_checkbox.jsx";
import { useFormEvents } from "./use_form_event.js";

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
  const { value: externalValue, id, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [valueArray, addValue, removeValue] = useStateArray(
    externalValue,
    navState,
    [],
  );
  useEffect(() => {
    setNavState(valueArray);
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
    value: externalValue,
    valueSignal,
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

  const [navState, setNavState, resetNavState] = useNavState(id);
  const [boundAction, valueArray, addValue, removeValue, resetValueArray] =
    useActionBoundToOneArrayParam(
      action,
      name,
      valueSignal ? valueSignal : externalValue,
      navState,
      [],
    );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  useEffect(() => {
    setNavState(valueArray);
  }, [valueArray]);

  const actionRequesterRef = useRef(null);
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
    onAbort: (e) => {
      resetValueArray();
      onActionAbort?.(e);
    },
    onError: (e) => {
      resetValueArray();
      onActionError?.(e);
    },
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
      data-action={boundAction}
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
        requestAction(checkboxListContainer, boundAction, {
          event,
          requester: checkbox,
        });
      }}
    >
      {children.map((child, i) => {
        const childRef = childRefArray[i];
        const loading =
          child.loading ||
          (actionLoading && actionRequesterRef.current === childRef.current);

        return {
          ...child,
          ref: childRef,
          loading,
          readOnly: child.readOnly || actionLoading,
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
  const { formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [valueArray, addValue, removeValue, resetValueArray] =
    useOneFormArrayParam(name, initialValue, navState, []);
  useEffect(() => {
    setNavState(valueArray);
  }, [valueArray]);

  useFormEvents(innerRef, {
    onFormReset: () => {
      resetValueArray();
    },
    onFormActionAbort: () => {
      resetValueArray();
    },
    onFormActionError: () => {
      resetValueArray();
    },
  });

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
