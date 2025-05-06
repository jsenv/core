import { signal, effect, batch } from "@preact/signals";
import { IDLE, EXECUTING, DONE, FAILED, ABORTED } from "./action_status.js";
import { routingWhile } from "../document_routing.js";

let debug = true;

const actionSet = new Set();
const actionWithParamsSetMap = new Map();
export const registerAction = (fn) => {
  const action = {
    fn,
    match: ({ formAction }) => formAction.action === action,
    toString: () => fn.name,
    withParams: (params) => {
      let actionWithParamsSet = actionWithParamsSetMap.get(action);
      if (!actionWithParamsSet) {
        actionWithParamsSet = new Set();
        actionWithParamsSetMap.set(action, actionWithParamsSet);
        const actionWithParams = createActionWithParams(action, params);
        actionWithParamsSet.add(actionWithParams);
        return actionWithParams;
      }
      for (const actionWithParamsCandidate of actionWithParamsSet) {
        if (compareTwoJsValues(actionWithParamsCandidate.params, params)) {
          return actionWithParamsCandidate;
        }
      }
      const actionWithParams = createActionWithParams(action, params);
      actionWithParamsSet.add(actionWithParams);
      return actionWithParams;
    },
  };
  actionSet.add(action);
  return action;
};
const createActionWithParams = (action, params) => {
  let disposeDataSignalEffect;
  let disposeErrorSignalEffect;
  const actionWithParams = {
    params,
    action,
    fn: (navParams) => {
      return action.fn({
        ...navParams,
        ...params,
      });
    },
    executionStateSignal: signal(IDLE),
    errorSignal: signal(null),
    dataSignal: signal(null),
    error: null,
    data: undefined,
    subscribeCount: 0,
    subscribe: () => {
      actionWithParams.subscribeCount++;
    },
    unsubscribe: () => {
      actionWithParams.subscribeCount--;
      if (actionWithParams.subscribeCount === 0) {
        if (disposeDataSignalEffect) {
          disposeDataSignalEffect();
          disposeDataSignalEffect = null;
        }
        if (disposeErrorSignalEffect) {
          disposeErrorSignalEffect();
          disposeErrorSignalEffect = null;
        }
      }
    },
    toString: () => {
      const name = action.fn.name || "anonymous";
      const paramsString = JSON.stringify(actionWithParams.params);
      return `${name}(${paramsString})`;
    },
  };
  disposeDataSignalEffect = effect(() => {
    actionWithParams.data = actionWithParams.dataSignal.value;
  });
  disposeErrorSignalEffect = effect(() => {
    actionWithParams.error = actionWithParams.errorSignal.value;
  });
  return actionWithParams;
};
const compareTwoJsValues = (a, b, seenSet = new Set()) => {
  if (a === b) {
    return true;
  }
  const aIsIsTruthy = Boolean(a);
  const bIsTruthy = Boolean(b);
  if (aIsIsTruthy && !bIsTruthy) {
    return false;
  }
  if (!aIsIsTruthy && !bIsTruthy) {
    // null, undefined, 0, false, NaN
    if (isNaN(a) && isNaN(b)) {
      return true;
    }
    return a === b;
  }
  const aType = typeof a;
  const bType = typeof b;
  if (aType !== bType) {
    return false;
  }
  const aIsPrimitive = aType !== "object" && aType !== "function";
  const bIsPrimitive = bType !== "object" && bType !== "function";
  if (aIsPrimitive !== bIsPrimitive) {
    return false;
  }
  if (aIsPrimitive && bIsPrimitive) {
    return a === b;
  }
  if (seenSet.has(a)) {
    return false;
  }
  if (seenSet.has(b)) {
    return false;
  }
  seenSet.add(a);
  seenSet.add(b);
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) {
    return false;
  }
  if (aIsArray) {
    // compare arrays
    if (a.length !== b.length) {
      return false;
    }
    let i = 0;
    while (i < a.length) {
      const aValue = a[i];
      const bValue = b[i];
      if (!compareTwoJsValues(aValue, bValue, seenSet)) {
        return false;
      }
      i++;
    }
    return true;
  }
  // compare objects
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    const aValue = a[key];
    const bValue = b[key];
    if (!compareTwoJsValues(aValue, bValue, seenSet)) {
      return false;
    }
  }
  return true;
};

export const applyAction = async (action, { signal }) => {
  await routingWhile(async () => {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;
    const abort = (reason) => {
      if (debug) {
        console.log(`abort action "${action}"`);
      }
      abortController.abort(reason);
      action.executionStateSignal.value = ABORTED;
    };
    signal.addEventListener("abort", () => {
      abort(signal.reason);
    });

    try {
      if (debug) {
        console.log(`executing action ${action}`);
      }
      batch(() => {
        action.executionStateSignal.value = EXECUTING;
        action.errorSignal.value = null;
      });
      const data = await action.fn({ signal });
      if (abortSignal.aborted) {
        return;
      }
      if (debug) {
        console.log(`${action} execution done`);
      }
      batch(() => {
        action.executionStateSignal.value = DONE;
        action.dataSignal.value = data;
      });
    } catch (e) {
      if (abortSignal.aborted && e === abortSignal.reason) {
        action.executionStateSignal.value = ABORTED;
      } else {
        batch(() => {
          action.executionStateSignal.value = FAILED;
          action.errorSignal.value = e;
        });
      }
    }
  });
};
