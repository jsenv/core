import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";

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
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
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
    <div
      ref={innerRef}
      className="navi_radio_list"
      onChange={(e) => {
        if (onValueChange) {
          const radioList = innerRef.current;
          const checkedRadio = radioList.querySelector(
            'input[type="radio"]:checked',
          );
          const newValue = checkedRadio ? checkedRadio.value : undefined;
          onValueChange(newValue, e);
        }
        onChange?.(e);
      }}
    >
      <FieldGroupNameContext.Provider value={name}>
        <FieldGroupValueContext.Provider value={value}>
          <FieldGroupReadOnlyContext.Provider value={readOnly}>
            <FieldGroupDisabledContext.Provider value={disabled}>
              <FieldGroupRequiredContext.Provider value={required}>
                <FieldGroupLoadingContext.Provider value={loading}>
                  {children}
                </FieldGroupLoadingContext.Provider>
              </FieldGroupRequiredContext.Provider>
            </FieldGroupDisabledContext.Provider>
          </FieldGroupReadOnlyContext.Provider>
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
export const Radio = forwardRef((props, ref) => {
  const { id, name, value, checked, disabled, required, loading, readOnly } =
    props;
  const groupName = useContext(FieldGroupNameContext);
  const groupReadOnly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupRequired = useContext(FieldGroupRequiredContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const groupActionRequester = useContext(FieldGroupActionRequesterContext);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || groupName;
  const innerReadOnly = readOnly || groupReadOnly;
  const innerDisabled = disabled || groupDisabled;
  const innerRequired = required || groupRequired;
  const innerLoading =
    loading || (groupLoading && groupActionRequester === innerRef.current);

  return (
    <InputRadio
      ref={innerRef}
      id={id}
      name={innerName}
      value={value}
      checked={checked}
      readOnly={innerReadOnly}
      disabled={innerDisabled}
      required={innerRequired}
      loading={innerLoading}
    />
  );
});

const RadioListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    readOnly,
    loading,
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
  const [boundAction, value, setValue, resetValue, initialValue] =
    useActionBoundToOneParam(
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
      resetValue();
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
      resetValue();
      onValueChange?.(initialValue, e);
      onActionAbort?.(e);
    },
    onError: (error) => {
      resetValue();
      onValueChange?.(initialValue, error);
      onActionError?.(error);
    },
    onEnd: (e) => {
      resetNavState();
      onValueChange?.(initialValue, e);
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
    readOnly,
    value: externalValue,
    onValueChange,
    children,
  } = props;
  const { formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [value, setValue, resetValue, initialValue] = useOneFormParam(
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
      resetValue();
      onValueChange?.(initialValue, e);
    },
    onFormActionError: (e) => {
      resetValue();
      onValueChange?.(initialValue, e);
    },
  });

  return (
    <RadioListBasic
      ref={innerRef}
      name={name}
      value={value}
      readOnly={readOnly || formIsReadOnly}
      onValueChange={(value) => {
        setValue(value);
      }}
    >
      {/* Reset form context so that input radio within
      do not try to do this. They are handled by the <RadioList /> */}
      <FormContext.Provider value={undefined}>{children}</FormContext.Provider>
    </RadioListBasic>
  );
});
