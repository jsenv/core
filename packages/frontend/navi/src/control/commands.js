import { dispatchCustomEvent } from "@jsenv/dom";

import {
  findClosestControlWithAction,
  findControlHost,
  getParentControl,
  isControlRoot,
} from "./control_dom.js";
import {
  dispatchRequestClearUIState,
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "./ui_state_dom.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "./validation/custom_constraint_validation.js";

export const dispatchNaviCommand = (
  element,
  command,
  event,
  { optional } = {},
) => {
  const naviCommand = NAVI_COMMANDS[command];
  if (!naviCommand) {
    console.warn(`Unknown command "${command}"`);
    return false;
  }
  // Check for explicit HTML target overrides early so a misconfigured commandfor
  // attribute (id not found) aborts immediately rather than silently falling back
  // to DOM resolution. Handlers receive this info via resolveExplicitTarget().
  const explicitTarget = resolveExplicitTarget(element);
  if (explicitTarget === null) {
    // attribute was present but target not found — already warned inside resolveExplicitTarget
    return false;
  }
  const execute = naviCommand.commandHandler(element, event);
  if (!execute) {
    if (optional) {
      return false;
    }
    console.warn(
      `"${command}" triggered on element but no suitable target found`,
      element,
    );
    return false;
  }
  const { target, implementation } = execute;
  return dispatchCustomEvent(target, "navi_command", {
    command,
    event,
    source: element,
    implementation,
  });
};
// Returns the target explicitly declared via HTML attributes (commandfor / navi-command-target),
// or undefined when no such attribute is present.
// Returns null when the attribute is present but the target element was not found (already warned).
// Handlers must check for null explicitly — null || fallback() would silently ignore the error.
const resolveExplicitTarget = (element) => {
  const commandFor = element.getAttribute("commandfor");
  if (commandFor) {
    const target = document.getElementById(commandFor);
    if (!target) {
      console.warn(
        `command triggered on element with commandfor="${commandFor}" but no element with that id found`,
        element,
      );
      return null;
    }
    return target;
  }
  const naviCommandTarget = element.getAttribute("navi-command-target");
  if (naviCommandTarget === "parent-control") {
    const target = resolveFirstParentControl(element);
    return target;
  }
  if (naviCommandTarget === "child-control") {
    const target = resolveFirstChildControl(element);

    return target;
  }
  return undefined;
};
const resolvePickerInnerControl = (target) => {
  if (!target.hasAttribute("navi-picker")) {
    return null;
  }
  const content = target.querySelector(".navi_picker_content");
  if (!content) {
    return null;
  }
  return content.querySelector("[navi-control-host]") ?? null;
};
const resolveFirstParentControl = (el) => {
  return getParentControl(el);
};
const resolveFirstChildControl = (el) => {
  let startEl;
  if (isControlRoot(el)) {
    startEl = findControlHost(el);
  } else {
    startEl = el;
  }
  return startEl.querySelector("[navi-control-host]");
};
const resolveClosestExpandable = (el) => {
  return el.closest("[aria-expanded]");
};
const resolveClosestControlWithAction = (el) => {
  return findClosestControlWithAction(el);
};

const resolveCommandValue = (source) => {
  if (source.hasAttribute("command-value")) {
    return source.getAttribute("command-value");
  }
  const value = getUIStateFromElement(source);
  return value;
};

export const onNaviCommand = (e, { debugCommand }) => {
  const { command, event, source, implementation } = e.detail;
  if (typeof command !== "string") {
    console.warn(`navi_command event is missing detail.command`, e);
    return false;
  }
  if (typeof implementation !== "function") {
    console.warn(`navi_command event is missing detail.implementation`, e);
    return false;
  }
  const commandTarget = e.currentTarget;
  debugCommand(
    event,
    `"${command}" triggered on`,
    source,
    `targeting`,
    commandTarget,
  );
  return implementation();
};

const NAVI_COMMANDS = {};
// commandHandler(source, event) → { target, implementation } | undefined
// - Each handler calls resolveExplicitTarget(source) first, then falls back to
//   its own DOM resolution logic (closest expandable, parent control, etc.).
// - Returns undefined when no target can be found — this is a normal outcome for
//   some commands (e.g. --navi-send when the source is outside any navi context).
// - Returns { target, implementation } so dispatchNaviCommand can dispatch navi_command.
const registerNaviCommand = (command, commandHandler) => {
  NAVI_COMMANDS[command] = {
    name: command,
    commandHandler,
    toString: () => command,
  };
};

registerNaviCommand("--navi-update", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      const allowed = dispatchRequestInteraction(
        target,
        event,
        "--navi-update",
      );
      if (!allowed) {
        event.preventDefault();
        return false;
      }
      dispatchRequestSetUIState(target, resolveCommandValue(source), { event });
      const innerControl = resolvePickerInnerControl(target);
      if (innerControl) {
        dispatchRequestSetUIState(innerControl, resolveCommandValue(source), {
          event,
        });
      }
      return true;
    },
  };
});

