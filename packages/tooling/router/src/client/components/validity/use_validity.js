import { useLayoutEffect, useRef, useCallback } from "preact/hooks";
import { createInputValidity } from "./input_validity.js";

export const useValidity = (inputRef, key, { onCancel } = {}) => {
  const inputValidityRef = useRef(null);

  const addCustomValidity = useCallback((message) => {
    const inputValidity = inputValidityRef.current;
    inputValidity.addCustomValidity(message);
  }, []);
  const removeCustomValidity = useCallback((message) => {
    const inputValidity = inputValidityRef.current;
    inputValidity.removeCustomValidity(message);
  }, []);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      console.warn(
        "useValidity: inputRef.current is null, make sure to pass a ref to an input element",
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
    const inputValidity = createInputValidity(input, key, { onCancel });
    inputValidityRef.current = inputValidity;
    return () => {
      inputValidity.unsubscribe();
    };
  }, [key, onCancel]);

  return [addCustomValidity, removeCustomValidity];
};
