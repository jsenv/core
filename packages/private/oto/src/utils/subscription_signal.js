import { signal } from "@preact/signals";

export const subscriptionSignal = (get, subscribe) => {
  const valueSignal = signal(get());
  subscribe(() => {
    valueSignal.value = get();
  });
  return valueSignal;
};
