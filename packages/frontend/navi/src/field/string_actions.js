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
  const target = e.target;
  const elementWithAction = target.closest("[data-action]");
  if (!elementWithAction) {
    console.warn(
      "submit event triggered but no element with [data-action] found in event path",
      e,
    );
    return false;
  }
  let requester = target;
  const { form } = target;
  if (elementWithAction.tagName === "FORM") {
    // when present, we use first button submitting the form as the requester
    // not the input, it aligns with browser behavior where
    // hitting Enter in a text input triggers the first submit button of the form, not the input itself
    const firstButtonSubmittingForm = elementWithAction.querySelector(
      `button[type="submit"], input[type="submit"], input[type="image"], [data-action="submit"]`,
    );
    if (firstButtonSubmittingForm) {
      requester = firstButtonSubmittingForm;
    }
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

export const registerStringAction = (name, uiCallback) => {
  STRING_ACTIONS[name] = uiCallback;
};

const STRING_ACTIONS = {
  submit,
};
