import { useSignal } from "@preact/signals";
import { useCallback, useContext, useRef } from "preact/hooks";

import { createAction } from "../../actions.js";
import { addIntoArray, removeFromArray } from "../../utils/array_add_remove.js";
import { useInitialValue } from "../use_initial_value.js";
import { FormContext } from "./form_context.js";

let debug = false;

// used by <form> to have their own action bound to many parameters
// any form element within the <form> will update these params
// these params are also assigned just before executing the action to ensure they are in sync
// (could also be used by <fieldset> but I think fieldset are not going to be used this way and
// we will reserve this behavior to <form>)
export const useFormActionBoundToFormParams = (action) => {
  const formParamsSignal = useSignal({});
  const formActionBoundActionToFormParams = useBoundAction(
    action,
    formParamsSignal,
  );
  const updateFormParams = useCallback((value) => {
    formParamsSignal.value = value;
  }, []);

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
  if (!name) {
    throw new Error("useOneFormParam: name is required");
  }

  const { formParamsSignal } = useContext(FormContext);
  const getValue = useCallback(() => formParamsSignal.value[name], []);
  const setValue = useCallback(
    (value) => updateParamsSignal(formParamsSignal, { [name]: value }),
    [],
  );

  const initialValue = useInitialValue(
    name,
    externalValue,
    fallbackValue,
    defaultValue,
    setValue,
  );
  const previousFormParamsSignalRef = useRef(null);
  const formActionChanged =
    previousFormParamsSignalRef.current !== null &&
    previousFormParamsSignalRef.current !== formParamsSignal;
  previousFormParamsSignalRef.current = formParamsSignal;
  if (formActionChanged) {
    if (debug) {
      console.debug(
        `useOneFormParam(${name}) form action changed, re-initializing with: ${initialValue}`,
      );
    }
    setValue(initialValue);
  }

  return [getValue(), setValue, initialValue];
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
  const actionFirstArgSignal = useSignal();
  const boundAction = useBoundAction(action, actionFirstArgSignal);
  const getValue = useCallback(() => actionFirstArgSignal.value, []);
  const setValue = useCallback((value) => {
    actionFirstArgSignal.value = value;
  }, []);
  const initialValue = useInitialValue(
    name,
    externalValue,
    fallbackValue,
    defaultValue,
    setValue,
  );
  const value = getValue();

  return [boundAction, value, setValue, initialValue];
};

export const useActionBoundToOneArrayParam = (
  action,
  name,
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  const [boundAction, value, setValue, initialValue] = useActionBoundToOneParam(
    action,
    name,
    externalValue,
    fallbackValue,
    defaultValue,
  );

  const add = (valueToAdd, valueArray = value) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };

  const remove = (valueToRemove, valueArray = value) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };

  const result = [boundAction, value, setValue, initialValue];
  result.add = add;
  result.remove = remove;
  return result;
};
export const useOneFormArrayParam = (
  name,
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  const [getValue, setValue, initialValue] = useOneFormParam(
    name,
    externalValue,
    fallbackValue,
    defaultValue,
  );
  const add = (valueToAdd, valueArray = getValue()) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };
  const remove = (valueToRemove, valueArray = getValue()) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };
  const result = [getValue, setValue, initialValue];
  result.add = add;
  result.remove = remove;
  return result;
};

// used by <details> to just call their action
export const useAction = (action, paramsSignal) => {
  return useBoundAction(action, paramsSignal);
};

export const updateParamsSignal = (paramsSignal, object) => {
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
        `Updating params with new params:`,
        object,
        `result:`,
        paramsCopy,
      );
    }
    paramsSignal.value = paramsCopy;
  } else if (debug) {
    console.debug(
      `No change in params, not updating.`,
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
  if (isFunctionButNotAnActionFunction(action)) {
    let actionInstance = actionRef.current;
    if (!actionInstance) {
      actionInstance = createAction(
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

const isFunctionButNotAnActionFunction = (action) => {
  return typeof action === "function" && !action.isAction;
};
