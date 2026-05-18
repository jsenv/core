// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const CheckboxFieldset = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const checkboxFieldset = <CheckboxFieldsetField {...props} />;

  return checkboxFieldset;
};

const CheckboxFieldsetField = (props) => {
  const { ref, name } = props;
  const fieldGroupProps = useFieldGroupProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      fieldType: "checkbox_fieldset",
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
      as="fieldset"
      flex
      {...fieldGroupProps}
      baseClassName="navi_checkbox_fieldset"
      navi-checkbox-list=""
      onChange={(e) => {
        // we rely on change event bubbling but we want to catch only the relevant checkbox change events
        const target = e.target;
        if (target.tagName !== "INPUT" || target.type !== "checkbox") {
          return;
        }
        if (target.name !== name) {
          return;
        }
        const checkboxFieldset = ref.current;
        dispatchRequestAction(checkboxFieldset, {
          event: e,
          requester: target,
        });
      }}
    />
  );
};
