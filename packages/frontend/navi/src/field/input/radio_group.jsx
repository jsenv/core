import { useId, useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { useFocusGroup } from "../../utils/focus/use_focus_group.js";
import { useFieldgroupInterfaceProps } from "../field_hooks.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";

const css = /* css */ `
  .navi_radio_group {
    border-style: solid;

    &[data-callout] {
      border-color: var(--callout-color);
    }
  }
`;

export const RadioGroup = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const defaultName = useId();
  props.name = props.name || `radio_group_${defaultName}`;
  const radioGroup = <RadioGroupInterface {...props} />;

  return radioGroup;
};

const RadioGroupInterface = (props) => {
  import.meta.css = css;
  const fieldgroupInterfaceProps = useFieldgroupInterfaceProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      fieldType: "radio_group",
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
  const { ref, name } = fieldgroupInterfaceProps;
  useFocusGroup(ref, { wrap: "both" });

  return (
    <Box
      as="fieldset"
      flex="y"
      {...fieldgroupInterfaceProps}
      name={undefined}
      baseClassName="navi_radio_group"
      data-callout-anchor="legend"
      onChange={(e) => {
        // we rely on change event bubbling but we want to catch only the relevant radio change events
        const target = e.target;
        if (target.tagName !== "INPUT" || target.type !== "radio") {
          return;
        }
        if (target.name !== name) {
          return;
        }
        const radioGroup = ref.current;
        dispatchRequestAction(radioGroup, {
          event: e,
          requester: target,
        });
      }}
    />
  );
};
