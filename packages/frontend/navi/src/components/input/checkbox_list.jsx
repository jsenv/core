import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
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

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedValueArrayAtStart = [];
  for (const child of children) {
    if (child.checked || navStateValue?.includes(child.value)) {
      checkedValueArrayAtStart.push(child.value);
    }
  }

  const [
    boundAction,
    addToCheckedValues,
    removeFromCheckedValues,
    isChecked,
    resetCheckedValueArray,
  ] = useActionBoundToOneParam(action, name, checkedValueArrayAtStart);
  const { pending } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const actionRequesterRef = useRef();
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      setNavStateValue(undefined);
      resetCheckedValueArray();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const requester = actionEvent.detail.requester;
      actionRequesterRef.current = requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      resetCheckedValueArray();
      onActionAbort?.(e);
    },
    onError: (e) => {
      resetCheckedValueArray();
      onActionError?.(e);
    },
    onEnd: (e) => {
      setNavStateValue(undefined);
      onActionEnd?.(e);
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
        const { id, value, disabled, label, loading } = child;
        const checked = isChecked(value);
        const checkboxRef = useRef(null);

        const innerLoading =
          loading ||
          (pending &&
            actionRequesterRef.current &&
            actionRequesterRef.current === checkboxRef.current);
        const innerDisabled = disabled || pending;
        const checkbox = (
          <InputCheckbox
            // ignoreParentAction: each checkbox is controller by this checkbox list
            // we don't want the checkbox to try to update the parent action
            // it's already done here
            ignoreParentAction
            ref={checkboxRef}
            id={id}
            name={name}
            value={value}
            checked={checked}
            disabled={innerDisabled}
            loading={innerLoading}
            onChange={(event) => {
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
              requestAction(boundAction, {
                event,
                target: checkboxListContainer,
                requester: checkbox,
              });
            }}
          />
        );

        return (
          <Field
            key={value}
            disabled={innerDisabled}
            input={checkbox}
            label={label}
          />
        );
      })}
    </fieldset>
  );
});
