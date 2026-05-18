import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const RadioList = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const radioList = <RadioListField {...props} />;

  return radioList;
};

const RadioListField = (props) => {
  const { ref, name } = props;
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
      navi-radio-list=""
      onChange={(e) => {
        // we rely on change event bubbling but we want to catch only the relevant radio change events
        const target = e.target;
        if (target.tagName !== "INPUT" || target.type !== "radio") {
          return;
        }
        if (target.name !== name) {
          return;
        }
        const radioList = ref.current;
        dispatchRequestAction(radioList, {
          event: e,
          requester: target,
        });
      }}
    />
  );
};
