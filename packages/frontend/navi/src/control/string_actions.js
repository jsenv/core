import { dispatchCustomEvent } from "@jsenv/dom";

import { getParentControl } from "./control_dom.js";
import { createUICallback } from "./ui_callback.js";
import { dispatchRequestSetUIState } from "./ui_state_controller.js";
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

const requestUpdate = (event, value) => {
  const currentTarget = event.currentTarget;
  const parentControl = getParentControl(currentTarget);
  if (!parentControl) {
    console.warn(
      "update triggered but no element with [navi-control] found in event path",
      event,
    );
    return false;
  }
  return dispatchRequestSetUIState(parentControl, value, { event });
};
/**
 * Updates the UI state of the closest ancestor field with the current value.
 * Use inside a custom picker popup on an input so the parent picker reflects
 * what is being typed/selected before the popup closes.
 *
 * @example
 * <Input type="text" action="update" />
 */
const update = createUICallback({
  name: "update",
  action: (value, { event }) => {
    return requestUpdate(event, value);
  },
});

const requestClosestAction = (event) => {
  const currentTarget = event.currentTarget;
  const target = event.target;
  // some element (like list) can have their own action, we want to trigger closest parent, not itself
  const elementWithAction = currentTarget.parentNode.closest("[data-action]");
  if (!elementWithAction) {
    console.warn(
      "submit event triggered but no element with [data-action] found in event path",
      event,
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
    event,
    requester,
  });
  if (form) {
    // prevent form submission when cliking buttons or pressing enter on inputs
    event.preventDefault();
  }
  return allowed;
};
/**
 * Triggers the action of the closest ancestor field.
 * Equivalent to clicking the first submit button of a form.
 * Use on a `<Button>` inside a field or form to confirm the current value.
 *
 * @example
 * <Button action="submit">Confirm</Button>
 */
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
/**
 * Clears the value of the closest ancestor field then closes the popup.
 * Combines `update('')` + `close` in one action.
 *
 * @example
 * <Button action="clear">Clear</Button>
 */
const clear = createUICallback({
  name: "clear",
  event: (event) => {
    update("", { event });
    return requestClose(event);
  },
  action: (v, { event }) => {
    update("", { event });
    return requestClose(event);
  },
});
/**
 * Closes the nearest expandable ancestor (the element with `[aria-expanded]`).
 * When used on a button inside a picker popup, closing also triggers the
 * picker's action if the value changed since the popup was opened.
 *
 * @example
 * <Button action="close">Close</Button>
 */
const close = createUICallback({
  name: "close",
  event: (event) => {
    return requestClose(event);
  },
  action: (value, { event }) => {
    return requestClose(event);
  },
});
/**
 * Cancels the current edit and closes the popup without triggering the
 * picker's action. The picker restores the value it had when the popup opened.
 *
 * @example
 * <Button action="cancel">Cancel</Button>
 */
const cancel = createUICallback({
  name: "cancel",
  event: (event) => {
    return requestClose(event, { cancel: true });
  },
  action: (_, { event }) => {
    return requestClose(event, { cancel: true });
  },
});
/**
 * Updates the field value with the current value then closes the popup,
 * combining `update` + `close` in one action. Useful for custom pickers
 * where the inner input value should be committed on close.
 * If the action callback provides no value (`undefined`), the update step
 * is skipped and only the close is performed.
 *
 * @example
 * <Button action="send">Send</Button>
 */
const send = createUICallback({
  name: "send",
  event: (event) => {
    return requestClose(event);
  },
  action: (value, { event }) => {
    if (value !== undefined) {
      requestUpdate(event, value);
    }
    return requestClose(event);
  },
});

export const STRING_ACTIONS = {
  submit,

  update,
  close,
  clear,
  cancel,
  send,
};
