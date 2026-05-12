// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
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

export const CheckboxList = forwardRef((props, ref) => {
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

  const checkboxList = renderActionableComponent(props, ref, {
    Basic: CheckboxListBasic,
    WithAction: CheckboxListWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {checkboxList}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
});
export const Checkbox = InputCheckbox;

const CheckboxListBasic = forwardRef((props, ref) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const { name, readOnly, disabled, required, loading, children, ...rest } =
    props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerLoading = loading || contextLoading;
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  return (
    <Box
      flex
      {...rest}
      ref={innerRef}
      name={name}
      baseClassName="navi_checkbox_list"
      data-checkbox-list=""
      onresetuistate={(e) => {
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
});

const CheckboxListWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
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
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneArrayParam(
    action,
    uiStateController.uiStateSignal,
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const onRequestAction = useOnRequestAction();
  const [actionRequester, setActionRequester] = useState(null);

  return (
    <CheckboxListBasic
      data-action={boundAction.name}
      {...rest}
      ref={innerRef}
      onnavi_cancel={(e) => {
        uiStateController.resetUIState(e);
        onCancel?.(e);
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
      onChange={(event) => {
        const checkboxList = innerRef.current;
        const checkbox = event.target;
        dispatchRequestAction(checkboxList, {
          event,
          requester: checkbox,
        });
      }}
      loading={loading || actionLoading}
    >
      <LoadingElementContext.Provider value={actionRequester}>
        {children}
      </LoadingElementContext.Provider>
    </CheckboxListBasic>
  );
});
