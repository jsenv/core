import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
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
    // RadioListInsideForm,
  );
});

const useRadioListValueAtStart = (children, navStateValue) => {
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

  return [checkedValueAtStart];
};

const RadioListControlled = forwardRef((props, ref) => {
  const { name, value, label, loading, children, onChildChecked, ...rest } =
    props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  return (
    <fieldset className="radio_list" ref={innerRef} {...rest}>
      {label ? <legend>{label}</legend> : null}
      {children.map((child) => {
        const {
          label,
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
            loading={loading || childLoading}
            onChange={(event) => {
              if (event.target.checked) {
                onChildChecked(child, event);
              }
              childOnChange?.(event);
            }}
          />
        );

        return <Field key={value} input={radio} label={label} />;
      })}
    </fieldset>
  );
});

const RadioListBasic = forwardRef((props, ref) => {
  const { id, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedValueAtStart = useRadioListValueAtStart(children, navStateValue);
  const [checkedValue, setCheckedValue] = useState(checkedValueAtStart);

  return (
    <RadioListControlled
      ref={innerRef}
      value={checkedValue}
      onChildChecked={(childChecked) => {
        setCheckedValue(childChecked.value);
        setNavStateValue(childChecked.value);
      }}
      {...rest}
    ></RadioListControlled>
  );
});

const RadioListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
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
  const checkedValueAtStart = useRadioListValueAtStart(children, navStateValue);
  const [boundAction, getCheckedValue, setCheckedValue] =
    useActionBoundToOneParam(action, name, checkedValueAtStart);
  const { pending, aborted, error } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const checkedValueInAction = getCheckedValue();
  const checkedValue =
    aborted || error ? checkedValueAtStart : checkedValueInAction;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      setNavStateValue(undefined);
      setCheckedValue(checkedValueAtStart);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
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
      value={checkedValue}
      onChildChecked={(childChecked, event) => {
        setCheckedValue(childChecked.value);
        const radioListContainer = innerRef.current;
        requestAction(boundAction, {
          event,
          target: radioListContainer,
          requester: event.target,
        });
      }}
      {...rest}
    >
      {children.map((child) => {
        return { ...child, loading: child.loading || pending };
      })}
    </RadioListControlled>
  );
});
