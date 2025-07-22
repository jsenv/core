import { signal } from "@preact/signals";
import { useCallback, useRef } from "preact/hooks";
import { createAction } from "../../actions.js";
import { addIntoArray, removeFromArray } from "../../utils/array_add_remove.js";
import { useInitialValue } from "../use_initial_value.js";
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
  const cacheKey = typeof action === "function" ? actionCacheKey : action;
  const [formParamsSignal, updateFormParams] = useActionParamsSignal(
    cacheKey,
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
export const useOneFormParam = (
  name,
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  const { formParamsSignal } = useFormContext();
  const previousFormParamsSignalRef = useRef(null);
  const formActionChanged =
    previousFormParamsSignalRef.current !== null &&
    previousFormParamsSignalRef.current !== formParamsSignal;
  previousFormParamsSignalRef.current = formParamsSignal;

  const getValue = useCallback(
    () => formParamsSignal.value[name],
    [formParamsSignal],
  );
  const setValue = useCallback(
    (value) => updateParamsSignal(formParamsSignal, { [name]: value }),
    [formParamsSignal],
  );

  const initialValue = useInitialValue(
    name,
    externalValue,
    fallbackValue,
    defaultValue,
    setValue,
  );
  if (formActionChanged) {
    if (debug) {
      console.debug(
        `useOneFormParam(${name}) form action changed, re-initializing with: ${initialValue}`,
      );
    }
    setValue(initialValue);
  }

  const resetValue = useCallback(() => {
    setValue(initialValue);
  }, [initialValue, formParamsSignal]);

  return [getValue(), setValue, resetValue];
};

// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the form params are updated when the form element single param is updated
export const useActionBoundToOneParam = (
  action,
  name,
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  const actionCacheKey = useComponentActionCacheKey();
  const cacheKey = typeof action === "function" ? actionCacheKey : action;
  const [paramsSignal, updateParams] = useActionParamsSignal(cacheKey, {});
  const previousParamsSignalRef = useRef(null);
  const actionChanged =
    previousParamsSignalRef.current !== null &&
    previousParamsSignalRef.current !== paramsSignal;
  previousParamsSignalRef.current = paramsSignal;

  const boundAction = useBoundAction(action, paramsSignal);
  const getValue = useCallback(() => paramsSignal.value[name], [paramsSignal]);
  const setValue = useCallback(
    (value) => {
      if (debug) {
        console.debug(
          `useActionBoundToOneParam(${name}) set value to ${value} (old value is ${getValue()} )`,
        );
      }
      return updateParams({ [name]: value });
    },
    [updateParams],
  );

  const initialValue = useInitialValue(
    name,
    externalValue,
    fallbackValue,
    defaultValue,
    setValue,
  );
  if (actionChanged) {
    if (debug) {
      console.debug(
        `useActionBoundToOneParam(${name}) action changed, re-initializing with: ${initialValue}`,
      );
    }
    setValue(initialValue);
  }

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue, paramsSignal]);

  return [boundAction, getValue(), setValue, reset];
};

// export const useActionBoundToOneBooleanParam = (action, name, value) => {
//   const [boundAction, getValue, setValue, resetValue] =
//     useActionBoundToOneParam(action, name, Boolean(value));

//   return [
//     boundAction,
//     () => Boolean(getValue()),
//     (value) => setValue(Boolean(value)),
//     resetValue,
//   ];
// };

export const useActionBoundToOneArrayParam = (
  action,
  name,
  initialValue,
  fallbackValue,
  defaultValue = [],
) => {
  const [boundAction, value, setValue, resetValue] = useActionBoundToOneParam(
    action,
    name,
    initialValue,
    fallbackValue,
    defaultValue,
  );

  const add = (valueToAdd, valueArray = value) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };

  const remove = (valueToRemove, valueArray = value) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };

  return [boundAction, value, add, remove, resetValue];
};
export const useOneFormArrayParam = (
  name,
  initialValue,
  fallbackValue,
  defaultValue = [],
) => {
  const [getValue, setValue, resetValue] = useOneFormParam(
    name,
    initialValue,
    fallbackValue,
    defaultValue,
  );
  const add = (valueToAdd, valueArray = getValue()) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };
  const remove = (valueToRemove, valueArray = getValue()) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };
  return [getValue, add, remove, resetValue];
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
  const result = [
    paramsSignal,
    (value) => updateParamsSignal(paramsSignal, value, cacheKey),
  ];
  sharedSignalCache.set(cacheKey, result);
  if (debug) {
    console.debug(
      `Created params signal for ${cacheKey} with params:`,
      initialParams,
    );
  }
  return result;
};

export const updateParamsSignal = (paramsSignal, object, cacheKey) => {
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
