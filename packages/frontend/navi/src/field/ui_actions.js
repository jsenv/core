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
  const elementWithSubmitEffect = e.currentTarget.closest(
    "[navi-submit-effect]",
  );
  if (!elementWithSubmitEffect) {
    console.warn(
      "submit event triggered but no element with navi-submit-effect found in event path",
      e,
    );
    return false;
  }
  if (elementWithSubmitEffect.tagName === "FORM") {
    e.preventDefault(); // prevent form submission on buttons
  }

  const submitEffect =
    elementWithSubmitEffect.getAttribute("navi-submit-effect");
  if (submitEffect === "request_action") {
    return dispatchRequestAction(elementWithSubmitEffect, {
      event: e,
    });
  }
  if (submitEffect === "request_ui_action") {
    /**
     *  submitting a picker must:
     *  - validate inputs inside the picker
     *  - sync picker ui state with field inside the picker
     *  - call picker uiAction
     *
     * And
     * - if picker has no action prop ->picker own input in sync (ready to be managed by a form when submitted)
     * - otherwise if picker has an action prop -> picker own input value change triggers the action to execute
     */
    return dispatchRequestUIAction(elementWithSubmitEffect, {
      event: e,
    });
  }
  console.warn(
    `Unknown submit effect "${submitEffect}" on element:`,
    elementWithSubmitEffect,
  );
  return false;
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
