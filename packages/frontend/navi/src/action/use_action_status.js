import { ABORTED, COMPLETED, IDLE, RUNNING } from "./action_run_states.js";

/**
 * The state of an action as plain values, read from its signals so the render
 * calling it follows them. It never suspends and never starts a run — for a
 * component drawing the state of a run someone else starts (a button's own, a
 * route's); `useAsyncData` is the one for the data a component asks for.
 * Without an action, everything reads idle.
 *
 * @param {object} [action]
 * @returns {{ params: any, runningState: object, isPrerun: boolean, idle: boolean, loading: boolean, aborted: boolean, error: any, completed: boolean, data: any }}
 */
export const useActionStatus = (action) => {
  if (!action) {
    return {
      params: undefined,
      runningState: IDLE,
      isPrerun: false,
      idle: true,
      loading: false,
      aborted: false,
      error: undefined,
      completed: false,
      data: undefined,
    };
  }
  const {
    paramsSignal,
    runningStateSignal,
    isPrerunSignal,
    errorSignal,
    dataSignal,
  } = action;
  const params = paramsSignal.value;
  const isPrerun = isPrerunSignal.value;
  const runningState = runningStateSignal.value;
  const idle = runningState === IDLE;
  const aborted = runningState === ABORTED;
  const error = errorSignal.value;
  const loading = runningState === RUNNING;
  const completed = runningState === COMPLETED;
  const data = dataSignal.value;

  return {
    params,
    runningState,
    isPrerun,
    idle,
    loading,
    aborted,
    error,
    completed,
    data,
  };
};
