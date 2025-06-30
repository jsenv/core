import { useRef } from "preact/hooks";
import { createAction } from "../actions.js";

export const useAction = (action) => {
  const actionRef = useRef();
  const actionCallbackRef = useRef();

  if (typeof action === "function") {
    let actionInstance = actionRef.current;
    if (!actionInstance) {
      actionInstance = createAction((...args) => {
        return actionCallbackRef.current(...args);
      });
      actionRef.current = actionInstance;
    }
    actionCallbackRef.current = action;
    return actionInstance;
  }
  if (!action) {
    return null;
  }
  return action;
};
