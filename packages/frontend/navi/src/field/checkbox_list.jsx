// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useContext, useRef, useState } from "preact/hooks";

import { useActionBoundToOneArrayParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { InputCheckbox } from "./input/input_checkbox.jsx";
import { useOnRequestAction } from "./use_action_events.js";
import {
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  LoadingElementContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  RequiredContext,
  UIStateContext,
  UIStateControllerContext,
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const CheckboxList = (props) => {
  const refDefault = useRef(null);
  const ref = props.ref || refDefault;
  const uiStateController = useUIGroupStateController(props, "checkbox_list", {
    childComponentType: "checkbox",
    aggregateChildStates: (childUIStateControllers) => {
      const values = [];
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          values.push(childUIStateController.uiState);
        }
      }
      return values.length === 0 ? undefined : values;
    },
  });
  const uiState = useUIState(uiStateController);
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <CheckboxListDispatcher {...props} ref={ref} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};
export const Checkbox = InputCheckbox;

const CheckboxListDispatcher = (props) => {
  if (props.action) {
    return <CheckboxListWithAction {...props} />;
  }
  return <CheckboxListUI {...props} />;
};

const CheckboxListUI = (props) => {
  const { name, readOnly, disabled, required, loading, children, ...rest } =
    props;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);

  const innerLoading = loading || contextLoading;
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  return (
    <Box
      flex
      {...rest}
      baseClassName="navi_checkbox_list"
      data-checkbox-list=""
      onnavi_request_reset_ui_state={(e) => {
        uiStateController.resetUIState(e);
      }}
    >
      <ParentUIStateControllerContext.Provider value={uiStateController}>
        <FieldNameContext.Provider value={name}>
          <ReadOnlyContext.Provider value={innerReadOnly}>
            <DisabledContext.Provider value={innerDisabled}>
              <RequiredContext.Provider value={required}>
                <LoadingContext.Provider value={innerLoading}>
                  {children}
                </LoadingContext.Provider>
              </RequiredContext.Provider>
            </DisabledContext.Provider>
          </ReadOnlyContext.Provider>
        </FieldNameContext.Provider>
      </ParentUIStateControllerContext.Provider>
    </Box>
  );
};

const CheckboxListWithAction = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
    ref,
    action,
    actionErrorEffect,
    onCancel,
    onActionPrevented,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    children,
    ...rest
  } = props;
  const [boundAction] = useActionBoundToOneArrayParam(
    action,
    uiStateController.uiStateSignal,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  const onRequestAction = useOnRequestAction();
  const [actionRequester, setActionRequester] = useState(null);

  return (
    <CheckboxListUI
      data-action={boundAction}
      {...rest}
      ref={ref}
      onChange={(e) => {
        const checkbox = e.target;
        const checkboxList = ref.current;
        dispatchRequestAction(checkboxList, {
          event: e,
          requester: checkbox,
          actionOrigin: "action_prop",
        });
      }}
      onnavi_cancel={(e) => {
        const { reason } = e.detail;
        uiStateController.resetUIState(e);
        onCancel?.(e, reason);
      }}
      onnavi_request_action={(e) => {
        onRequestAction(boundAction, e);
      }}
      onnavi_action_prevented={onActionPrevented}
      onnavi_action_ready={(e) => {
        setActionRequester(e.detail.requester);
        executeAction(e);
      }}
      onnavi_action_abort={(e) => {
        uiStateController.resetUIState(e);
        onActionAbort?.(e);
      }}
      onnavi_action_error={(e) => {
        uiStateController.resetUIState(e);
        onActionError?.(e);
      }}
      onnavi_action_end={onActionEnd}
      loading={loading || actionLoading}
    >
      <LoadingElementContext.Provider value={actionRequester}>
        {children}
      </LoadingElementContext.Provider>
    </CheckboxListUI>
  );
};
