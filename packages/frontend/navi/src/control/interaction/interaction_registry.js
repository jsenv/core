/**
 * `interactions`: which interactions a control answers, and with what.
 *
 * `action` stays what it always was — the work, wired to whatever asking for it
 * naturally means for that control (a click on a button, a change on a field).
 * `interactions` is the other half: the interactions that are NOT that natural
 * one, named, each said to do one of four things.
 *
 *   interactions={{
 *     swipe_left: "request_action",       // ask for the action prop
 *     swipe_right: "request_ui_action",   // ask for a ui action
 *     longpress: (event) => openMenu(event),
 *     move: "refuse",                     // it would move, and it does not
 *     "keyboard:ctrl+backspace": "request_action",
 *   }}
 *
 * The last one is the odd one: the three others say what the interaction DOES,
 * and "refuse" says it does not happen — the element goes on owning the press it
 * would have taken, so nothing else answers it, and whoever reads the interaction
 * says a refusal in its place (see `isRefused` below, and "refuse" in
 * interaction_drag.js). It is the answer to something that would be a bug read
 * from outside: a thing that stays put under the hand, silently.
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
import { useLayoutEffect } from "preact/hooks";

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
 * @param {(element: Element, trigger: Function, context: object) => (void|Function)} definition.setup
 *   Called ONCE per element, with the element itself, and returns how to undo
 *   whatever it did. Listeners, attributes, anything — it is a plain setup and
 *   teardown, so a detector counts what it needs in its own closure and nothing
 *   here has to hold state on its behalf.
 *
 *     setup: (element, trigger) => {
 *       const onClick = (event) => trigger(event);
 *       element.addEventListener("click", onClick);
 *       return () => {
 *         element.removeEventListener("click", onClick);
 *       };
 *     }
 *
 *   `trigger(type, originalEvent, detail)` says the interaction happened. Called
 *   with a single event — `trigger(event)` — the type is the detector's own, which
 *   only works when exactly one of its names is declared here.
 *
 *   It returns null when NOTHING RAN (the gate refused, no control to ask, the
 *   interaction event was prevented), and otherwise a promise: resolved once the
 *   effect worked, rejected when it did not. Those two answers are different and a
 *   detector usually treats them differently — a row pulled out comes back either
 *   way, something thrown off the screen only comes back if the throw failed.
 *
 *   The third argument carries `{ types, readConfig, isRefused, isDeclared }`: the
 *   claimed names actually declared, a number read off the element or any ancestor
 *   carrying that attribute (so a whole list is tuned in one place), whether an
 *   interaction is currently declared "refuse", and whether a name is declared at
 *   all — including one this detector does not claim, which is how a word two
 *   gestures share ("grab" and "release", told by a drag and by a surface) finds
 *   out which of them it belongs to here. The last two are asked at the moment
 *   they matter and never at setup: what an interaction does is the caller's
 *   latest render, and something is locked and unlocked while its listeners stay
 *   where they are.
 * @param {(type: string) => boolean} [definition.refusable] Whether that
 *   interaction can be declared "refuse" — a detector that answers a refusal has
 *   to say so, or "refuse" reads as an effect nothing runs and the dev warning
 *   below says it.
 * @param {boolean} [definition.disputesPress] Whether this detector's interactions
 *   are still deciding what a press IS while the finger/button is down — the press
 *   belongs to the gesture until it resolves. Said here so that anything acting on
 *   the press itself can step back and wait for the click instead (see
 *   interactionsDisputeThePress).
 */
export const defineInteractionDetector = (definition) => {
  detectors.push(definition);
};

