import { dispatchCustomEvent } from "@jsenv/dom";

import {
  findClosestControlWithAction,
  findControlHost,
  getParentControl,
  isControlRoot,
} from "./control_dom.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "./ui_state_dom.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "./validation/custom_constraint_validation.js";

export const dispatchNaviCommand = (element, command, event) => {
  const naviCommand = NAVI_COMMANDS[command];
  if (!naviCommand) {
    console.warn(`Unknown command "${command}"`);
    return false;
  }
  const commandTarget = resolveCommandTarget(element, naviCommand);
  if (!commandTarget) {
    return false;
  }
  return dispatchCustomEvent(commandTarget, "navi_command", {
    command,
    event,
    source: element,
  });
};
const resolveCommandTarget = (elementWithCommand, naviCommand) => {
  const commandFor = elementWithCommand.getAttribute("commandfor");
  if (commandFor) {
    const commandForElement = document.getElementById(commandFor);
    if (!commandForElement) {
      console.warn(
        `${naviCommand} triggered on element with command-for="${commandFor}" but no element with that id found`,
      );
      return undefined;
    }
    return commandForElement;
  }
  const naviCommandTarget = elementWithCommand.getAttribute(
    "navi-command-target",
  );
  const isCommandForParentControl = naviCommandTarget === "parent-control";
  if (isCommandForParentControl) {
    const firstParentControl = getFirstParentControl(elementWithCommand);
    if (!firstParentControl) {
      console.warn(
        `${naviCommand} triggered on element with navi-command-target="parent-control" but no parent control found`,
      );
      return undefined;
    }
    return firstParentControl;
  }
  const isCommandForChildControl = naviCommandTarget === "child-control";
  if (isCommandForChildControl) {
    const firstChildControl = getFirstChildControl(elementWithCommand);
    if (!firstChildControl) {
      console.warn(
        `${naviCommand} triggered on element with navi-command-target="child-control" but no child control found`,
      );
      return undefined;
    }
    return firstChildControl;
  }
  const { resolveTarget } = naviCommand;
  if (resolveTarget) {
    const resolveTargetResult = resolveTarget(elementWithCommand);
    if (!resolveTargetResult) {
      console.warn(
        `${naviCommand} triggered on element but resolveTarget callback returned no target`,
      );
      return undefined;
    }
    return resolveTargetResult;
  }
  return undefined;
};
const getFirstParentControl = (el) => {
  const parentControl = getParentControl(el);
  return parentControl;
};
const getFirstChildControl = (el) => {
  let startEl;
  if (isControlRoot(el)) {
    startEl = findControlHost(el);
  } else {
    startEl = el;
  }
  const childControl = startEl.querySelector("[navi-control-host]");
  return childControl;
};
const getClosestExpandable = (el) => {
  const expandableElement = el.closest("[aria-expanded]");
  return expandableElement;
};
const getClosestControlWithAction = (el) => {
  const controlWithAction = findClosestControlWithAction(el);
  return controlWithAction;
};

export const onNaviCommand = (e, { debugCommand }) => {
  const { command, event, source } = e.detail;
  if (typeof command !== "string") {
    console.warn(`navi_command event is missing detail.command`, e);
    return false;
  }
  const naviCommand = NAVI_COMMANDS[command];
  if (!naviCommand) {
    console.warn(`Unknown command "${command}"`);
    return false;
  }
  const commandTarget = e.currentTarget;
  const { implementation } = naviCommand;
  debugCommand(
    event,
    `${naviCommand} triggered on`,
    source,
    `targeting`,
    commandTarget,
  );
  const result = implementation(commandTarget, { event, source });
  return result;
};

const NAVI_COMMANDS = {};
const registerNaviCommand = (command, { resolveTarget, implementation }) => {
  NAVI_COMMANDS[command] = {
    name: command,
    resolveTarget,
    implementation,
    toString: () => {
      return `${command}`;
    },
  };
};

