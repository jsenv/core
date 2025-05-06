import { signal, effect } from "@preact/signals";
import { IDLE, EXECUTING, DONE, FAILED } from "./action_status.js";
import { routingWhile } from "../document_routing.js";

const actionSet = new Set();

export const registerAction = (fn) => {
  const action = {
    fn,
    executionStateSignal: signal(IDLE),
    errorSignal: signal(null),
    dataSignal: signal(null),
    error: null,
    data: undefined,
    match: ({ formAction }) => formAction.action === action,
    toString: () => fn.name,
  };
  effect(() => {
    action.data = action.dataSignal.value;
  });
  effect(() => {
    action.error = action.errorSignal.value;
  });
  actionSet.add(action);
  return action;
};

export const applyAction = async (action, { signal }) => {
  await routingWhile(async () => {
    try {
      action.executionStateSignal.value = EXECUTING;
      const data = await action.fn({ signal });
      action.executionStateSignal.value = DONE;
      action.dataSignal.value = data;
    } catch (e) {
      action.executionStateSignal.value = FAILED;
      action.errorSignal.value = e;
    }
  });
};
