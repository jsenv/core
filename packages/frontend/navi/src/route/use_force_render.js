import { signal } from "@preact/signals";

const renderSignal = signal(null);

const forceRender = () => {
  // later try with NaN
  renderSignal.value = {}; // force re-render
};

export const useForceRender = () => {
  // eslint-disable-next-line no-unused-expressions
  renderSignal.value;
  return forceRender;
};
