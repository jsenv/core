import { signal, useSignal } from "@preact/signals";

let debug = false;

const sharedSignalCache = new WeakMap();
export const useActionParamsSignal = (action, initialParams) => {
  if (!action) {
    return useSignal(initialParams);
  }

  const existingSignal = sharedSignalCache.get(action);
  if (existingSignal) {
    return existingSignal;
  }

  const paramsSignal = signal(initialParams);
  sharedSignalCache.set(action, paramsSignal);
  if (debug) {
    console.debug(
      `Created params signal for ${action} with params:`,
      initialParams,
    );
  }
  return paramsSignal;
};

export const useActionSingleParamSignal = (action, initialValue, name) => {
  if (!name) {
    throw new Error("name is required for useActionSingleParamSignal");
  }
  const paramsSignal = useActionParamsSignal(action, {
    [name]: initialValue,
  });
  return [
    paramsSignal,
    () => paramsSignal.value[name],
    (value) => {
      paramsSignal.value = { [name]: value };
    },
  ];
};
