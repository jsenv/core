import { useContext, useRef, useState } from "preact/hooks";

import { useActionBoundToOneParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { InputRadio } from "./input/input_radio.jsx";
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

export const RadioList = (props) => {
  const refDefault = useRef(null);
  const ref = props.ref || refDefault;
  const uiStateController = useUIGroupStateController(props, "radio_list", {
    childComponentType: "radio",
    aggregateChildStates: (childUIStateControllers) => {
      let activeValue;
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          activeValue = childUIStateController.uiState;
          break;
        }
      }

      return activeValue;
    },
  });
  const uiState = useUIState(uiStateController);
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <RadioListDispatcher {...props} ref={ref} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};
export const Radio = InputRadio;

const RadioListDispatcher = (props) => {
  if (props.action) {
    return <RadioListWithAction {...props} />;
  }
  return <RadioListUI {...props} />;
};

const RadioListUI = (props) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const { name, loading, disabled, readOnly, children, required, ...rest } =
    props;

  const innerLoading = loading || contextLoading;
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  return (
    <Box
      flex="y"
      {...rest}
      baseClassName="navi_radio_list"
      data-radio-list=""
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
const RadioListWithAction = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
    ref,
    action,
    onCancel,
    onActionPrevented,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    loading,
    children,
    ...rest
  } = props;
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiStateController.uiStateSignal,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  const [actionRequester, setActionRequester] = useState(null);
  const onRequestAction = useOnRequestAction();

  return (
    <RadioListUI
      data-action={boundAction}
      {...rest}
      ref={ref}
      // This is the onChange event that bubbled from radios
      onChange={(e) => {
        const radio = e.target;
        const radioListContainer = ref.current;
        dispatchRequestAction(radioListContainer, {
          event: e,
          requester: radio,
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
    </RadioListUI>
  );
};
