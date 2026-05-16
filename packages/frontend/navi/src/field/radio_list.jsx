import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { InputRadio } from "./input/input_radio.jsx";
import { useActionProps } from "./use_action_props.jsx";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import {
  UIStateControllerContext,
  useUIGroupStateController,
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
  const radioList = <RadioListDispatcher {...props} ref={ref} />;

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      {radioList}
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
  const fieldGroupProps = useFieldGroupProps(props);

  return (
    <Box
      flex="y"
      {...fieldGroupProps}
      baseClassName="navi_radio_list"
      navi-submit-effect="request_action"
      data-radio-list=""
    />
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
      // This is the bubbling onChange we receive from radio buttons
      // we should likely ensure we receive change for the correct radio (right now we trust change only happens from the radio we care)
      // we should ensure that
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
