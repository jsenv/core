import { batch, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../compare_two_js_values.js";
import { routingWhile } from "../document_routing.js";
import { ABORTED, DONE, EXECUTING, FAILED, IDLE } from "./action_status.js";

let debug = false;

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

export const applyAction = async (action, { signal, formData }) => {
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
      const data = await action.fn({ signal, formData });
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
