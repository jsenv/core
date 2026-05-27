import { dispatchCustomEvent } from "@jsenv/dom";
import { createUICallback } from "./ui_callback.js";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const resolveActionProp = (action) => {
  if (typeof action === "string") {
    const naviAction = STRING_ACTIONS[action];
    if (!naviAction) {
      throw new Error(`Unknown ui action "${action}"`);
    }
    return naviAction;
  }
  return action;
};

export const requestClosestAction = (e) => {
  const currentTarget = e.currentTarget;
  const target = e.target;
  // some element (like list) can have their own action, we want to trigger closest parent, not itself
  const elementWithAction = currentTarget.parentNode.closest("[data-action]");
  if (!elementWithAction) {
    console.warn(
      "submit event triggered but no element with [data-action] found in event path",
      e,
    );
    return false;
  }
  let requester = target;
  const { form } = target;
  // when present, we use first button submitting the form as the requester
  // not the input, it aligns with browser behavior where
  // hitting Enter in a text input triggers the first submit button of the form, not the input itself
  const firstButtonSubmitting = elementWithAction.querySelector(
    `button[type="submit"], input[type="submit"], input[type="image"], [data-action="submit"]`,
  );
  if (firstButtonSubmitting) {
    requester = firstButtonSubmitting;
  }
  const allowed = dispatchRequestAction(elementWithAction, {
    event: e,
    requester,
  });
  if (form) {
    // prevent form submission when cliking buttons or pressing enter on inputs
    e.preventDefault();
  }
  return allowed;
};

const submit = createUICallback({
  name: "submit",
  event: (e) => requestClosestAction(e),
  action: (_, { event }) => {
    return requestClosestAction(event);
  },
});

const requestClose = (event, { cancel = false } = {}) => {
  const currentTarget = event.currentTarget;
  const expandableEl = currentTarget.closest("[aria-expanded]");
  if (!expandableEl) {
    console.warn(
      "close action triggered but no element with [aria-expanded] found in event path",
      event,
    );
    return false;
  }
  return dispatchCustomEvent(expandableEl, "navi_request_close", {
    event,
    cancel,
  });
};
const close = createUICallback({
  name: "close",
  event: (e) => {
    return requestClose(e);
  },
  action: (_, { event }) => {
    return requestClose(event);
  },
});
const cancel = createUICallback({
  name: "cancel",
  event: (e) => {
    return requestClose(e, { cancel: true });
  },
  action: (_, { event }) => {
    return requestClose(event, { cancel: true });
  },
});

const STRING_ACTIONS = {
  submit,
  close,
  cancel,
};
