/**
 * What a gesture changes in a closed picker is sent at once.
 *
 * A picker's `action` waits for its popup to close: what is done in there is
 * one answer, given when the person is done. A change made while the popup is
 * closed — the clear cross, a chip's cross, a paste, a cut, a value proposed
 * from beside it (`--navi-update`) — has no close coming, so nothing would ever
 * send it: the value moves on screen and the record behind it stays. Each of
 * those gestures calls this right after setting the value; a failing action
 * puts the value back (resetOnError), as it does after a close.
 *
 * Called by gestures only. A value set without one — a bound signal followed, a
 * cancel or a failure rolled back — is the picker being told, not asked, which
 * is why this is not a reaction to every value set on a closed picker.
 *
 * The action is requested the way the close requests it, not through
 * `--navi-send`: a send also answers the surface around the control (a slide
 * moves on, an open dialog closes — see resolveAfterSend in commands.js), and a
 * cross pressed on a picker in a dialog is not the dialog being answered.
 */

import { findControlHost, findControlRoot } from "../control_dom.js";
import { dispatchRequestAction } from "../rules/control_action.js";

export const sendClosedPickerChange = (element, { event, name, requester }) => {
  const controlHost = findControlHost(element) || element;
  const controlRoot = findControlRoot(controlHost);
  if (!controlRoot || controlRoot.getAttribute("navi-control") !== "picker") {
    return;
  }
  if (controlRoot.getAttribute("aria-expanded") === "true") {
    return;
  }
  const { props } = controlHost.__uiStateController__;
  if (!props.action) {
    return;
  }
  // A picker that picks nothing (`type="confirm"`, a menu of actions) holds no
  // value its action would be sending: that action is the yes of its popup,
  // and a paste landing on the trigger must not say it.
  if (props.picksNothing) {
    return;
  }
  // A source with an action of its own made the request already: `<Button
  // action={remove} command="--navi-clear">` runs the removal, and the command
  // that follows only brings the picker in line with it. Sending the picker's
  // action on top would ask twice.
  if (requester?.__uiStateController__?.props.action) {
    return;
  }
  // `requester`: the source of a command may have claimed the press to send
  // this very change (see isAimedAtSelfInteractionsBelow).
  dispatchRequestAction(controlHost, { event, name, requester });
};
