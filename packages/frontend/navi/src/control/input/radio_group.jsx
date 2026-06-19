import { useId, useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { useFocusGroup } from "../../utils/focus/use_focus_group.js";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";

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
  const { ref } = props;
  const [radioGroupProps, remainingProps, childrenWrapperProps] =
    useControlgroupProps(
      {
        resetOnCancel: true,
        resetOnAbort: true,
        resetOnError: true,
        ...props,
      },
      {
        controlType: "radio_group",
        childControlFilter: (childUIStateController) => {
          return (
            childUIStateController.controlType === "input" &&
            childUIStateController.props.type === "radio"
          );
        },
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
  useFocusGroup(ref, { wrap: "both" });

  return (
    <Box
      as="fieldset"
      {...radioGroupProps}
      {...remainingProps}
      name={undefined}
      baseClassName="navi_radio_group"
      data-callout-point-to-border-box=""
    >
      <ControlgroupChildrenWrapper {...childrenWrapperProps}>
        {props.children}
      </ControlgroupChildrenWrapper>
    </Box>
  );
};
