import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { requestAction } from "../../validation/custom_constraint_validation.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { InputRadio } from "./input_radio.jsx";
import { useActionEvents } from "./use_action_events.js";
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

import.meta.css = /* css */ `
  @layer navi {
    .navi_radio_list {
      display: flex;
      flex-direction: column;
    }
  }
`;

export const RadioList = forwardRef((props, ref) => {
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
  const radioList = renderActionableComponent(props, ref, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction,
    InsideForm: RadioListInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {radioList}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
});
export const Radio = InputRadio;

const RadioListBasic = forwardRef((props, ref) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const { name, loading, disabled, readOnly, children, required, ...rest } =
    props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerLoading = loading || contextLoading;
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  return (
    <div
      data-action={rest["data-action"]}
      {...rest}
      ref={innerRef}
      className="navi_radio_list"
      data-radio-list
      // eslint-disable-next-line react/no-unknown-property
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
    </div>
  );
});
const RadioListWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,

    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneParam(action, uiState);
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
    <RadioListBasic
      data-action={boundAction}
      {...rest}
      ref={innerRef}
      onChange={(e) => {
        const radio = e.target;
        const radioListContainer = innerRef.current;
        requestAction(radioListContainer, boundAction, {
          event: e,
          requester: radio,
          actionOrigin: "action_prop",
        });
      }}
      loading={loading || actionLoading}
    >
      <LoadingElementContext.Provider value={actionRequester}>
        {children}
      </LoadingElementContext.Provider>
    </RadioListBasic>
  );
});
const RadioListInsideForm = RadioListBasic;
