/**
 * What a control HOLDS, as opposed to what it is showing.
 *
 * A `value` is held: the control was given it, so handing it back says nothing
 * new. A `defaultValue` is only a suggestion — an age that is usually 18, a
 * duration that is usually 1h30 — so the control holds nothing, and confirming
 * the suggestion IS an answer ("yes, 18"). A control bound to a signal falls on
 * whichever side the signal put it: a signal with something in it is an answer
 * (restored from the url, set by whoever owns it), an empty one leaves the
 * control on its suggestion.
 *
 * The same distinction Form makes across its fields (see readHeldUIState in
 * form.jsx), asked of a single control — which is what lets a Picker tell "the
 * user re-confirmed what was already chosen" (nothing new) from "the user
 * accepted the proposal" (an answer).
 */
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

export const isUIStateHeld = (controller) => {
  if (!controller) {
    return false;
  }
  // Given a value outright: held, whatever it is showing.
  if (controller.hasStateProp || controller.hasValueProp) {
    return true;
  }
  // A facade (a picker) shows what the control inside its popup holds, so that
  // is the one to ask — the facade itself was given nothing.
  const facadeChild = controller.facadeChild;
  if (facadeChild) {
    return isUIStateHeld(facadeChild);
  }
  const boundSignal = controller.props?.signal;
  if (boundSignal) {
    return boundSignal.value !== undefined;
  }
  // Uncontrolled with a suggestion: what it shows is that suggestion until it
  // differs from it.
  if (controller.defaultValue !== undefined) {
    return !compareTwoJsValues(controller.uiState, controller.defaultValue);
  }
  // A group holding nothing of its own is worth what its children are: two
  // wheels each on their own suggestion make a group still waiting for an
  // answer, one of them moved makes a group holding one.
  const childControllers = controller.getChildControllers?.() || [];
  if (childControllers.length > 0) {
    return childControllers.some((child) => isUIStateHeld(child));
  }
  return controller.uiState !== undefined;
};

/**
 * Tell a control — and everything inside it — that what it is showing is now
 * the answer, without its state having to move.
 *
 * The state is already right; what has not happened is anyone saying so. A
 * control reports an answer through `onUIAction` (that is where a bound signal
 * is written, where `uiAction` fires), and a suggestion nobody touched never
 * got there. Confirming a picker is exactly that moment.
 *
 * Down the whole subtree because that is where the answer actually lives: a
 * picker holding a group of two wheels has one signal per wheel, and it is each
 * wheel that has to record what it is showing. Commands are skipped — a
 * `command` on a control is its reaction to being used, and this is a
 * confirmation happening elsewhere, whose own command (the picker's) is already
 * running.
 *
 * And up one, to the group the control answers to: a picker inside a form is
 * one of its fields, and a form is worth what its fields say. What the popup
 * put there arrived through a mount sync, which is deliberately silent — a
 * popup opening is nobody answering (see onChange in ui_state_controller.js) —
 * so this is the first moment the form can be told.
 *
 * That group only hears about it when it moves: a value the user picked in the
 * popup reached it already, and one trip through a picker is one answer. Down
 * the subtree the reaction re-runs either way — a control saying again what it
 * holds says the same thing, and it is where a signal is written.
 */
export const commitUIStateAsAnswer = (controller, e) => {
  if (!controller) {
    return;
  }
  const answering = controller.facadeChild || controller;
  commitSubtree(answering, e);
  controller.parentUIStateController?.onChildUIAction(controller, e, {
    stateChanged: true,
    onlyIfGroupValueMoves: true,
  });
};
const commitSubtree = (controller, e) => {
  controller.onUIAction?.(e, { skipCommand: true });
  for (const child of controller.getChildControllers?.() || []) {
    commitSubtree(child, e);
  }
};
