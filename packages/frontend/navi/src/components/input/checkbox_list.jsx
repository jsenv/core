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
  useActionBoundToOneArrayParam,
  useOneFormArrayParam,
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
import { InputCheckbox } from "./input_checkbox.jsx";
import { useFormEvents } from "./use_form_events.js";

import.meta.css = /* css */ `
  .navi_checkbox_list {
    display: flex;
    flex-direction: column;
  }
`;

const CheckboxListBasic = forwardRef((props, ref) => {
  const {
    id,
    name,
    value,
    readOnly,
    disabled,
    required,
    loading,
    onChange,
    onValueChange,
    children,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  return (
    <div
      ref={innerRef}
      id={id}
      className="navi_checkbox_list"
      data-checkbox-list
      data-action={props["data-action"]}
      onChange={(e) => {
        onChange?.(e);
        if (onValueChange) {
          const values = collectCheckedValues(innerRef.current, name);
          onValueChange(values, e);
        }
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

export const collectCheckedValues = (checkboxList, name) => {
  const values = [];
  const checkboxSelector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
  const checkboxWithSameName = checkboxList.querySelectorAll(checkboxSelector);
  for (const checkboxElement of checkboxWithSameName) {
    if (checkboxElement.checked) {
      values.push(checkboxElement.value);
    }
  }
  return values;
};

export const CheckboxList = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: CheckboxListBasic,
    WithAction: CheckboxListWithAction,
    InsideForm: CheckboxListInsideForm,
  });
});
export const Checkbox = forwardRef((props, ref) => {
  const { name, value, checked, readOnly, disabled, required, loading } = props;
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
    <InputCheckbox
      ref={innerRef}
      name={innerName}
      value={value}
      checked={checked}
      readOnly={innerReadOnly}
      disabled={innerDisabled}
      required={innerRequired}
      loading={innerLoading}
      {...props}
    />
  );
});

const CheckboxListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    readOnly,
    loading,
    action,
    valueSignal,
    onValueChange,
    actionErrorEffect,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    children,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState, resetNavState] = useNavState(id);
  const [
    boundAction,
    valueArray,
    setValueArray,
    resetValueArray,
    initialValueArray,
  ] = useActionBoundToOneArrayParam(
    action,
    name,
    valueSignal ? valueSignal : externalValue,
    navState,
    [],
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  useEffect(() => {
    setNavState(valueArray);
  }, [valueArray]);

  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      resetValueArray();
      onValueChange?.(initialValueArray, e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      resetValueArray();
      onValueChange?.(initialValueArray, e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      resetValueArray();
      onValueChange?.(initialValueArray, e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      resetNavState();
      onValueChange?.(initialValueArray, e);
      onActionEnd?.(e);
    },
  });

  const innerLoading = loading || actionLoading;

  return (
    <CheckboxListBasic
      ref={innerRef}
      name={name}
      value={valueArray}
      data-action={boundAction}
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
      onChange={(event) => {
        const checkboxList = innerRef.current;
        const checkedValues = collectCheckedValues(checkboxList, name);
        setValueArray(checkedValues);

        const checkbox = event.target;
        requestAction(checkboxList, boundAction, {
          event,
          requester: checkbox,
        });
      }}
      onValueChange={onValueChange}
    >
      <FieldGroupActionRequesterContext.Provider value={actionRequester}>
        {children}
      </FieldGroupActionRequesterContext.Provider>
    </CheckboxListBasic>
  );
});

const CheckboxListInsideForm = forwardRef((props, ref) => {
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
  const [valueArray, setValueArray, resetValueArray, initialValueArray] =
    useOneFormArrayParam(name, externalValue, navState, []);
  useEffect(() => {
    setNavState(valueArray);
  }, [valueArray]);

  useFormEvents(innerRef, {
    onFormReset: (e) => {
      resetValueArray();
      onValueChange?.(initialValueArray, e);
    },
    onFormActionAbort: (e) => {
      resetValueArray();
      onValueChange?.(initialValueArray, e);
    },
    onFormActionError: (e) => {
      resetValueArray();
      onValueChange?.(initialValueArray, e);
    },
  });

  return (
    <CheckboxListBasic
      ref={innerRef}
      name={name}
      value={valueArray}
      readOnly={readOnly || formIsReadOnly}
      onChange={(e) => {
        const checkboxList = innerRef.current;
        const checkedValues = collectCheckedValues(checkboxList, name);
        setValueArray(checkedValues);
        onValueChange?.(checkedValues, e);
      }}
      onValueChange={null}
    >
      {/* Reset form context so that input checkbox within
      do not try to do this. They are handled by the <CheckboxList /> */}
      <FormContext.Provider value={undefined}>{children}</FormContext.Provider>
    </CheckboxListBasic>
  );
});
