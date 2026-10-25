/**
 * How an interaction that does not go through is said, where the hand made it.
 *
 * Two moments. Before: the control around the element would not let a write
 * through (disabled, read-only, busy), or the network policy holds what the
 * interaction writes (`verb`, see interaction_registry.js) — nothing runs, and
 * why is said the way a held control answers a press. A gesture asks it where
 * the hand meets it rather than once the gesture played: a thing carried across
 * the board, or a row swiped out, before being told it was never free to go is
 * the press that "looks accepted and fails after". After: the answer rejected,
 * and what it rejected with is said once the thing stands where it was — a seat
 * taken in the meantime is something the person has to read, not guess from a
 * card flying back.
 */

import { chainEvent } from "@jsenv/dom";
import { isValidElement } from "preact";

import {
  errorIsDisplayed,
  markErrorAsDisplayedBy,
  reportErrorIfNobodyDisplaysIt,
} from "../../action/action_error_report.js";
import { getNetworkPolicyReadOnlyMessage } from "../../action/network_policy.js";
import { findNearestControlHost } from "../control_dom.js";
import { openCallout } from "../rules/callout/callout.js";
import {
  allowsInteraction,
  dispatchRequestInteraction,
} from "../rules/control_interaction.js";

// The control whose gate the element's interactions go through (see
// interaction_registry.js) when it would turn a write down right now, else
// null. Silent: nothing is said, nothing runs.
export const findControlRefusingWrites = (element) => {
  const controlHost = findNearestControlHost(element);
  if (!controlHost || allowsInteraction(controlHost, { intent: "write" })) {
    return null;
  }
  return controlHost;
};

// Said by the gate itself, in the control's words. An event of the
// interaction's name stands for it, chained to the press: the press itself was
// already taken by the gesture reading it.
export const sayControlRefusal = (controlHost, pressEvent, type) => {
  const interactionEvent = new CustomEvent(type);
  chainEvent(interactionEvent, pressEvent);
  dispatchRequestInteraction(controlHost, {
    event: interactionEvent,
    name: `interaction "${type}"`,
    allowed: () => {},
  });
};

// What a refused answer rejected with, said on the element in an error callout
// the way a control says its action failed, and read the way an errorMapping
// answer is: an error, a string or an element is shown; `{ message, target }`
// is shown on that target; rejecting with nothing refuses without a word. An
// error something already shows — the control an outcome asked for its action —
// is not said a second time.
export const sayRefusal = (element, error) => {
  if (error === undefined || error === null) {
    return;
  }
  if (errorIsDisplayed(error)) {
    return;
  }
  let message = error;
  let anchorElement = element;
  if (
    typeof error === "object" &&
    !Error.isError(error) &&
    !isValidElement(error)
  ) {
    message = error.message;
    anchorElement = error.target || element;
  }
  if (message === undefined || !anchorElement.isConnected) {
    // Nothing to show, or nowhere to show it: the error goes where every error
    // nothing displays goes.
    reportErrorIfNobodyDisplaysIt(error);
    return;
  }
  openCallout(message, { anchorElement, status: "error" });
  markErrorAsDisplayedBy(error, "interactions: refused answer");
};

// The policy's words, as a control it holds says them (see READONLY_CONSTRAINT):
// an explanation of the press that just happened, gone once the page moves on.
export const sayHeldByNetworkPolicy = (element) => {
  if (!element.isConnected) {
    return;
  }
  openCallout(getNetworkPolicyReadOnlyMessage(), {
    anchorElement: element,
    status: "info",
    closeByScroll: true,
  });
};
