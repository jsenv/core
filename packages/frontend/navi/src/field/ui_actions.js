import { createUICallback } from "./ui_callback.js";
import {
  dispatchRequestAction,
  dispatchRequestUIAction,
} from "./validation/custom_constraint_validation.js";

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
    // submitting a form is executing his action
    e.preventDefault(); // prevent form submission for buttons
    return dispatchRequestAction(elementToSubmit, {
      event: e,
    });
  }
  // submitting a picker must:
  // - validate inputs inside the picker
  // - sync picker ui state with field inside the picker
  // - call picker uiAction
  // in turn if the picker has an action has his input value will change the action is executed
  // otherwise input inside picker is now valid and synced, ready to be picked (likely by a form managing multiple fields, including picker(s))
  return dispatchRequestUIAction(elementToSubmit, {
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
