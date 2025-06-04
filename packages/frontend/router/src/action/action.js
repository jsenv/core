import { batch, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../compare_two_js_values.js";
import { routingWhile } from "../document_routing.js";
import { ABORTED, DONE, EXECUTING, FAILED, IDLE } from "./action_status.js";

let debug = false;

const actionWeakMap = new WeakMap();
export const registerAction = (fn, name = fn.name || "anonymous") => {
  const existingAction = actionWeakMap.get(fn);
  if (existingAction) {
    return existingAction;
  }
  const action = createAction(fn, name);
  action.bindParams = (params) => bindParamsToAction(action, params);
  actionWeakMap.set(fn, action);
  return action;
};
const createAction = (fn, name = fn.name || "anonymous") => {
  let disposeErrorSignalEffect;
  let disposeDataSignalEffect;

  const executionStateSignal = signal(IDLE);
  let error;
  const errorSignal = signal(null);
  let data;
  const dataSignal = signal(null);

  let subscribeCount = 0;
  const subscribe = () => {
    subscribeCount++;
    action.subscribeCount = subscribeCount;
    if (subscribeCount === 1) {
      disposeDataSignalEffect = effect(() => {
        data = dataSignal.value;
        action.data = data;
      });
      disposeErrorSignalEffect = effect(() => {
        error = errorSignal.value;
        action.error = error;
      });
    }
  };
  const unsubscribe = () => {
    subscribeCount--;
    action.subscribeCount = subscribeCount;
    if (subscribeCount === 0) {
      if (disposeDataSignalEffect) {
        disposeDataSignalEffect();
        disposeDataSignalEffect = null;
      }
      if (disposeErrorSignalEffect) {
        disposeErrorSignalEffect();
        disposeErrorSignalEffect = null;
      }
    }
  };

  const action = {
    isAction: true,
    fn,
    name,
    executionStateSignal,
    errorSignal,
    dataSignal,
    error,
    data,
    subscribeCount,
    subscribe,
    unsubscribe,
    toString: () => `<Action> ${name}()`,
  };
  return action;
};
// Use a Map to store bound actions with their parameters
const boundActionWeakMap = new WeakMap();

export const bindParamsToAction = (fnOrAction, params) => {
  let fn;
  let name;
  if (typeof fnOrAction === "function") {
    fn = fnOrAction;
    name = fn.name || "anonymous";
  } else if (fnOrAction.isAction) {
    fn = fnOrAction.fn;
    name = fnOrAction.name;
  } else {
    throw new Error(
      `bindParamsToAction expects an action or a function, got ${typeof fnOrAction}`,
    );
  }

  // Get or create the array for this function
  let boundActions = boundActionWeakMap.get(fn);
  if (!boundActions) {
    // Use an array of weak references instead of WeakSet
    boundActions = [];
    boundActionWeakMap.set(fn, boundActions);
  }

  // Clean up any garbage collected references first
  const liveActions = boundActions.filter((ref) => ref.deref() !== undefined);
  boundActions.length = 0;
  boundActions.push(...liveActions);

  // Check if we already have a matching bound action
  for (const actionRef of boundActions) {
    const boundActionCandidate = actionRef.deref();
    if (
      boundActionCandidate &&
      compareTwoJsValues(boundActionCandidate.params, params)
    ) {
      return boundActionCandidate;
    }
  }

  // Create a new bound action
  const boundAction = createAction((navParams) =>
    fn({ ...navParams, ...params }),
  );

  boundAction.params = params;
  boundAction.toString = () =>
    `<BoundAction> ${name}(${JSON.stringify(params)})`;

  // Store weak reference to allow garbage collection
  boundActions.push(new WeakRef(boundAction));

  return boundAction;
};

export const applyAction = async (action, { signal, formData }) => {
  const result = await routingWhile(async () => {
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
        return { aborted: true, error: null };
      }
      if (debug) {
        console.log(`${action} execution done`);
      }
      batch(() => {
        action.executionStateSignal.value = DONE;
        action.dataSignal.value = data;
      });
      return { aborted: false, error: null };
    } catch (e) {
      if (abortSignal.aborted && e === abortSignal.reason) {
        action.executionStateSignal.value = ABORTED;
        return { aborted: true, error: null };
      }
      batch(() => {
        action.executionStateSignal.value = FAILED;
        action.errorSignal.value = e;
      });
      return { aborted: false, error: e };
    }
  });
  return result;
};
