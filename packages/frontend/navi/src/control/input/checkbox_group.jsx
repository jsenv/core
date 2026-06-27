// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useId, useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { useFocusGroup } from "../../utils/focus/use_focus_group.js";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";

const css = /* css */ `
  .navi_checkbox_group {
    border-style: solid;

    &[data-callout] {
      border-color: var(--callout-color);
    }
  }
`;

export const CheckboxGroup = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const defaultName = useId();
  props.name = props.name || `checkbox_group_${defaultName}`;
  const checkboxGroup = <CheckboxGroupInterface {...props} />;

  return checkboxGroup;
};

const CheckboxGroupInterface = (props) => {
  import.meta.css = css;
  const { ref } = props;
  const [checkboxGroupProps, remainingProps, childrenWrapperProps] =
    useControlgroupProps(
      {
        resetOnCancel: true,
        resetOnAbort: true,
        resetOnError: true,
        ...props,
      },
      {
        stateType: "array",
        controlType: "checkbox_group",
      },
    );
  useFocusGroup(ref, { wrap: "both" });

  return (
    <Box
      as="fieldset"
      {...checkboxGroupProps}
      {...remainingProps}
      name={undefined}
      baseClassName="navi_checkbox_group"
      navi-checkbox-list=""
      data-callout-point-to-border-box=""
    >
      <ControlgroupChildrenWrapper {...childrenWrapperProps}>
        {props.children}
      </ControlgroupChildrenWrapper>
    </Box>
  );
};
