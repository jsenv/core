// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useContext, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { InputCheckbox } from "./input/input_checkbox.jsx";
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
  const {
    name,
    readOnly,
    uiAction,
    disabled,
    required,
    loading,
    children,
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
    <CheckboxListUI
      {...remainingProps}
      onChange={(e) => {
        const checkbox = e.target;
        const checkboxList = props.ref.current;
        dispatchRequestAction(checkboxList, {
          event: e,
          requester: checkbox,
        });
      }}
    />
  );
};