registerNaviCommand("--navi-send", (source, event) => {
  const target =
    resolveExplicitTarget(source) ||
    resolveClosestExpandable(source) ||
    resolveClosestControlWithAction(source);
  if (!target) {
    return undefined;
  }

  // send inside expandable
  if (target.hasAttribute("aria-expanded")) {
    return {
      target,
      implementation: () => {
        // Skip --navi-update when the picker already has an inner control that
        // manages the picker's value autonomously:
        // - A ControlGroup aggregates all child values and syncs them up via its
        //   own command="--navi-update". Calling --navi-update from the send button
        //   (which has no value) would override the aggregated value.
        // - Any other inner control host (e.g. a plain Input inside the picker
        //   popup) already propagates its value to the picker via its own
        //   command="--navi-update" on every change. Calling it again from the
        //   send button's undefined value would corrupt the picker state.
        const skipUpdate = resolvePickerInnerControl(target) !== null;
        if (!skipUpdate) {
          dispatchNaviCommand(source, "--navi-update", event);
        }
        // The picker's onClose already dispatches the action with the final value.
        // Dispatching again here would fire the action twice.
        dispatchNaviCommand(target, "--navi-close", event);
        return true;
      },
    };
  }

  // send inside a control with action
  const submitSelector = `button[type="submit"], input[type="submit"], input[type="image"], [command="--navi-send"]`;
  return {
    target,
    implementation: () => {
      let requester = source;
      if (!source.matches(submitSelector)) {
        // When present, use the first submit button as the requester, not the input.
        // This aligns with browser behavior where Enter in a text input triggers
        // the first submit button of the form, not the input itself.
        const firstButtonSubmitting = target.querySelector(submitSelector);
        if (firstButtonSubmitting) {
          requester = firstButtonSubmitting;
        }
      }
      const allowed = dispatchRequestAction(target, { event, requester });
      const initiator =
        event.detail && typeof event.detail === "object"
          ? event.detail.eventChain[0]
          : event;
      const { form } = target;
      if (form) {
        // prevent form submission when clicking buttons or pressing enter on inputs
        initiator.preventDefault();
      } else if (initiator.type === "keydown" && initiator.key === "Enter") {
        // prevent triggering click on such button, they are already performing submit
        // (this ensures enter inside a picker won't trigger picker button click)
        initiator.preventDefault();
      }
      return allowed;
    },
  };
});

registerNaviCommand("--navi-open", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveClosestExpandable(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_open", {
        event,
        source,
      });
    },
  };
});
registerNaviCommand("--navi-close", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveClosestExpandable(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_close", {
        event,
        source,
      });
    },
  };
});
registerNaviCommand("--navi-cancel", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveClosestExpandable(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_close", {
        event,
        source,
        isCancel: true,
      });
    },
  };
});
registerNaviCommand("--navi-clear", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  const fromInput = source.closest(`[navi-control="input"]`);

  return {
    target,
    implementation: () => {
      if (fromInput) {
        // clearing input search should not close a popover/dialog
      } else {
        dispatchNaviCommand(source, "--navi-close", event, {
          optional: true,
        });
      }
      const allowed = dispatchRequestInteraction(target, event, "--navi-clear");
      if (!allowed) {
        event.preventDefault();
        return false;
      }
      dispatchRequestClearUIState(target, event);
      const innerControl = resolvePickerInnerControl(target);
      if (innerControl) {
        dispatchRequestClearUIState(innerControl, event);
      }
      return true;
    },
  };
});

registerNaviCommand("--navi-reset", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      const allowed = dispatchRequestInteraction(target, event, "--navi-reset");
      if (!allowed) {
        event.preventDefault();
        return false;
      }
      return dispatchRequestResetUIState(target, event);
    },
  };
});

registerNaviCommand("--navi-scroll", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_scroll", {
        event,
        id: resolveCommandValue(source),
      });
    },
  };
});
registerNaviCommand("--navi-select", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_select", {
        event,
        id: resolveCommandValue(source),
      });
    },
  };
});
registerNaviCommand("--navi-unselect", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_unselect", {
        event,
        id: resolveCommandValue(source),
      });
    },
  };
});
registerNaviCommand("--navi-void", (source) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      // intentional no-op — useful to verify command dispatch in demos and tests
      return true;
    },
  };
});
