import { useCallback, useLayoutEffect, useRef } from "preact/hooks";
import { installInputCustomValidation } from "../input_custom_validation.js";

export const useInputCustomValidationRef = (
  inputRef,
  initCallback,
  initCallbackDeps,
) => {
  const inputCustomValidationRef = useRef();
  const initCallbackMemoized = useCallback(initCallback, initCallbackDeps);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      console.warn(
        "useInputCustomValidation: inputRef.current is null, make sure to pass a ref to an input element",
      );
      /* can happen if the component does this for instance:
      const Component = () => {
        const ref = useRef(null) 
        
        if (something) {
          return <input ref={ref} />  
        }
        return <span></span>
      }

      usually it's better to split the component in two but hey 
      */
      return null;
    }
    const unsubscribe = subscribe(input);
    const inputValidationInterface = input.validationInterface;
    inputCustomValidationRef.current = inputValidationInterface;
    let cleanupInit;
    if (initCallbackMemoized) {
      cleanupInit = initCallbackMemoized(inputValidationInterface);
    }
    return () => {
      unsubscribe();
      if (typeof cleanupInit === "function") {
        cleanupInit();
      }
    };
  }, [initCallbackMemoized]);

  return inputCustomValidationRef;
};

const inputSubscribeCountWeakMap = new WeakMap();
const subscribe = (input) => {
  if (input.validationInterface) {
    let subscribeCount = inputSubscribeCountWeakMap.get(input);
    inputSubscribeCountWeakMap.set(input, subscribeCount + 1);
  } else {
    installInputCustomValidation(input);
    inputSubscribeCountWeakMap.set(input, 1);
  }
  return () => {
    unsubscribe(input);
  };
};

const unsubscribe = (input) => {
  const subscribeCount = inputSubscribeCountWeakMap.get(input);
  if (subscribeCount === 1) {
    input.validationInterface.uninstall();
    inputSubscribeCountWeakMap.delete(input);
  } else {
    inputSubscribeCountWeakMap.set(input, subscribeCount - 1);
  }
};
