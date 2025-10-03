import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import {
  useContext,
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
          const checkboxList = innerRef.current;
          const checkedValues = collectCheckedValues(checkboxList, name);
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
  const checkedValues = [];
  const checkboxSelector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
  const checkboxWithSameName = checkboxList.querySelectorAll(checkboxSelector);
  for (const checkboxElement of checkboxWithSameName) {
    if (checkboxElement.checked) {
      checkedValues.push(checkboxElement.value);
    }
  }
  return checkedValues.length === 0 ? undefined : checkedValues;
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
    value,
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
  const [boundAction, , setActionValue, initialValue] =
    useActionBoundToOneArrayParam(
      action,
      name,
      valueSignal ? valueSignal : value,
      navState,
      undefined,
    );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const innerLoading = loading || actionLoading;
  const innerReadOnly =
    readOnly || innerLoading || (!onValueChange && !valueSignal);
  const innerOnValueChange = (uiValue, e) => {
    setNavState(uiValue);
    setActionValue(uiValue);
    onValueChange?.(uiValue, e);
  };
  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      innerOnValueChange(initialValue, e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      innerOnValueChange(initialValue, e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      innerOnValueChange(initialValue, e);
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
      value={value}
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
    value,
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

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [, setFormValue, initialValue] = useOneFormArrayParam(
    name,
    value,
    navState,
    undefined,
  );

  const innerLoading = loading || formLoading;
  const innerReadOnly = readOnly || formReadonly || !onValueChange;
  const innerDisabled = disabled || formDisabled;
  const innerOnValueChange = (uiValue, e) => {
    setNavState(uiValue);
    setFormValue(uiValue);
    onValueChange?.(uiValue, e);
  };

  useFormEvents(innerRef, {
    onFormReset: (e) => {
      innerOnValueChange(undefined, e);
    },
    onFormActionAbort: (e) => {
      innerOnValueChange(initialValue, e);
    },
    onFormActionError: (e) => {
      innerOnValueChange(initialValue, e);
    },
  });

  return (
    <CheckboxListBasic
      ref={innerRef}
      name={name}
      value={value}
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
