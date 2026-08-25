import { RUNNING } from "@jsenv/navi/src/action/action_run_states.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const BUSY_CONSTRAINT = {
  name: "busy",
  messageAttribute: "data-busy-message",
  // True for as long as an action runs and false again right after, with
  // nothing to re-check it in between: a title written from it would still be
  // saying "this action is in progress" over a button that has been idle for
  // minutes. The callout says it live while it lasts, which is where that
  // message belongs (see control_interaction.js).
  transient: true,
  // Unlike readonly/disabled, a busy element DOES block its parent from
  // submitting — the element is mid-operation and cannot safely participate.
  check: (field) => {
    const isBusy = isControlBusy(field);
    if (!isBusy) {
      return null;
    }

    const isButton = field.controlType === "button";
    const message = isButton
      ? naviI18n("constraint.busy.button")
      : naviI18n("constraint.busy.default");
    return { message, status: "info" };
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-busy");

// Asked source by source rather than off the rendered `aria-busy`, which
// conflates them and is a frame behind: that attribute is written during
// render, so it still says "true" for the whole tick in which an action
// settles — and that tick is exactly when this gets asked (an action's own
// completion side effect walking the surface around it: a popup deciding
// whether it may finally close, a slide whether it may move on).
//
// The action's running state is a signal, so it is already right there. A
// control busy only because the group above is running the action it asked for
// has no state of its own to read — the group's answer IS its answer, so it
// asks upward and inherits the same live reading.
const isControlBusy = (field) => {
  if (field.loadingFromOwnProp) {
    return true;
  }
  const { boundAction } = field;
  // An optimistic control stays interactive while its bound action runs:
  // a new interaction is queued behind the run (see the action queue in
  // control_hooks.jsx) rather than refused.
  if (
    !field.optimistic &&
    boundAction &&
    boundAction.runningStateSignal.value === RUNNING
  ) {
    return true;
  }
  if (field.loadingFromParent) {
    const parent = field.parentUIStateController;
    return parent ? isControlBusy(parent) : false;
  }
  return false;
};
