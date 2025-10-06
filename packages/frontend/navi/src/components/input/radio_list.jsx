import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { FormContext } from "../action_execution/form_context.js";
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
  FieldGroupReadOnlyContext,
  FieldGroupRequiredContext,
  FieldGroupUIStateControllerContext,
} from "../field_group_context.js";
import { useActionEvents } from "../use_action_events.js";
import { InputRadio } from "./input_radio.jsx";
import { useFormEvents } from "./use_form_events.js";
import {
  UIStateContext,
  UIStateControllerContext,
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";

import.meta.css = /* css */ `
  .navi_radio_list {
    display: flex;
    flex-direction: column;
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
  const groupReadonly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const { name, loading, disabled, readOnly, children, required, ...rest } =
    props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerLoading = loading || groupLoading;
  const innerReadOnly =
    readOnly || groupReadonly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || groupDisabled;

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
      <FieldGroupUIStateControllerContext.Provider value={uiStateController}>
        <FieldGroupNameContext.Provider value={name}>
          <FieldGroupReadOnlyContext.Provider value={innerReadOnly}>
            <FieldGroupDisabledContext.Provider value={innerDisabled}>
              <FieldGroupRequiredContext.Provider value={required}>
                <FieldGroupLoadingContext.Provider value={innerLoading}>
                  {children}
                </FieldGroupLoadingContext.Provider>
              </FieldGroupRequiredContext.Provider>
            </FieldGroupDisabledContext.Provider>
          </FieldGroupReadOnlyContext.Provider>
        </FieldGroupNameContext.Provider>
      </FieldGroupUIStateControllerContext.Provider>
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
      {...rest}
      ref={innerRef}
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
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const { name, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useOneFormParam(name, uiState);

  useFormEvents(innerRef, {
    onFormReset: (e) => {
      e.preventDefault();
      uiStateController.resetUIState(e);
    },
    onFormActionAbort: () => {},
    onFormActionError: () => {},
  });

  return (
    <RadioListBasic {...rest} ref={innerRef} name={name}>
      {/* <input type="radio" /> must be ignorant of the <form>
      otherwise they would try to update the <form>.
      This responsability belongs to the radio list which manages the list of radios */}
      <FormContext.Provider value={null}> {children}</FormContext.Provider>
    </RadioListBasic>
  );
});
