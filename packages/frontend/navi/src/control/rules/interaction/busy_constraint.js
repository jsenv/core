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
  // Unless it says the wait is its own (`actionStandalone`): then the refusal
  // stays on the element and every ancestor reads it as free — the group above
  // (see getInteractionBlockingControls) and the popup around it (see
  // popup_busy.js, which filters on `ignoredByParents`).
  check: (field, { intent } = {}) => {
    const busySource = findBusySource(field);
    if (!busySource) {
      return null;
    }

    // Busy, and what it opens still opens: a picker's answer lives in a shape
    // only its popup draws, and refusing to open leaves it unreadable for as
    // long as the wait lasts. Opening reads and nothing more — the same
    // exemption read-only makes, on the same controls (see
    // READONLY_CONSTRAINT), so that "read" means one thing to both.
    if (intent === "read" && field.readOnlyOpens) {
      return null;
    }

    const isButton = field.controlType === "button";
    const message = isButton
      ? naviI18n("constraint.busy.button")
      : naviI18n("constraint.busy.default");
    return {
      message,
      status: "info",
      ignoredByParents: Boolean(field.actionStandalone),
      // Read off the control the run belongs to, not off this one: a field or a
      // submit button inherits its form's wait, so it inherits with it whether
      // the person waiting is allowed to call that wait off (see
      // abortControlRun, and `actionAbortable` in control_hooks.jsx).
      abortable: Boolean(busySource.action && busySource.field.actionAbortable),
    };
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-busy");

/**
 * Give up on the run that makes `field` busy — the person waiting deciding the
 * answer is not coming. The work is not undone: aborting frees the client and
 * nothing more, the server may already have done it (see docs/actions.md,
 * "Aborting saves resources, it does not undo"). What ends is the wait, and
 * with it every refusal held by it.
 */
export const abortControlRun = (field, reason) => {
  const busySource = findBusySource(field);
  if (!busySource || !busySource.action) {
    return false;
  }
  return busySource.action.abort(reason);
};

// Asked source by source rather than off the rendered `aria-busy`, which
// conflates them and is a frame behind: that attribute is written during
// render, so it still says "true" for the whole tick in which an action
// settles — and that tick is exactly when this gets asked (an action's own
// completion side effect walking the surface around it: a popup deciding
// whether it may finally close, a slide whether it may move on).
//
// The action's running state is a signal, so it is already right there. A
// control busy only because the group above is waiting has no state of its own
// to read — the group's answer IS its answer, so it asks upward and inherits
// the same live reading.
//
// What comes back is the control the wait BELONGS to, and the running action
// when there is one, because two questions are asked of it: whether this
// control is busy at all, and what giving up on that wait would mean.
const findBusySource = (field) => {
  if (field.loadingFromOwnProp) {
    // A `loading` prop is a wait the app draws itself; there is no run behind
    // it to call off.
    return { field, action: null };
  }
  const { boundAction } = field;
  // An optimistic control stays interactive while its bound action runs:
  // a new interaction is queued behind the run (see the action queue in
  // control_hooks.jsx) rather than refused.
  if (!field.optimistic && boundAction) {
    // The INSTANCE the proxy resolves to right now, not the proxy's own
    // signal: that one is a MIRROR, synced by an effect the settling batch
    // defers — read mid-batch (a state echo carrying the user's event back
    // down, an automatic follow-up), it still says RUNNING for an action
    // that is already over, and the gate would refuse — callout included —
    // for nothing. The resolved instance is the live truth: at that echo it
    // is the instance that just settled, already COMPLETED. And it IS the
    // running one whenever one runs — a non-optimistic control's state
    // cannot move mid-run, this very gate blocks it.
    const liveAction = boundAction.getCurrentAction?.() ?? boundAction;
    if (liveAction.runningStateSignal.value === RUNNING) {
      return { field, action: liveAction };
    }
  }
  if (field.loadingFromAbove) {
    const parent = field.parentUIStateController;
    return parent ? findBusySource(parent) : null;
  }
  return null;
};
