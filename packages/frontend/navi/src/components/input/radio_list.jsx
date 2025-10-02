import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";

import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { FormContext } from "../action_execution/form_context.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useStableCallback } from "../use_stable_callback.js";
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
  FieldGroupOnValueChangeContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
  FieldGroupValueContext,
} from "./field_group_context.js";
import { InputRadio } from "./input_radio.jsx";
import { useFormEvents } from "./use_form_events.js";

import.meta.css = /* css */ `
  .navi_radio_list {
    display: flex;
    flex-direction: column;
  }
`;

const RadioListBasic = forwardRef((props, ref) => {
  const {
    name,
    loading,
    disabled,
    readOnly,
    children,
    required,
    value,
    onChange,
    onValueChange,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  return (
    <div ref={innerRef} className="navi_radio_list" onChange={onChange}>
      <FieldGroupNameContext.Provider value={name}>
        <FieldGroupValueContext.Provider value={value}>
          <FieldGroupOnValueChangeContext.Provider
            value={useStableCallback(onValueChange)}
          >
            <FieldGroupReadOnlyContext.Provider value={readOnly}>
              <FieldGroupDisabledContext.Provider value={disabled}>
                <FieldGroupRequiredContext.Provider value={required}>
                  <FieldGroupLoadingContext.Provider value={loading}>
                    {children}
                  </FieldGroupLoadingContext.Provider>
                </FieldGroupRequiredContext.Provider>
              </FieldGroupDisabledContext.Provider>
            </FieldGroupReadOnlyContext.Provider>
          </FieldGroupOnValueChangeContext.Provider>
        </FieldGroupValueContext.Provider>
      </FieldGroupNameContext.Provider>
    </div>
  );
});

export const RadioList = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction,
    InsideForm: RadioListInsideForm,
  });
});
export const Radio = InputRadio;

const RadioListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    readOnly,
    loading,
    required,
    action,
    valueSignal,
    onValueChange,

    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    children,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState, resetNavState] = useNavState(id);
  const [boundAction, value, setValue, initialValue] = useActionBoundToOneParam(
    action,
    name,
    valueSignal ? valueSignal : externalValue,
    navState,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const [actionRequester, setActionRequester] = useState(null);
  useEffect(() => {
    setNavState(value);
  }, [value]);

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      setValue(initialValue);
      onValueChange?.(initialValue, e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      setValue(initialValue);
      onValueChange?.(initialValue, e);
      onActionAbort?.(e);
    },
    onError: (error) => {
      setValue(initialValue);
      onValueChange?.(initialValue, error);
      onActionError?.(error);
    },
    onEnd: (e) => {
      resetNavState();
      onActionEnd?.(e);
    },
  });

  const innerLoading = loading || actionLoading;

  return (
    <RadioListBasic
      ref={innerRef}
      name={name}
      value={value}
      data-action={boundAction}
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
      required={required}
      onValueChange={(value, e) => {
        setValue(value);
        onValueChange?.(value, e);
      }}
      onChange={(e) => {
        const radio = e.target;
        const radioListContainer = innerRef.current;
        requestAction(radioListContainer, boundAction, {
          event: e,
          requester: radio,
        });
      }}
    >
      <FieldGroupActionRequesterContext.Provider value={actionRequester}>
        {children}
      </FieldGroupActionRequesterContext.Provider>
    </RadioListBasic>
  );
});
const RadioListInsideForm = forwardRef((props, ref) => {
  const {
    formContext,
    id,
    name,
    value: externalValue,
    onValueChange,
    readOnly,
    required,
    children,
  } = props;
  const { formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [value, setValue, initialValue] = useOneFormParam(
    name,
    externalValue,
    navState,
  );
  useEffect(() => {
    setNavState(value);
  }, [value]);

  useFormEvents(innerRef, {
    onFormReset: (e) => {
      setValue(undefined);
      onValueChange?.(undefined, e);
    },
    onFormActionAbort: (e) => {
      setValue(initialValue);
      onValueChange?.(initialValue, e);
    },
    onFormActionError: (e) => {
      setValue(initialValue);
      onValueChange?.(initialValue, e);
    },
  });

  return (
    <RadioListBasic
      ref={innerRef}
      name={name}
      value={value}
      onValueChange={(checkedValueOrUndefined, e) => {
        setValue(checkedValueOrUndefined);
        onValueChange?.(checkedValueOrUndefined, e);
      }}
      readOnly={readOnly || formIsReadOnly}
      required={required}
    >
      {/* Reset form context so that input radio within
      do not try to do this. They are handled by the <RadioList /> */}
      <FormContext.Provider value={undefined}>{children}</FormContext.Provider>
    </RadioListBasic>
  );
});
