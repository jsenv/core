import { batch } from "@preact/signals";

let debug = true;

export const IDLE = { id: "idle" };
export const ACTIVATING = { id: "activating" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const ACTIVATED = { id: "activated" };

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const actionWeakRefSet = new Set(); // WeakRef de toutes les routes
const matchingActionSet = new Set();
const getAliveActionSet = () => {
  const aliveSet = new Set();
  for (const weakRef of actionWeakRefSet) {
    const action = weakRef.deref();
    if (action) {
      aliveSet.add(action);
    } else {
      actionWeakRefSet.delete(weakRef);
    }
  }
  return aliveSet;
};

export const updateActions = async ({
  signal,
  isReload,
  isReplace,
  reason,
}) => {
  const toDeactivateSet = new Set();
  const toActivateMap = new Map();
  const candidateSet = getAliveActionSet();
  const promises = [];
  const alreadyActivatingSet = new Set();
  const alreadyActivatedSet = new Set();

  if (debug) {
    const documentUrl = window.location.href;
    const documentState = navigation.currentEntry.getState();

    console.group(`updateActions() on ${candidateSet.size} actions`);
    console.debug(
      `situation at start:
- document url: ${documentUrl}
- document state: ${documentState}
- matching actions: ${matchingActionSet.size === 0 ? "none" : Array.from(matchingActionSet).join(", ")}
- meta: isReload: ${isReload}, isReplace ${isReplace}`,
    );
  }

  for (const actionCandidate of candidateSet) {
    const matchResult = actionCandidate.match();
    if (!matchResult) {
      continue;
    }
    const targetParams = {
      ...matchResult.named,
      ...matchResult.stars,
    };
    const enterParams = {
      signal,
      matchResult: targetParams,
    };
    const startsMatching = !matchingActionSet.has(actionCandidate);
    if (startsMatching || actionCandidate.shouldReload({ matchResult })) {
      toActivateMap.set(actionCandidate, enterParams);
    } else {
      const hasError = actionCandidate.errorSignal.peek();
      const isAborted = actionCandidate.loadingStateSignal.peek() === ABORTED;
      if (isReload) {
        toActivateMap.set(actionCandidate, enterParams);
      } else if (hasError) {
        toActivateMap.set(actionCandidate, enterParams);
      } else if (isAborted) {
        toActivateMap.set(actionCandidate, enterParams);
      } else {
        alreadyActivatedSet.add(actionCandidate);
        const actionPromise = actionPromiseMap.get(actionCandidate);
        if (actionPromise) {
          alreadyActivatingSet.add(actionCandidate);
          promises.push(actionPromise);
        } else {
          alreadyActivatedSet.add(actionCandidate);
        }
      }
    }
  }
  for (const matchingAction of matchingActionSet) {
    if (
      alreadyActivatingSet.has(matchingAction) ||
      alreadyActivatedSet.has(matchingAction) ||
      toActivateMap.has(matchingAction)
    ) {
      continue;
    }
    toDeactivateSet.add(matchingAction);
  }

  if (
    toActivateMap.size === 0 &&
    toDeactivateSet.size === 0 &&
    alreadyActivatingSet.size === 0
  ) {
    if (debug) {
      console.debug("no effect on actions, early return");
      console.groupEnd();
    }
    return;
  }

  if (debug) {
    console.debug(`situation before updating actions:
- to de-activate: ${toDeactivateSet.size === 0 ? "none" : Array.from(toDeactivateSet).join(", ")}
- to activate: ${toActivateMap.size === 0 ? "none" : Array.from(toActivateMap.keys()).join(", ")}
- already activating: ${alreadyActivatingSet.size === 0 ? "none" : Array.from(alreadyActivatingSet).join(", ")}
- already activated: ${alreadyActivatedSet.size === 0 ? "none" : Array.from(alreadyActivatedSet).join(", ")}`);
  }
  for (const actionToDeactivate of toDeactivateSet) {
    deactivate(actionToDeactivate, reason);
  }

  for (const [action, actionParams] of toActivateMap) {
    const actionPromise = activate(action, actionParams);
    actionPromiseMap.set(action, actionPromise);
    promises.push(actionPromise);
  }
  await Promise.all(promises);

  if (debug) {
    console.groupEnd();
  }
};

const activate = async (action, { signal, matchResult }) => {
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  const abort = (reason) => {
    if (debug) {
      console.log(`"${action}": abort activation.`);
    }
    action.loadingStateSignal.value = ABORTED;
    abortController.abort(reason);
    actionAbortMap.delete(action);
  };
  const onabort = () => {
    abort(signal.reason);
  };
  signal.addEventListener("abort", onabort);
  actionAbortMap.set(action, abort);
  action.enterEffect({ matchResult });
  matchingActionSet.add(action);

  try {
    await action.load({ signal: abortSignal });
    action.loadingStateSignal.value = ACTIVATED;
    if (abortSignal.aborted) {
      return;
    }
    actionAbortMap.delete(action);
    actionPromiseMap.delete(action);
  } catch (e) {
    signal.removeEventListener("abort", onabort);
    actionAbortMap.delete(action);
    actionPromiseMap.delete(action);
    if (abortSignal.aborted && e === abortSignal.reason) {
      action.loadingStateSignal.value = ABORTED;
      return;
    }
    batch(() => {
      action.reportError(e);
      action.loadingStateSignal.value = FAILED;
    });
  }
};

const deactivate = (action, reason) => {
  const abort = actionAbortMap.get(action);
  if (abort) {
    if (debug) {
      console.log(`"${action}": aborting (reason: ${reason})`);
    }
    abort(reason);
  } else if (debug) {
    console.log(`"${action}": deactivating route (reason: ${reason})`);
  }
  action.leaveEffect(reason);
  matchingActionSet.delete(action);
  actionPromiseMap.delete(action);
};
