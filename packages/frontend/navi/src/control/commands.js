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

export const triggerCommand = (commandName, ...args) => {
  return resolveCommandProp(commandName)(...args);
};
export const resolveCommandProp = (command) => {
  if (typeof command === "string") {
    const naviCommand = NAVI_COMMANDS[command];
    if (!naviCommand) {
      throw new Error(`Unknown navi command "${command}"`);
    }
    return naviCommand;
  }
  return command;
};

const getCommandTarget = (e) => {
  const currentTarget = e.currentTarget;
  let startEl = currentTarget;
  if (isControlHost(currentTarget)) {
    // mousedown on input host -> start from the control root which has the navi-command-target attribute
    startEl = findControlRoot(currentTarget);
  }
  const commandTargetAttribute = startEl.getAttribute("navi-command-target");
  if (!commandTargetAttribute) {
    return undefined;
  }
  if (commandTargetAttribute === "parent") {
    const parent = getParentControl(e);
    if (!parent) {
      console.warn(
        `navi-command-target="parent" specified but no parent control found`,
        e,
      );
    }
    return parent;
  }
  if (commandTargetAttribute === "child") {
    const child = startEl.querySelector("[navi-control-host]");
    if (!child) {
      console.warn(
        `navi-command-target="child" specified but no child control found`,
        e,
      );
    }
    return child;
  }
  let commandTarget;
  if (commandTargetAttribute.startsWith("#")) {
    commandTarget = document.getElementById(commandTargetAttribute.slice(1));
  } else {
    commandTarget = startEl.querySelector(commandTargetAttribute);
  }
  if (!commandTarget) {
    console.warn(
      `navi-command-target="${commandTargetAttribute}" specified but no element found`,
      e,
    );
    return undefined;
  }
  return commandTarget;
};
const getClosestExpandable = (e) => {
  return e.currentTarget.closest("[aria-expanded]");
};

const scroll = createUICallback({
  name: "--navi-scroll",
  event: (e) => {
    return requestScroll(e, () => getCommandParam(e));
  },
  action: (value, { event }) => {
    return requestScroll(event, () => value);
  },
});
const requestScroll = (e, getScrollParam) => {
  const scrollTarget =
    getCommandTarget(e) || getParentControl(e) || e.currentTarget;
  const param = getScrollParam();
  if (!param) {
    console.warn(
      `--navi-scroll command triggered but no command-param specified or returned by getScrollParam callback`,
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
  name: "--navi-select",
  event: (e) => {
    return requestSelect(e, () => getCommandParam(e));
  },
  action: (value, { event }) => {
    return requestSelect(event, () => value);
  },
});
const unselect = createUICallback({
  name: "--navi-unselect",
  event: (e) => {
    return requestUnselect(e, () => getCommandParam(e));
  },
  action: (value, { event }) => {
    return requestUnselect(event, () => value);
  },
});
const requestSelect = (e, getSelectParam) => {
  const selectTarget =
    getCommandTarget(e) || getParentControl(e) || e.currentTarget;
  if (!selectTarget) {
    return false;
  }
  const param = getSelectParam();
  if (!param) {
    console.warn(
      `--navi-select command triggered but no command-param specified or returned by getSelectParam callback`,
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
    getCommandTarget(e) || getParentControl(e) || e.currentTarget;
  const param = getUnselectParam();
  if (!param) {
    console.warn(
      `--navi-unselect command triggered but no command-param specified or returned by getUnselectParam callback`,
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
  name: "--navi-update",
  action: (value, { event, commandTarget }) => {
    return requestUpdate(event, value, { commandTarget });
  },
});
const requestUpdate = (event, value, { commandTarget, isClear } = {}) => {
  const updateTarget =
    commandTarget ||
    getCommandTarget(event) ||
    getParentControl(event) ||
    event.currentTarget;

  return dispatchRequestSetUIState(updateTarget, value, { event, isClear });
};

/**
 * Submits the closest ancestor field's action.
 * When triggered inside a popup (an element with `[aria-expanded]`), behaves
 * like `--navi-send` instead: closes the popup and, if a value is available, updates
 * the parent field with that value before closing.
 *
 * @example
 * <Button command="--navi-send">Confirm</Button>
 */
const send = createUICallback({
  name: "--navi-send",
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
 * Combines `--navi-update('')` + `--navi-close` in one command.
 *
 * @example
 * <Button command="--navi-clear">Clear</Button>
 */
const clear = createUICallback({
  name: "--navi-clear",
  event: (event, { commandTarget, skipClose } = {}) => {
    requestUpdate(event, "", { commandTarget, isClear: true });
    if (!skipClose) {
      const expandableEl = getClosestExpandable(event);
      if (expandableEl) {
        return requestClose(event);
      }
    }
    return true;
  },
  action: (v, { event, commandTarget }) => {
    requestUpdate(event, "", { commandTarget, isClear: true });
    const expandableEl = getClosestExpandable(event);
    if (expandableEl) {
      return requestClose(event);
    }
    return true;
  },
});
const open = createUICallback({
  name: "--navi-open",
  event: (event, { commandTarget } = {}) => {
    return requestOpen(event, { commandTarget });
  },
  action: (value, { event, commandTarget }) => {
    return requestOpen(event, { commandTarget });
  },
});
/**
 * Closes the nearest expandable ancestor (the element with `[aria-expanded]`).
 * When used on a button inside a picker popup, closing also triggers the
 * picker's action if the value changed since the popup was opened.
 *
 * @example
 * <Button command="--navi-close">Close</Button>
 */
const close = createUICallback({
  name: "--navi-close",
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
 * <Button command="--navi-cancel">Cancel</Button>
 */
const cancel = createUICallback({
  name: "--navi-cancel",
  event: (event, { commandTarget } = {}) => {
    return requestClose(event, { commandTarget });
  },
  action: (_, { event, commandTarget }) => {
    return requestClose(event, { commandTarget });
  },
});
const requestOpen = (event, { commandTarget }) => {
  const openTarget =
    commandTarget ||
    getCommandTarget(event) ||
    getClosestExpandable(event) ||
    event.currentTarget;

  return dispatchCustomEvent(openTarget, "navi_request_open", {
    event,
  });
};
const requestClose = (event, { isCancel = false } = {}) => {
  const closeTarget =
    getCommandTarget(event) ||
    getClosestExpandable(event) ||
    event.currentTarget;

  return dispatchCustomEvent(closeTarget, "navi_request_close", {
    event,
    isCancel,
  });
};

const getCommandParam = (e) => {
  const currentTarget = e.currentTarget;
  const commandParamAttribute =
    currentTarget.getAttribute("navi-command-param");
  if (commandParamAttribute) {
    return commandParamAttribute;
  }
  return null;
};

const NAVI_COMMANDS = {
  "--navi-scroll": scroll,
  "--navi-select": select,
  "--navi-unselect": unselect,
  "--navi-update": update,

  "--navi-send": send,

  "--navi-open": open,
  "--navi-close": close,
  "--navi-clear": clear,
  "--navi-cancel": cancel,
};
