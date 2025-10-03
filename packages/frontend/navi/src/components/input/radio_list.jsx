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
  useActionBoundToOneParam,
  useOneFormParam,
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
} from "../field_group_context.js";
import { useActionEvents } from "../use_action_events.js";
import { useStableCallback } from "../use_stable_callback.js";
import { InputRadio } from "./input_radio.jsx";
import { useFormEvents } from "./use_form_events.js";

import.meta.css = /* css */ `
  .navi_radio_list {
    display: flex;
    flex-direction: column;
  }
`;

export const RadioList = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction,
    InsideForm: RadioListInsideForm,
  });
});
export const Radio = InputRadio;

const RadioListBasic = forwardRef((props, ref) => {
  const {
    name,
    loading,
    disabled,
    readOnly,
    children,
    required,
    value,
    onValueChange,
    ...rest
  } = props;
  const groupOnValueChange = useContext(FieldGroupOnValueChangeContext);
  const groupReadonly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const valueIsSignal = isSignal(value);
  const innerOnValueChange =
    onValueChange || groupOnValueChange
      ? (value, e) => {
          onValueChange?.(value, e);
          groupOnValueChange?.(value, e);
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
    <div ref={innerRef} className="navi_radio_list" {...rest}>
      <FieldGroupNameContext.Provider value={name}>
        <FieldGroupOnValueChangeContext.Provider
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
        </FieldGroupOnValueChangeContext.Provider>
      </FieldGroupNameContext.Provider>
    </div>
  );
});

const RadioListWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value,
    action,
    onValueChange,

    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState, resetNavState] = useNavState(id);
  const [boundAction, , setActionValue, initialValue] =
    useActionBoundToOneParam(action, name, value, navState);
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
    onError: (error) => {
      innerOnValueChange(initialValue, error);
      onActionError?.(error);
    },
    onEnd: (e) => {
      resetNavState();
      onActionEnd?.(e);
    },
  });

  return (
    <RadioListBasic
      {...rest}
      ref={innerRef}
      name={name}
      value={value}
      onValueChange={innerOnValueChange}
      data-action={boundAction}
      onChange={(e) => {
        const radio = e.target;
        const radioListContainer = innerRef.current;
        requestAction(radioListContainer, boundAction, {
          event: e,
          requester: radio,
        });
      }}
    >
      <FieldGroupLoadingContext.Provider value={actionLoading}>
        <FieldGroupActionRequesterContext.Provider value={actionRequester}>
          {children}
        </FieldGroupActionRequesterContext.Provider>
      </FieldGroupLoadingContext.Provider>
    </RadioListBasic>
  );
});
const RadioListInsideForm = forwardRef((props, ref) => {
  const { id, name, value, onValueChange, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [, setFormValue, initialValue] = useOneFormParam(name, value, navState);

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
    <RadioListBasic
      {...rest}
      ref={innerRef}
      name={name}
      value={value}
      onValueChange={innerOnValueChange}
    >
      {children}
    </RadioListBasic>
  );
});
