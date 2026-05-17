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

  const submitEffect =
    elementWithSubmitEffect.getAttribute("navi-submit-effect");
  if (submitEffect === "request_action") {
    if (elementWithSubmitEffect.tagName === "FORM") {
      e.preventDefault(); // prevent form submission on buttons
    }
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
    return dispatchRequestAction(elementWithSubmitEffect, {
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
  action: (_, { event }) => {
    return submitFromEvent(event);
  },
});

const STRING_ACTIONS = {
  submit,
};
