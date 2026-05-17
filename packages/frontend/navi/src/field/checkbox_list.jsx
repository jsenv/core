// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const CheckboxList = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const checkboxList = <CheckboxListField {...props} />;

  return checkboxList;
};

const CheckboxListField = (props) => {
  const { ref } = props;
  const fieldGroupProps = useFieldGroupProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      fieldType: "checkbox_list",
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
    },
  );

  return (
    <Box
      flex
      {...fieldGroupProps}
      baseClassName="navi_checkbox_list"
      data-checkbox-list=""
      onChange={(e) => {
        const checkbox = e.target;
        const checkboxList = ref.current;
        dispatchRequestAction(checkboxList, {
          event: e,
          requester: checkbox,
        });
      }}
    />
  );
};
