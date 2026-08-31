/**
 * Interaction gate: decides whether a user interaction is allowed to proceed
 * based solely on the control's interactivity state (disabled / read-only / busy).
 *
 * Does NOT know about actions or validity — those are handled separately:
 * - Action dispatch + validity: `control_action.js` / `dispatchRequestAction`
 * - Validity checking: `control_validation.js`
 *
 * Each UI state controller gets its own `controlInteraction` instance (created by
 * `createControlInteraction`) just like it gets a `controlValidity` instance.
 *
 * Flow:
 *   user interaction
 *   → dispatchRequestInteraction
 *   → "navi_request_interaction" event
 *   → onRequestInteraction
 *       → check disabled / read-only / busy (via controller.controlInteraction)
 *         against the interaction's `intent` ("write" by default, "read" for one
 *         that only shows what is already there — see READONLY_CONSTRAINT)
 *       → if blocked  → prevented()
 *       → if allowed  → allowed()
 *         → (in allowed callback) setUIState(value)
 *         → (in allowed callback) dispatchRequestAction(element, { action, event })
 */

import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "../control_dom.js";
import { isAimedAtSelfInteractionsBelow } from "../self_interactions.js";
import { preventClickToExpand } from "./click_to_expand.js";
import { getConstraintMessage } from "./constraint_message.js";
import { createOpenToken } from "./control_callout.js";
import { BUSY_CONSTRAINT } from "./interaction/busy_constraint.js";
import { DISABLED_CONSTRAINT } from "./interaction/disabled_constraint.js";
import { READONLY_CONSTRAINT } from "./interaction/readonly_constraint.js";

const INTERACTION_TOKEN = createOpenToken();

const INTERACTION_CONSTRAINT_SET = new Set([
  DISABLED_CONSTRAINT,
  BUSY_CONSTRAINT,
  READONLY_CONSTRAINT,
]);

/**
 * Per-controller interactivity state manager.
 * Checks whether the control is currently interactive (not disabled/readonly/busy).
 * Shows a callout when interaction is blocked.
 * Knows nothing about validity or actions.
 *
 * @param {object} controller - The UI state controller.
 * @param {object} callout    - Shared callout manager from `controller.rules.callout`.
 */
export const createControlInteraction = (
  controller,
  { callout, debugInteraction },
) => {
  let interactionFailedConstraintInfo = null;
  let failingManagedInteraction = null;
  // The title this rule put on the element, if any (see checkInteractivity).
  let titleWritten = null;

  const checkInteractivity = ({ event, intent = "write" } = {}) => {
    interactionFailedConstraintInfo = null;
    for (const constraint of INTERACTION_CONSTRAINT_SET) {
      const checkResult = constraint.check(controller, { intent });
      if (!checkResult) {
        continue;
      }
      const constraintInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;
      interactionFailedConstraintInfo = {
        name: constraint.name,
        constraint,
        ...constraintInfo,
      };
      break;
    }
    // Check managed controls — a non-interactable child blocks the parent,
    // UNLESS the child's failing constraint has `ignoredByParents: true`
    // (e.g. a disabled child inside a group should not prevent the group from acting).
    // Only the children that are reachable alongside the parent take part: a
    // picker's popup content is excluded, see getInteractionBlockingControls.
    failingManagedInteraction = null;
    if (!interactionFailedConstraintInfo) {
      for (const mc of controller.getInteractionBlockingControls()) {
        const mci = mc.rules.interaction;
        if (!mci) {
          continue;
        }
        const canInteract = mci.checkInteractivity({ event, intent });
        if (canInteract) {
          continue;
        }
        const failedInfo = mci.interactionFailedConstraintInfo;
        if (failedInfo?.ignoredByParents) {
          continue;
        }
        failingManagedInteraction = mci;
        break;
      }
    }

    // Keep title attribute in sync for accessibility.
    // Only off a check that asked the general question: a title is read
    // whenever a pointer rests on the element, so it says what is true of the
    // control as a whole. A check made for an interaction that only reads (a
    // read-only picker asked to open its popup) answers about that one
    // interaction — writing the title from it would take away the "read-only"
    // the first time someone opened the popup.
    const titleLess = !controller.controlHostProps?.title;
    if (intent === "write" && titleLess) {
      const element = controller.ref.current;
      if (element) {
        if (interactionFailedConstraintInfo) {
          // Only what stays true: a title is written once and read whenever the
          // pointer rests on the element, so a constraint that comes and goes
          // on its own (busy, see its own `transient`) would leave it telling a
          // story that ended — "this action is in progress" over a button that
          // has been idle for minutes. Those say what they have to say through
          // the callout, live, while it lasts.
          if (!interactionFailedConstraintInfo.constraint?.transient) {
            // The same message the callout would show, not the generated one:
            // a control that says why in its own words (readOnlyMessage and
            // friends) says it wherever the reason is read.
            const { message } = getConstraintMessage(
              controller,
              interactionFailedConstraintInfo.constraint,
              interactionFailedConstraintInfo.message,
              {},
            );
            element.setAttribute("title", message);
            // Remembered so it can be taken back below.
            titleWritten = message;
          }
        } else if (titleWritten !== null) {
          // Only what this rule wrote, and only if nothing has changed it since
          // — a title from validation (which owns its own, see
          // control_validation.js) or from anywhere else is not ours to remove.
          if (element.getAttribute("title") === titleWritten) {
            element.removeAttribute("title");
          }
          titleWritten = null;
        }
      }
    }

    const canInteract =
      !interactionFailedConstraintInfo && !failingManagedInteraction;
    // When the control is now interactable, remove the interaction token
    // so the callout closes if no other tokens (e.g. validation) are active.
    if (canInteract) {
      callout.removeOpenToken(INTERACTION_TOKEN, event);
    }
    return canInteract;
  };

  const reportInteractivity = ({ event } = {}) => {
    if (failingManagedInteraction) {
      // Report on the specific child that is blocking, not the parent.
      failingManagedInteraction.reportInteractivity({ event });
      return;
    }
    debugInteraction(
      event,
      `reportInteractivity (${interactionFailedConstraintInfo.name})`,
    );
    const { message } = getConstraintMessage(
      controller,
      interactionFailedConstraintInfo.constraint,
      interactionFailedConstraintInfo.message,
      {},
    );
    callout.addOpenToken(INTERACTION_TOKEN, {
      message,
      status: interactionFailedConstraintInfo.status,
      anchorElement: interactionFailedConstraintInfo.target,
      event,
      skipFocus: true,
    });
  };

  const controlInteraction = {
    checkInteractivity,
    reportInteractivity,
  };
  Object.defineProperty(controlInteraction, "interactionFailedConstraintInfo", {
    get: () => interactionFailedConstraintInfo,
  });
  Object.defineProperty(controlInteraction, "failingManagedInteraction", {
    get: () => failingManagedInteraction,
  });
  return controlInteraction;
};

