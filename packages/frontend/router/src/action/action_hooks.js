import { useEffect } from "preact/hooks";
import { bindParamsToAction } from "./action.js";
import { ABORTED, EXECUTING } from "./action_status.js";

export const useAction = (action, params) => {
  if (params) {
    action = bindParamsToAction(action, params);
  }

  useEffect(() => {
    action.subscribe();
    return () => {
      action.unsubscribe();
    };
  }, []);

  return action;
};

export const useActionStatus = (action) => {
  // je peux pas faire ça:
  // puisque la route est partagé par les actions
  // il faut bel et bien que je mette cet action quelque part
  const pending = action.executionStateSignal.value === EXECUTING;
  const error = action.errorSignal.value;
  const aborted = action.executionStateSignal.value === ABORTED;
  return { aborted, pending, error };
};
