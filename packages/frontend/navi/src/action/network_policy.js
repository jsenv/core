import { signal, untracked } from "@preact/signals";

import { naviI18n } from "../text/navi_i18n.js";
import { isSignal } from "../utils/is_signal.js";

/*
 * The network policy: one declaration saying whether a request may go out,
 * read by the action layer rather than by every callback.
 *
 * Under a policy (a truthy reason):
 * - a resource GET answers with the row its store holds for it — named by its
 *   params, or the one it last completed with — and asks nothing
 *   (resource_graph.js, applyNetworkPolicy); a completed read
 *   asked to rerun stays completed (actions.js, handleActionRequest);
 *   anything else settles with an OfflineError carrying the reason;
 * - a control bound to a write — or inside a form bound to one — is read-only
 *   and says why (control_hooks.jsx, readonly_constraint.js).
 *
 * The reason is a value rather than a boolean because "no network" and
 * "offline mode" are not said the same way to the user: the error and the
 * read-only message both carry it, and the app decides the words.
 *
 * Only actions declaring a verb (`meta.verb`, which every resource action
 * has) are subject to the policy: a plain `createAction` may not touch the
 * network at all, and navi has no way to tell.
 */

const WRITE_VERB_SET = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const networkPolicySignal = signal({
  source: null,
  readOnlyMessage: undefined,
});

/**
 * Declares whether requests may go out.
 *
 * @param {import("@preact/signals").Signal | Function | any} source - where the
 *   reason is read from: a signal (followed live), a function (called on each
 *   read), or a plain value. A falsy reason means "go to the network"; any
 *   truthy value means "do not", and is handed to the `OfflineError` an action
 *   settles with (`error.reason`) so a screen can say which kind of offline it is.
 * @param {Object} [options]
 * @param {string | ((reason: any) => string)} [options.readOnlyMessage] - what a
 *   control held back by the policy answers when pressed; defaults to navi's
 *   `constraint.readonly.network_policy` text.
 * @see docs/offline.md
 *
 * @example
 * const offlineReasonSignal = computed(() =>
 *   offlineChosenSignal.value ? "chosen" : deviceOfflineSignal.value ? "device" : null,
 * );
 * setNetworkPolicy(offlineReasonSignal, {
 *   readOnlyMessage: (reason) =>
 *     reason === "device" ? "No network: this cannot be sent." : "Offline mode: this cannot be sent.",
 * });
 */
export const setNetworkPolicy = (source, { readOnlyMessage } = {}) => {
  silenceOfflineErrors();
  networkPolicySignal.value = { source, readOnlyMessage };
};

/**
 * The policy's reason, `null` when requests may go out. Read in a component
 * render, it follows the policy as it changes.
 */
export const useNetworkPolicyReason = () => {
  return readReason(networkPolicySignal.value.source);
};

// For the action layer: the same answer without subscribing whoever asks.
export const peekNetworkPolicyReason = () => {
  return untracked(() => readReason(networkPolicySignal.peek().source));
};

export const isRerunHeldByNetworkPolicy = (action) => {
  return action.meta.verb === "GET" && peekNetworkPolicyReason() !== null;
};

export const isWriteAction = (action) => {
  return WRITE_VERB_SET.has(action.meta.verb);
};

export const getNetworkPolicyReadOnlyMessage = () => {
  const { readOnlyMessage } = networkPolicySignal.peek();
  if (typeof readOnlyMessage === "function") {
    return readOnlyMessage(peekNetworkPolicyReason());
  }
  if (readOnlyMessage) {
    return readOnlyMessage;
  }
  return naviI18n("constraint.readonly.network_policy");
};

/**
 * The error of a request that never left: the policy said not to.
 * `reason` is the policy's value at that moment.
 */
export class OfflineError extends Error {
  constructor(reason, message = naviI18n("network_policy.offline")) {
    super(message);
    this.name = "OfflineError";
    this.reason = reason;
    // A flag beside the class: the error crosses layers that may copy it, and
    // instanceof does not survive a copy.
    this.offline = true;
  }
}

export const isOfflineError = (error) => {
  return Boolean(error && error.offline);
};

/**
 * An offline error is not one, and nobody is to be told about it as if it were.
 *
 * It says "run with what you have, ask nothing" — a state the app itself
 * declared, about a request that never left. There is no bug to point at, no
 * stack worth reading, and a screen is already saying it in words the person
 * understands.
 *
 * navi's own report leaves it alone (action_error_report.js). What is left is
 * the screen displaying it: it does so by throwing the error to a boundary, and
 * `preact/debug` re-emits on `window` every error a boundary caught — on
 * purpose, for React devtools compatibility. Uncancelled, that lands as an
 * uncaught error in the console, over a page calmly explaining there is no
 * network. Cancelling the event is what says it is handled: the browser drops
 * the console line, and the jsenv supervisor skips prevented events too.
 *
 * Both shapes a failure travels in are covered, since which one it is depends
 * on whether the resource callback happened to be async — the throw reaching
 * `window`, and the rejection nobody caught.
 *
 * Scoped to the policy's own error and to nothing else — every other error a
 * boundary caught, and every other rejection let go, stays exactly as loud as
 * it is.
 */
let offlineErrorSilenced = false;
const silenceOfflineErrors = () => {
  if (offlineErrorSilenced || typeof window === "undefined") {
    return;
  }
  offlineErrorSilenced = true;
  window.addEventListener("error", (errorEvent) => {
    if (isOfflineError(errorEvent.error)) {
      errorEvent.preventDefault();
    }
  });
  window.addEventListener("unhandledrejection", (rejectionEvent) => {
    if (isOfflineError(rejectionEvent.reason)) {
      rejectionEvent.preventDefault();
    }
  });
};

const readReason = (source) => {
  if (!source) {
    return null;
  }
  let reason;
  if (isSignal(source)) {
    reason = source.value;
  } else if (typeof source === "function") {
    reason = source();
  } else {
    reason = source;
  }
  return reason || null;
};