registerNaviCommand("--navi-update", {
  resolveTarget: getFirstParentControl,
  implementation: (commandTarget, { event, source }) => {
    const allowed = dispatchRequestInteraction(
      commandTarget,
      event,
      "--navi-update",
    );
    if (!allowed) {
      event.preventDefault();
      return false;
    }
    const updateParam = getUIStateFromElement(source);

    return dispatchRequestSetUIState(commandTarget, updateParam, {
      event,
    });
  },
});
const submitSelector = `button[type="submit"], input[type="submit"], input[type="image"], [command="--navi-send"]`;
registerNaviCommand("--navi-send", {
  resolveTarget: getClosestControlWithAction,
  implementation: (commandTarget, { event, source }) => {
    if (source.hasAttribute("navi-control-group")) {
      dispatchNaviCommand(source, "--navi-update", event);
    }
    const closestExpandable = getClosestExpandable(source);
    if (closestExpandable) {
      // The picker's onClose already dispatched the action with the final value.
      // Dispatching again here would fire the action twice.
      dispatchNaviCommand(closestExpandable, "--navi-close", event);
      return true;
    }

    let requester = source;
    if (source.matches(submitSelector)) {
      requester = source;
    } else {
      // when present, we use first button submitting the form as the requester
      // not the input, it aligns with browser behavior where
      // hitting Enter in a text input triggers the first submit button of the form, not the input itself
      const firstButtonSubmitting = commandTarget.querySelector(submitSelector);
      if (firstButtonSubmitting) {
        requester = firstButtonSubmitting;
      }
    }

    const allowed = dispatchRequestAction(commandTarget, {
      event,
      requester,
    });
    const initiator =
      event.detail && typeof event.detail === "object"
        ? event.detail.eventChain[0]
        : event;
    const { form } = commandTarget;
    if (form) {
      // prevent form submission when cliking buttons or pressing enter on inputs
      initiator.preventDefault();
    } else if (initiator.type === "keydown" && initiator.key === "Enter") {
      // prevent triggering click on such button, they are already performing submit
      // (this ensure enter inside a picker won't trigger picker button click)
      initiator.preventDefault();
    }
    return allowed;
  },
});

registerNaviCommand("--navi-open", {
  resolveTarget: getClosestExpandable,
  implementation: (commandTarget, { event, source }) => {
    return dispatchCustomEvent(commandTarget, "navi_request_open", {
      event,
      source,
    });
  },
});
registerNaviCommand("--navi-close", {
  resolveTarget: getClosestExpandable,
  implementation: (commandTarget, { event, source }) => {
    return dispatchCustomEvent(commandTarget, "navi_request_close", {
      event,
      source,
    });
  },
});
registerNaviCommand("--navi-cancel", {
  resolveTarget: getClosestExpandable,
  implementation: (commandTarget, { event, source }) => {
    return dispatchCustomEvent(commandTarget, "navi_request_close", {
      event,
      source,
      isCancel: true,
    });
  },
});
registerNaviCommand("--navi-clear", {
  resolveTarget: getFirstParentControl,
  implementation: (commandTarget, { event, source }) => {
    const fromInput = source.closest(`[navi-control="input"]`);
    if (fromInput) {
      // clearing input search should not close a popover/dialog
    } else {
      dispatchNaviCommand(source, "--navi-close", event);
    }

    const allowed = dispatchRequestInteraction(
      commandTarget,
      event,
      "--navi-clear",
    );
    if (!allowed) {
      event.preventDefault();
      return false;
    }
    return dispatchRequestSetUIState(commandTarget, "", {
      event,
    });
  },
});

registerNaviCommand("--navi-scroll", {
  resolveTarget: getFirstParentControl,
  implementation: (commandTarget, { event, source }) => {
    const scrollParam = getUIStateFromElement(source);

    return dispatchCustomEvent(commandTarget, "navi_request_scroll", {
      event,
      id: scrollParam,
    });
  },
});
registerNaviCommand("--navi-select", {
  resolveTarget: getFirstParentControl,
  implementation: (commandTarget, { event, source }) => {
    const selectParam = getUIStateFromElement(source);

    return dispatchCustomEvent(commandTarget, "navi_request_select", {
      event,
      id: selectParam,
    });
  },
});
registerNaviCommand("--navi-unselect", {
  resolveTarget: getFirstParentControl,
  implementation: (commandTarget, { event, source }) => {
    const unselectParam = getUIStateFromElement(source);

    return dispatchCustomEvent(commandTarget, "navi_request_unselect", {
      event,
      id: unselectParam,
    });
  },
});
