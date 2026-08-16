import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { MAX_LENGTH_CONSTRAINT } from "../validation/standard_constraints.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field) => {
    const readOnly = Boolean(
      field.controlHostProps.readOnly ||
      field.controlHostProps["aria-readonly"] === "true",
    );
    if (!readOnly) {
      return null;
    }

    // A selection guarding its length (see maxLengthGuard) is what holds this
    // one back, so max_length is what refuses it: same name, same message, same
    // `maxLengthMessage` to say it in the caller's own words. Read-only is only
    // how it is expressed on the item.
    const parent = field.parentUIStateController;
    if (parent?.isChildBlockedByMaxLengthGuard?.(field)) {
      return {
        name: MAX_LENGTH_CONSTRAINT.name,
        constraint: MAX_LENGTH_CONSTRAINT,
        message: naviI18n("constraint.guard.max_length.selection", {
          max: String(parent.props.maxLengthGuard),
        }),
        status: "info",
        ignoredByParents: true,
      };
    }

    // A readonly element does not block its parent from submitting — mirrors
    // standard HTML form behaviour where readonly inputs are submitted as-is.
    return {
      message: readOnlyMessage(field),
      status: "info",
      ignoredByParents: true,
    };
  },
};
// CONSTRAINT_ATTRIBUTE_SET.add("readOnly"); // not all control support this attr
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-reason");

const readOnlyMessage = (field) => {
  // Read-only for a reason the control named itself. Only one so far: a send
  // button held back by the form above it, which holds nothing new (see
  // Button's own `readOnlyWhileFormUnchanged`) — what stops the press is not the
  // button, it is the form still waiting for a change, so that is what it says.
  // Read off the reason rather than off the form's state: a button read-only for
  // its own reasons, inside a form that happens to be unchanged, is not waiting
  // for anything.
  if (field.controlHostProps["data-readonly-reason"] === "form-unchanged") {
    return naviI18n("constraint.readonly.awaiting_change");
  }
  if (field.controlType === "button") {
    return naviI18n("constraint.readonly.button");
  }
  return naviI18n("constraint.readonly.default");
};
