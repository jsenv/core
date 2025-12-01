import { useLayoutEffect, useState } from "preact/hooks";

import { NAVI_VALIDITY_CHANGE_CUSTOM_EVENT } from "../custom_constraint_validation.js";

const DEFAULT_VALIDITY_STATE = { valid: true };
export const useConstraintValidityState = (ref) => {
  const checkValue = () => {
    const element = ref.current;
    if (!element) {
      return DEFAULT_VALIDITY_STATE;
    }
    const { __validationInterface__ } = element;
    if (!__validationInterface__) {
      return DEFAULT_VALIDITY_STATE;
    }
    const value = __validationInterface__.getConstraintValidityState();
    return value;
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
