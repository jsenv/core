import { useEffect } from "preact/hooks";
import { EXECUTING, ABORTED } from "./action_status.js";

export const useAction = (action, params = {}) => {
  const actionWithParams = action.withParams(params);

  // when no one is interested by this action anymore
  // we can delete the usage of this param and eventually the route
  useEffect(() => {
    actionWithParams.subscribe();
    return () => {
      actionWithParams.unsubscribe();
    };
  }, []);

  return actionWithParams;
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
