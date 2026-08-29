import { getNetworkPolicyReadOnlyMessage } from "@jsenv/navi/src/action/network_policy.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { MAX_LENGTH_CONSTRAINT } from "../validation/standard_constraints.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field, { intent } = {}) => {
    const readOnly = Boolean(
      field.controlHostProps.readOnly ||
      field.controlHostProps["aria-readonly"] === "true",
    );
    if (!readOnly) {
      return null;
    }

    // Read-only, and what it opens still opens: a picker's answer often lives
    // in a shape only its popup draws — a plan with one tile ringed, a wheel
    // stopped on a time — and refusing to open leaves that shape unreadable.
    // Opening reads and nothing more, so it goes through; everything that would
    // write is refused below, and the popup content is handed the same
    // read-only state so each control in there refuses on its own terms. Which
    // controls say so, and when, is theirs to answer (see createControlInfo's
    // readOnlyOpens).
    if (intent === "read" && field.readOnlyOpens) {
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
  // Read-only for a reason the control named itself, read off the reason
  // rather than off the surrounding state: a button read-only for its own
  // reasons, inside a form that happens to be unchanged, is not waiting for
  // anything.
  const reason = field.controlHostProps["data-readonly-reason"];
  // Held by the network policy: the write it asks for cannot leave (see
  // network_policy.js), in the policy's own words.
  if (reason === "network-policy") {
    return getNetworkPolicyReadOnlyMessage();
  }
  // A send button held back by the form above it, which holds nothing new (see
  // Button's own `readOnlyWhileFormUnchanged`) — what stops the press is not the
  // button, it is the form still waiting for a change, so that is what it says.
  if (reason === "form-unchanged") {
    return naviI18n("constraint.readonly.awaiting_change");
  }
  if (field.controlType === "button") {
    return naviI18n("constraint.readonly.button");
  }
  return naviI18n("constraint.readonly.default");
};
