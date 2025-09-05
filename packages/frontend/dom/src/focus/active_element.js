import { effect, signal } from "@preact/signals";

export const activeElementSignal = signal(document.activeElement);

document.addEventListener(
  "focus",
  () => {
    activeElementSignal.value = document.activeElement;
  },
  { capture: true },
);

export const useActiveElement = () => {
  return activeElementSignal.value;
};
export const addActiveElementEffect = (callback) => {
  const remove = effect(() => {
    const activeElement = activeElementSignal.value;
    callback(activeElement);
  });
  return remove;
};
