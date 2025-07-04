import { signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { createAction } from "../../actions.js";
import { useParentAction } from "./action_context.js";

let debug = false;
let componentIdCounter = 0;

export const useAction = (action, { name, value, preferSelf } = {}) => {
  const mountedRef = useRef(false);
  const parentBoundAction = useParentAction();
  if (parentBoundAction) {
    const parentActionParamsSignal = parentBoundAction.meta.paramsSignal;
    const parentActionUpdateParams = parentBoundAction.meta.updateParams;
    const getValue = name
      ? () => parentActionParamsSignal.value[name]
      : () => parentActionParamsSignal.value;
    const setValue = name
      ? (value) => parentActionUpdateParams({ [name]: value })
      : parentActionUpdateParams;

    if (preferSelf) {
      const boundAction = useBoundAction(action, parentActionParamsSignal);
      return [boundAction, getValue, setValue];
    }

    if (!mountedRef.current) {
      mountedRef.current = true;
      if (name && value !== undefined) {
        setValue(value);
      }
    }
    return [parentBoundAction, getValue, setValue];
  }

  const componentId = useRef({
    toString: () => `component_action_id_${componentId.current.id}`,
  });
  if (!componentId.current.id) {
    componentId.current.id = ++componentIdCounter;
    if (debug) {
      console.debug(`🆔 Created new componentId: ${componentId.current.id}`);
    }
  }

  const cacheKey = typeof action === "function" ? componentId.current : action;
  const [paramsSignal, updateParams] = useActionParamsSignal(cacheKey, {});
  const boundAction = useBoundAction(action, paramsSignal);
  boundAction.meta.paramsSignal = paramsSignal;
  boundAction.meta.updateParams = updateParams;

  const boundActionPrevious = useRef(null);
  boundActionPrevious.current = boundAction;

  const getValue = name
    ? () => paramsSignal.value[name]
    : () => paramsSignal.value;
  const setValue = name
    ? (value) => {
        if (debug) {
          console.debug(
            `useAction(${name}) set value to ${value} (old value is ${getValue()} )`,
          );
        }
        return updateParams({ [name]: value });
      }
    : updateParams;

  if (!mountedRef.current) {
    mountedRef.current = true;
    if (name) {
      if (debug) {
        console.debug(`useAction(${name}) initial value: ${value}`);
      }
      setValue(value);
    }
  }
  return [boundAction, getValue, setValue];
};

const sharedSignalCache = new WeakMap();
const useActionParamsSignal = (cacheKey, initialParams = {}) => {
  // ✅ cacheKey peut être componentId (Symbol) ou action (objet)
  const fromCache = sharedSignalCache.get(cacheKey);
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
          `Updating params for ${cacheKey} with new params:`,
          object,
          `result:`,
          paramsCopy,
        );
      }
      paramsSignal.value = paramsCopy;
    } else if (debug) {
      console.debug(
        `No change in params for ${cacheKey}, not updating.`,
        `current params:`,
        currentParams,
        `new params:`,
        object,
      );
    }
  };
  const result = [paramsSignal, updateParams];
  sharedSignalCache.set(cacheKey, result);
  if (debug) {
    console.debug(
      `Created params signal for ${cacheKey} with params:`,
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
