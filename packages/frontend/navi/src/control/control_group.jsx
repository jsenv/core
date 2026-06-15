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
 */
export const ControlGroup = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;

  const [controlgroupProps, remainingProps, childrenWrapperProps] =
    useControlgroupProps(props, {
      wantRequesterButtonState: true,
      controlType: props.type || "control_group",
      stateType: "object",
      aggregateChildStates: (childUIStateControllers) => {
        const groupValues = {};
        for (const childUIStateController of childUIStateControllers) {
          const { name, uiState, allowNameless } = childUIStateController;
          if (!name) {
            if (!allowNameless) {
              console.warn(
                "A ControlGroup child is missing a name property, its state won't be included in the group state",
                childUIStateController,
              );
            }
            continue;
          }
          groupValues[name] = uiState;
        }
        return groupValues;
      },
    });
  const { children } = controlgroupProps;

  return (
    <Box
      {...controlgroupProps}
      {...remainingProps}
      type={undefined}
      pseudoClasses={CONTROL_GROUP_PSEUDO_CLASSES}
      onnavi_get_managed_controls={(e) => {
        e.detail.respondWith(getControlGroupManagedControls(e.currentTarget));
      }}
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

const getControlGroupManagedControls = (el) => {
  const managedControls = [];
  for (const child of el.querySelectorAll("[navi-control-host]")) {
    // Exclude controls that belong to a nested ControlGroup — that group is itself
    // a managed control and will cascade validation to its own children.
    const parentControlGroup = child.closest("[navi-control-group]");
    if (parentControlGroup && parentControlGroup !== el) {
      continue;
    }
    managedControls.push(child);
  }
  return managedControls;
};

const CONTROL_GROUP_PSEUDO_CLASSES = [
  ":hover",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
