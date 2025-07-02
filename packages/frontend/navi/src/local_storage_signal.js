import { effect, signal } from "@preact/signals";

export const localStorageSignal = (key) => {
  const initialValue = localStorage.getItem(key);

  const valueSignal = signal(initialValue === null ? undefined : initialValue);
  effect(() => {
    const value = valueSignal.value;
    if (value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  });

  return valueSignal;
};