const REQUEST_ACTION = "request_action";
const REQUEST_UI_ACTION = "request_ui_action";
// Not an effect but the absence of one, answered by the detector that reads the
// interaction rather than from here.
const REFUSE = "refuse";

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
      const detector = detectors.find((candidate) => candidate.claims(type));
      if (detector) {
        if (resolved[type] === REFUSE && !detector.refusable?.(type)) {
          console.warn(
            `interactions: "${type}" is declared "refuse", and "${detector.name}" has no refusal to give — it reads the interaction and tells that it happened, which is all it can do. Give "${type}" something to do, or take it off.`,
          );
        }
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
 * Whether the declared interactions are still deciding what the press is.
 *
 * A control that acts on `mousedown` — a picker opening its popup, a button
 * whose action is asked for on the press — answers before anyone knows what the
 * press will become. That is right when nothing else disputes it: the press has
 * only one meaning, so reading it early is only reading it sooner. It is wrong
 * the moment a gesture is declared on the same element: the finger going down is
 * then the beginning of something that may be a drag, a swipe or a hold, and
 * whoever answers on the spot both takes an answer the user never gave and
 * prevents the gesture from ever forming.
 *
 * So this says "the press is disputed, do not read it yet" — and what such a
 * control does then is wait for the `click`, which the browser only delivers if
 * the press stayed a press (the gestures swallow the one they leave behind).
 */
export const interactionsDisputeThePress = (interactions) => {
  if (!interactions) {
    return false;
  }
  for (const type of Object.keys(interactions)) {
    if (!interactions[type]) {
      // Same as resolveInteractions: a falsy effect means "not this one".
      continue;
    }
    for (const detector of detectors) {
      if (detector.disputesPress && detector.claims(type)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Installs the detectors for the interactions declared on an element, and takes
 * them down when they change or when it goes away.
 *
 * The control is not passed in: it is found from the element, which is what lets
 * `interactions` live on a Box rather than on the control itself. A Box that IS a
 * control (a Button) is its own; a Box around one or inside one reaches it; a Box
 * with no control anywhere near it can still answer with a callback of the
 * caller's, and only "request_action" has nothing to ask.
 *
 * Set up once per element rather than on every render, which is what lets a
 * detector be a plain `setup`/teardown pair. So the interactions themselves are
 * read through a ref: what a swipe DOES is the caller's latest render, while WHEN
 * it happens was wired at mount.
 *
 * @param {{current: Element}} ref The element the interactions are read on, and
 *   the one that moves under a swipe.
 * @param {{current: object|null}} interactionsRef What `resolveInteractions`
 *   returned, kept current by the caller.
 */
export const useInteractionsEffect = (ref, interactionsRef) => {
  // Which detectors to install, and under which names — the only thing a change
  // of which has to take everything down and put it back. What each one does can
  // change every render without any of that.
  const names = interactionsRef.current
    ? Object.keys(interactionsRef.current).sort().join(",")
    : "";

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !names) {
      return undefined;
    }
    const interactionsNow = () => interactionsRef.current || {};

    // Answers one interaction, and reports back what became of it: null when
    // nothing ran at all, else a promise that mirrors the effect (see the
    // trigger contract on defineInteractionDetector).
    const perform = (type, interactionEvent) => {
      const effect = interactionsNow()[type];
      if (!effect) {
        return null;
      }
      if (effect === REFUSE) {
        // Nothing to run: a refusal is answered where the interaction is READ —
        // before it happens, which is the only place it can be — so a detector
        // that asked (isRefused) never gets here, and one that did not is told by
        // the dev warning in resolveInteractions.
        return null;
      }
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
        // "auto" rather than an action of our own: which action this is belongs
        // to the control, and it resolves it to whatever its `action` prop bound
        // (see onnavi_action_allowed).
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
          // Synchronous: it is already done, and done is not refused.
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
        // The value it already holds, set again: a ui action is what says the
        // user acted, and everything listening for one (a command, a group
        // above) hears it whether or not the value moved.
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
        // read-only control must answer a swipe the way it answers a click, and
        // it is the control that knows it is.
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

    const cleanups = [];
    for (const detector of detectors) {
      const types = Object.keys(interactionsNow()).filter(detector.claims);
      if (types.length === 0) {
        continue;
      }
      const trigger = (typeOrEvent, originalEvent, detail) => {
        if (typeof typeOrEvent !== "string") {
          // trigger(event): the type is the detector's own, which only makes
          // sense when it has exactly one here.
          if (types.length !== 1) {
            throw new Error(
              `trigger(event) needs a single interaction to be unambiguous, and "${detector.name}" has ${types.length} here (${types.join(", ")}). Name it: trigger(type, event, detail).`,
            );
          }
          return trigger(types[0], typeOrEvent);
        }
        const type = typeOrEvent;
        if (originalEvent?.type === type) {
          // The interaction IS that event — a native one. Dispatching a second
          // event of the same name would be answering the same thing twice.
          return perform(type, originalEvent);
        }
        const interactionEvent = new CustomEvent(type, {
          detail: { ...detail, event: originalEvent },
          bubbles: true,
          cancelable: true,
        });
        // The event the interaction was read from stays reachable from it:
        // `findEvent(actionEvent, "pointerdown")` still finds the press a swipe
        // was made of.
        chainEvent(interactionEvent, originalEvent);
        if (!element.dispatchEvent(interactionEvent)) {
          return null;
        }
        return perform(type, interactionEvent);
      };
      const cleanup = detector.setup(element, trigger, {
        types,
        readConfig: (attribute, defaultValue) =>
          readNumberFromDom(element, attribute, defaultValue),
        isRefused: (type) => interactionsNow()[type] === REFUSE,
        isDeclared: (type) => Boolean(interactionsNow()[type]),
      });
      if (typeof cleanup === "function") {
        cleanups.push(cleanup);
      }
    }
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
    // `names` alone: what a detector DOES is read live off the ref, so a render
    // that changes only that must not take the wiring down and put it back.
  }, [names]);
};

// A rejection nobody is listening for is a console warning about something already
// reported where it happened (a validation message on the control). The promise
// handed out keeps rejecting — a detector that has something to undo needs to hear
// it — but it is no longer "unhandled".
const settled = (promise) => {
  promise.catch(() => {});
  return promise;
};

const readNumberFromDom = (element, attribute, defaultValue) => {
  const holder = element.closest(`[${attribute}]`);
  if (!holder) {
    return defaultValue;
  }
  const value = parseFloat(holder.getAttribute(attribute));
  if (isNaN(value)) {
    return defaultValue;
  }
  return value;
};
