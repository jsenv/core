import { CONSTRAINT_ATTRIBUTE_SET } from "./validation/constraint_attribute_set.js";

export const fieldPropSet = new Set([
  ...CONSTRAINT_ATTRIBUTE_SET,
  "data-testid",
]);
