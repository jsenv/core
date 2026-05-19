import { createContext } from "preact";

import { CONSTRAINT_ATTRIBUTE_SET } from "./validation/constraint_attribute_set.js";

export const fieldPropSet = new Set([
  ...CONSTRAINT_ATTRIBUTE_SET,
  "value",
  "id",
  "name",
  "data-testid",
]);

export const ActionRequesterContext = createContext();
export const ActionContext = createContext();

export const FieldNameContext = createContext();
export const ReadOnlyContext = createContext();
export const DisabledContext = createContext();
export const RequiredContext = createContext();
export const LoadingContext = createContext();
export const LoadingElementContext = createContext();
