import { useContext, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { InputRadio } from "./input/input_radio.jsx";
import { useActionProps } from "./use_action_props.jsx";
import {
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  RequiredContext,
  UIStateContext,
  UIStateControllerContext,
  useUIAction,
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
  const {
    name,
    loading,
    disabled,
    readOnly,
    uiAction,
    children,
    required,
    ...rest
  } = props;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  useUIAction(uiStateController, uiAction);

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
  const remainingProps = useActionProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      provideAction: true,
      provideActionRequester: true,
    },
  );

  return (
    <RadioListUI
      {...remainingProps}
      onChange={(e) => {
        const radio = e.target;
        const radioListContainer = props.ref.current;
        dispatchRequestAction(radioListContainer, {
          event: e,
          requester: radio,
        });
      }}
    />
  );
};
