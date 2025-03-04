import { performance } from "node:perf_hooks";

export const timeStart = () => {
  // as specified in https://w3c.github.io/server-timing/#the-performanceservertiming-interface
  // duration is a https://www.w3.org/TR/hr-time-2/#sec-domhighrestimestamp
  const startTimestamp = performance.now();
  const timeEnd = () => {
    const endTimestamp = performance.now();
    const duration = endTimestamp - startTimestamp;
    return duration;
  };
  return timeEnd;
};

export const timeFunction = (fn) => {
  const timeEnd = timeStart();
  const returnValue = fn();
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((value) => {
      return [timeEnd(), value];
    });
  }
  return [timeEnd(), returnValue];
};
