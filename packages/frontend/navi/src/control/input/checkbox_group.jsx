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

/**
 * @type {import("preact").FunctionComponent<{
 *   maxLength?: number,
 *   maxLengthGuard?: number,
 *   [key: string]: any,
 * }>}
 * @param {number} [props.maxLength]
 *   How many boxes the group accepts — the same word, and the same behaviour,
 *   as `maxLength` on a text field: a rule the group is judged against, not a
 *   wall. More checked boxes than that is allowed to exist and reported as
 *   invalid, which is what lets a value coming from elsewhere be shown and then
 *   corrected.
 * @param {number} [props.maxLengthGuard]
 *   The same limit, enforced as the boxes are checked: while the group holds as
 *   many as it accepts, the unchecked ones go read-only — still focusable and
 *   pressable, answering `"[max] max."` instead of checking — and `uiAction` is
 *   not called. The checked ones can always be unchecked, so a value that
 *   arrived too long can always be brought back under the limit. Implies
 *   `maxLength` for validity.
 */
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
