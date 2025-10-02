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
      onChange={onChange}
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
  const groupValue = useContext(FieldGroupValueContext);
  const groupReadOnly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupRequired = useContext(FieldGroupRequiredContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const groupActionRequester = useContext(FieldGroupActionRequesterContext);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerName = name || groupName;
  const innerChecked = checked || value === groupValue;
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
      checked={innerChecked}
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
  const [boundAction, valueArray, addValue, removeValue, resetValueArray] =
    useActionBoundToOneArrayParam(
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
      onActionAbort?.(e);
    },
    onError: (e) => {
      resetValueArray();
      onActionError?.(e);
    },
    onEnd: (e) => {
      resetNavState();
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
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          addValue(checkboxValue, valueArray);
        } else {
          removeValue(checkboxValue, valueArray);
        }
        const checkboxListContainer = innerRef.current;
        requestAction(checkboxListContainer, boundAction, {
          event,
          requester: checkbox,
        });
      }}
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
    children,
  } = props;
  const { formIsReadOnly } = formContext;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [valueArray, addValue, removeValue, resetValueArray] =
    useOneFormArrayParam(name, externalValue, navState, []);
  useEffect(() => {
    setNavState(valueArray);
  }, [valueArray]);

  useFormEvents(innerRef, {
    onFormReset: () => {
      resetValueArray();
    },
    onFormActionAbort: () => {
      resetValueArray();
    },
    onFormActionError: () => {
      resetValueArray();
    },
  });

  return (
    <CheckboxListBasic
      ref={innerRef}
      name={name}
      value={valueArray}
      readOnly={readOnly || formIsReadOnly}
      onChange={(event) => {
        const checkbox = event.target;
        const checkboxIsChecked = checkbox.checked;
        const checkboxValue = checkbox.value;
        if (checkboxIsChecked) {
          addValue(checkboxValue, valueArray);
        } else {
          removeValue(checkboxValue, valueArray);
        }
      }}
    >
      {/* Reset form context so that input checkbox within
      do not try to do this. They are handled by the <CheckboxList /> */}
      <FormContext.Provider value={undefined}>{children}</FormContext.Provider>
    </CheckboxListBasic>
  );
});
