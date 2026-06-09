import { createContext } from "preact";

import { CONSTRAINT_ATTRIBUTE_SET } from "./validation/constraint_attribute_set.js";

// prop that we'll set on the control
export const CONTROL_ATTRIBUTE_SET = new Set([
  ...CONSTRAINT_ATTRIBUTE_SET,

  "ref",
  "children",
  "id",
  "name",
  "type",
  "value",
  "checked",
  "placeholder",

  "navi-input-type",
  "navi-control-proxy-for",
  "aria-controls",
  "tabIndex",

  "data-callout-arrow-x",
  "data-callout-point-to-border-box",
  "data-callout-point-to-content-box",
  "data-callout-viewport-spacing",
  "data-callout-position",
  "data-callout-position-fixed",

  "data-testid",
]);
// prop concerning control but that won't end up in the DOM if not inside CONTROL_ATTRIBUTE_SET
export const CONTROL_PROP_SET = new Set([
  ...CONTROL_ATTRIBUTE_SET,

  "action",
  "actionInteraction",
  "actionAfterChange",
  "actionOnMouseDown",
  "actionDebounce",
  "defaultValue",
  "defaultChecked",

  "loading",
  "basePseudoState",
  "constraints",

  "autoFocus",
  "autoFocusVisible",
  "autoSelect",

  "onMouseDown",
  "onClick",
  "onKeyDown",
  "onPaste",
  "onInput",

  "onCancel",
  "cancelOnBlurInvalid",
  "cancelOnEscape",
  "onActionPrevented",
  "onActionStart",
  "onActionAborted",
  "onActionError",
  "actionErrorEffect",
  "errorMapping",
  "onActionEnd",

  "resetOnCancel",
  "resetOnAbort",
  "resetOnError",
]);

export const ControlToInterfaceContext = createContext(null);
export const MessagePropsRefContext = createContext();

export const ControlNameContext = createContext();
export const DisabledContext = createContext();
export const ReadOnlyContext = createContext();
export const RequiredContext = createContext();
export const LoadingContext = createContext();
export const LoadingElementContext = createContext();

export const ActionContext = createContext();
export const ActionRequesterContext = createContext();
