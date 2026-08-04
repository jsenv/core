import { RUNNING } from "@jsenv/navi/src/action/action_run_states.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const BUSY_CONSTRAINT = {
  name: "busy",
  messageAttribute: "data-busy-message",
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

// Read in two halves rather than off the rendered `aria-busy`, which conflates
// them: that attribute is written during render, so it still says "true" for
// the whole tick in which an action settles — and that is exactly when this
// gets asked (an action's own completion side effect walking the surface around
// it: a popup deciding whether it may finally close, a slide whether it may
// move on). The action's running state is a signal and is already correct
// there; `loadingFromProps` covers everything else that makes a control busy
// (the `loading` prop, a group's loading context) and has no such timing
// problem.
const isControlBusy = (field) => {
  if (field.loadingFromProps) {
    return true;
  }
  const { boundAction } = field;
  if (boundAction) {
    return boundAction.runningStateSignal.value === RUNNING;
  }
  return field.controlHostProps["aria-busy"] === "true";
};
