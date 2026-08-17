/**
 * `interactions`: which interactions a control answers, and with what.
 *
 * `action` stays what it always was — the work, wired to whatever asking for it
 * naturally means for that control (a click on a button, a change on a field).
 * `interactions` is the other half: the interactions that are NOT that natural
 * one, named, each said to do one of three things.
 *
 *   interactions={{
 *     swipe_left: "request_action",       // ask for the action prop
 *     swipe_right: "request_ui_action",   // ask for a ui action
 *     longpress: (event) => openMenu(event),
 *     "keyboard:ctrl+backspace": "request_action",
 *   }}
 *
 * An interaction that asks for the action does not say WHICH work: the action is
 * one, and it reads which interaction asked from the event it already receives.
 *
 *   action={(value, { event }) => {
 *     const swipe = findEvent(event, "swipe_left");
 *     if (swipe) { … }
 *   }}
 *
 * Everything goes through the interaction gate, so a disabled, read-only or busy
 * control answers a swipe the way it answers a click: it says why, where the
 * interaction happened, and nothing runs.
 *
 * WHAT AN INTERACTION IS, HERE
 *
 * A name, and something that knows when it happened. Some names are the browser's
 * own events (`click`, `mousedown`, `contextmenu`); the rest are interactions the
 * browser has no event for, and something has to read them from lower-level ones.
 * That something is a DETECTOR, and this module holds no detector of its own —
 * navi registers its own through `defineInteractionDetector` exactly like an
 * application does (see interaction_native.js, interaction_press.js,
 * interaction_keyboard.js). So an application that needs an interaction navi does
 * not have registers it the same way, and its name then works in `interactions`
 * like any other.
 *
 * A detector claims a SET of names rather than one, because interactions that
 * share an input have to be arbitrated together: a swipe, a long press and a
 * click dispute the same press, and read apart they walk over each other.
 *
 * An interaction navi makes is DISPATCHED as an event of its own name — bubbling
 * and cancelable, like any other. That is what puts it in the event chain the
 * action receives, what lets anything around the control listen for one, and what
 * gives a caller the usual way to say "not this time" (`preventDefault`).
 */

import { chainEvent } from "@jsenv/dom";

import { findNearestControlHost } from "../control_dom.js";
import {
  dispatchRequestAction,
  watchActionCompletion,
} from "../rules/control_action.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";

const detectors = [];

/**
 * Registers something that knows when an interaction happened.
 *
 * @param {object} definition
 * @param {string} definition.name For debugging and for the message a name
 *   nothing claims produces.
 * @param {(type: string) => boolean} definition.claims Whether this detector
 *   reads that interaction name.
 * @param {(claimedTypes: string[], interactions: object) => object|null} [definition.implies]
 *   Interactions that come with the ones declared, for a detector whose gesture
 *   only makes sense alongside another. What the caller declared explicitly always
 *   wins.
 * @param {(context: object) => object|null} definition.setup Called on every
 *   render with `{ types, interactions, ref, state, perform, request, readConfig }`,
 *   and returns props to put on the element — event handlers, attributes. It must
 *   not call hooks: how many detectors run, and which, follows the caller's object
 *   and changes between two renders.
 *   - `types`: the claimed names actually declared.
 *   - `state`: an object of this detector's own, the SAME one across renders of
 *     that element. Anything counted between two events (how many clicks so far,
 *     a pending timeout) has to live here: `setup` runs again on every render, so
 *     a closure variable would go back to its initial value under a component
 *     that re-rendered mid-gesture — which is most of them, since answering an
 *     interaction usually changes something.
 *   - `perform(type, event)`: answer an interaction whose event already exists
 *     (a native one). Returns null when nothing ran (the gate refused, no control
 *     to ask), else a promise: resolved once the effect worked, rejected when it
 *     did not. "Nothing ran" and "ran and failed" are different answers — a row
 *     pulled out comes back either way, something thrown away only comes back if
 *     the throw failed.
 *   - `request(type, detail, originalEvent)`: dispatch the interaction as an event
 *     of its own name, then answer it. Same return, plus null when the dispatch
 *     was prevented.
 *   - `readConfig(attribute, defaultValue)`: a number read off the element or any
 *     ancestor carrying that attribute, so a whole list is tuned in one place.
 */
export const defineInteractionDetector = (definition) => {
  detectors.push(definition);
};

