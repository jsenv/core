import { useState } from "preact/hooks";

const promiseStateWeakMap = new WeakMap();
export const usePromiseAsyncData = (
  promise,
  { loadingEffect, errorEffect },
) => {
  const forceRender = useForceRender();

  let promiseState = promiseStateWeakMap.get(promise);
  if (!promiseState) {
    promiseState = {
      data: undefined,
      error: undefined,
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
        forceRender();
      },
    );
  }
  if (!promiseState.settled) {
    if (loadingEffect === "use") {
      return [promiseState.data, true, undefined];
    }
    throw promise;
  }
  if (promiseState.error) {
    if (errorEffect === "use") {
      return [promiseState.data, false, promiseState.error];
    }
    throw promiseState.error;
  }
  return [promiseState.data, false, undefined];
};

const useForceRender = () => {
  const [, setState] = useState(null);
  return () => {
    setState({});
  };
};
