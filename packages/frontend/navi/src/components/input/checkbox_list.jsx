import { dispatchRequestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";
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
  useOnFormReset(innerRef, () => {
    setNavStateValue(undefined);
    setCheckedValueArray(checkedValueArrayAtStart);
  });

  const [effectiveAction, getCheckedValueArray, setCheckedValueArray] =
    useAction(action, {
      name,
      value: checkedValueArrayAtStart,
    });
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const actionRequesterRef = useRef();

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

  return (
    <fieldset
      className="checkbox_list"
      data-checkbox-list
      ref={innerRef}
      {...rest} // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (!actionEvent.target.form) {
          const requester = actionEvent.detail.requester;
          actionRequesterRef.current = requester;
          executeAction(effectiveAction, { requester });
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={onActionError}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={() => {
        setNavStateValue(undefined); // the action is completed the nav state is no longer needed
        onActionEnd?.();
      }}
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
