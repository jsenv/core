import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "./control_hooks.jsx";

/**
 * ControlGroup — a named sub-group of form controls whose combined state is
 * aggregated into a single key/value object, exactly like a Form but without
 * the <form> element semantics.
 *
 * Use it when you need a self-contained cluster of inputs that:
 *   - produce one composite value (an object) as their joint state
 *   - can carry their own action / uiAction / command
 *   - may live inside or outside a <Form>
 *
 * Props:
 *   name       — the key under which the composite value is registered in a
 *                parent Form (optional when used standalone)
 *   action     — called with the aggregated object value when any child changes
 *   command    — navi command string (e.g. "--navi-send")
 *   disabled   — propagates to all children
 *   readOnly   — propagates to all children
 *   as         — HTML element to render (default "div")
 *   children   — the controls that belong to this group
 *
 *   aggregateChildStates / distributeChildUIState
 *              — what the group is worth, in both directions, when that is not
 *                simply "one key per child": two wheels that add up to a number
 *                of minutes, three fields that make one date. With them the
 *                group takes and hands back a single value, so it can be driven
 *                by one `value`/`signal` like any other control. Same mechanism
 *                InputDuration uses for its own hour/minute/second fields (see
 *                input_duration.jsx). `name` is unaffected: it still says under
 *                which key the group's value — whatever shape it now has —
 *                lands in the form around it.
 *
 *   distributeChildStates
 *              — the same way down, asked ONCE for all the children at a time:
 *                `(groupValue, children) => Map<child, state>`. The plural of
 *                `distributeChildUIState`, and the mirror of
 *                `aggregateChildStates`, which already sees every child. For a
 *                group whose children cannot be placed one at a time — four
 *                seats where who sits down decides who moves, a row where the
 *                first answer changes what the others may show. A child the Map
 *                does not name is left where it is. Given both, this one wins.
 */
export const ControlGroup = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;

  const [controlgroupRootProps, controlgroupProps, childrenWrapperProps] =
    useControlgroupProps(props, {
      allowCapture: true,
      wantRequesterButtonState: true,
      controlType: props.type || "control_group",
      stateType: "object",
      cascadeValidationToChildren: true,
      aggregateChildStates: props.aggregateChildStates,
      distributeChildUIState: props.distributeChildUIState,
      distributeChildStates: props.distributeChildStates,
    });
  const { children } = controlgroupProps;

  return (
    <Box
      {...controlgroupRootProps}
      {...controlgroupProps}
      type={undefined}
      // consumed by the group hook above; blanked after the spreads so they
      // don't reach the DOM as unknown attributes
      aggregateChildStates={undefined}
      distributeChildUIState={undefined}
      distributeChildStates={undefined}
      pseudoClasses={CONTROL_GROUP_PSEUDO_CLASSES}
    >
      <ControlgroupChildrenWrapper
        {...childrenWrapperProps}
        // do not propagate name to children like radio group or checkbox group does
        // (otherwise anonymous button end up using that name)
        name={undefined}
      >
        {children}
      </ControlgroupChildrenWrapper>
    </Box>
  );
};

const CONTROL_GROUP_PSEUDO_CLASSES = [
  ":hover",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
