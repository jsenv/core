import { createUICallback } from "./ui_callback.js";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const normalizeUIAction = (uiAction) => {
  if (typeof uiAction === "string") {
    const naviUIAction = UI_ACTIONS[uiAction];
    if (!naviUIAction) {
      throw new Error(`Unknown uiAction "${uiAction}"`);
    }
    return naviUIAction;
  }
  return uiAction;
};

const submitFromEvent = (e) => {
  const elementToSubmit = e.currentTarget.closest("[data-can-submit]");
  if (!elementToSubmit) {
    return false;
  }
  if (elementToSubmit.tagName === "FORM") {
    e.preventDefault(); // prevent form submission for buttons
    return dispatchRequestAction(elementToSubmit, {
      event: e,
    });
  }
  return dispatchRequestAction(elementToSubmit, {
    event: e,
  });
};

const submit = createUICallback({
  name: "submit",
  event: (e) => submitFromEvent(e),
  uiAction: (v_, e) => {
    return submitFromEvent(e);
  },
});

const UI_ACTIONS = {
  submit,
};
