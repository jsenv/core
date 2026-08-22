import { chainEvent, dispatchCustomEvent } from "@jsenv/dom";

import {
  getConfirmParams,
  requestConfirmation,
  suspendConfirmParams,
} from "../action/confirm.js";
import { navTo } from "../nav/browser_integration/browser_integration.js";
import {
  findClosestControlWithAction,
  findControlHost,
  getParentControl,
  isControlRoot,
} from "./control_dom.js";
import { readControlValue } from "./control_value.js";
import {
  dispatchRequestAction,
  watchActionCompletion,
} from "./rules/control_action.js";
import { dispatchRequestInteraction } from "./rules/control_interaction.js";
import {
  dispatchRequestClearUIState,
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "./ui_state_dom.js";

/**
 * @param {Element} element The element asking — the command's source, and the
 *   anchor a popup opens on unless `anchor` says otherwise.
 * @param {string} command
 * @param {Event} event What the user did.
 * @param {object} [options]
 * @param {boolean} [options.optional] No suitable target is not a warning.
 * @param {any} [options.value] What the command is about, carried to whoever
 *   answers — and, for `--navi-open`/`--navi-toggle`, what the popup is opened
 *   ON: it reaches its `onOpen` before the popup builds anything. Left out, a
 *   source's own value (`<Button value={id}>`) is read instead.
 * @param {Element} [options.anchor] Where a popup this opens should be placed,
 *   when that is not the element asking: a menu opened by a press belongs at the
 *   point the press happened, and the row that was pressed is not that point.
 */
export const triggerNaviCommand = (
  element,
  command,
  event,
  { optional, value, anchor } = {},
) => {
  const naviCommand =
    NAVI_COMMANDS[command] || NAVI_COMMANDS[commandName(command)];
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
  const execute = naviCommand.commandHandler(element, event, {
    // Whatever followed the colon: "--navi-go-to-slide:edit" → "edit".
    argument: command.includes(":") ? commandArgument(command) : undefined,
    anchor,
    // What the command is about, said by the caller rather than read off the
    // source: the attribute form has a `value` to read (`<Button value={id}>`),
    // a JS decision has none, and both must be able to say the same thing.
    value,
  });
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
    value,
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
// An element carrying navi-command-proxy-for="anchorId" stands in for that
// other element as the command's source when the source is forwarded to
// consumers (e.g. Popover reads a --navi-toggle/--navi-open request's source
// as its anchor) — useful for a trigger button that should open a popover
// anchored to some other, unrelated element rather than to itself.
const resolveCommandProxySource = (element) => {
  const proxyForId = element.getAttribute("navi-command-proxy-for");
  if (!proxyForId) {
    return element;
  }
  const proxyTarget = document.getElementById(proxyForId);
  if (!proxyTarget) {
    console.warn(
      `navi-command-proxy-for="${proxyForId}" but no element with that id found`,
      element,
    );
    return element;
  }
  return proxyTarget;
};
const resolveClosestControlWithAction = (el) => {
  return findClosestControlWithAction(el);
};
// Both can enclose the send's source: a form inside a dialog is a control with
// an action, inside an expandable. The nearer one owns the send — a button
// inside that form means "submit this form", not "confirm the dialog around
// it", and the same button placed directly in the dialog means the opposite.
const resolveClosestSendTarget = (expandable, controlWithAction) => {
  if (!expandable || !controlWithAction) {
    return expandable || controlWithAction;
  }
  return expandable.contains(controlWithAction)
    ? controlWithAction
    : expandable;
};

const resolveCommandValue = (source, event) => {
  if (
    // event.detail can be a number for some native events
    event.detail &&
    typeof event.detail === "object" &&
    Object.hasOwn(event.detail, "value")
  ) {
    return event.detail.value;
  }
  if (source.hasAttribute("command-value")) {
    return source.getAttribute("command-value");
  }
  if (source.type === "radio" || source.type === "checkbox") {
    // Use readControlValue so that radio/checkbox sources return their `value`
    // attribute (e.g. "Cherry") rather than the boolean checked state (true).
    // getUIStateFromElement would return true for a checked radio, which is
    // wrong when the command needs to propagate the selected item's identity.
    return readControlValue(source);
  }
  // What the SOURCE says, not what the control around it holds. A button with
  // no value of its own inherits one from the control it sits in — right for
  // `--navi-send` ("send what is around me"), wrong for a travel: a "+" button
  // inside a picker would say the travel is about the entry that picker has
  // selected, and the screen it opens would prefill a new entry with it.
  return getUIStateFromElement(source, { own: true });
};

export const onNaviCommand = (e, { debugCommand = () => {} } = {}) => {
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
  // Timed once, for the wheel-in-dialog "Définir feels frozen on mobile" case;
  // the line is gone now that the answer is known — a command that runs in 1ms
  // said nothing, and it said it on every single interaction.
  return implementation();
};

const NAVI_COMMANDS = {};
// commandHandler(source, event) → { target, implementation } | undefined
// - Each handler calls resolveExplicitTarget(source) first, then falls back to
//   its own DOM resolution logic (closest expandable, parent control, etc.).
// - Returns undefined when no target can be found — this is a normal outcome for
//   some commands (e.g. --navi-send when the source is outside any navi context).
// - Returns { target, implementation } so dispatchNaviCommand can dispatch navi_command.
// A command can carry an argument of its own, after a colon:
// "--navi-go-to-slide:edit" is the go-to-slide command, told where to go. It is
// part of the command because it says WHAT the command does — where a `value`
// says what it is about, and a source needs to be able to say both.
const commandName = (command) => command.split(":")[0];
const commandArgument = (command) => command.slice(command.indexOf(":") + 1);

const registerNaviCommand = (command, commandHandler) => {
  NAVI_COMMANDS[command] = {
    name: command,
    commandHandler,
    toString: () => command,
  };
};

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

registerNaviCommand("--navi-update", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      dispatchRequestInteraction(target, {
        event,
        name: "--navi-update",
        prevented: () => event.preventDefault(),
        allowed: () => {
          const commandValue = resolveCommandValue(source, event);
          dispatchRequestSetUIState(target, commandValue, {
            event,
          });
        },
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
  // A control that commits on an explicit send — a picker, whose list sends the
  // moment a value is chosen — has nothing that would commit a clear: its
  // action never runs on a ui state change. Left alone, the field goes empty
  // while the caller still holds the value it gave, and renders it right back.
  //
  // Unless the source committed the clear itself: a clear button given its own
  // action (`<Button action={remove} command="--navi-clear">`) already made the
  // request — the ui state is being brought in line with what just happened, and
  // sending the picker's own action on top would ask twice.
  const sourceController = source.__uiStateController__;
  const fromSendOnlyControl = Boolean(
    source.closest?.(`[navi-control=picker]`) &&
    !sourceController?.props.action,
  );

  const performClear = (clearEvent) => {
    dispatchRequestInteraction(target, {
      event: clearEvent,
      name: "--navi-clear",
      prevented: () => clearEvent.preventDefault(),
      allowed: () => {
        // What the control holds, before it holds nothing: the clear is
        // optimistic — the field empties now and the send that commits it may
        // still fail — so what it emptied has to be kept to be put back.
        const uiStateBefore = getUIStateFromElement(target);
        dispatchRequestClearUIState(target, clearEvent);
        if (!fromSendOnlyControl) {
          return;
        }
        // After the clear, never before: the action is bound to the ui
        // state signal, so this sends the value the control now holds.
        const actionHost = findControlHost(target) || target;
        const completion = watchActionCompletion(actionHost, () => {
          triggerNaviCommand(source, "--navi-send", clearEvent, {
            optional: true,
          });
        });
        completion.whenSettled(({ error, aborted }) => {
          if (!error && !aborted) {
            return;
          }
          // The removal did not happen, so the field must stop saying it did.
          // The error itself stays where the action put it — on the control,
          // which is still there, unlike the cross that has just gone with the
          // value it cleared (see addErrorMessage in use_execute_action.js).
          //
          // Put back from the inside ("clear_rollback" is an internal event
          // type, see ui_state_controller.js) rather than asked for the way a
          // user would: nobody acted, the control is being returned to the
          // state its caller still holds. Asked from the outside it would be
          // answered with "this element is busy" — the action is still
          // settling — over the very error that explains why the value is back.
          const controller = actionHost.__uiStateController__;
          if (!controller) {
            return;
          }
          const rollbackEvent = new CustomEvent("clear_rollback", {
            detail: {},
          });
          chainEvent(rollbackEvent, clearEvent);
          controller.setUIState(uiStateBefore, rollbackEvent);
        });
      },
    });

    if (fromInput) {
      // clearing input search should not close a popover/dialog
    } else if (
      // Only what is open: the clear cross of a picker sits on the closed
      // trigger, and asking that trigger to close is asking it to do nothing —
      // except that the ask goes through the interaction gate, which turns it
      // down while the clear it just sent is still running and says so out loud
      // ("this element is busy"). A clear pressed INSIDE an open popup is the
      // one this is for: it answers the popup, so the popup goes away.
      resolveClosestExpandable(source)?.getAttribute("aria-expanded") === "true"
    ) {
      triggerNaviCommand(source, "--navi-close", clearEvent, {
        optional: true,
      });
    }
  };

  return {
    target,
    implementation: () => {
      // "Are you sure?" comes before anything is cleared. It is asked here
      // rather than by the action the clear ends up sending (which is where a
      // confirmation is normally asked, see use_execute_action) because that
      // one only runs AFTER the ui state was emptied: the field would go blank
      // behind the question, and answering "no" would leave it blank over a
      // value that was never removed.
      const confirmParams = getConfirmParams(source);
      if (!confirmParams) {
        performClear(event);
        return;
      }
      requestConfirmation({
        ...confirmParams,
        anchor: source,
      }).then((confirmed) => {
        if (!confirmed) {
          return;
        }
        // A new event, chained to the press: the press itself is over and has
        // been consumed — the control that took the click cancelled it on its
        // way out so the region around it would not read it as "unfold me" (see
        // click_to_expand.js), and navi refuses an interaction on a cancelled
        // event. What happens now happens BECAUSE of that press, which is what
        // the chain says, but it is no longer that press.
        const clearConfirmedEvent = new CustomEvent("navi_clear_confirmed", {
          detail: {},
        });
        chainEvent(clearConfirmedEvent, event);
        // Answered — and the send that follows must not ask it again: it reads
        // the same question off this same element (getConfirmParams(requester)).
        const restoreConfirmParams = suspendConfirmParams(source);
        try {
          performClear(clearConfirmedEvent);
        } finally {
          restoreConfirmParams();
        }
      });
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
      dispatchRequestInteraction(target, {
        event,
        name: "--navi-reset",
        prevented: () => event.preventDefault(),
        allowed: () => dispatchRequestResetUIState(target, event),
      });
    },
  };
});
/**
 * What a successful send does once the value is committed. The control says it
 * (`command` on a Form, kept in the DOM as data-after-send), and when it says
 * nothing the surface above it decides:
 * - a slide: it is told the step is done (`--navi-done`) and decides for itself
 *   what that means — what a finished step does to the walk is the slide's
 *   business, not the form's;
 * - an open popup: it closes. The popup was there for the duration of one
 *   decision, and the send just made it. A picker already does this when the
 *   send targets the popup itself (executeNaviDefine); a form inside one is the
 *   same act, a level down. A popup opened from another popup answers for
 *   itself only — say `data-after-send="--navi-send"` on the sending control
 *   to make the decision travel up to the surface holding it;
 * - the document: nothing. A form on a page stays where it is.
 */
// What follows a send that went through — and it is asked of the button that
// sent before the form it sent, because a form with two submit buttons has two
// answers: "save" stays, "delete" goes back to the list. Same shape as the
// browser's own formaction/formmethod, and the same shape the action already
// has (it is told which button requested it).
const resolveAfterSend = (target, requester) => {
  const askedForByRequester = requester?.getAttribute?.("data-after-send");
  if (askedForByRequester) {
    return askedForByRequester;
  }
  const askedFor = target.getAttribute?.("data-after-send");
  if (askedFor) {
    return askedFor;
  }
  // From above the target: a popup that IS the send target is handled on its
  // own (see the aria-expanded branch below), and must not answer twice.
  const surface = target.parentElement?.closest(
    `[data-slide], [aria-expanded]`,
  );
  if (!surface) {
    return undefined;
  }
  if (surface.hasAttribute("data-slide")) {
    return "--navi-done";
  }
  if (surface.getAttribute("aria-expanded") === "true") {
    return "--navi-close";
  }
  return undefined;
};

registerNaviCommand("--navi-send", (source, event) => {
  const expandable = resolveClosestExpandable(source);
  const target =
    resolveExplicitTarget(source) ||
    resolveClosestSendTarget(
      expandable,
      resolveClosestControlWithAction(source),
    );
  if (!target) {
    return undefined;
  }
  // What follows a send that went through, decided by where the control lives
  // rather than by what it is: the surface holding it is what the user is
  // looking at, and a decision just taken there is a reason to leave it. The
  // NEAREST surface answers, and only that one — a form inside a slide inside a
  // dialog goes back a slide, it does not also close the dialog.
  // send inside expandable
  if (target.getAttribute("aria-expanded") === "true") {
    return {
      target,
      implementation: () => {
        const result = executeNaviDefine(source, event, target);
        // Only what was explicitly asked for: the surface above a popup is not
        // answered by a decision taken inside it (see resolveAfterSend), so a
        // popup opened from another popup closes alone unless the send says
        // otherwise. Triggered from the target — the popup that just closed no
        // longer holds the source.
        const afterSend =
          source.getAttribute("data-after-send") ||
          target.getAttribute("data-after-send");
        if (afterSend) {
          triggerNaviCommand(target, afterSend, event, { optional: true });
        }
        return result;
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
      // Nothing is committed when a constraint fails, so nothing is decided
      // and the popup must stay open — with the form still in front of the
      // user, showing what it is waiting for.
      let invalid = false;
      // What follows the send is read at the moment it runs, never before it:
      // it depends on the requester (Enter in a field sends through the first
      // submit button, and what follows is that button's answer), and on
      // anything the send itself decided — an action that learned where to go
      // from the response writes it on the form while it runs
      // (data-after-send), and this is what picks it up.
      const runAfterSend = () => {
        const afterSend = resolveAfterSend(target, requester);
        if (!afterSend) {
          return;
        }
        triggerNaviCommand(source, afterSend, event, { optional: true });
      };
      const {
        result: sent,
        isRunning,
        whenSucceeded,
      } = watchActionCompletion(target, () =>
        dispatchRequestAction(target, {
          onInvalid: () => {
            invalid = true;
          },
          event,
          name: "--navi-send",
          always: () => {
            const initiator =
              event.detail && typeof event.detail === "object"
                ? event.detail.eventChain[0]
                : event;
            const { form } = target;
            if (form) {
              // prevent form submission when clicking buttons or pressing enter on inputs
              initiator.preventDefault();
            } else if (
              initiator.type === "keydown" &&
              initiator.key === "Enter"
            ) {
              // prevent triggering click on such button, they are already performing submit
              // (this ensures enter inside a picker won't trigger picker button click)
              initiator.preventDefault();
            }
          },
          requester,
        }),
      );
      if (sent === false || invalid) {
        return sent;
      }
      if (isRunning) {
        // The send is committing but has not finished: leaving now would take
        // the form off the screen mid-submission (a popup closing over its own
        // running action, a slide moving on before it is answered). What
        // follows the send waits for the send to be real.
        whenSucceeded(runAfterSend);
        return sent;
      }
      runAfterSend();
      return sent;
    },
  };
});

// "What I was here for is done" — said to the surface the control lives in, not
// to the screen that should come next. What a finished step does to the walk is
// the slide's own business (mark it answered, move on), the same way closing
// would be the dialog's.
registerNaviCommand("--navi-done", (source, event) => {
  const target =
    resolveExplicitTarget(source) || source.closest("[data-slide]");
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () =>
      dispatchCustomEvent(target, "navi_done", {
        event,
        source: resolveCommandProxySource(source),
      }),
  };
});

// Which slide is shown is the slide container's own business: a button says
// which way to go, not "show the slide with that id" — which is what lets them
// be rearranged without touching what drives them.
//
// A direction, not a step: slides are laid out on a map (see
// slide_container.jsx), and on a map "next" only means something when there is
// a single axis to walk. One vocabulary for both cases beats a second one that
// works half the time.
const registerSlideCommand = (command, dx, dy) => {
  registerNaviCommand(command, (source, event) => {
    const target =
      resolveExplicitTarget(source) || source.closest("[data-slide-container]");
    if (!target) {
      return undefined;
    }
    return {
      target,
      implementation: () =>
        dispatchCustomEvent(target, "navi_slide_move", {
          event,
          dx,
          dy,
          // What the source was worth, carried along: a button that says which
          // entry it is about (value={{ name }}) sends that with the travel, and
          // the slide arriving keeps it — see Slide's own `useSlideValue`. Read
          // the same way every other command reads a value, so a source says it
          // in one way whatever the command.
          value: resolveCommandValue(source, event),
        }),
    };
  });
};
registerSlideCommand("--navi-right", 1, 0);
registerSlideCommand("--navi-left", -1, 0);
registerSlideCommand("--navi-down", 0, 1);
registerSlideCommand("--navi-up", 0, -1);

// A step along a line, and the two ends of it. Said without an axis on purpose:
// a list is a line of items whichever way it is laid out, and a container of
// slides on a single row (or a single column) is one too — so the same four
// commands drive both, and the thing being driven reads them in its own terms.
// A map with two axes cannot answer "next" with a straight face: the four
// directions (--navi-left and friends) are what it is driven by.
//
// Two kinds of target, whichever is nearer: a list walks its items, a slide
// container walks its slides.
const resolveWalkableTarget = (source) =>
  resolveExplicitTarget(source) ||
  source.closest("[navi-selectable], [data-slide-container]");

const registerWalkCommand = (command, goal) => {
  registerNaviCommand(command, (source, event) => {
    const target = resolveWalkableTarget(source);
    if (!target) {
      return undefined;
    }
    const isList = target.hasAttribute("navi-selectable");
    return {
      target,
      implementation: () => {
        if (isList) {
          return dispatchCustomEvent(target, "navi_request_nav", {
            event,
            goal,
          });
        }
        if (goal === "first" || goal === "last") {
          return dispatchCustomEvent(target, "navi_slide_end", {
            event,
            last: goal === "last",
            value: resolveCommandValue(source, event),
          });
        }
        // A line of slides: onwards is to the right, or downwards when that is
        // where they are — which the container decides, not this.
        return dispatchCustomEvent(target, "navi_slide_step", {
          event,
          goal,
          value: resolveCommandValue(source, event),
        });
      },
    };
  });
};
registerWalkCommand("--navi-previous", "previous");
registerWalkCommand("--navi-next", "next");
registerWalkCommand("--navi-first", "first");
registerWalkCommand("--navi-last", "last");

// "Take the thing one is on": choosing the item a list is pointing at, without
// naming it — the keyboard's own Enter, said as a command so a button can offer
// it too.
registerNaviCommand("--navi-activate", (source, event) => {
  const target =
    resolveExplicitTarget(source) || source.closest("[navi-selectable]");
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () =>
      dispatchCustomEvent(target, "navi_request_activate", { event }),
  };
});

// By name, when a direction cannot say it: a screen reached from several
// places, or from one that is not next to it on the map. The name is part of
// the command — `command="--navi-go-to-slide:edit"` — which leaves `value` for
// what every other command uses it for: what this is about. A source needs to
// be able to say both, and it says them in the two places that already mean
// those two things.
registerNaviCommand(
  "--navi-go-to-slide",
  (source, event, { argument } = {}) => {
    const target =
      resolveExplicitTarget(source) || source.closest("[data-slide-container]");
    if (!target) {
      return undefined;
    }
    if (!argument) {
      console.warn(
        `--navi-go-to-slide needs the area to go to: --navi-go-to-slide:my_area`,
        source,
      );
      return undefined;
    }
    return {
      target,
      implementation: () =>
        dispatchCustomEvent(target, "navi_slide_go_to", {
          event,
          area: argument,
          value: resolveCommandValue(source, event),
        }),
    };
  },
);

// Back where one came from — the slide that sent the user here, whichever way
// that was. What "back" means is a fact about the travel, not about the map: a
// screen reached from two places goes back to the one it was reached from, and
// no direction can say that.
registerNaviCommand("--navi-back", (source, event) => {
  const target =
    resolveExplicitTarget(source) || source.closest("[data-slide-container]");
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () =>
      dispatchCustomEvent(target, "navi_slide_back", { event }),
  };
});

// Where a press takes the user. The destination is the command's argument
// because it says WHAT the command does — "--navi-nav-to:/games/42" — which is how
// it can also be what follows a form submission: the form has answered its
// question, and the answer to "what now" is a page.
//
// A destination fixed at the call site, so it is for a page known before the
// send — which is what a form needs, since it must also know where to go when
// the press had nothing to send. A destination the response decides (a
// creation, whose id comes back with it) is the action's own business: it
// navigates itself.
registerNaviCommand("--navi-nav-to", (source, event, { argument }) => {
  if (!argument) {
    console.warn(
      `[navi] "--navi-nav-to" needs a destination: --navi-nav-to:/the/url (relative to the current page, or absolute).`,
    );
    return undefined;
  }
  const target = resolveExplicitTarget(source) || source;
  return {
    target,
    implementation: () => navTo(argument),
  };
});

registerNaviCommand(
  "--navi-toggle",
  (source, event, { anchor, value } = {}) => {
    const target =
      resolveExplicitTarget(source) || resolveClosestExpandable(source);
    if (!target) {
      return undefined;
    }
    return {
      target,
      implementation: () => {
        const isExpanded = target.getAttribute("aria-expanded") === "true";
        const customEventName = isExpanded
          ? "navi_request_close"
          : "navi_request_open";
        return dispatchCustomEvent(target, customEventName, {
          event,
          source: resolveCommandProxySource(source),
          anchor,
          // Same as --navi-open below: the half of the toggle that opens says
          // what it opens ON, and the half that closes carries it too so the
          // popup never has to ask which half it just heard.
          value:
            value === undefined ? resolveCommandValue(source, event) : value,
        });
      },
    };
  },
);
// A popup that edits opens ON something, and the press is the only place that
// knows which one. It says it with `value` — "what this is about", as
// everywhere else — rather than with an argument, which says what the command
// DOES: "open" is already a complete instruction, unlike --navi-go-to-slide.
//   <Button value={radar.id} command="--navi-open" commandfor="radar-dialog">
// The popup is told before it opens — see Dialog/Popover's `onOpen`.
registerNaviCommand("--navi-open", (source, event, { anchor, value } = {}) => {
  const target =
    resolveExplicitTarget(source) || resolveClosestExpandable(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      // The popup reads `anchor` first and falls back to the source (see
      // onnavi_request_open in popover.jsx), so saying nothing keeps the old
      // behaviour: the element asking is the element opened against.
      return dispatchCustomEvent(target, "navi_request_open", {
        event,
        source: resolveCommandProxySource(source),
        anchor,
        value: value === undefined ? resolveCommandValue(source, event) : value,
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
        source: resolveCommandProxySource(source),
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
        source: resolveCommandProxySource(source),
        isCancel: true,
      });
    },
  };
});
// "Yes, do it" — said inside the popup an action's `confirm` opened, by its own
// confirm button or by whatever a caller put there instead (see
// action/confirm_popup.jsx). Its counterpart is --navi-cancel; the difference
// between the two is this event, since both then close the popup, and a popup
// that closes without having said this is the answer "no".
registerNaviCommand("--navi-confirm", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveClosestExpandable(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      const commandSource = resolveCommandProxySource(source);
      dispatchCustomEvent(target, "navi_request_confirm", {
        event,
        source: commandSource,
      });
      return dispatchCustomEvent(target, "navi_request_close", {
        event,
        source: commandSource,
      });
    },
  };
});
registerNaviCommand("--navi-define", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveClosestExpandable(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => executeNaviDefine(source, event, target),
  };
});
const executeNaviDefine = (source, event, target) => {
  // The picker's onClose already dispatches the action with the final value.
  // Dispatching again here would fire the action twice.
  return triggerNaviCommand(target, "--navi-close", event);
};

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
        id: resolveCommandValue(source, event),
      });
    },
  };
});
registerNaviCommand("--navi-check", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_check", {
        event,
      });
    },
  };
});
registerNaviCommand("--navi-uncheck", (source, event) => {
  const target =
    resolveExplicitTarget(source) || resolveFirstParentControl(source);
  if (!target) {
    return undefined;
  }
  return {
    target,
    implementation: () => {
      return dispatchCustomEvent(target, "navi_request_uncheck", {
        event,
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
        id: resolveCommandValue(source, event),
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
        id: resolveCommandValue(source, event),
      });
    },
  };
});
