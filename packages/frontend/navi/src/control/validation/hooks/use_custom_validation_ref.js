import { useLayoutEffect, useRef } from "preact/hooks";

import { installCustomConstraintValidation } from "../custom_constraint_validation.js";

export const useCustomValidationRef = (
  elementRef,
  { targetSelector, disabled },
) => {
  const customValidationRef = useRef();
  // Capture the call-site stack at render time (outside the layout effect)
  // so the warning points to the component that called this hook, not Preact internals.
  const callSiteRef = useRef(null);
  if (!callSiteRef.current) {
    callSiteRef.current = new Error("useCustomValidationRef called here").stack;
  }

  useLayoutEffect(() => {
    if (disabled) {
      return undefined;
    }
    const element = elementRef.current;
    if (!element) {
      if (!elementRef.nullExpected) {
        console.warn(
          `useCustomValidationRef: elementRef.current is null, make sure to pass a ref to an element
${callSiteRef.current}`,
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
      }
      return undefined;
    }
    let target;
    if (targetSelector) {
      target = element.querySelector(targetSelector);
      if (!target) {
        console.warn(
          `useCustomValidationRef: targetSelector "${targetSelector}" did not match in element`,
        );
        return undefined;
      }
    } else {
      target = element;
    }
    const unsubscribe = subscribe(element, target);
    const validationInterface = element.__validationInterface__;
    customValidationRef.current = validationInterface;
    return () => {
      unsubscribe();
    };
  }, [targetSelector, disabled]);

  return customValidationRef;
};

const subscribeCountWeakMap = new WeakMap();
const subscribe = (element, target) => {
  if (element.__validationInterface__) {
    let subscribeCount = subscribeCountWeakMap.get(element);
    subscribeCountWeakMap.set(element, subscribeCount + 1);
  } else {
    installCustomConstraintValidation(element, target);
    subscribeCountWeakMap.set(element, 1);
  }
  return () => {
    unsubscribe(element);
  };
};

const unsubscribe = (element) => {
  const subscribeCount = subscribeCountWeakMap.get(element);
  if (subscribeCount === 1) {
    element.__validationInterface__.uninstall();
    subscribeCountWeakMap.delete(element);
  } else {
    subscribeCountWeakMap.set(element, subscribeCount - 1);
  }
};
