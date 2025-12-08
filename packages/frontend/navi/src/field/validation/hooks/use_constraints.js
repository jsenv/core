import { useLayoutEffect, useRef } from "preact/hooks";

import { useCustomValidationRef } from "./use_custom_validation_ref.js";

const NO_CONSTRAINTS = [];
export const useConstraints = (elementRef, props, { targetSelector } = {}) => {
  const {
    constraints = NO_CONSTRAINTS,
    requiredMessage,
    ...remainingProps
  } = props;

  const customValidationRef = useCustomValidationRef(
    elementRef,
    targetSelector,
  );
  useLayoutEffect(() => {
    const customValidation = customValidationRef.current;
    const cleanupCallbackSet = new Set();
    for (const constraint of constraints) {
      const unregister = customValidation.registerConstraint(constraint);
      cleanupCallbackSet.add(unregister);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, constraints);

  const requiredMessageRef = useStableRef(requiredMessage);
  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return null;
    }
    el.setAttribute("data-required-message-event", "navi_required_message_jsx");
    el.addEventListener("navi_required_message_jsx", (e) => {
      const requiredMessage = requiredMessageRef.current;
      e.detail.render(requiredMessage);
    });
    return () => {};
  }, []);

  return remainingProps;
};

const useStableRef = (v) => {
  const ref = useRef(v);
  ref.current = v;
  return ref;
};
