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
    // The gate's own options, named here so they reach it: everything left in
    // actionOptions goes to the action alone, so a gate option arriving under
    // any other name is dropped without a word.
    automatic,
    bypassInteractivity,
    prevented,
    allowed,
    always,
    ...actionOptions // action, requester, actionOrigin, method, meta
  } = {},
) => {
  return dispatchRequestInteraction(element, {
    event,
    name,
    automatic,
    bypassInteractivity,
    // The gate needs it as much as the action does: the requester may be an
    // affordance that claimed the press to ask for this very action, and the
    // control must not read that claim as "this press was not for me" — see
    // isAimedAtSelfInteractionsBelow.
    requester: actionOptions.requester,
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

/**
 * Dispatches an action and reports whether it outlived the dispatch.
 *
 * "start" is dispatched synchronously (see `use_execute_action.js`), so an
 * action that has not settled by the time `dispatchAction` returns is
 * asynchronous — which is the question anything waiting on a commit actually
 * asks before acting on it: a dialog before closing, `--navi-send` before
 * moving to the next slide.
 *
 * `whenSucceeded` registers what to do once it completes, and only then: an
 * error or an abort leaves whatever the action left in front of the user
 * (a validation message, an aborted state) instead. `whenSettled` is for a
 * caller that has something to undo however it ended — a row a swipe pulled out
 * has to come back on a failure, so it must hear about one.
 *
 * @param {Element} element - The element the action is dispatched on.
 * @param {() => any} dispatchAction
 * @returns {{ result: any, isRunning: boolean, whenSucceeded: (callback: Function) => void, whenSettled: (callback: Function) => void }}
 */
export const watchActionCompletion = (element, dispatchAction) => {
  let running = false;
  let onSuccess = null;
  let onSettled = null;
  let settledOutcome = null;
  const onActionStart = (actionStartEvent) => {
    running = true;
    actionStartEvent.detail.addSideEffect((outcome) => {
      running = false;
      const { error, aborted } = outcome;
      if (onSettled) {
        onSettled(outcome);
      } else {
        // Settled before the caller had a chance to ask — a synchronous action.
        // Kept rather than dropped, because what waits on this waits to UNDO
        // something (see whenSettled), and there is no other path for that.
        settledOutcome = outcome;
      }
      if (error || aborted) {
        return;
      }
      // A microtask later, not right here: this runs inside the `batch()` that
      // settles the action (see actions.js), and a bound action mirrors its
      // running state through a signal effect the batch defers — so the action
      // still reads as running until the batch ends. What waits for a commit
      // asks exactly that question next (the interaction gate, on the way to
      // closing a popup), and must not be told the action is still going.
      // Null for an action that settled before the caller ever asked to wait
      // (a synchronous one): it goes out through the caller's own normal path.
      queueMicrotask(() => {
        onSuccess?.();
      });
    });
  };
  element.addEventListener("navi_action_start", onActionStart);
  let result;
  try {
    result = dispatchAction();
  } finally {
    element.removeEventListener("navi_action_start", onActionStart);
  }
  return {
    result,
    isRunning: running,
    whenSucceeded: (callback) => {
      onSuccess = callback;
    },
    whenSettled: (callback) => {
      if (settledOutcome) {
        callback(settledOutcome);
        return;
      }
      onSettled = callback;
    },
  };
};

/**
 * What follows the control's OWN action: it runs once that action has
 * succeeded, and not at all otherwise.
 *
 * The outcome arrives in one of three shapes and each decides differently:
 * - the gate turned the request down (`result === false`): nothing happened,
 *   so nothing follows;
 * - the action is running: what follows waits for it, and an error or an abort
 *   drops it — whatever the action left in front of the user stays;
 * - it is already settled, or never started at all. A control with nothing to
 *   run leaves no outcome behind, and no outcome means nothing went wrong.
 */
export const runWhenActionSucceeded = (completion, callback) => {
  if (completion.result === false) {
    return;
  }
  if (completion.isRunning) {
    completion.whenSucceeded(callback);
    return;
  }
  let succeeded = true;
  completion.whenSettled(({ error, aborted }) => {
    succeeded = !error && !aborted;
  });
  if (succeeded) {
    callback();
  }
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
    reportOnInvalid,
    onInvalid,
  },
) => {
  const controlHost = findControlHost(element) || element;
  const controller = controlHost.__uiStateController__;
  // Whether the control being asked owns the work, or is only a way of asking
  // for it. A button with no action of its own still comes through here (it
  // gets a placeholder action so its own navi_action_* events exist), then
  // hands the real request to its command's target — a submit button to the
  // form around it, which comes back through here with that same button as
  // requester.
  const hasOwnAction = Boolean(controller?.props.action);

  // Resolve proxy so navi_action_* fires on the real control element.
  let elementForAction = controlHost;
  let uiState;
  if (controller) {
    const proxyTargetController = findControlProxyTargetController(controller);
    if (proxyTargetController) {
      elementForAction = proxyTargetController.ref.current;
    }
    const activeController = proxyTargetController ?? controller;
    uiState = activeController?.uiState;
  }

  // Validity gate: re-check (handles autoResetOnAction side effects), then read
  // the result and decide whether to report/prevent/allow.
  const cv = controller?.rules.validation;
  if (cv) {
    const isValid = cv.syncValidity(event, {
      report: reportOnInvalid ?? hasOwnAction,
      fromRequestAction: true,
    });
    if (!isValid) {
      onInvalid?.();
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
    // A control that commits gets the last word on whether this particular
    // value is worth acting on — see Form's own `shouldRequestAction`, which
    // is where "nothing changed since the last send" is decided. Everything
    // before this still ran (the interaction gate, the constraints), and the
    // caller is still told the send went through: what follows a send (a slide
    // moving on, a popup closing) is about the user being done, not about
    // whether there was anything to send.
    if (controller?.shouldRequestAction?.(uiState) === false) {
      return true;
    }
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
