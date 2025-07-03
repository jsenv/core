import { signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { createAction } from "../../actions.js";
import { useParentAction } from "./action_context.js";

export const useAction = (action, { name, value, preferSelf } = {}) => {
  const mountedRef = useRef(false);
  const parentBoundAction = useParentAction();
  if (parentBoundAction && !preferSelf) {
    const parentActionParamsSignal = parentBoundAction.meta.paramsSignal;
    const parentActionUpdateParams = parentBoundAction.meta.updateParams;
    const getValue = name
      ? () => parentActionParamsSignal.value[name]
      : () => parentActionParamsSignal.value;
    const setValue = name
      ? (value) => parentActionUpdateParams({ [name]: value })
      : parentActionUpdateParams;
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (name) {
        setValue(value);
      }
    }
    return [parentBoundAction, getValue, setValue];
  }

  const [paramsSignal, updateParams] = useActionParamsSignal(action, {});
  const boundAction = useBoundAction(action, paramsSignal);
  boundAction.meta.paramsSignal = paramsSignal;
  boundAction.meta.updateParams = updateParams;

  const getValue = name
    ? () => paramsSignal.value[name]
    : () => paramsSignal.value;
  const setValue = name
    ? (value) => updateParams({ [name]: value })
    : updateParams;

  return [boundAction, getValue, setValue];
};

let debug = true;
const sharedSignalCache = new WeakMap();
const useActionParamsSignal = (action, initialParams = {}) => {
  const fromCache = sharedSignalCache.get(action);
  if (fromCache) {
    return fromCache;
  }

  const paramsSignal = signal(initialParams);
  const updateParams = (object) => {
    const currentParams = paramsSignal.peek();
    const paramsCopy = { ...currentParams };
    let modified = false;
    for (const key of Object.keys(object)) {
      const value = object[key];
      const currentValue = currentParams[key];
      if (Object.hasOwn(currentParams, key)) {
        if (value !== currentValue) {
          modified = true;
          paramsCopy[key] = value;
        }
      } else {
        modified = true;
        paramsCopy[key] = value;
      }
    }
    if (modified) {
      if (debug) {
        console.debug(
          `Updating params for action ${action} with new params:`,
          object,
          `result:`,
          paramsCopy,
        );
      }
      paramsSignal.value = paramsCopy;
    } else if (debug) {
      console.debug(
        `No change in params for action ${action}, not updating.`,
        `current params:`,
        currentParams,
        `new params:`,
        object,
      );
    }
  };
  const result = [paramsSignal, updateParams];
  sharedSignalCache.set(action, result);
  if (debug) {
    console.debug(
      `Created params signal for ${action} with params:`,
      initialParams,
    );
  }
  return result;
};

const useBoundAction = (action, actionParamsSignal) => {
  const actionRef = useRef();
  const actionCallbackRef = useRef();

  if (!action) {
    return null;
  }
  if (typeof action === "function") {
    let actionInstance = actionRef.current;
    if (!actionInstance) {
      actionInstance = createAction((...args) => {
        return actionCallbackRef.current(...args);
      });
      if (actionParamsSignal) {
        actionInstance = actionInstance.bindParams(actionParamsSignal);
      }
      actionRef.current = actionInstance;
    }
    actionCallbackRef.current = action;
    return actionInstance;
  }
  if (actionParamsSignal) {
    return action.bindParams(actionParamsSignal);
  }
  return action;
};
