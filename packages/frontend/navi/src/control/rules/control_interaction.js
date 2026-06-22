/**
 * Interaction gate: decides whether a user interaction is allowed to proceed
 * based solely on the control's interactivity state (disabled / read-only / busy).
 *
 * Validity (required, pattern, …) is intentionally NOT checked here.
 * It is the responsibility of the action execution path (`onnavi_action_allowed`)
 * to verify validity before running an action.
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
 *       → if blocked  → "navi_action_prevented" (when wantAction) + prevented()
 *       → if allowed  → allowed() + "navi_action_allowed" (when wantAction)
 *   → "navi_action_allowed" handler (in control_hooks.jsx)
 *       → check validity via controller.controlValidity.syncValidity()
 *       → if invalid → do not execute action
 *       → if valid   → executeAction()
 */

import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "../control_dom.js";
import { findControlProxyTargetController } from "../controller_registry.js";
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
 * Knows nothing about validity — only about whether the user can interact at all.
 */
export const createControlInteraction = (controller) => {
  let interactionFailedConstraintInfo = null;

  const checkInteractivity = () => {
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
    // Also check managed controls (e.g. a busy child blocks the parent action).
    let failingManagedInteraction = null;
    if (!interactionFailedConstraintInfo) {
      for (const mc of controller.getManagedControls()) {
        if (
          mc.controlInteraction &&
          !mc.controlInteraction.checkInteractivity()
        ) {
          failingManagedInteraction = mc.controlInteraction;
          break;
        }
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
        // Note: title removal is managed by controlValidity which also sets it
        // for validation errors. We do not remove here to avoid races.
      }
    }
    return !interactionFailedConstraintInfo && !failingManagedInteraction;
  };

  const controlInteraction = {
    checkInteractivity,
  };
  Object.defineProperty(controlInteraction, "interactionFailedConstraintInfo", {
    get: () => interactionFailedConstraintInfo,
  });
  return controlInteraction;
};

export const dispatchRequestInteraction = (
  element,
  {
    event,
    name = "",
    wantAction = false,
    prevented,
    allowed,
    always,
    ...detailRest
  } = {},
) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_request_interaction", {
    event,
    wantAction,
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
    wantAction = false,
    action,
    actionOrigin = "action_prop",
    requester = event.target,
    meta = {},
    method = "rerun",
    bypassInteractivity = false,
    prevented,
    allowed,
    always,
  } = requestInteractionCustomEvent.detail;

  const onPrevented = (reason) => {
    debugInteraction(event, `"${name}" prevented (${reason})`);
    requestInteractionCustomEvent.preventDefault();
    if (wantAction) {
      dispatchInternalCustomEvent(
        requestInteractionCustomEvent.currentTarget,
        "navi_action_prevented",
        {
          event: requestInteractionCustomEvent,
          requester,
          actionOrigin,
          action,
          method,
          meta,
        },
      );
    }
    prevented?.();
    always?.();
  };

  const onAllowed = () => {
    debugInteraction(event, `"${name}" allowed`);
    allowed?.();
    always?.();
    if (wantAction && action?.isAction) {
      // Resolve proxy so navi_action_* fires on the real control element.
      let elementForAction = requestInteractionCustomEvent.currentTarget;
      const handlingController = elementForAction.__uiStateController__;
      const proxyTargetController = handlingController
        ? findControlProxyTargetController(handlingController)
        : null;
      if (proxyTargetController) {
        elementForAction = proxyTargetController.elementRef.current;
      }
      const activeController = proxyTargetController ?? handlingController;
      const uiState = activeController?.uiState;

      dispatchInternalCustomEvent(elementForAction, "navi_action_allowed", {
        event: requestInteractionCustomEvent,
        requester,
        uiState,
        actionOrigin,
        action,
        method,
        meta,
      });
    }
  };

  if (event.defaultPrevented) {
    onPrevented("event.defaultPrevented");
    return false;
  }

  if (!bypassInteractivity) {
    const currentTarget = requestInteractionCustomEvent.currentTarget;
    const controlHost = findControlHost(currentTarget) || currentTarget;
    const controller = controlHost.__uiStateController__;
    const ci = controller?.controlInteraction;
    if (ci) {
      const canInteract = ci.checkInteractivity();
      if (!canInteract) {
        const failedInfo = ci.interactionFailedConstraintInfo;
        const reason = failedInfo
          ? `failing interaction constraint "${failedInfo.name}"`
          : "not interactable";
        onPrevented(reason);
        return false;
      }
    }
  }

  onAllowed();
  return true;
};

// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
// Override requestSubmit so that programmatic form submissions go through the
// navi interaction gate (interactivity + validity checks) instead of the browser
// native validation pipeline.
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  const form = this;
  const controller = form.__uiStateController__;
  if (!controller) {
    requestSubmit.call(form, submitter);
    return;
  }
  const programmaticEvent = new CustomEvent("programmatic_request_submit", {
    cancelable: true,
    detail: { submitter },
  });
  dispatchRequestInteraction(form, {
    event: programmaticEvent,
    requester: submitter,
    wantAction: true,
    name: "requestSubmit",
  });
  // requestSubmit.call(this, submitter); — intentionally skipped to avoid
  // double-firing: navi handles the action pipeline itself.
};
