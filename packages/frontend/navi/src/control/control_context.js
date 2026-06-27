import { createContext } from "preact";

import { CONSTRAINT_ATTRIBUTE_SET } from "./rules/constraint_attribute_set.js";
import { CONSTRAINT_MESSAGE_PROP_NAME_SET } from "./rules/constraint_message.js";

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
  "inputMode",
  "pattern",
  "autoComplete",
  "spellcheck",
  "autoCorrect",
  "aria-controls",
  "tabIndex",
  "command",
  "commandFor",
  "command-value", // not standard but make sense, allow to give param to the command in question

  // "ui-action-target",
  "navi-input-type",
  "navi-control-proxy-for",
  "navi-command-target",
  "onnavi_command",
  "onnavi_request_open",
  "onnavi_request_close",

  "data-callout-arrow-x",
  "data-callout-point-to-border-box",
  "data-callout-point-to-content-box",
  "data-callout-viewport-spacing",
  "data-callout-position",
  "data-callout-position-fixed",

  "data-testid", // playwright, cypress
  "data-separator", // used by InputGroup paste-to-fill
]);
// prop concerning control but that won't end up in the DOM if not inside CONTROL_ATTRIBUTE_SET
export const CONTROL_PROP_SET = new Set([
  ...CONTROL_ATTRIBUTE_SET,
  ...CONSTRAINT_MESSAGE_PROP_NAME_SET,

  "action",
  "actionEvent",
  "actionAfterChange",
  "actionOnMouseDown",
  "actionDebounce",
  "defaultValue",
  "defaultChecked",
  "readOnly", // will depend wether readOnly is supported

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
  "eventReactionDefinitions",

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

  "allowedCharsGuard",
  "maxLengthGuard",
]);

export const MessagePropsRefContext = createContext();

export const ControlIdContext = createContext();
export const ControlNameContext = createContext();
export const DisabledContext = createContext();
export const ReadOnlyContext = createContext();
export const RequiredContext = createContext();
export const LoadingContext = createContext();
export const LoadingElementContext = createContext();

export const ActionContext = createContext();
export const ActionRequesterContext = createContext();
