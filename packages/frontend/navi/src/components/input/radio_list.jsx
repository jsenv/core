import { requestAction } from "@jsenv/validation";
import { createContext } from "preact";
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
import { InputRadio } from "./input_radio.jsx";
import { useFormEvents } from "./use_form_event.js";

import.meta.css = /* css */ `
  .navi_radio_list {
    display: flex;
    flex-direction: column;
  }
`;

const RadioListNameContext = createContext();
const RadioListValueContext = createContext();
const RadioListDisabledContext = createContext();
const RadioListRequiredContext = createContext();
const RadioListLoadingContext = createContext();
const RadioListLoadRequesterContext = createContext();
const RadioListReadOnlyContext = createContext();

const RadioListBasic = forwardRef((props, ref) => {
  const {
    id,
    name,
    label,
    loading,
    disabled,
    readOnly,
    children,
    required,
    value,
    onChange,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  return (
    <div
      ref={innerRef}
      {...rest}
      className="navi_radio_list"
      onChange={(event) => {
        onChange?.(event);
      }}
    >
      <RadioListNameContext.Provider value={name}>
        <RadioListValueContext.Provider value={value}>
          <RadioListRequiredContext.Provider value={required}>
            <RadioListDisabledContext.Provider value={disabled}>
              <RadioListLoadingContext.Provider value={loading}>
                <RadioListReadOnlyContext.Provider value={readOnly}>
                  {children}
                </RadioListReadOnlyContext.Provider>
              </RadioListLoadingContext.Provider>
            </RadioListDisabledContext.Provider>
          </RadioListRequiredContext.Provider>
        </RadioListValueContext.Provider>
      </RadioListNameContext.Provider>
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
  const { name, value, checked, disabled, required, loading, readOnly } = props;
  const radioListName = useContext(RadioListNameContext);
  const radioListValue = useContext(RadioListValueContext);
  const radioListReadOnly = useContext(RadioListReadOnlyContext);
  const radioListDisabled = useContext(RadioListDisabledContext);
  const radioListRequired = useContext(RadioListRequiredContext);
  const radioListLoading = useContext(RadioListLoadingContext);
  const radioListLoadRequester = useContext(RadioListLoadRequesterContext);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || radioListName;
  const innerChecked = checked || value === radioListValue;
  const innerReadOnly = readOnly || radioListReadOnly;
  const innerDisabled = disabled || radioListDisabled;
  const innerRequired = required || radioListRequired;
  const innerLoading =
    loading ||
    (radioListLoading && radioListLoadRequester === innerRef.current);

  return (
    <InputRadio
      ref={innerRef}
      name={innerName}
      value={value}
      checked={innerChecked}
      readOnly={innerReadOnly}
      disabled={innerDisabled}
      required={innerRequired}
      loading={innerLoading}
      {...props}
    />
  );
});

const RadioListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    loading,
    readOnly,
    valueSignal,
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
  const [boundAction, value, setValue, resetValue] = useActionBoundToOneParam(
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
      onActionAbort?.(e);
    },
    onError: (error) => {
      resetValue();
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
      onChange={(event) => {
        const radio = event.target;
        const radioIsChecked = radio.checked;
        if (!radioIsChecked) {
          return;
        }
        const value = radio.value;
        setValue(value);
        const radioListContainer = innerRef.current;
        requestAction(radioListContainer, boundAction, {
          event,
          requester: radio,
        });
      }}
      {...rest}
    >
      <RadioListLoadRequesterContext.Provider value={actionRequester}>
        {children}
      </RadioListLoadRequesterContext.Provider>
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
    children,
    ...rest
  } = props;
  const { formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [value, setValue, resetValue] = useOneFormParam(
    name,
    externalValue,
    navState,
  );
  useEffect(() => {
    setNavState(value);
  }, [value]);

  useFormEvents(innerRef, {
    onFormReset: () => {
      setValue(undefined);
    },
    onFormActionAbort: () => {
      resetValue();
    },
    onFormActionError: () => {
      resetValue();
    },
  });

  return (
    <RadioListBasic
      ref={innerRef}
      name={name}
      value={value}
      readOnly={readOnly || formIsReadOnly}
      onChange={(event) => {
        const radio = event.target;
        const radioIsChecked = radio.checked;
        if (!radioIsChecked) {
          return;
        }
        const value = radio.value;
        setValue(value);
      }}
      {...rest}
    >
      {/* Reset form context so that input radio within
      do not try to do this. They are handled by the <RadioList /> */}
      <FormContext.Provider value={undefined}>{children}</FormContext.Provider>
    </RadioListBasic>
  );
});
