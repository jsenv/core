import { ABORTED, COMPLETED, IDLE, RUNNING } from "./action_run_states.js";

const actionPrivatePropertiesWeakMap = new WeakMap();
export const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};
export const setActionPrivateProperties = (action, properties) => {
  actionPrivatePropertiesWeakMap.set(action, properties);
};

export const getActionStatus = (action) => {
  const { runningStateSignal, errorSignal, computedDataSignal } =
    getActionPrivateProperties(action);
  const runningState = runningStateSignal.value;
  const idle = runningState === IDLE;
  const aborted = runningState === ABORTED;
  const error = errorSignal.value;
  const loading = runningState === RUNNING;
  const completed = runningState === COMPLETED;
  const data = computedDataSignal.value;

  return { idle, loading, aborted, error, completed, data };
};
