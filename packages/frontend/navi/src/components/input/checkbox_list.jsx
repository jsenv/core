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
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
  FieldGroupOnValueChangeContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
  FieldGroupValueContext,
} from "../field_group_context.js";
import { useActionEvents } from "../use_action_events.js";
import { useStableCallback } from "../use_stable_callback.js";
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
    onValueChange,
    readOnly,
    disabled,
    required,
    loading,
    onChange,
    children,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const onCheckboxValueChange = useStableCallback(
    onValueChange
      ? (_, e) => {
          const checkedValues = collectCheckedValues(innerRef.current, name);
          onValueChange(checkedValues, e);
        }
      : undefined,
  );

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
          <FieldGroupOnValueChangeContext.Provider
            value={onCheckboxValueChange}
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
const collectCheckedValues = (checkboxList, name) => {
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
export const Checkbox = InputCheckbox;

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
  const [boundAction, valueArray, setValueArray, initialValueArray] =
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

  const innerLoading = loading || actionLoading;
  const innerReadOnly =
    readOnly || innerLoading || (!onValueChange && !valueSignal);
  const innerOnValueChange = (checkedValues, e) => {
    setValueArray(checkedValues);
    onValueChange?.(checkedValues, e);
  };
  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      innerOnValueChange(initialValueArray, e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      innerOnValueChange(initialValueArray, e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      innerOnValueChange(initialValueArray, e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      resetNavState();
      onActionEnd?.(e);
    },
  });

  return (
    <CheckboxListBasic
      ref={innerRef}
      name={name}
      value={valueArray}
      onValueChange={innerOnValueChange}
      data-action={boundAction}
      readOnly={innerReadOnly}
      loading={innerLoading}
      onChange={(event) => {
        const checkboxList = innerRef.current;
        const checkbox = event.target;
        requestAction(checkboxList, boundAction, {
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
    id,
    name,
    value: externalValue,
    onValueChange,
    readOnly,
    disabled,
    loading,
    children,
  } = props;
  // here we forward form context. For instance when form is readOnly it propagates to all checkboxes
  const formLoading = useContext(FieldGroupLoadingContext);
  const formReadonly = useContext(FieldGroupReadOnlyContext);
  const formDisabled = useContext(FieldGroupDisabledContext);

  const innerLoading = loading || formLoading;
  const innerReadOnly = readOnly || formReadonly || !onValueChange;
  const innerDisabled = disabled || formDisabled;
  const innerOnValueChange = (checkedValues, e) => {
    setValueArray(checkedValues);
    onValueChange?.(checkedValues, e);
  };

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [valueArray, setValueArray, initialValueArray] = useOneFormArrayParam(
    name,
    externalValue,
    navState,
    [],
  );
  useEffect(() => {
    setNavState(valueArray);
  }, [valueArray]);

  useFormEvents(innerRef, {
    onFormReset: (e) => {
      innerOnValueChange([], e);
    },
    onFormActionAbort: (e) => {
      innerOnValueChange(initialValueArray, e);
    },
    onFormActionError: (e) => {
      innerOnValueChange(initialValueArray, e);
    },
  });

  return (
    <CheckboxListBasic
      ref={innerRef}
      name={name}
      value={valueArray}
      onValueChange={innerOnValueChange}
      readOnly={innerReadOnly}
      loading={innerLoading}
      disabled={innerDisabled}
    >
      {/* Reset form context so that input checkbox within
      do not try to do this. They are handled by the <CheckboxList /> */}
      <FormContext.Provider value={undefined}>{children}</FormContext.Provider>
    </CheckboxListBasic>
  );
});
