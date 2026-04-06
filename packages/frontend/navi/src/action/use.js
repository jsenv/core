import { COMPLETED, FAILED } from "./action_run_states.js";
import { useForceRender } from "./use_force_render.js";

const promiseStateWeakMap = new WeakMap();
const actionPendingPromiseWeakMap = new WeakMap();

export const use = (promiseOrAction) => {
  const isAction = Boolean(promiseOrAction && promiseOrAction.dataSignal);
  if (isAction) {
    return useAction(promiseOrAction);
  }
  return usePromise(promiseOrAction);
};

const useAction = (action) => {
  const forceRender = useForceRender();
  const runningState = action.runningStateSignal.value;
  if (runningState === COMPLETED) {
    return action.dataSignal.value;
  }
  if (runningState === FAILED) {
    throw action.errorSignal.value;
  }
  // IDLE or RUNNING — suspend
  let pendingPromise = actionPendingPromiseWeakMap.get(action);
  if (!pendingPromise) {
    let resolve;
    pendingPromise = new Promise((res) => {
      resolve = res;
    });
    actionPendingPromiseWeakMap.set(action, pendingPromise);
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === COMPLETED || state === FAILED) {
        actionPendingPromiseWeakMap.delete(action);
        unsubscribe();
        resolve();
        forceRender();
      }
    });
  }
  throw pendingPromise;
};

const usePromise = (promise) => {
  const forceRender = useForceRender();

  let promiseState = promiseStateWeakMap.get(promise);
  if (!promiseState) {
    promiseState = {
      data: null,
      error: null,
      settled: false,
    };
    promiseStateWeakMap.set(promise, promiseState);
    promise.then(
      (data) => {
        promiseState.data = data;
        promiseState.settled = true;
        forceRender();
      },
      (error) => {
        promiseState.error = error;
        promiseState.settled = true;
      },
    );
    throw promise;
  }
  if (!promiseState.settled) {
    throw promise;
  }
  if (promiseState.error) {
    throw promiseState.error;
  }
  return promiseState.data;
};
