import { useCallback, useRef } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";
import { isSignal } from "../utils/is_signal.js";
import { createAction } from "./actions.js";

// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the form params are updated when the form element single param is updated
export const useActionBoundToOneParam = (action, paramsSignal) => {
  if (!isSignal(paramsSignal)) {
    throw new Error(
      `useActionBoundToOneParam expects a signal as second argument, got: ${paramsSignal}`,
    );
  }
  const boundAction = useBoundAction(action, paramsSignal);
  const getValue = useCallback(() => paramsSignal.value, []);
  const setValue = useCallback((value) => {
    paramsSignal.value = value;
  }, []);
  return [boundAction, getValue(), setValue];
};
export const useActionBoundToOneArrayParam = (action, paramsSignal) => {
  const [boundAction, value, setValue] = useActionBoundToOneParam(
    action,
    paramsSignal,
  );

  const add = (valueToAdd, valueArray = value) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };

  const remove = (valueToRemove, valueArray = value) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };

  const result = [boundAction, value, setValue];
  result.add = add;
  result.remove = remove;
  return result;
};
// used by <details> to just call their action
export const useAction = (action, paramsSignal) => {
  return useBoundAction(action, paramsSignal);
};

const useBoundAction = (action, actionParamsSignal) => {
  const actionRef = useRef();
  const actionCallbackRef = useRef();

  if (!action) {
    const existingAction = actionRef.current;
    if (existingAction) {
      return existingAction;
    }
    const noopAction = createAction(() => {}, { params: undefined });
    const noopActionBound = actionParamsSignal
      ? noopAction.bindParams(actionParamsSignal)
      : noopAction;
    actionRef.current = noopActionBound;
    return noopActionBound;
  }
  const isFunction = typeof action === "function";
  if (!isFunction) {
    throw new TypeError(
      `useBoundAction expects an action function or an action object, got: ${action}`,
    );
  }
  if (isFunctionButNotAnActionFunction(action)) {
    actionCallbackRef.current = action;
    const existingAction = actionRef.current;
    if (existingAction) {
      return existingAction;
    }
    const actionFromFunction = createAction(
      (...args) => {
        return actionCallbackRef.current?.(...args);
      },
      {
        name: action.name,
        // We don't want to give empty params by default
        // we want to give undefined for regular functions
        params: undefined,
      },
    );
    if (!actionParamsSignal) {
      actionRef.current = actionFromFunction;
      return actionFromFunction;
    }
    const actionBoundToParams =
      actionFromFunction.bindParams(actionParamsSignal);
    actionRef.current = actionBoundToParams;
    return actionBoundToParams;
  }
  if (actionParamsSignal) {
    return action.bindParams(actionParamsSignal);
  }
  return action;
};

const isFunctionButNotAnActionFunction = (action) => {
  return typeof action === "function" && !action.isAction;
};
