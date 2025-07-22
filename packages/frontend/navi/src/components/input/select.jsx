import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useRefArray } from "../use_ref_array.js";
import { useFormEvents } from "./use_form_event.js";

import.meta.css = /* css */ `
  .navi_select[data-readonly] {
    pointer-events: none;
  }
`;

export const Select = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: SelectBasic,
    WithAction: SelectWithAction,
    InsideForm: SelectInsideForm,
  });
});

const SelectControlled = forwardRef((props, ref) => {
  const { name, value, loading, disabled, readOnly, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const selectElement = (
    <select
      className="navi_select"
      ref={innerRef}
      data-field=""
      data-readonly={readOnly && !disabled ? "" : undefined}
      onKeyDown={(e) => {
        if (readOnly) {
          e.preventDefault();
        }
      }}
      {...rest}
    >
      {children.map((child) => {
        const {
          label,
          readOnly: childReadOnly,
          disabled: childDisabled,
          loading: childLoading,
          value: childValue,
          ...childRest
        } = child;

        return (
          <option
            key={childValue}
            name={name}
            value={childValue}
            selected={childValue === value}
            readOnly={readOnly || childReadOnly}
            disabled={disabled || childDisabled}
            loading={loading || childLoading}
            {...childRest}
          >
            {label}
          </option>
        );
      })}
    </select>
  );

  return (
    <LoaderBackground
      loading={loading}
      color="light-dark(#355fcc, #3b82f6)"
      inset={-1}
    >
      {selectElement}
    </LoaderBackground>
  );
});

const SelectBasic = forwardRef((props, ref) => {
  const { value: initialValue, id, children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const valueAtStart = navState === undefined ? initialValue : navState;
  const [value, setValue] = useState(valueAtStart);
  useEffect(() => {
    setNavState(value);
  }, [value]);

  return (
    <SelectControlled
      ref={innerRef}
      value={value}
      onChange={(event) => {
        const select = event.target;
        const selectedValue = select.value;
        setValue(selectedValue);
      }}
      {...rest}
    >
      {children}
    </SelectControlled>
  );
});

const SelectWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: initialValue,
    action,
    children,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState, resetNavState] = useNavState(id);
  const valueAtStart = initialValue === undefined ? navState : initialValue;
  const [boundAction, getCheckedValue, setCheckedValue, resetCheckedValue] =
    useActionBoundToOneParam(action, name, valueAtStart);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const actionRequesterRef = useRef(null);

  const valueInAction = getCheckedValue();
  const value = valueInAction;
  useEffect(() => {
    setNavState(value);
  }, [valueInAction]);

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      resetCheckedValue();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      actionRequesterRef.current = actionEvent.detail.requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      resetCheckedValue();
      onActionAbort?.(e);
    },
    onError: (error) => {
      resetCheckedValue();
      onActionError?.(error);
    },
    onEnd: () => {
      resetNavState();
      onActionEnd?.();
    },
  });

  const childRefArray = useRefArray(children, (child) => child.value);

  return (
    <SelectControlled
      ref={innerRef}
      name={name}
      value={value}
      onChange={(event) => {
        const select = event.target;
        const selectedValue = select.value;
        setCheckedValue(selectedValue);
        const radioListContainer = innerRef.current;
        const optionSelected = select.querySelector(
          `option[value="${selectedValue}"]`,
        );
        requestAction(boundAction, {
          event,
          target: radioListContainer,
          requester: optionSelected,
        });
      }}
      {...rest}
    >
      {children.map((child, i) => {
        const childRef = childRefArray[i];
        return {
          ...child,
          ref: childRef,
          loading:
            child.loading ||
            (actionLoading && actionRequesterRef.current === childRef.current),
          readOnly: child.readOnly || actionLoading,
        };
      })}
    </SelectControlled>
  );
});

const SelectInsideForm = forwardRef((props, ref) => {
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
  const [getSelectedValue, setSelectedValue, resetSelectedValue] =
    useOneFormParam(name, initialValue, navState);
  const value = getSelectedValue();
  useEffect(() => {
    setNavState(value);
  }, [value]);

  useFormEvents(innerRef, {
    onFormReset: () => {
      setSelectedValue(undefined);
    },
    onFormActionAbort: () => {
      resetSelectedValue();
    },
    onFormActionError: () => {
      resetSelectedValue();
    },
  });

  return (
    <SelectControlled
      ref={innerRef}
      name={name}
      value={value}
      readOnly={readOnly || formIsReadOnly}
      onChange={(event) => {
        const select = event.target;
        const selectedValue = select.checked;
        setSelectedValue(selectedValue);
      }}
      {...rest}
    >
      {children}
    </SelectControlled>
  );
});
