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

/**
 * A set of radios answering one question, holding the value of the one that is
 * checked.
 *
 * It renders a `<fieldset>` and hands its `name` down, so the radios inside are
 * plain `<Input type="radio" value="…">` with nothing else to declare — sharing
 * a name is what makes them exclusive. What it holds is said the way every
 * control says it — `value` / `defaultValue`, or a bound `signal` — and inside a
 * `<Form>` the group is one entry of the submitted params.
 *
 * ```jsx
 * <RadioGroup name="role" defaultValue="viewer" action={save}>
 *   <legend>Rôle</legend>
 *   <Field as="label"><Input type="radio" value="viewer" /> Lecteur</Field>
 *   <Field as="label"><Input type="radio" value="admin" /> Administrateur</Field>
 * </RadioGroup>
 * ```
 *
 * See `<CheckboxGroup>` for the same shape holding an array.
 */
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
