import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useNavState } from "../use_nav_state.js";
import { Field } from "./field.jsx";
import { InputRadio } from "./input_radio.jsx";

import.meta.css = /*css*/ `
.radio_list {
    display: flex;
    flex-direction: column;
}`;

export const RadioList = forwardRef((props, ref) => {
  const {
    id,
    name,
    action,
    label,
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
  let checkedValueAtStart;
  for (const child of children) {
    if (child.checked) {
      checkedValueAtStart = child.value;
      break;
    }
  }
  if (checkedValueAtStart === undefined && navStateValue !== undefined) {
    checkedValueAtStart = navStateValue;
  }

  const [effectiveAction, getCheckedValue, setCheckedValue] =
    useActionBoundToOneParam(action, name, checkedValueAtStart);
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const checkedValueFromSignal = getCheckedValue();
  const checkedValue =
    error || aborted ? checkedValueAtStart : checkedValueFromSignal;

  const actionRequesterRef = useRef();
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      setNavStateValue(undefined);
      setCheckedValue(checkedValueAtStart);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const requester = actionEvent.detail.requester;
      actionRequesterRef.current = requester;
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
    <fieldset className="radio_list" ref={innerRef} {...rest}>
      {label ? <legend>{label}</legend> : null}
      {children.map((child) => {
        const { id, value, disabled, label, loading } = child;
        const checked = checkedValue === value;
        const radioRef = useRef(null);
        const innerDisabled = disabled || pending;
        const innerLoading =
          loading ||
          (pending &&
            actionRequesterRef.current &&
            actionRequesterRef.current === radioRef.current);

        const radio = (
          <InputRadio
            // ignoreParentAction: each checkbox is controller by this checkbox list
            // we don't want the checkbox to try to update the parent action
            // it's already done here
            ignoreParentAction
            ref={radioRef}
            id={id}
            name={name}
            value={value}
            checked={checked}
            disabled={innerDisabled}
            loading={innerLoading}
            onChange={(event) => {
              const radio = event.target;
              const radioIsChecked = radio.checked;
              if (radioIsChecked) {
                setCheckedValue(value);
                if (radio.form) {
                  return;
                }
                const radioListContainer = innerRef.current;
                requestAction(effectiveAction, {
                  event,
                  target: radioListContainer,
                });
                return;
              }

              // checking if other radio are unchecked is rather useless
              // in case of browser "change" event as browser always uncheck one in favor of an other
              // the only way to uncheck without having something else checked is to do it programmatically (or via form reset button)
              // so we could theorically skip this check and assume no other radio is checked
              // HOWEVER let's be robust
              const closestContainer =
                radio.form ||
                radio.closest(".radio_list") ||
                radio.closest("fieldset") ||
                document;
              const radios = closestContainer.querySelectorAll(
                `input[type="radio"][name="${name}"]`,
              );
              let otherRadioChecked;
              for (const radioCandidate of radios) {
                if (radioCandidate === radio) {
                  continue;
                }
                if (radioCandidate.checked) {
                  otherRadioChecked = true;
                  break;
                }
              }
              if (otherRadioChecked) {
                // so in theory we never reach this point
                return;
              }
              if (checkedValue === value) {
                setCheckedValue(undefined);
              }
              if (radio.form) {
                return;
              }
              const radioListContainer = innerRef.current;
              requestAction(effectiveAction, event, {
                target: radioListContainer,
              });
            }}
          />
        );

        return (
          <Field
            key={value}
            disabled={innerDisabled}
            input={radio}
            label={label}
          />
        );
      })}
    </fieldset>
  );
});
