import { createContext } from "preact";

import { CONSTRAINT_ATTRIBUTE_SET } from "./validation/constraint_attribute_set.js";

export const FIELD_PROP_SET = new Set([
  ...CONSTRAINT_ATTRIBUTE_SET,
  "value",
  "id",
  "name",
  "data-testid",
  "navi-proxy-for",
  "data-callout-arrow-x",
  "data-callout-point-to-border-box",
  "data-callout-point-to-content-box",
  "data-callout-viewport-spacing",
  "data-callout-position",
  "data-callout-position-fixed",
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
