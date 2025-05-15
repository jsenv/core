import { useLayoutEffect, useRef } from "preact/hooks";
import { installInputCustomValidation } from "../input_custom_validation.js";

export const useInputCustomValidation = (inputRef) => {
  const inputCustomValidationRef = useRef();

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

    if (input.validationInterface) {
      inputCustomValidationRef.current = input.validationInterface;
    } else {
      inputCustomValidationRef.current = installInputCustomValidation(input);
    }
    return () => {
      input.validationInterface.unsubscribe();
    };
  }, []);
};
