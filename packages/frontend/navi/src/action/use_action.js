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
  // The cache gives an inline function a stable action identity across renders.
  // That identity is only wanted while `action` stays the same kind
  // (function to function); when the kind changes — none ↔ function ↔ action
  // object — each branch clears the other kind's refs so the control picks up
  // its new role instead of the action it was born with.
  const noopActionRef = useRef();
  const actionFromFunctionRef = useRef();
  const actionCallbackRef = useRef();

  if (!action) {
    actionFromFunctionRef.current = undefined;
    actionCallbackRef.current = undefined;
    const existingNoopAction = noopActionRef.current;
    if (existingNoopAction) {
      return existingNoopAction;
    }
    const noopAction = createAction(() => {}, { params: undefined });
    const noopActionBound = actionParamsSignal
      ? noopAction.bindParams(actionParamsSignal)
      : noopAction;
    noopActionRef.current = noopActionBound;
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
    const existingAction = actionFromFunctionRef.current;
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
      actionFromFunctionRef.current = actionFromFunction;
      return actionFromFunction;
    }
    const actionBoundToParams =
      actionFromFunction.bindParams(actionParamsSignal);
    actionFromFunctionRef.current = actionBoundToParams;
    return actionBoundToParams;
  }
  actionFromFunctionRef.current = undefined;
  actionCallbackRef.current = undefined;
  if (actionParamsSignal) {
    return action.bindParams(actionParamsSignal);
  }
  return action;
};

const isFunctionButNotAnActionFunction = (action) => {
  return typeof action === "function" && !action.isAction;
};
