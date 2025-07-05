import { dispatchRequestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useNavState } from "../use_nav_state.js";
import { Field } from "./field.jsx";
import { InputCheckbox } from "./input_checkbox.jsx";

import.meta.css = /*css*/ `
.checkbox_list {
    display: flex;
    flex-direction: column;
}
`;

export const CheckboxList = forwardRef((props, ref) => {
  const {
    id,
    name,
    action = () => {},
    label,
    children,
    actionPendingEffect = "loading",
    actionErrorEffect,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    loading,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedValueArrayAtStart = [];
  for (const child of children) {
    if (child.checked || navStateValue?.includes(child.value)) {
      checkedValueArrayAtStart.push(child.value);
    }
  }

  const [effectiveAction, getCheckedValueArray, setCheckedValueArray] =
    useAction(action, {
      name,
      value: checkedValueArrayAtStart,
    });
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const checkedValueArrayFromSignal = getCheckedValueArray();
  const checkedValueArray =
    error || aborted ? checkedValueArrayAtStart : checkedValueArrayFromSignal;
  const addToCheckedValues = (valueToAdd) => {
    const checkedValueArrayWithThisValue = [];
    for (const checkedValue of checkedValueArray) {
      if (checkedValue === valueToAdd) {
        return;
      }
      checkedValueArrayWithThisValue.push(checkedValue);
    }
    checkedValueArrayWithThisValue.push(valueToAdd);
    setCheckedValueArray(checkedValueArrayWithThisValue);
  };
  const removeFromCheckedValues = (valueToRemove) => {
    const checkedValueArrayWithoutThisValue = [];
    let found = false;
    for (const checkedValue of checkedValueArray) {
      if (checkedValue === valueToRemove) {
        found = true;
        continue;
      }
      checkedValueArrayWithoutThisValue.push(checkedValue);
    }
    if (!found) {
      return;
    }
    setCheckedValueArray(checkedValueArrayWithoutThisValue);
  };

  const actionRequesterRef = useRef();
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      setNavStateValue(undefined);
      setCheckedValueArray(checkedValueArrayAtStart);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      if (action && !innerRef.current.form) {
        const requester = actionEvent.detail.requester;
        actionRequesterRef.current = requester;
        executeAction(effectiveAction, { requester });
      }
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: () => {
      setNavStateValue(undefined);
      onActionEnd?.();
    },
  });

  return (
    <fieldset
      className="checkbox_list"
      data-checkbox-list
      ref={innerRef}
      {...rest}
    >
      {label ? <legend>{label}</legend> : null}
      {children.map((child) => {
        const { id, value, disabled, label } = child;
        const checked = checkedValueArray.includes(value);
        const checkboxRef = useRef(null);

        const handleChange = (event) => {
          const checkbox = event.target;
          const checkboxIsChecked = checkbox.checked;
          if (checkboxIsChecked) {
            addToCheckedValues(value);
          } else {
            removeFromCheckedValues(value);
          }

          if (checkbox.form) {
            // let the submit button handle the request action
            return;
          }
          const checkboxListContainer = innerRef.current;
          actionRequesterRef.current = checkbox;
          dispatchRequestAction(checkboxListContainer, event);
        };

        const innerLoading =
          actionPendingEffect === "loading" &&
          (loading ||
            (pending &&
              actionRequesterRef.current &&
              actionRequesterRef.current === checkboxRef.current));

        const innerDisabled = disabled || pending;

        const checkbox = (
          <InputCheckbox
            // ignoreParentAction: each checkbox is controller by this checkbox list
            // we don't want the checkbox to try to update the parent action
            // it's already done here
            ignoreParentAction
            ref={checkboxRef}
            type="checkbox"
            id={id}
            name={name}
            checked={checked}
            disabled={innerDisabled}
            loading={innerLoading}
            onChange={handleChange}
            onProgrammaticChange={handleChange}
          >
            {value}
          </InputCheckbox>
        );

        return (
          <Field
            key={value}
            disabled={innerDisabled}
            label={label}
            input={checkbox}
          />
        );
      })}
    </fieldset>
  );
});
