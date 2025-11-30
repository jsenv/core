import { useLayoutEffect, useState } from "preact/hooks";

import { NAVI_VALIDITY_CHANGE_CUSTOM_EVENT } from "../custom_constraint_validation.js";

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
    const currentConstraintValidityState =
      __validationInterface__.getConstraintValidityState();
    return currentConstraintValidityState;
  };

  const [constraintValidityState, setConstraintValidityState] =
    useState(checkValue);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.addEventListener(NAVI_VALIDITY_CHANGE_CUSTOM_EVENT, () => {
      setConstraintValidityState(checkValue());
    });
  }, []);

  return constraintValidityState;
};
