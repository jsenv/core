import { createContext } from "preact";

import { CONSTRAINT_ATTRIBUTE_SET } from "./validation/constraint_attribute_set.js";

export const FIELD_PROP_SET = new Set([
  ...CONSTRAINT_ATTRIBUTE_SET,
  "value",
  "id",
  "name",
  "data-testid",
  "navi-proxy-for",
  "aria-controls",
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

export const findFieldElement = (el) => {
  const naviFieldAttribute = el.getAttribute("navi-field");
  if (!naviFieldAttribute) {
    return null;
  }
  const fieldEl = el.querySelector(naviFieldAttribute);
  return fieldEl;
};

export const findAncestorFieldElement = (el) => {
  let ancestor;
  const renderedBy = el.getAttribute("navi-rendered-by");
  if (renderedBy) {
    // event usually occur on inputs that are sometimes wrapped by a custom ui element
    // these custom ui element have a [navi-field] attribute on them
    // we want to look for their ancestor otherwise input would consider their wrapper as a field instead of finding a parent field
    ancestor = el.closest(renderedBy).parentNode;
  } else {
    ancestor = el.parentNode;
  }
  const closestField = ancestor.closest("[navi-field]");
  return closestField;
};
