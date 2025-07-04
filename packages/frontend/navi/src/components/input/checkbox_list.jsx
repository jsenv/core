import { dispatchRequestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useNavState } from "../use_nav_state.js";

import.meta.css = /*css*/ `
.checkbox_list {
    display: flex;
    flex-direction: column;
}`;
// TODO: ideally if there is no action nor parent action we should have a simplified version of this component

export const CheckboxList = forwardRef((props, ref) => {
  const {
    id,
    name,
    action,
    options,
    actionPendingEffect = "loading",
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedValueArrayAtStart = [];
  for (const option of options) {
    if (option.checked || navStateValue?.includes(option.value)) {
      checkedValueArrayAtStart.push(option.value);
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
    <div
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
        setNavStateValue(undefined);
        onActionEnd?.();
      }}
    >
      {options.map((option) => {
        const { value, disabled } = option;
        const checked = checkedValueArray.includes(value);
        const checkboxRef = useRef(null);

        let checkbox = (
          <input
            ref={checkboxRef}
            type="checkbox"
            name={name}
            value={value}
            checked={checked}
            disabled={disabled || pending}
            onChange={(event) => {
              const checkbox = event.target;
              const checkboxIsChecked = checkbox.checked;
              if (checkboxIsChecked) {
                addToCheckedValues(value);
              } else {
                removeFromCheckedValues(value);
              }
              if (!checkbox.form) {
                const checkboxListContainer = innerRef.current;
                actionRequesterRef.current = checkbox;
                dispatchRequestAction(checkboxListContainer, event);
              }
            }}
          />
        );

        if (actionPendingEffect === "loading") {
          checkbox = (
            <LoaderBackground
              pending={
                pending &&
                actionRequesterRef.current &&
                actionRequesterRef.current === checkboxRef.current
              }
            >
              {checkbox}
            </LoaderBackground>
          );
        }

        return (
          <label
            key={value}
            data-disabled={disabled || pending ? "" : undefined}
          >
            {checkbox}
            {option.renderLabel(option)}
          </label>
        );
      })}
    </div>
  );
});
