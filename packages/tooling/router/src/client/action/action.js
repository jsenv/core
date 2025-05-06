import { signal, effect } from "@preact/signals";
import { IDLE, EXECUTING, DONE, FAILED } from "./action_status.js";
import { routingWhile } from "../document_routing.js";

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
        actionWithParamsSetMap.add(action, actionWithParamsSet);
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
  let removeDataSignalEffect;
  let removeErrorSignalEffect;
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
        removeDataSignalEffect();
        removeDataSignalEffect = null;
        removeErrorSignalEffect();
        removeErrorSignalEffect = null;
      }
    },
  };
  removeDataSignalEffect = effect(() => {
    action.data = action.dataSignal.value;
  });
  removeErrorSignalEffect = effect(() => {
    action.error = action.errorSignal.value;
  });
  return actionWithParams;
};

const compareTwoJsValues = (a, b) => {
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
      if (!compareTwoJsValues(aValue, bValue)) {
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
    if (!compareTwoJsValues(aValue, bValue)) {
      return false;
    }
  }
  return true;
};

export const applyAction = async (action, { signal }) => {
  await routingWhile(async () => {
    try {
      action.executionStateSignal.value = EXECUTING;
      const data = await action.fn({ signal });
      action.executionStateSignal.value = DONE;
      action.dataSignal.value = data;
    } catch (e) {
      action.executionStateSignal.value = FAILED;
      action.errorSignal.value = e;
    }
  });
};