// Keyed by the element's ref rather than by the element: it is stable from the
// first render, while the element itself only exists from the first mount, and a
// detector is set up before that.
const stateByRef = new WeakMap();
const getDetectorState = (ref, detectorName) => {
  let stateByDetectorName = stateByRef.get(ref);
  if (!stateByDetectorName) {
    stateByDetectorName = new Map();
    stateByRef.set(ref, stateByDetectorName);
  }
  let state = stateByDetectorName.get(detectorName);
  if (!state) {
    state = {};
    stateByDetectorName.set(detectorName, state);
  }
  return state;
};

const REQUEST_ACTION = "request_action";
const REQUEST_UI_ACTION = "request_ui_action";

/**
 * The interactions as declared, plus the ones they imply, minus the ones turned
 * off.
 *
 * A falsy effect means "not this one", so an interaction can be declared under a
 * condition — `{ swipe_right: canArchive && archive }` — without the caller
 * having to build the object in two steps.
 */
export const resolveInteractions = (interactions) => {
  if (!interactions) {
    return null;
  }
  let resolved = interactions;
  for (const detector of detectors) {
    if (!detector.implies) {
      continue;
    }
    const claimedTypes = Object.keys(resolved).filter(detector.claims);
    if (claimedTypes.length === 0) {
      continue;
    }
    const implied = detector.implies(claimedTypes, resolved);
    if (implied) {
      // Declared last so it wins: an implication is a default, and a caller who
      // said what that interaction does has already answered.
      resolved = { ...implied, ...resolved };
    }
  }
  const kept = {};
  for (const type of Object.keys(resolved)) {
    if (resolved[type]) {
      kept[type] = resolved[type];
    }
  }
  resolved = kept;
  if (Object.keys(resolved).length === 0) {
    return null;
  }
  if (import.meta.dev) {
    for (const type of Object.keys(resolved)) {
      if (detectors.some((detector) => detector.claims(type))) {
        continue;
      }
      console.warn(
        `interactions: nothing knows how to detect "${type}". Register a detector for it with defineInteractionDetector, or use one of the interactions navi detects (${detectors.map((detector) => detector.name).join(", ")}).`,
      );
    }
  }
  return resolved;
};

/**
 * Reads the interactions declared on a control and returns the props that make
 * them happen.
 *
 * The control is not passed in: it is found from the element, which is what lets
 * `interactions` live on a Box rather than on the control itself. A Box that IS a
 * control (a Button) is its own; a Box around one or inside one reaches it; a Box
 * with no control anywhere near it can still answer with a callback of the
 * caller's, and only "request_action" has nothing to ask.
 *
 * @param {object|null} interactions What `resolveInteractions` returned.
 * @param {object} options
 * @param {{current: Element}} options.ref The element the interactions are read
 *   on, and the one that moves under a swipe.
 * @returns {object|null} props to spread on that element.
 */
