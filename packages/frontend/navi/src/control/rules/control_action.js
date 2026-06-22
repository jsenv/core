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
 * by `setUIState` on every state change). It only calls `syncValidity` to decide
 * whether to show/close the callout and whether to fire `navi_action_allowed`.
 */

import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "../control_dom.js";
import { findControlProxyTargetController } from "../controller_registry.js";

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
    action,
    requester,
    actionOrigin = "action_prop",
    uiState,
    method = "rerun",
    meta = {},
  } = {},
) => {
  const controlHost = findControlHost(element) || element;
  const controller = controlHost.__uiStateController__;

  // Resolve proxy so navi_action_* fires on the real control element.
  let elementForAction = controlHost;
  if (controller) {
    const proxyTargetController = findControlProxyTargetController(controller);
    if (proxyTargetController) {
      elementForAction = proxyTargetController.elementRef.current;
    }
    if (uiState === undefined) {
      const activeController = proxyTargetController ?? controller;
      uiState = activeController?.uiState;
    }
  }

  // Validity gate: syncValidity both re-checks constraints and decides
  // whether to open/close/update the callout.
  const cv = controller?.rules.validation;
  if (cv) {
    const isValid = cv.syncValidity(event, { fromRequestAction: true });
    if (!isValid) {
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