export const dispatchRequestInteraction = (
  element,
  { event, name = "", prevented, allowed, always, ...detailRest } = {},
) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_request_interaction", {
    event,
    name,
    prevented,
    allowed,
    always,
    ...detailRest,
  });
};

export const onRequestInteraction = (
  requestInteractionCustomEvent,
  { debugInteraction },
) => {
  const {
    event,
    name,
    // What this interaction would do to the control: write it, or only read it.
    // Everything writes unless it says otherwise — an interaction that merely
    // shows what is already there (opening a picker's popup, closing it again)
    // says "read", and that is what a control held read-only can still let
    // through (see READONLY_CONSTRAINT).
    intent = "write",
    bypassInteractivity = false,
    prevented,
    allowed,
    always,
  } = requestInteractionCustomEvent.detail;

  const onPrevented = (reason) => {
    debugInteraction(event, `"${name}" prevented (${reason})`);
    requestInteractionCustomEvent.preventDefault();
    prevented?.();
    always?.();
  };

  if (event.defaultPrevented) {
    onPrevented("event.defaultPrevented");
    return false;
  }

  if (POINTER_DOWN_TYPE_SET.has(event.type) && event.button !== 0) {
    onPrevented(`non-primary mouse button (${event.button})`);
    return false;
  }

  const currentTarget = requestInteractionCustomEvent.currentTarget;
  const controlHost = findControlHost(currentTarget) || currentTarget;

  // Aimed at something else that lives in this control's box: a chip's cross, an
  // eye, a diskette, claiming the press for itself (see self_interactions.js).
  // The press is that element's alone, and stepping back here — rather than
  // stopping the propagation over there — is what leaves the event whole for
  // everything that is not a navi interaction. Stepping back, not refusing: the
  // reaction never happened, so its `prevented`/`always` (an
  // `e.preventDefault()`, for most of them) have nothing to undo and would take
  // the press from the affordance itself.
  if (isAimedAtSelfInteractionsBelow(event, controlHost)) {
    debugInteraction(
      event,
      `"${name}" is for a self-interactions element below`,
    );
    requestInteractionCustomEvent.preventDefault();
    return false;
  }

  const controller = controlHost.__uiStateController__;

  if (controller && !bypassInteractivity) {
    const ci = controller?.rules.interaction;
    if (ci) {
      const canInteract = ci.checkInteractivity({ event, intent });
      if (!canInteract) {
        const failedInfo =
          ci.interactionFailedConstraintInfo ??
          ci.failingManagedInteraction?.interactionFailedConstraintInfo;
        const reason = failedInfo
          ? `failing interaction constraint "${failedInfo.name}"`
          : "not interactable";
        ci.reportInteractivity({ event });
        onPrevented(reason);
        return false;
      }
    }
  }

  debugInteraction(event, `"${name}" allowed`);
  allowed?.();
  always?.();
  // The click served this control; it must not serve a second time whatever
  // unfolds around it (see click_to_expand.js).
  preventClickToExpand(controlHost, event);
  return true;
};

const POINTER_DOWN_TYPE_SET = new Set(["pointerdown", "mousedown", "click"]);
