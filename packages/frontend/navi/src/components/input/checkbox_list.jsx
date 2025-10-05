import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
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
  FieldGroupActionErrorContext,
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupNameContext,
  FieldGroupOnUIStateChangeContext,
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
  FieldGroupUIStateControllerContext,
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

export const CheckboxList = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: CheckboxListBasic,
    WithAction: CheckboxListWithAction,
    InsideForm: CheckboxListInsideForm,
  });
});
export const Checkbox = InputCheckbox;

const CheckboxListBasic = forwardRef((props, ref) => {
  const groupOnUIStateChange = useContext(FieldGroupOnUIStateChangeContext);
  const groupReadonly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const {
    name,
    onUIStateChange,
    readOnly,
    disabled,
    required,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerOnUIStateChange =
    onUIStateChange || groupOnUIStateChange
      ? (_, e) => {
          const checkboxList = innerRef.current;
          const checkedValues = collectCheckedValues(checkboxList, name);
          onUIStateChange?.(checkedValues, e);
          groupOnUIStateChange?.(checkedValues, e);
        }
      : undefined;
  const innerLoading = loading || groupLoading;
  const innerReadOnly =
    readOnly || groupReadonly || innerLoading || !innerOnUIStateChange;
  const innerDisabled = disabled || groupDisabled;

  const checkboxController = useMemo(() => {
    return {
      type: "checkbox",
      getUIState: (checkboxProps) => [].includes(checkboxProps.value),
    };
  }, []);

  return (
    <div
      ref={innerRef}
      name={name}
      className="navi_checkbox_list"
      data-checkbox-list
      {...rest}
    >
      <FieldGroupNameContext.Provider value={name}>
        <FieldGroupUIStateControllerContext.Provider value={checkboxController}>
          <FieldGroupOnUIStateChangeContext.Provider
            value={useStableCallback(innerOnUIStateChange)}
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
          </FieldGroupOnUIStateChangeContext.Provider>
        </FieldGroupUIStateControllerContext.Provider>
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

const CheckboxListWithAction = forwardRef((props, ref) => {
  const {
    name,
    action,
    onUIStateChange,
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
  // ici j'ai pas la moindre idée de l'état mais c'est ok
  const [valueState, setValueState] = useState(undefined);
  const [boundAction, , setActionValue] = useActionBoundToOneArrayParam(
    action,
    undefined,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const [actionRequester, setActionRequester] = useState(null);
  const [actionError, setActionError] = useState();

  const innerOnUIStateChange = (uiState, e) => {
    setValueState(uiState);
    setActionValue(uiState);
    onUIStateChange?.(uiState, e);
  };
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      // innerOnUIStateChange(externalValueState, e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      setActionError(null);
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      // innerOnUIStateChange(externalValueState, e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      setActionError(e);
      // innerOnUIStateChange(externalValueState, e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      onActionEnd?.(e);
    },
  });
  useLayoutEffect(() => {
    innerOnUIStateChange(collectCheckedValues(innerRef.current, name));
  }, []);

  return (
    <CheckboxListBasic
      {...rest}
      ref={innerRef}
      name={name}
      value={valueState}
      onUIStateChange={innerOnUIStateChange}
      data-action={boundAction.name}
      onChange={(event) => {
        const checkboxList = innerRef.current;
        const checkbox = event.target;
        requestAction(checkboxList, boundAction, {
          event,
          requester: checkbox,
        });
      }}
    >
      <FieldGroupActionErrorContext.Provider value={actionError}>
        <FieldGroupLoadingContext.Provider value={actionLoading}>
          <FieldGroupActionRequesterContext.Provider value={actionRequester}>
            {children}
          </FieldGroupActionRequesterContext.Provider>
        </FieldGroupLoadingContext.Provider>
      </FieldGroupActionErrorContext.Provider>
    </CheckboxListBasic>
  );
});
const CheckboxListInsideForm = forwardRef((props, ref) => {
  const { id, name, value, onUIStateChange, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [, setFormValue, initialValue] = useOneFormArrayParam(
    name,
    value,
    navState,
    undefined,
  );

  const innerOnUIStateChange = (uiValue, e) => {
    setNavState(uiValue);
    setFormValue(uiValue);
    onUIStateChange?.(uiValue, e);
  };
  useFormEvents(innerRef, {
    onFormReset: (e) => {
      innerOnUIStateChange(undefined, e);
    },
    onFormActionAbort: (e) => {
      innerOnUIStateChange(initialValue, e);
    },
    onFormActionError: (e) => {
      innerOnUIStateChange(initialValue, e);
    },
  });

  return (
    <CheckboxListBasic
      {...rest}
      ref={innerRef}
      name={name}
      value={value}
      onUIStateChange={innerOnUIStateChange}
    >
      {/* <input type="checkbox" /> must not try to update the <form>
     The checkbox list is doing it with the array of checked values
     Without this we would likely have form complaining the input has no name
     or the input overriding the checkbox list */}
      <FormContext.Provider value={null}>{children}</FormContext.Provider>
    </CheckboxListBasic>
  );
});
