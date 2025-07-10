import { signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { createAction } from "../../actions.js";
import { useFormContext } from "./form_context.js";

let debug = false;
let componentActionIdCounter = 0;
const useComponentActionCacheKey = () => {
  const componentActionCacheKeyRef = useRef(null);
  // It's very important to use an object here as componentId and not just in integer
  // because this key will be used as a key in a WeakMap
  // and if we pass an integer the browser allows itself to garbage collect it
  // but not if it's an object as the useRef above keeps referencing it
  // this is a subtle different and might be the reason why WeakMap does not accept primitive as keys
  if (!componentActionCacheKeyRef.current) {
    const id = ++componentActionIdCounter;
    componentActionCacheKeyRef.current = {
      id,
      toString: () => `component_action_id_${id}`,
    };
  }
  return componentActionCacheKeyRef.current;
};

// used by <form> to have their own action bound to many parameters
// any form element within the <form> will update these params
// these params are also assigned just before executing the action to ensure they are in sync
// (could also be used by <fieldset> but I think fieldset are not going to be used this way and
// we will reserve this behavior to <form>)
export const useFormActionBoundToFormParams = (action) => {
  const actionCacheKey = useComponentActionCacheKey();
  const [formParamsSignal, updateFormParams] = useActionParamsSignal(
    actionCacheKey,
    {},
  );
  const formActionBoundActionToFormParams = useBoundAction(
    action,
    formParamsSignal,
  );
  return [
    formActionBoundActionToFormParams,
    formParamsSignal,
    updateFormParams,
  ];
};
export const useOneFormParam = (name, value) => {
  const { formParamsSignal } = useFormContext();
  const mountedRef = useRef(false);
  const getValue = () => formParamsSignal.value[name];
  const setValue = (value) => updateParams(formParamsSignal, { [name]: value });
  if (!mountedRef.current) {
    mountedRef.current = true;
    if (name && value !== undefined) {
      setValue(value);
    }
  }
  return [getValue, setValue];
};

// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the form params are updated when the form element single param is updated
export const useActionBoundToOneParam = (action, name, value) => {
  const mountedRef = useRef(false);
  const actionCacheKey = useComponentActionCacheKey();
  const [paramsSignal, updateParams] = useActionParamsSignal(
    actionCacheKey,
    {},
  );
  const boundAction = useBoundAction(action, paramsSignal);
  const getValue = () => paramsSignal.value[name];
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

  const reset = () => {
    setValue(value);
  };

  return [boundAction, getValue, setValue, reset];
};

export const useActionBoundToOneArrayParam = (action, name, value) => {
  const [boundAction, getValue, setValue, resetValue] =
    useActionBoundToOneParam(action, name, value);

  const add = (valueToAdd, valueArray = getValue()) => {
    const valueArrayWithThisValue = [];
    for (const value of valueArray) {
      if (value === valueToAdd) {
        return;
      }
      valueArrayWithThisValue.push(value);
    }
    valueArrayWithThisValue.push(valueToAdd);
    setValue(valueArrayWithThisValue);
  };
  const remove = (valueToRemove, valueArray = getValue()) => {
    const valueArrayWithoutThisValue = [];
    let found = false;
    for (const value of valueArray) {
      if (value === valueToRemove) {
        found = true;
        continue;
      }
      valueArrayWithoutThisValue.push(value);
    }
    if (!found) {
      return;
    }
    setValue(valueArrayWithoutThisValue);
  };

  const isInArray = (valueToCheck, valueArray = getValue()) => {
    return valueArray.includes(valueToCheck);
  };

  return [boundAction, add, remove, isInArray, resetValue];
};

// used by <details> to just call their action
export const useAction = (action, paramsSignal) => {
  return useBoundAction(action, paramsSignal);
};

const sharedSignalCache = new WeakMap();
const useActionParamsSignal = (cacheKey, initialParams = {}) => {
  // ✅ cacheKey peut être componentId (Symbol) ou action (objet)
  const fromCache = sharedSignalCache.get(cacheKey);
  if (fromCache) {
    return fromCache;
  }

  const paramsSignal = signal(initialParams);
  const result = [paramsSignal, (value) => updateParams(paramsSignal, value)];
  sharedSignalCache.set(cacheKey, result);
  if (debug) {
    console.debug(
      `Created params signal for ${cacheKey} with params:`,
      initialParams,
    );
  }
  return result;
};

export const updateParams = (paramsSignal, object, cacheKey) => {
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
