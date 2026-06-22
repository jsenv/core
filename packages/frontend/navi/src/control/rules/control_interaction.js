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
 *       → if blocked  → prevented()
 *       → if allowed  → allowed()
 *         → (in allowed callback) setUIState(value)
 *         → (in allowed callback) dispatchRequestAction(element, { action, event })
 */

import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "../control_dom.js";
import { BUSY_CONSTRAINT } from "./interaction/busy_constraint.js";
import { DISABLED_CONSTRAINT } from "./interaction/disabled_constraint.js";
import { READONLY_CONSTRAINT } from "./interaction/readonly_constraint.js";

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

  const checkInteractivity = ({ event } = {}) => {
    interactionFailedConstraintInfo = null;
    for (const constraint of INTERACTION_CONSTRAINT_SET) {
      const checkResult = constraint.check(controller);
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
    failingManagedInteraction = null;
    if (!interactionFailedConstraintInfo) {
      for (const mc of controller.getManagedControls()) {
        const mci = mc.rules.interaction;
        if (!mci) {
          continue;
        }
        const canInteract = mci.checkInteractivity({ event });
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
    const titleLess = !controller.controlHostProps?.title;
    if (titleLess) {
      const element = controller.elementRef.current;
      if (element) {
        if (interactionFailedConstraintInfo) {
          element.setAttribute(
            "title",
            interactionFailedConstraintInfo.message,
          );
        }
        // Title removal is managed by controlValidation to avoid conflicts.
      }
    }

    return !interactionFailedConstraintInfo && !failingManagedInteraction;
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
    callout.openConstraintCallout(interactionFailedConstraintInfo, {
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

  const onAllowed = () => {
    debugInteraction(event, `"${name}" allowed`);
    allowed?.();
    always?.();
  };

  if (event.defaultPrevented) {
    onPrevented("event.defaultPrevented");
    return false;
  }

  if (!bypassInteractivity) {
    const currentTarget = requestInteractionCustomEvent.currentTarget;
    const controlHost = findControlHost(currentTarget) || currentTarget;
    const controller = controlHost.__uiStateController__;
    const ci = controller?.rules.interaction;
    if (ci) {
      const canInteract = ci.checkInteractivity({ event });
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

  onAllowed();
  return true;
};
