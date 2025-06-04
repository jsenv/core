import { useEffect } from "preact/hooks";
import { registerAction } from "./action.js";
import { ABORTED, EXECUTING } from "./action_status.js";

export const useActionStatus = (action) => {
  if (typeof action === "function") {
    action = registerAction(action);
  }

  useEffect(() => {
    action.subscribe();
    return () => {
      action.unsubscribe();
    };
  }, []);

  // je peux pas faire ça:
  // puisque la route est partagé par les actions
  // il faut bel et bien que je mette cet action quelque part
  const pending = action.executionStateSignal.value === EXECUTING;
  const error = action.errorSignal.value;
  const aborted = action.executionStateSignal.value === ABORTED;
  return { aborted, pending, error };
};
