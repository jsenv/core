// TOFIX: select in data then reset, it reset to red/blue instead of red/blue/green

import { useId, useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { useFocusGroup } from "../../utils/focus/use_focus_group.js";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";

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
  const { ref, name } = props;
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
        childControlType: "checkbox",
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
      onChange={(e) => {
        // we rely on change event bubbling but we want to catch only the relevant checkbox change events
        const target = e.target;
        if (target.tagName !== "INPUT" || target.type !== "checkbox") {
          return;
        }
        if (target.name !== name) {
          return;
        }
        const checkboxGroup = ref.current;
        dispatchRequestAction(checkboxGroup, {
          event: e,
          requester: target,
        });
      }}
    >
      <ControlgroupChildrenWrapper {...childrenWrapperProps}>
        {props.children}
      </ControlgroupChildrenWrapper>
    </Box>
  );
};
