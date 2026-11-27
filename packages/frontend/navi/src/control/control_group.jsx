import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "./control_hooks.jsx";

/**
 * A cluster of controls whose values make one object — a Form without the
 * <form> element and without a send of its own. Named, it is one key of the
 * form or group around it; nameless, its controls answer as if they were the
 * surrounding group's own (see docs/control_object.md). Every `Box` prop is
 * accepted too.
 *
 * @type {import("preact").FunctionComponent<{
 *   children?: import("preact").ComponentChildren,
 *   name?: string,
 *   action?: Function | object,
 *   uiAction?: (value: object, event: Event) => void,
 *   command?: string,
 *   disabled?: boolean,
 *   readOnly?: boolean,
 *   as?: string,
 *   aggregateChildStates?: Function,
 *   distributeChildUIState?: Function,
 *   distributeChildStates?: (groupValue: any, children: object[]) => Map<object, any>,
 *   [key: string]: any,
 * }>}
 *
 * @param {string} [name]
 *   The key the group's value lands under in the form around it.
 * @param {Function|object} [action]
 *   Runs with the group's value when it is sent — Enter in one of its fields,
 *   a `--navi-send` aimed at it — not on each change of a child: that is
 *   `uiAction`, or an `action` on the child itself.
 * @param {Function} [aggregateChildStates]
 *   What the group is worth when that is not "one key per child": two wheels
 *   adding up to a number of minutes, three fields making one date. With
 *   `distributeChildUIState` (the way back down) the group takes and hands back
 *   a single value, so it can be driven by one `value`/`signal` like any other
 *   control — the mechanism InputDuration uses for its hour/minute/second
 *   fields. `name` still says under which key that value lands.
 * @param {Function} [distributeChildStates]
 *   The way down asked ONCE for all the children:
 *   `(groupValue, children) => Map<child, state>`, the mirror of
 *   `aggregateChildStates`. For children that cannot be placed one at a time —
 *   four seats where who sits down decides who moves. A child the Map does not
 *   name is left where it is; given both, this one wins over
 *   `distributeChildUIState`. The group then holds ONE answer its children are
 *   views of: when one of them speaks, the others are placed again (the one
 *   that acted is left where the user put it).
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
