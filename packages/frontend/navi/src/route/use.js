import { useState } from "preact/hooks";

const promiseStateWeakMap = new WeakMap();
export const use = (promise) => {
  const [, setState] = useState(null);

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
        setState(NaN);
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
