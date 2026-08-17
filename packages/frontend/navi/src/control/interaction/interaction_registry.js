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
 *     long_press: (event) => openMenu(event),
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
 *   would otherwise be a dead end (long_press brings contextmenu). What the
 *   caller declared explicitly always wins.
 * @param {(context: object) => object|null} definition.setup Called on every
 *   render with `{ types, interactions, ref, perform, request, readConfig }`, and
 *   returns props to put on the control host — event handlers, attributes. It
 *   must not call hooks: how many detectors run, and which, follows the caller's
 *   object and changes between two renders.
 *   - `types`: the claimed names actually declared.
 *   - `perform(type, event)`: answer an interaction whose event already exists
 *     (a native one). Returns a promise while something is still going, else null.
 *   - `request(type, detail, originalEvent)`: dispatch the interaction as an event
 *     of its own name, then answer it. Same return, plus null when the dispatch
 *     was prevented.
 *   - `readConfig(attribute, defaultValue)`: a number read off the element or any
 *     ancestor carrying that attribute, so a whole list is tuned in one place.
 */
export const defineInteractionDetector = (definition) => {
  detectors.push(definition);
};

const REQUEST_ACTION = "request_action";
const REQUEST_UI_ACTION = "request_ui_action";

/**
 * The interactions as declared, plus the ones they imply.
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
 * @param {object|null} interactions What `resolveInteractions` returned.
 * @param {object} options
 * @param {{current: Element}} options.ref The element the interactions are read
 *   on: the control host, which is where the click is read too.
 * @param {(event: Event) => object} options.requestAction Asks for the control's
 *   own action, gate included; returns what `watchActionCompletion` returns.
 * @param {(event: Event) => void} options.requestUIAction Asks for a ui action.
 * @param {(event: Event, name: string, allowed: Function) => void} options.requestInteraction
 *   The interaction gate, for an interaction whose effect is a callback of the
 *   caller's.
 * @returns {object|null} props to spread on the control host.
 */
export const useInteractionProps = (
  interactions,
  { ref, requestAction, requestUIAction, requestInteraction },
) => {
  if (!interactions) {
    return null;
  }

  // Answers one interaction, and reports back whether something is still going —
  // a promise, or null for an interaction that is already over. A swipe waits on
  // it before letting the row it pulled out come back.
  const perform = (type, interactionEvent) => {
    const effect = interactions[type];
    if (effect === REQUEST_ACTION) {
      const completion = requestAction(interactionEvent);
      if (!completion || completion.result === false || !completion.isRunning) {
        return null;
      }
      return new Promise((resolve) => {
        completion.whenSettled(resolve);
      });
    }
    if (effect === REQUEST_UI_ACTION) {
      requestUIAction(interactionEvent);
      return null;
    }
    let returnValue;
    requestInteraction(interactionEvent, `interaction "${type}"`, () => {
      returnValue = effect(interactionEvent);
    });
    if (returnValue && typeof returnValue.then === "function") {
      return returnValue;
    }
    return null;
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
