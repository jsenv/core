import { signal, untracked } from "@preact/signals";

import { naviI18n } from "../text/navi_i18n.js";
import { isSignal } from "../utils/is_signal.js";

/*
 * The network policy: one declaration saying whether a request may go out,
 * read by the action layer rather than by every callback.
 *
 * Under a policy (a truthy reason):
 * - a control bound to a write — or inside a form bound to one — is read-only
 *   and says why (control_hooks.jsx, readonly_constraint.js), and a write that
 *   runs anyway settles with a NetworkPolicyError carrying the reason;
 * - reads are answered from the store, or still go out — `reads`. Answered
 *   from the store, a resource GET completes with the row its store holds for
 *   it, named by its params or the one it last completed with
 *   (resource_graph.js, applyNetworkPolicy); a completed read asked to rerun
 *   stays completed (actions.js, handleActionRequest); a read with nothing to
 *   answer with settles with a NetworkPolicyError.
 *
 * Holding writes is what every policy does; where reads are answered from is
 * what tells two policies apart. No network holds both ends. "Viewing the app
 * as someone else" — an admin reading every screen as another account — holds
 * only the writes: every read must go out, that is the entire mode.
 *
 * One policy at a time, and `reads` may be read from the reason rather than
 * fixed, because an app that has two of these at once (no network AND viewing
 * as someone) composes them into one reason itself. Stacking policies would
 * hand navi a decision it has nothing to decide it with: when two of them hold
 * the same write, which one says why. The app knows; navi would guess from
 * declaration order.
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
  reads: "store",
});

/**
 * Declares whether requests may go out.
 *
 * @param {import("@preact/signals").Signal | Function | any} source - where the
 *   reason is read from: a signal (followed live), a function (called on each
 *   read), or a plain value. A falsy reason means "go to the network"; any
 *   truthy value means "hold the writes", and is handed to the
 *   `NetworkPolicyError` an action settles with (`error.reason`) so a screen can
 *   say which kind of policy is holding.
 * @param {Object} [options]
 * @param {"store" | "network" | ((reason: any) => "store" | "network")} [options.reads="store"]
 *   where a read is answered from while the policy holds. `"store"` is no
 *   network: a resource GET answers with the row the store holds and a completed
 *   read asked to rerun stays completed. `"network"` holds the writes only and
 *   lets every read go out — for a mode whose whole point is fresh answers.
 *   A function is called with the reason, for an app whose single reason covers
 *   both kinds.
 * @param {string | ((reason: any) => string)} [options.readOnlyMessage] - what a
 *   control held back by the policy answers when pressed; defaults to navi's
 *   `constraint.readonly.network_policy` text.
 * @see docs/network_policy.md
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
export const setNetworkPolicy = (
  source,
  { reads = "store", readOnlyMessage } = {},
) => {
  silenceNetworkPolicyErrors();
  networkPolicySignal.value = { source, reads, readOnlyMessage };
};

/**
 * The policy's reason, `null` when requests may go out. Read in a component
 * render, it follows the policy as it changes.
 */
export const useNetworkPolicyReason = () => {
  return readReason(networkPolicySignal.value.source);
};

/**
 * For the action layer: what the policy holds right now, without subscribing
 * whoever asks. `null` when requests may go out.
 *
 * @returns {{ reason: any, readsFromStore: boolean } | null}
 */
export const peekNetworkPolicy = () => {
  const { reads } = networkPolicySignal.peek();
  const reason = peekReason();
  if (reason === null) {
    return null;
  }
  return {
    reason,
    readsFromStore: readReads(reads, reason) === "store",
  };
};

export const isRerunHeldByNetworkPolicy = (action) => {
  if (action.meta.verb !== "GET") {
    return false;
  }
  const policy = peekNetworkPolicy();
  // A read that still goes out has nothing to hold back: what the rerun is
  // for is the answer the network gives.
  return policy !== null && policy.readsFromStore;
};

export const isWriteAction = (action) => {
  return WRITE_VERB_SET.has(action.meta.verb);
};

export const getNetworkPolicyReadOnlyMessage = () => {
  const { readOnlyMessage } = networkPolicySignal.peek();
  if (typeof readOnlyMessage === "function") {
    return readOnlyMessage(peekReason());
  }
  if (readOnlyMessage) {
    return readOnlyMessage;
  }
  return naviI18n("constraint.readonly.network_policy");
};

/**
 * The error of a request that never left: the policy said not to.
 * `reason` is the policy's value at that moment, and the only thing that says
 * which kind of policy held it — no network, or writes held while the reads go
 * out. The class names the mechanism, never the reason.
 */
export class NetworkPolicyError extends Error {
  constructor(reason, message = naviI18n("network_policy.held")) {
    super(message);
    this.name = "NetworkPolicyError";
    this.reason = reason;
    // A flag beside the class: the error crosses layers that may copy it, and
    // instanceof does not survive a copy.
    this.networkPolicy = true;
  }
}

export const isNetworkPolicyError = (error) => {
  return Boolean(error && error.networkPolicy);
};

/**
 * The policy's own error is not a failure, and nobody is to be told about it as
 * if it were.
 *
 * It says "the app declared that this does not leave" — about a request that
 * never left. There is no bug to point at, no stack worth reading, and a screen
 * is already saying it in words the person understands.
 *
 * navi's own report leaves it alone (action_error_report.js). What is left is
 * the error reaching `window` on its own — a run called by hand whose failure
 * nobody catches, a render throw no boundary took — where it lands as an
 * uncaught error in the console, about a request the app itself declared would
 * not leave. Cancelling the event is what says it is handled: the browser drops
 * the console line, and the jsenv supervisor skips prevented events too.
 *
 * Both shapes a failure travels in are covered, since which one it is depends
 * on whether the resource callback happened to be async — the throw reaching
 * `window`, and the rejection nobody caught.
 *
 * A boundary displaying it raises no event at all. In dev, `preact/debug` hands
 * every error a boundary caught to `console.error`, after the boundary took it
 * and before it rendered anything; it reads no option and no flag, so that line
 * stays. Muting it from here is not done: wrapping `console.error` rewrites a
 * global, and wrapping `options._catchError` reaches into preact's private
 * hooks, both to hide one class of error.
 *
 * Scoped to the policy's own error and to nothing else — every other error
 * thrown at window, and every other rejection let go, stays exactly as loud as
 * it is.
 */
let networkPolicyErrorSilenced = false;
const silenceNetworkPolicyErrors = () => {
  if (networkPolicyErrorSilenced || typeof window === "undefined") {
    return;
  }
  networkPolicyErrorSilenced = true;
  window.addEventListener("error", (errorEvent) => {
    if (isNetworkPolicyError(errorEvent.error)) {
      errorEvent.preventDefault();
    }
  });
  window.addEventListener("unhandledrejection", (rejectionEvent) => {
    if (isNetworkPolicyError(rejectionEvent.reason)) {
      rejectionEvent.preventDefault();
    }
  });
};

const peekReason = () => {
  return untracked(() => readReason(networkPolicySignal.peek().source));
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

// "store" or "network", from the declaration or from the reason.
const readReads = (reads, reason) => {
  const value = typeof reads === "function" ? reads(reason) : reads;
  if (value === "network") {
    return "network";
  }
  if (import.meta.dev && value !== "store") {
    console.warn(
      `setNetworkPolicy: "reads" must be "store" or "network", received "${value}". Reads are answered from the store.`,
    );
  }
  return "store";
};
