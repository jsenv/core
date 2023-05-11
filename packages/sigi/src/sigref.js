import { signal, effect } from "@preact/signals";

export const sigref = (initialValue) => {
  const valueSignal = signal(initialValue);

  const ref = {
    value: initialValue,
    subscribe: (callback) => {
      return effect(() => {
        callback(valueSignal.value);
      });
    },
  };

  const set = (newValue) => {
    ref.value = newValue;
    valueSignal.value = newValue;
  };

  return [ref, set];
};
