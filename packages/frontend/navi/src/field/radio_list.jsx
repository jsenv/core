import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { InputRadio } from "./input/input_radio.jsx";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const RadioList = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const radioList = <RadioListField {...props} />;

  return radioList;
};
export const Radio = InputRadio;

const RadioListField = (props) => {
  const { ref } = props;
  const fieldGroupProps = useFieldGroupProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      fieldType: "radio_list",
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
    },
  );

  return (
    <Box
      flex="y"
      {...fieldGroupProps}
      baseClassName="navi_radio_list"
      navi-submit-effect="request_action"
      data-radio-list=""
      // This is the bubbling onChange we receive from radio buttons
      // we should likely ensure we receive change for the correct radio (right now we trust change only happens from the radio we care)
      // we should ensure that
      onChange={(e) => {
        const radioList = ref.current;
        const radio = e.target;
        dispatchRequestAction(radioList, {
          event: e,
          requester: radio,
        });
      }}
    />
  );
};
