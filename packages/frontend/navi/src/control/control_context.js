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
  "autoComplete",
  "spellcheck",
  "autoCorrect",
  "aria-controls",
  "tabIndex",
  "command",
  "commandFor",
  "command-value", // not standard but make sense, allow to give param to the command in question
  "list",

  // "ui-action-target",
  "navi-input-type",
  "navi-value-pad",
  "navi-control-proxy-for",
  "navi-command-proxy-for",
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
  // A signal bound two-way to the control: its value seeds the control's state and
  // is written back on every uiAction. Precludes value/checked (see createControlInfo).
  "signal",
  "defaultValue",
  "defaultChecked",
  // A checked radio pressed again lets its value go — a group allowed to hold
  // nothing. Answered by the radio's own reactions (see control_hooks.jsx).
  "deselectable",
  "readOnly", // will depend wether readOnly is supported

  "loading",
  "basePseudoState",
  // App constraints this control must satisfy, on top of the ones navi ships:
  // `constraints={[MY_CONSTRAINT]}`. A constraint is an object, so it carries
  // its own parameters — nothing has to travel through an attribute. Read on
  // every check in control_validation.js; `registerGlobalConstraint` is the
  // same thing for every control at once.
  "constraints",

  // A real target inside a zone that belongs to another control — see
  // own_target.js.
  "ownTarget",

  "autoFocus",
  "autoFocusVisible",
  "autoFocusSelect",

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
  "optimistic",

  "charGuard",
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
