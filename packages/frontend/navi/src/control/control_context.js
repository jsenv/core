import { createContext } from "preact";

import {
  CONSTRAINT_ATTRIBUTE_SET,
  constraintAttributeFromProp,
} from "./rules/constraint_attribute_set.js";
import { CONSTRAINT_MESSAGE_PROP_NAME_SET } from "./rules/constraint_message.js";

// prop that we'll set on the control.
// CONSTRAINT_ATTRIBUTE_SET is consulted through controlAttributeFromProp()
// rather than spread in here: a constraint registers into it when its own
// module evaluates, so anything read at module-eval time reads a set that is
// still filling up — and in a bundle, whichever constraint happens to evaluate
// last would silently lose its attribute.
export const CONTROL_ATTRIBUTE_SET = new Set([
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
  // The name goes where the role is: the root box has none, so an aria-label
  // left on it names nothing at all, while the host is what the user focuses
  // and what a screen reader announces (and what getByRole({ name }) reads).
  "aria-label",
  "aria-labelledby",
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

  // The interactions this element takes for itself inside a zone that belongs
  // to another control, and what becomes of it where they are blocked — see
  // self_interactions.js.
  "selfInteractions",
  "whenSelfInteractionsBlocked",

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

/**
 * The attribute a prop must be written as on the control host, `null` when the
 * prop is not one. A constraint attribute may be passed either way — as the
 * attribute itself (`data-no-emoji`) or as the prop it stands for (`noEmoji`).
 */
export const controlAttributeFromProp = (key) => {
  if (CONTROL_ATTRIBUTE_SET.has(key) || CONSTRAINT_ATTRIBUTE_SET.has(key)) {
    return key;
  }
  return constraintAttributeFromProp(key);
};

export const isControlProp = (key) =>
  CONTROL_PROP_SET.has(key) || controlAttributeFromProp(key) !== null;

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
