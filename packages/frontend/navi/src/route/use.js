import { useForceRender } from "./use_force_render.js";

const promiseStateWeakMap = new WeakMap();
export const use = (promise) => {
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
