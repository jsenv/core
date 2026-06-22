/**
 * Interaction gate: decides whether a user interaction is allowed to proceed
 * based solely on the control's interactivity state (disabled / read-only / busy).
 *
 * Validity (required, pattern, …) is intentionally NOT checked here.
 * It is the responsibility of the action execution path (`onnavi_action_allowed`)
 * to verify validity before running an action.
 *
 * Flow:
 *   user interaction
 *   → dispatchRequestInteraction
 *   → "navi_request_interaction" event
 *   → onRequestInteraction
 *       → check disabled / read-only / busy
 *       → if blocked  → "navi_action_prevented" (when wantAction) + prevented()
 *       → if allowed  → allowed() + "navi_action_allowed" (when wantAction)
 *   → "navi_action_allowed" handler (in control_hooks.jsx)
 *       → check validity via controlValidity.syncValidity()
 *       → if invalid → do not execute action
 *       → if valid   → executeAction()
 */

import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "../control_dom.js";
import { findControlProxyTargetController } from "../controller_registry.js";
import { getControlValidityFromElement } from "./control_validity.js";

export const dispatchRequestInteraction = (
  element,
  {
    event,
    name = "",
    wantAction = false,
    category = "none",
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
    category,
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

  const cv = getControlValidityFromElement(
    requestInteractionCustomEvent.currentTarget,
  );
  if (cv && !bypassInteractivity) {
    const canInteract = cv.checkInteractivity(event);
    if (!canInteract) {
      const failedInfo =
        cv.interactionFailedConstraintInfo ??
        cv.failingManagedControlValidity?.interactionFailedConstraintInfo;
      const reason = failedInfo
        ? `failing interaction constraint "${failedInfo.name}"`
        : "not interactable";
      cv.reportInteractivity({ event });
      onPrevented(reason);
      return false;
    }
  }

  onAllowed();
  return true;
};
