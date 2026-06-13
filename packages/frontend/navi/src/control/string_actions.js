import { dispatchCustomEvent } from "@jsenv/dom";

import {
  findClosestControlWithAction,
  findControlRoot,
  getParentControl,
  isControlHost,
} from "./control_dom.js";
import { createUICallback } from "./ui_callback.js";
import { dispatchRequestSetUIState } from "./ui_state_dom.js";
import { dispatchRequestAction } from "./validation/custom_constraint_validation.js";

export const triggerStringAction = (actionName, ...args) => {
  return resolveActionProp(actionName)(...args);
};
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

const getActionTarget = (e) => {
  const currentTarget = e.currentTarget;
  let startEl = currentTarget;
  if (isControlHost(currentTarget)) {
    // mousedown on input host -> start from the control root which have the action-target attribute
    // and can have children
    startEl = findControlRoot(currentTarget);
  }
  const actionTargetAttribute = startEl.getAttribute("action-target");
  if (!actionTargetAttribute) {
    return undefined;
  }
  let actionTarget;
  if (actionTargetAttribute.startsWith("#")) {
    actionTarget = document.getElementById(actionTargetAttribute.slice(1));
  } else {
    actionTarget = startEl.querySelector(actionTargetAttribute);
  }
  if (!actionTarget) {
    console.warn(
      `action-target="${actionTargetAttribute}" specified but no element with that id found in the document`,
      e,
    );
    return undefined;
  }
  return actionTarget;
};
const getClosestExpandable = (e) => {
  return e.currentTarget.closest("[aria-expanded]");
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
  const scrollTarget =
    getActionTarget(e) || getParentControl(e) || e.currentTarget;
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
  const selectTarget =
    getActionTarget(e) || getParentControl(e) || e.currentTarget;
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
  const unselectTarget =
    getActionTarget(e) || getParentControl(e) || e.currentTarget;
  const param = getUnselectParam();
  if (!param) {
    console.warn(
      `unselect action triggered but no action-param specified or returned by getSelectParam callback`,
      e,
    );
    return false;
  }
  return dispatchCustomEvent(unselectTarget, "navi_request_unselect", {
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
  action: (value, { event, actionTarget }) => {
    return requestUpdate(event, value, { actionTarget });
  },
});
const requestUpdate = (event, value, { actionTarget, isClear } = {}) => {
  const updateTarget =
    actionTarget ||
    getActionTarget(event) ||
    getParentControl(event) ||
    event.currentTarget;
  return dispatchRequestSetUIState(updateTarget, value, { event, isClear });
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
    const expandableTarget = getClosestExpandable(e);
    if (expandableTarget) {
      return requestClose(e);
    }
    return requestClosestAction(e);
  },
  action: (value, { event }) => {
    const expandableTarget = getClosestExpandable(event);
    if (expandableTarget) {
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
  event: (event, { actionTarget, skipClose } = {}) => {
    requestUpdate(event, "", { actionTarget, isClear: true });
    if (!skipClose) {
      const expandableEl = event.currentTarget.closest("[aria-expanded]");
      if (expandableEl) {
        return requestClose(event);
      }
    }
    return true;
  },
  action: (v, { event, actionTarget }) => {
    requestUpdate(event, "", { actionTarget, isClear: true });
    const expandableEl = event.currentTarget.closest("[aria-expanded]");
    if (expandableEl) {
      return requestClose(event);
    }
    return true;
  },
});
const open = createUICallback({
  name: "open",
  event: (event, { actionTarget } = {}) => {
    return requestOpen(event, { actionTarget });
  },
  action: (value, { event, actionTarget }) => {
    return requestOpen(event, { actionTarget });
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
  event: (event, { actionTarget } = {}) => {
    return requestClose(event, { actionTarget });
  },
  action: (_, { event, actionTarget }) => {
    return requestClose(event, { actionTarget });
  },
});
const requestOpen = (event, { actionTarget }) => {
  const openTarget =
    actionTarget ||
    getActionTarget(event) ||
    getClosestExpandable(event) ||
    event.currentTarget;

  return dispatchCustomEvent(openTarget, "navi_request_open", {
    event,
  });
};
const requestClose = (event, { isCancel = false } = {}) => {
  const closeTarget =
    getActionTarget(event) ||
    getClosestExpandable(event) ||
    event.currentTarget;

  return dispatchCustomEvent(closeTarget, "navi_request_close", {
    event,
    isCancel,
  });
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

  open,
  close,
  clear,
  cancel,
};
