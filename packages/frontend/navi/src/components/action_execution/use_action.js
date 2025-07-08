import { signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { createAction } from "../../actions.js";
import { useParentAction } from "./action_context.js";

let debug = false;
let componentIdCounter = 0;

// used by <form> (could also be used by <fieldset> but I think fieldset are not going to be used this way)
// to have their own action bound to many parameters
export const useActionBoundToManyParams = (action) => {
  const parentBoundAction = useParentAction();
  if (parentBoundAction) {
    const parentActionParamsSignal = parentBoundAction.meta.paramsSignal;
    const parentActionUpdateParams = parentBoundAction.meta.updateParams;
    const getValue = parentActionParamsSignal.value;
    const setValue = parentActionUpdateParams;
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
  const getValue = paramsSignal.value;
  const setValue = updateParams;
  return [boundAction, getValue, setValue];
};
// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the action will update the form action params
export const useActionBoundToOneParam = (action, name, value) => {
  const mountedRef = useRef(false);
  const parentBoundAction = useParentAction();
  if (parentBoundAction) {
    const parentActionParamsSignal = parentBoundAction.meta.paramsSignal;
    const parentActionUpdateParams = parentBoundAction.meta.updateParams;
    const getValue = () => parentActionParamsSignal.value[name];
    const setValue = (value) => parentActionUpdateParams({ [name]: value });

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

  const getValue = paramsSignal.value[name];
  const setValue = (value) => {
    if (debug) {
      console.debug(
        `useAction(${name}) set value to ${value} (old value is ${getValue()} )`,
      );
    }
    return updateParams({ [name]: value });
  };

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
// used by <button> to have different their own action still bound to elements in the <form> (if any)
// as a result button action can acces the form values
export const useActionBoundToParentParams = (action) => {
  const parentBoundAction = useParentAction();
  const boundAction = useBoundAction(action);
  if (parentBoundAction) {
    const parentActionParamsSignal = parentBoundAction.meta.paramsSignal;

    const actionBoundToParentParams = useBoundAction(
      action,
      parentActionParamsSignal,
    );
    if (action) {
      return actionBoundToParentParams;
    }
    return parentBoundAction;
  }
  return boundAction;
};
// used by <details> to just call their action
export const useAction = (action) => {
  const parentBoundAction = useParentAction();
  const boundAction = useBoundAction(action);
  return parentBoundAction || boundAction;
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
