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
  // Uncontrolled: what it shows is its own default until it differs from it.
  return !compareTwoJsValues(controller.uiState, controller.defaultValue);
};
