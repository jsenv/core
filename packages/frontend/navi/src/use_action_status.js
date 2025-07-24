import { getActionPrivateProperties } from "./action_private_properties.js";
import { ABORTED, COMPLETED, IDLE, RUNNING } from "./action_run_states.js";

export const useActionStatus = (action) => {
  if (!action) {
    return {
      params: undefined,
      runningState: IDLE,
      isPrerun: false,
      idle: true,
      prerunning: false,
      running: false,
      aborted: false,
      error: null,
      precompleted: false,
      completed: false,
      data: undefined,
    };
  }
  const {
    paramsSignal,
    runningStateSignal,
    isPrerunSignal,
    errorSignal,
    computedDataSignal,
  } = getActionPrivateProperties(action);

  const params = paramsSignal.value;
  const isPrerun = isPrerunSignal.value;
  const runningState = runningStateSignal.value;
  const idle = runningState === IDLE;
  const aborted = runningState === ABORTED;
  const error = errorSignal.value;
  const running = runningState === RUNNING && !isPrerun;
  const prerunning = runningState === RUNNING && isPrerun;
  const completed = runningState === COMPLETED && !isPrerun;
  const precompleted = runningState === COMPLETED && isPrerun;
  const data = computedDataSignal.value;

  return {
    params,
    runningState,
    isPrerun,
    idle,
    prerunning,
    running,
    aborted,
    error,
    precompleted,
    completed,
    data,
  };
};
