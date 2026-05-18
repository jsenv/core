import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useFocusGroup } from "../utils/focus/use_focus_group.js";
import { useFieldGroupProps } from "./use_field_group_props.jsx";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const RadioFieldset = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const radioFieldset = <RadioFieldsetField {...props} />;

  return radioFieldset;
};

const RadioFieldsetField = (props) => {
  const { ref, name } = props;
  const fieldGroupProps = useFieldGroupProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      fieldType: "radio_fieldset",
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

  useFocusGroup(ref, { direction: "both", loop: true });

  return (
    <Box
      as="fieldset"
      flex="y"
      {...fieldGroupProps}
      baseClassName="navi_radio_fieldset"
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
        const radioFieldset = ref.current;
        dispatchRequestAction(radioFieldset, {
          event: e,
          requester: target,
        });
      }}
    />
  );
};
