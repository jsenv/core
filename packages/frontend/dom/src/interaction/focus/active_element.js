import { effect, signal } from "@preact/signals";

export const activeElementSignal = signal(
  typeof document === "object" ? document.activeElement : undefined,
);
if (typeof document === "object") {
  document.addEventListener(
    "focus",
    () => {
      activeElementSignal.value = document.activeElement;
    },
    { capture: true },
  );
  // When clicking on document there is no "focus" event dispatched on the document
  // We can detect that with "blur" event when relatedTarget is null
  document.addEventListener(
    "blur",
    (e) => {
      if (!e.relatedTarget) {
        activeElementSignal.value = document.activeElement;
      }
    },
    { capture: true },
  );
}

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
