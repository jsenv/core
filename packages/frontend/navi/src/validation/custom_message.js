import { installCustomConstraintValidation } from "./custom_constraint_validation.js";

export const addCustomMessage = (element, key, message, options) => {
  const customConstraintValidation =
    element.__validationInterface__ ||
    (element.__validationInterface__ =
      installCustomConstraintValidation(element));

  return customConstraintValidation.addCustomMessage(key, message, options);
};

export const removeCustomMessage = (element, key) => {
  const customConstraintValidation = element.__validationInterface__;
  if (!customConstraintValidation) {
    return;
  }
  customConstraintValidation.removeCustomMessage(key);
};
