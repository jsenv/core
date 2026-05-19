import { createContext } from "preact";

import { CONSTRAINT_ATTRIBUTE_SET } from "./validation/constraint_attribute_set.js";

export const FIELD_PROP_SET = new Set([
  ...CONSTRAINT_ATTRIBUTE_SET,
  "value",
  "id",
  "name",
  "data-testid",
  "navi-proxy-for",
]);

export const FieldToInterfaceContext = createContext(null);
export const MessagePropsRefContext = createContext();

export const FieldNameContext = createContext();
export const DisabledContext = createContext();
export const ReadOnlyContext = createContext();
export const RequiredContext = createContext();
export const LoadingContext = createContext();
export const LoadingElementContext = createContext();

export const ActionContext = createContext();
export const ActionRequesterContext = createContext();
