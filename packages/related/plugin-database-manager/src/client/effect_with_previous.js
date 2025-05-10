import { signal, effect } from "@preact/signals";

const cacheSet = new Set();
export const effectWithPrevious = (inputSignals, callback) => {
  for (const cacheCandidate of cacheSet) {
    const same = cacheCandidate.inputSignals.every(
      (sig, i) => sig === inputSignals[i],
    );
    if (same) {
      cacheCandidate.callbackSet.add(callback);
      return cacheCandidate.disposeOne;
    }
  }
  const previousSignals = [];
  for (const inputSignal of inputSignals) {
    previousSignals.push(signal(inputSignal.value));
  }
  const callbackSet = new Set();
  callbackSet.add(callback);
  let disposeEffect = effect(() => {
    const previousValues = [];
    const values = [];
    let i = 0;
    while (i < inputSignals.length) {
      const inputSignal = inputSignals[i];
      const previousSignal = previousSignals[i];
      const previousValue = previousSignal.value;
      const value = inputSignal.value;
      previousValues.push(previousValue);
      values.push(value);
      if (previousValue !== value) {
        previousSignal.value = structuredClone(value);
      }
      i++;
    }
    for (const callback of callbackSet) {
      callback(previousValues, values);
    }
  });
  const disposeOne = () => {
    callbackSet.delete(callback);
    if (callbackSet.size === 0) {
      if (disposeEffect) {
        disposeEffect();
        disposeEffect = null;
      }
      previousSignals.length = 0;
      cacheSet.remove(cacheEntry);
    }
  };
  const cacheEntry = {
    inputSignals,
    callbackSet,
    disposeOne,
  };
  cacheSet.add(cacheEntry);

  return disposeOne;
};