export const useInteractionProps = (interactions, { ref }) => {
  if (!interactions) {
    return null;
  }

  // Answers one interaction, and reports back what became of it:
  // - null when nothing ran at all — the gate refused, there was no control to
  //   ask, the interaction was prevented;
  // - a promise otherwise, resolved once the effect worked and REJECTED when it
  //   did not (an error, an abort). "Nothing ran" and "ran and failed" have to be
  //   told apart: what a detector does about them is not the same — a row pulled
  //   out comes back either way, but something thrown away only comes back if the
  //   throw failed.
  const perform = (type, interactionEvent) => {
    const element = ref.current;
    if (!element) {
      return null;
    }
    const effect = interactions[type];
    const controlHost = findNearestControlHost(element);
    const name = `interaction "${type}"`;
    if (effect === REQUEST_ACTION) {
      if (!controlHost) {
        if (import.meta.dev) {
          console.warn(
            `interactions: "${type}" asks for an action, but there is no control around it to ask. Put the interaction on a control (or on a box that holds one), or give it a callback.`,
          );
        }
        return null;
      }
      // "auto" rather than an action of our own: which action this is belongs to
      // the control, and it resolves it to whatever its `action` prop bound (see
      // onnavi_action_allowed).
      const completion = watchActionCompletion(controlHost, () =>
        dispatchRequestAction(controlHost, {
          event: interactionEvent,
          name,
          action: "auto",
          requester: controlHost,
        }),
      );
      if (completion.result === false) {
        // The gate turned the request down and has said why where it happened.
        return null;
      }
      if (!completion.isRunning) {
        // Synchronous: it is already done, and done is not the same as refused.
        return settled(Promise.resolve());
      }
      return settled(
        new Promise((resolve, reject) => {
          completion.whenSettled((outcome) => {
            if (outcome.error) {
              reject(outcome.error);
            } else if (outcome.aborted) {
              reject(new Error(`aborted: ${outcome.reason}`));
            } else {
              resolve(outcome.data);
            }
          });
        }),
      );
    }
    if (effect === REQUEST_UI_ACTION) {
      if (!controlHost) {
        if (import.meta.dev) {
          console.warn(
            `interactions: "${type}" asks for a ui action, but there is no control around it to ask.`,
          );
        }
        return null;
      }
      // The value it already holds, set again: a ui action is what says the user
      // acted, and everything listening for one (a command, a group above) hears
      // it whether or not the value moved.
      let allowed = false;
      dispatchRequestInteraction(controlHost, {
        event: interactionEvent,
        name,
        allowed: () => {
          allowed = true;
          dispatchRequestSetUIState(
            controlHost,
            getUIStateFromElement(controlHost),
            { event: interactionEvent },
          );
        },
      });
      return allowed ? settled(Promise.resolve()) : null;
    }
    let ran = false;
    let returnValue;
    const run = () => {
      ran = true;
      returnValue = effect(interactionEvent);
    };
    if (controlHost) {
      // Through the gate even for a callback of the caller's: a disabled or
      // read-only control must answer a swipe the way it answers a click, and it
      // is the control that knows it is.
      dispatchRequestInteraction(controlHost, {
        event: interactionEvent,
        name,
        allowed: run,
      });
    } else {
      run();
    }
    if (!ran) {
      return null;
    }
    if (returnValue && typeof returnValue.then === "function") {
      return settled(returnValue);
    }
    return settled(Promise.resolve(returnValue));
  };

  const request = (type, detail, originalEvent) => {
    const element = ref.current;
    if (!element) {
      return null;
    }
    const interactionEvent = new CustomEvent(type, {
      detail: { ...detail, event: originalEvent },
      bubbles: true,
      cancelable: true,
    });
    // The event the interaction was read from stays reachable from it:
    // `findEvent(actionEvent, "pointerdown")` still finds the press a swipe was
    // made of.
    chainEvent(interactionEvent, originalEvent);
    if (!element.dispatchEvent(interactionEvent)) {
      return null;
    }
    return perform(type, interactionEvent);
  };

  // A rejection nobody is listening for is a console warning about something
  // already reported where it happened (a validation message on the control). The
  // promise handed out keeps rejecting — a detector that has something to undo
  // needs to hear it — but it is no longer "unhandled".
  const settled = (promise) => {
    promise.catch(() => {});
    return promise;
  };

  const readConfig = (attribute, defaultValue) => {
    const element = ref.current;
    const holder = element?.closest(`[${attribute}]`);
    if (!holder) {
      return defaultValue;
    }
    const value = parseFloat(holder.getAttribute(attribute));
    if (isNaN(value)) {
      return defaultValue;
    }
    return value;
  };

  const interactionProps = {};
  for (const detector of detectors) {
    const types = Object.keys(interactions).filter(detector.claims);
    if (types.length === 0) {
      continue;
    }
    const detectorProps = detector.setup({
      types,
      interactions,
      ref,
      state: getDetectorState(ref, detector.name),
      perform,
      request,
      readConfig,
    });
    if (detectorProps) {
      mergeInteractionProps(interactionProps, detectorProps, detector.name);
    }
  }
  return interactionProps;
};

// Two detectors can want the same event: a shortcut and something else both read
// keydown. Both are called, in the order they were registered.
const mergeInteractionProps = (target, source, detectorName) => {
  for (const key of Object.keys(source)) {
    const existing = target[key];
    const added = source[key];
    if (typeof existing === "function" && typeof added === "function") {
      target[key] = (...args) => {
        existing(...args);
        added(...args);
      };
      continue;
    }
    if (import.meta.dev && existing !== undefined && existing !== added) {
      console.warn(
        `interactions: detector "${detectorName}" sets "${key}" to a value another detector already set. The last one wins.`,
      );
    }
    target[key] = added;
  }
};
