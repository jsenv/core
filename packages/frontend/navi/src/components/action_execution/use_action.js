import { signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { createAction } from "../../actions.js";
import { createJsValueWeakMap } from "../../js_value_weak_map.js";
import { useFormContext } from "./form_context.js";

let debug = false;
let componentIdCounter = 0;
const useComponentId = () => {
  const componentIdRef = useRef(null);
  if (!componentIdRef.current) {
    const id = ++componentIdCounter;
    componentIdRef.current = {
      id,
      toString: () => `component_action_id_${id}`,
    };
    if (debug) {
      console.debug(`🆔 Created new componentId: ${id}`);
    }
  }
  return componentIdRef.current.id;
};

// used by <form> to have their own action bound to many parameters
// any form element within the <form> will update these params
// these params are also assigned just before executing the action to ensure they are in sync
// (could also be used by <fieldset> but I think fieldset are not going to be used this way and
// we will reserve this behavior to <form>)
export const useFormActionBoundToManyParams = (action) => {
  const componentId = useComponentId();
  const cacheKey = typeof action === "function" ? componentId : action;
  const [paramsSignal, updateParams] = useActionParamsSignal(cacheKey, {});
  const boundAction = useBoundAction(action, paramsSignal);

  boundAction.meta.paramsSignal = paramsSignal;
  boundAction.meta.updateParams = updateParams;
  const getValue = paramsSignal.value;
  const setValue = updateParams;
  return [boundAction, getValue, setValue];
};
export const useOneFormParam = (name, value) => {
  const { formAction } = useFormContext();
  const mountedRef = useRef(false);

  const formActionParamsSignal = formAction.meta.paramsSignal;
  const formActionUpdateParams = formAction.meta.updateParams;
  const getValue = () => formActionParamsSignal.value[name];
  const setValue = (value) => formActionUpdateParams({ [name]: value });
  if (!mountedRef.current) {
    mountedRef.current = true;
    if (name && value !== undefined) {
      setValue(value);
    }
  }
  return [getValue, setValue];
};
// used by <button> to have their own action still bound to parent action params (if any)
// as a result when inside a <form> a <button> action receives the form elements values
// when outside <form> button action receives no param
export const useActionBoundToFormParams = (action) => {
  const { formAction } = useFormContext();
  const formActionParamsSignal = formAction.meta.paramsSignal;
  const actionBoundToFormParams = useBoundAction(
    action,
    formActionParamsSignal,
  );
  return actionBoundToFormParams;
};

// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the form params are updated when the form element single param is updated
export const useActionBoundToOneParam = (action, name, value) => {
  const mountedRef = useRef(false);
  const componentId = useComponentId();
  const cacheKey = typeof action === "function" ? componentId : action;
  const [paramsSignal, updateParams] = useActionParamsSignal(cacheKey, {});
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
  return [boundAction, getValue, setValue];
};
// used by <details> to just call their action
export const useAction = (action) => {
  return useBoundAction(action);
};

const sharedSignalCache = createJsValueWeakMap(); // because keys can be integer or action object
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
