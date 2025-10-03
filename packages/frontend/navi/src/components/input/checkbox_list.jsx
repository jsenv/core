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
import { isSignal } from "../../utils/is_signal.js";
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
  FieldGroupOnFieldChangeContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
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
    children,
    ...rest
  } = props;
  const groupOnFieldChange = useContext(FieldGroupOnFieldChangeContext);
  const groupReadonly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupLoading = useContext(FieldGroupLoadingContext);

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const valueIsSignal = isSignal(value);
  const innerOnValueChange =
    onValueChange || groupOnFieldChange
      ? (_, e) => {
          const checkboxList = innerRef.current;
          const checkedValues = collectCheckedValues(checkboxList, name);
          onValueChange?.(checkedValues, e);
          groupOnFieldChange?.(checkedValues, e);
        }
      : undefined;
  const innerLoading = loading || groupLoading;
  const innerReadOnly =
    readOnly ||
    groupReadonly ||
    innerLoading ||
    (!innerOnValueChange && !valueIsSignal);
  const innerDisabled = disabled || groupDisabled;

  return (
    <div
      ref={innerRef}
      id={id}
      name={name}
      className="navi_checkbox_list"
      data-checkbox-list
      data-action={props["data-action"]}
      {...rest}
    >
      <FieldGroupNameContext.Provider value={name}>
        <FieldGroupOnFieldChangeContext.Provider
          value={useStableCallback(innerOnValueChange)}
        >
          <FieldGroupReadOnlyContext.Provider value={innerReadOnly}>
            <FieldGroupDisabledContext.Provider value={innerDisabled}>
              <FieldGroupRequiredContext.Provider value={required}>
                <FieldGroupLoadingContext.Provider value={innerLoading}>
                  {children}
                </FieldGroupLoadingContext.Provider>
              </FieldGroupRequiredContext.Provider>
            </FieldGroupDisabledContext.Provider>
          </FieldGroupReadOnlyContext.Provider>
        </FieldGroupOnFieldChangeContext.Provider>
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
    ...rest
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
  const [actionRequester, setActionRequester] = useState(null);

  const innerOnValueChange = (uiValue, e) => {
    setNavState(uiValue);
    setActionValue(uiValue);
    onValueChange?.(uiValue, e);
  };
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
      {...rest}
      ref={innerRef}
      name={name}
      value={value}
      onValueChange={innerOnValueChange}
      data-action={boundAction}
      onChange={(event) => {
        const checkboxList = innerRef.current;
        const checkbox = event.target;
        requestAction(checkboxList, boundAction, {
          event,
          requester: checkbox,
        });
      }}
    >
      <FieldGroupLoadingContext.Provider value={actionLoading}>
        <FieldGroupActionRequesterContext.Provider value={actionRequester}>
          {children}
        </FieldGroupActionRequesterContext.Provider>
      </FieldGroupLoadingContext.Provider>
    </CheckboxListBasic>
  );
});

const CheckboxListInsideForm = forwardRef((props, ref) => {
  const { id, name, value, onValueChange, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [, setFormValue, initialValue] = useOneFormArrayParam(
    name,
    value,
    navState,
    undefined,
  );

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
      {...rest}
      ref={innerRef}
      name={name}
      value={value}
      onValueChange={innerOnValueChange}
    >
      {children}
    </CheckboxListBasic>
  );
});
