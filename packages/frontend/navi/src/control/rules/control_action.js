/**
 * Action gate: decides whether a requested action should execute, based on
 * the control's current validity state.
 *
 * This is intentionally separate from the interaction gate (`control_interaction.js`):
 * - Interaction gate: "can the user interact with this control at all?" (disabled/readonly/busy)
 * - Action gate: "should this specific action execute?" (required, pattern, etc.)
 *
 * Typical call sequence from `control_hooks.jsx`:
 *   1. `dispatchRequestInteraction(element, { ... })` — interactivity check
 *   2. In the `allowed` callback: `setUIState(value)` — update state
 *   3. Still in `allowed`: `dispatchRequestAction(element, { action, event })` — action gate
 *
 * `dispatchRequestAction` assumes `checkValidity` has already been called (it is called
 * by `setUIState` on every state change). It re-checks with `fromRequestAction: true`
 * to trigger any `autoResetOnAction` side effects, then reads the validity state to
 * decide whether to report the failure or fire `navi_action_allowed`.
 */

import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "../control_dom.js";
import { findControlProxyTargetController } from "../controller_registry.js";
import { dispatchRequestInteraction } from "./control_interaction.js";

/**
 * Requests that `action` be executed on `element`.
 *
 * - Resolves any proxy target (so navi_action_* fires on the real element).
 * - Calls `syncValidity` to update callout state and determine validity.
 * - If invalid: calls `reportValidity`, dispatches `navi_action_prevented`, returns false.
 * - If valid:   dispatches `navi_action_allowed`, returns true.
 *
 * Pass `action: "auto"` for form submits — the `onnavi_action_allowed` handler
 * in `control_hooks.jsx` will resolve it to the element's bound action.
 */
export const dispatchRequestAction = (
  element,
  {
    event,
    name = "dispatchRequestAction",
    prevented,
    allowed,
    always,
    ...actionOptions // action, requester, actionOrigin, method, meta
  } = {},
) => {
  return dispatchRequestInteraction(element, {
    event,
    name,
    prevented,
    allowed: () => {
      allowed?.();
      return tryActionAfterInteractionAllowed(element, {
        event,
        ...actionOptions,
      });
    },
    always,
  });
};

export const tryActionAfterInteractionAllowed = (
  element,
  {
    event,
    action = "auto",
    requester,
    actionOrigin = "action_prop",
    method = "rerun",
    meta = {},
  },
) => {
  const controlHost = findControlHost(element) || element;
  const controller = controlHost.__uiStateController__;

  // Resolve proxy so navi_action_* fires on the real control element.
  let elementForAction = controlHost;
  let uiState;
  if (controller) {
    const proxyTargetController = findControlProxyTargetController(controller);
    if (proxyTargetController) {
      elementForAction = proxyTargetController.elementRef.current;
    }
    const activeController = proxyTargetController ?? controller;
    uiState = activeController?.uiState;
  }

  // Validity gate: re-check (handles autoResetOnAction side effects), then read
  // the result and decide whether to report/prevent/allow.
  const cv = controller?.rules.validation;
  if (cv) {
    const isValid = cv.checkValidity({ event, fromRequestAction: true });
    if (!isValid) {
      // Find the specific failing leaf to show the callout on (mirrors syncValidity logic).
      let leafCV = cv;
      while (
        leafCV.failingManagedControlValidity &&
        !leafCV.failedConstraintInfo
      ) {
        leafCV = leafCV.failingManagedControlValidity;
      }
      leafCV.reportValidity({ event });
      if (action === "auto" || action?.isAction) {
        dispatchInternalCustomEvent(elementForAction, "navi_action_prevented", {
          event,
          requester,
          actionOrigin,
          action,
          method,
          meta,
        });
      }
      return false;
    }
  }

  if (action === "auto" || action?.isAction) {
    dispatchInternalCustomEvent(elementForAction, "navi_action_allowed", {
      event,
      requester,
      uiState,
      actionOrigin,
      action,
      method,
      meta,
    });
  }
  return true;
};
