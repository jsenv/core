import { useLayoutEffect, useState } from "preact/hooks";

export const useConstraintValidityState = (ref) => {
  const checkValue = () => {
    const element = ref.current;
    if (!element) {
      return null;
    }
    const { __validationInterface__ } = element;
    if (!__validationInterface__) {
      return null;
    }
    return __validationInterface__.getConstraintValidityState();
  };

  const [constraintValidityState, setConstraintValidityState] =
    useState(checkValue);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.addEventListener("navi_constraint_validity_state", () => {
      setConstraintValidityState(checkValue());
    });
  }, []);

  return constraintValidityState;
};
