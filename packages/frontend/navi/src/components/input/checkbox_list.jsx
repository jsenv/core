// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

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
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
  FieldGroupUIStateControllerContext,
} from "../field_group_context.js";
import { useActionEvents } from "../use_action_events.js";
import { InputCheckbox } from "./input_checkbox.jsx";
import { useFormEvents } from "./use_form_events.js";
import {
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";

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

const useCheckboxListUIStateController = (props) => {
  return useUIGroupStateController(props, "checkbox_list", {
    childComponentType: "checkbox",
    emptyState: undefined,
  });
};

const CheckboxListBasic = forwardRef((props, ref) => {
  const groupReadonly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const {
    name,
    uiStateController,
    readOnly,
    disabled,
    required,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  // idéalement on voudrait que le checkbox list puisse écouter tous les autre uiStateController qui le compose
  // (lorsque ce sont des checkbox)
  // afin de pouvoir les controler un peu (juste pour obtenir les valeurs et pour le reset en fait)

  const innerLoading = loading || groupLoading;
  const innerReadOnly =
    readOnly || groupReadonly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || groupDisabled;

  return (
    <div
      {...rest}
      ref={innerRef}
      name={name}
      className="navi_checkbox_list"
      data-checkbox-list
      // eslint-disable-next-line react/no-unknown-property
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
    >
      <FieldGroupNameContext.Provider value={name}>
        <FieldGroupUIStateControllerContext.Provider value={uiStateController}>
          <FieldGroupReadOnlyContext.Provider value={innerReadOnly}>
            <FieldGroupDisabledContext.Provider value={innerDisabled}>
              <FieldGroupRequiredContext.Provider value={required}>
                <FieldGroupLoadingContext.Provider value={innerLoading}>
                  {children}
                </FieldGroupLoadingContext.Provider>
              </FieldGroupRequiredContext.Provider>
            </FieldGroupDisabledContext.Provider>
          </FieldGroupReadOnlyContext.Provider>
        </FieldGroupUIStateControllerContext.Provider>
      </FieldGroupNameContext.Provider>
    </div>
  );
});
// const collectCheckedValues = (checkboxList, name) => {
//   const checkedValues = [];
//   const checkboxSelector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
//   const checkboxWithSameName = checkboxList.querySelectorAll(checkboxSelector);
//   for (const checkboxElement of checkboxWithSameName) {
//     if (checkboxElement.checked) {
//       checkedValues.push(checkboxElement.value);
//     }
//   }
//   return checkedValues.length === 0 ? undefined : checkedValues;
// };

const CheckboxListWithAction = forwardRef((props, ref) => {
  const {
    name,
    action,
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
  const uiStateController = useCheckboxListUIStateController(props);
  const uiState = useUIState(uiStateController);
  const [boundAction] = useActionBoundToOneArrayParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const [actionRequester, setActionRequester] = useState(null);

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: (e) => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      onActionEnd?.(e);
    },
  });

  return (
    <CheckboxListBasic
      {...rest}
      ref={innerRef}
      name={name}
      uiStateController={uiStateController}
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
      <FieldGroupLoadingContext.Provider value={actionLoading}>
        <FieldGroupActionRequesterContext.Provider value={actionRequester}>
          {children}
        </FieldGroupActionRequesterContext.Provider>
      </FieldGroupLoadingContext.Provider>
    </CheckboxListBasic>
  );
});
const CheckboxListInsideForm = forwardRef((props, ref) => {
  const { id, name, value, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const uiStateController = useCheckboxListUIStateController(props, navState);
  const uiState = useUIState(uiStateController);
  useOneFormArrayParam(name, uiState);
  setNavState(uiState);

  useFormEvents(innerRef, {
    onFormReset: (e) => {
      e.preventDefault();
      uiStateController.resetUIState(e);
    },
    onFormActionAbort: () => {},
    onFormActionError: () => {},
  });

  return (
    <CheckboxListBasic
      {...rest}
      ref={innerRef}
      name={name}
      value={value}
      uiStateController={uiStateController}
    >
      {/* <input type="checkbox" /> must not try to update the <form>
     The checkbox list is doing it with the array of checked values
     Without this we would likely have form complaining the input has no name
     or the input overriding the checkbox list */}
      <FormContext.Provider value={null}>{children}</FormContext.Provider>
    </CheckboxListBasic>
  );
});
