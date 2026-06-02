import { dispatchCustomEvent } from "@jsenv/dom";

import {
  findClosestControlWithAction,
  getParentControl,
} from "./control_dom.js";
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

const scroll = createUICallback({
  name: "scroll",
  event: (e) => {
    return requestScroll(e, () => getActionParam(e));
  },
  action: (value, { event }) => {
    return requestScroll(event, () => value);
  },
});
const requestScroll = (e, getScrollParam) => {
  const scrollTarget = getActionTarget(e, "scroll");
  if (!scrollTarget) {
    return false;
  }
  const param = getScrollParam();
  if (!param) {
    console.warn(
      `scroll action triggered but no action-param specified or returned by getScrollParam callback`,
      e,
    );
    return false;
  }
  return dispatchCustomEvent(scrollTarget, "navi_request_scroll", {
    event: e,
    id: param,
  });
};

const select = createUICallback({
  name: "select",
  event: (e) => {
    return requestSelect(e, () => getActionParam(e));
  },
  action: (value, { event }) => {
    return requestSelect(event, () => value);
  },
});
const unselect = createUICallback({
  name: "unselect",
  event: (e) => {
    return requestUnselect(e, () => getActionParam(e));
  },
  action: (value, { event }) => {
    return requestUnselect(event, () => value);
  },
});
const requestSelect = (e, getSelectParam) => {
  const selectTarget = getActionTarget(e, "select");
  if (!selectTarget) {
    return false;
  }
  const param = getSelectParam();
  if (!param) {
    console.warn(
      `select action triggered but no action-param specified or returned by getSelectParam callback`,
      e,
    );
    return false;
  }
  return dispatchCustomEvent(selectTarget, "navi_request_select", {
    event: e,
    id: param,
  });
};
const requestUnselect = (e, getUnselectParam) => {
  const selectTarget = getActionTarget(e, "select");
  if (!selectTarget) {
    return false;
  }
  const param = getUnselectParam();
  if (!param) {
    console.warn(
      `unselect action triggered but no action-param specified or returned by getSelectParam callback`,
      e,
    );
    return false;
  }
  return dispatchCustomEvent(selectTarget, "navi_request_unselect", {
    event: e,
    id: param,
  });
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
const requestUpdate = (event, value) => {
  const actionTarget = getActionTarget(event);
  if (!actionTarget) {
    return false;
  }
  return dispatchRequestSetUIState(actionTarget, value, { event });
};

/**
 * Submits the closest ancestor field's action.
 * When triggered inside a popup (an element with `[aria-expanded]`), behaves
 * like `send` instead: closes the popup and, if a value is available, updates
 * the parent field with that value before closing.
 *
 * @example
 * <Button action="send">Confirm</Button>
 */
const send = createUICallback({
  name: "send",
  event: (e) => {
    const expandableEl = e.currentTarget.closest("[aria-expanded]");
    if (expandableEl) {
      return requestClose(e);
    }
    return requestClosestAction(e);
  },
  action: (value, { event }) => {
    const expandableEl = event.currentTarget.closest("[aria-expanded]");
    if (expandableEl) {
      if (value !== undefined) {
        requestUpdate(event, value);
      }
      return requestClose(event);
    }
    return requestClosestAction(event);
  },
});
const submitSelector = `button[type="submit"], input[type="submit"], input[type="image"], [data-action="submit"]`;
const requestClosestAction = (event) => {
  const currentTarget = event.currentTarget;
  const target = event.target;
  const controlWithAction = findClosestControlWithAction(currentTarget);
  if (!controlWithAction) {
    console.warn(
      `submit event triggered but no control with [data-action] found in event path`,
      event,
    );
    return false;
  }
  let requester = target;
  if (currentTarget.matches(submitSelector)) {
    requester = currentTarget;
  } else {
    // when present, we use first button submitting the form as the requester
    // not the input, it aligns with browser behavior where
    // hitting Enter in a text input triggers the first submit button of the form, not the input itself
    const firstButtonSubmitting =
      controlWithAction.querySelector(submitSelector);
    if (firstButtonSubmitting) {
      requester = firstButtonSubmitting;
    }
  }
  const allowed = dispatchRequestAction(controlWithAction, {
    event,
    requester,
  });
  const initiator = event.detail ? event.detail.eventChain[0] : event;
  const { form } = currentTarget;
  if (form) {
    // prevent form submission when cliking buttons or pressing enter on inputs
    initiator.preventDefault();
  } else if (initiator.type === "keydown" && initiator.key === "Enter") {
    // prevent triggering click on such button, they are already performing submit
    // (this ensure enter inside a picker won't trigger picker button click)
    initiator.preventDefault();
  }
  return allowed;
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

const getActionTarget = (e, actionName) => {
  const currentTarget = e.currentTarget;
  const actionTargetAttribute = currentTarget.getAttribute("action-target");
  if (actionTargetAttribute) {
    const actionTarget = document.getElementById(actionTargetAttribute);
    if (!actionTarget) {
      console.warn(
        `action-target="${actionTargetAttribute}" specified but no element with that id found in the document`,
        e,
      );
      return null;
    }
    return actionTarget;
  }
  const parentControl = getParentControl(currentTarget);
  if (!parentControl) {
    console.warn(
      `${actionName} triggered but no element with [navi-control] found in event path`,
      e,
    );
    return null;
  }
  return parentControl;
};
const getActionParam = (e) => {
  const currentTarget = e.currentTarget;
  const actionParamAttribute = currentTarget.getAttribute("action-param");
  if (actionParamAttribute) {
    return actionParamAttribute;
  }
  return null;
};

const STRING_ACTIONS = {
  scroll,
  select,
  unselect,
  update,

  send,

  close,
  clear,
  cancel,
};
