import { useLayoutEffect, useState } from "preact/hooks";

import { NAVI_VALIDITY_CHANGE_CUSTOM_EVENT } from "../control_validation.js";

const DEFAULT_VALIDITY_STATE = { valid: true, reported: null };

/**
 * The control's constraint validity, re-read whenever it changes:
 * `{ valid, reported, [constraintName]: null | failureInfo }`.
 *
 * `reported` names the constraint whose message the callout shows — the one
 * navi picks when several fail at once. A failure info carries `messageString`,
 * the sentence itself.
 */
export const useConstraintValidityState = (ref) => {
  const checkValue = () => {
    const element = ref.current;
    if (!element) {
      return DEFAULT_VALIDITY_STATE;
    }
    const controller = element.__uiStateController__;
    if (!controller) {
      return DEFAULT_VALIDITY_STATE;
    }
    const controlValidity = controller.rules.validation;
    const value = controlValidity.getConstraintValidityState();
    return value;
  };

  const [constraintValidityState, setConstraintValidityState] =
    useState(checkValue);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    setConstraintValidityState(checkValue());
    element.addEventListener(NAVI_VALIDITY_CHANGE_CUSTOM_EVENT, () => {
      setConstraintValidityState(checkValue());
    });
  }, []);

  return constraintValidityState;
};
