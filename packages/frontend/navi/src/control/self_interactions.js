/**
 * The interactions an element takes for itself inside a zone that belongs to
 * another control.
 *
 * A pressable row, a picker's façade, a slide that travels under the finger:
 * each of them answers a gesture that lands anywhere in its box. An affordance
 * an application draws in there — a chip's cross, an eye that opens a profile, a
 * diskette that saves a guest — is aimed AT, not merely inside.
 *
 * But aimed at for WHAT. A press is not a drag: a drag announces itself (a few
 * pixels of travel with a mouse, a long hold with a finger), a click is the
 * absence of both, and the DOM tells them apart without anyone guessing at
 * pointerdown. So an affordance drawn against the edge of a card can take the
 * click and leave the grab: the finger that carries the card is allowed to start
 * on it. A claim over every gesture at once would be a hole in the card, at
 * precisely the place one grabs.
 *
 * Hence a list, and hence it is required: what is named belongs to this element,
 * what is not stays the zone's.
 *
 *     selfInteractions="click"        the press is mine, the grab is the card's
 *     selfInteractions="click drag"   both — an affordance carried on its own
 *     selfInteractions="*"            everything; say it only when it is true
 *
 * Saying "the press is mine" by hand takes three guards, one per moment of the
 * same press: the pointerdown where gestures are arbitrated, the mousedown where
 * a picker opens, the click where it opens too when a gesture disputed the
 * press. All three are navi's own knowledge of navi's own event flow, and an
 * application that gets one wrong finds out by opening a popup it meant to keep
 * shut. `selfInteractions` is that knowledge, said once.
 *
 * The other half is `whenSelfInteractionsBlocked`: what becomes of the
 * affordance where the zone around it is disabled or read-only. The question
 * that settles it is **does this affordance write to the control it sits in?**
 *
 * - it does, and once the value cannot be changed it has nothing left to offer:
 *   it GOES (`"hide"`, the default). A remove cross that still removes is worse
 *   than no cross, and one that refuses politely still says "there is something
 *   to remove here" on a row that is only being read.
 * - it does, but its presence is information in itself: `"refuse"` keeps it and
 *   refuses in its own words, like every other navi control.
 * - it does NOT — a diskette saving a row into the reader's own address book, a
 *   badge explaining why a placement is odd. The block is about a value it never
 *   touches, so `"ignore"` lets it through: the affordance stays lit and stays
 *   pressable. It is on the caller to use it only for a gesture that genuinely
 *   writes nothing to the control around it.
 *
 * That question is scoped to the claimed interactions and to them alone — the
 * ones left to the zone were never this element's to block, and are arbitrated
 * by the zone's own state.
 *
 * Whichever mode, the affordance's own handler runs from inside its own gate
 * rather than from the DOM: a caller's `onClick` fires before any of this, and
 * would go off from a button drawn greyed.
 *
 * These two answer about the GESTURE. Whose VALUE an element carries is a third
 * question, and `standalone` is where it is answered (see useUIStateController).
 * They are said separately because they genuinely come apart: a door that holds
 * no value of its own can still write into the control around it — it is
 * `standalone` and must still shut when that control is read-only — and an
 * affordance can claim a press without ever being a field. Something that is
 * its own on all three counts says all three (a diskette filing a name into the
 * reader's own address book: `selfInteractions="click"`,
 * `whenSelfInteractionsBlocked="ignore"`, `standalone`).
 */

import { useContext } from "preact/hooks";

import { DisabledContext, ReadOnlyContext } from "./control_context.js";

/**
 * The whole claim, in the DOM, on any element — a `<button>` an application
 * draws itself as much as a navi control. It is read from the outside and
 * nowhere else: by the controls above (below), and by the gesture readers
 * (@jsenv/dom's DRAG_EXCLUDED_SELECTOR and DRAG_IGNORED_SELECTOR), which is why
 * one attribute is enough and the `selfInteractions` prop only writes it.
 *
 * A space-separated list, so every reader picks its own word out of it with the
 * attribute selector the DOM already has for that: `[data-self-interactions~=
 * "drag"]`. Nobody parses anything, and a reader that knows nothing of the other
 * words is unaffected by them.
 */
export const SELF_INTERACTIONS_ATTRIBUTE = "data-self-interactions";

/**
 * Every word an element may claim. Small on purpose: a word exists here because
 * something reads it, and a reader is a whole family of gestures, not an event
 * name. `"click"` is the press-to-act chain (navi's own interaction gate, which
 * a keyboard activation goes through too); `"drag"` is being picked up or
 * carried (@jsenv/dom). `"*"` is all of them, present and future.
 */
const SELF_INTERACTION_SET = new Set(["click", "drag"]);
const ALL_SELF_INTERACTIONS = "*";

/**
 * The value to write in the DOM, and the one place a malformed claim is caught:
 * a word nobody reads is silent forever otherwise, which is exactly the trap
 * this API exists to remove.
 */
export const selfInteractionsAttributeValue = (selfInteractions) => {
  if (import.meta.dev) {
    if (selfInteractions === true) {
      console.warn(
        `selfInteractions must say WHICH interactions are this element's own, as a list: selfInteractions="click". Read as "${ALL_SELF_INTERACTIONS}" for now, which takes every gesture — including the drag of whatever the element sits in.`,
      );
    } else if (typeof selfInteractions === "string") {
      for (const word of selfInteractions.trim().split(/\s+/)) {
        if (word !== ALL_SELF_INTERACTIONS && !SELF_INTERACTION_SET.has(word)) {
          console.warn(
            `"${word}" is not an interaction an element can claim. Known: ${[...SELF_INTERACTION_SET].join(", ")}, ${ALL_SELF_INTERACTIONS}.`,
          );
        }
      }
    }
  }
  return typeof selfInteractions === "string"
    ? selfInteractions
    : ALL_SELF_INTERACTIONS;
};

const selfInteractionSelector = (interaction) =>
  `[${SELF_INTERACTIONS_ATTRIBUTE}~="${interaction}"],[${SELF_INTERACTIONS_ATTRIBUTE}~="${ALL_SELF_INTERACTIONS}"]`;

// What navi's own interaction gate answers to. The press-to-act chain is one
// thing said at three moments (pointerdown, mousedown, click), and a keyboard
// activation is a click too — so one word covers the lot.
const CLICK_SELECTOR = selfInteractionSelector("click");

/**
 * Whether `event` was aimed at an element below this control that claims the
 * press — in which case the control is not what the press was for and must not
 * answer it.
 *
 * Read from the event's target rather than from a mark left by a handler: the
 * question is "who is this press for", and the DOM between the pointer and the
 * control is the whole answer. Nothing is asked of the element itself, which is
 * what lets it be anything — a button, a link, a field, a bare element.
 *
 * The closest element CLAIMING THE PRESS wins, not the closest one claiming
 * anything: an affordance that took only the drag is transparent here, exactly
 * as it is to the drag readers when it took only the click.
 *
 * @param {Event} event The gesture being arbitrated.
 * @param {Element} controlHost The control asking whether the press is its own.
 * @param {Element} [requester] Who asked this control to act, when someone did
 *   — the source of a command, typically. The claim answers "was this press
 *   yours or the affordance's"; it says nothing about a request that affordance
 *   is making, and the answer there is always yes.
 */
export const isAimedAtSelfInteractionsBelow = (
  event,
  controlHost,
  requester,
) => {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") {
    return false;
  }
  const claimer = target.closest(CLICK_SELECTOR);
  if (!claimer) {
    return false;
  }
  // The claim is against what is ABOVE it: the control that IS the claimer, and
  // any control living inside it, are being aimed at like anything else.
  if (claimer === controlHost || claimer.contains(controlHost)) {
    return false;
  }
  // The claimer is the one asking. Its claim took the press so IT would decide
  // what the press means, and this is that decision arriving — a clear cross
  // sending "--navi-clear" to the field it sits in. Stepping back here would be
  // the control refusing the very request the claim exists to let through.
  if (requester && (claimer === requester || claimer.contains(requester))) {
    return false;
  }
  // From the root rather than the host: a layered control (a picker holding an
  // input) has its gate on the input, and what the application drew sits beside
  // it, not in it.
  const controlRoot = controlHost.closest("[navi-control]") || controlHost;
  return controlRoot.contains(claimer);
};

/**
 * Whether the disabled and read-only of the zone around this element are about
 * its own interactions at all — see the modes at the top of this file.
 */
export const selfInteractionsIgnoreBlock = (props) =>
  props.whenSelfInteractionsBlocked === "ignore";

/**
 * Whether the affordance has nothing left to offer where it sits: it writes to
 * the control around it, and that control cannot be written to, so it goes.
 *
 * Read from disabled and read-only alone. Busy is not a block — it is read-only
 * that blocks, which a running action sets on its way (see readOnlyBase in
 * control_hooks.jsx); a zone busy without being read-only is a zone whose
 * interactions still work.
 */
export const useSelfInteractionsHidden = (props) => {
  const disabled = useContext(DisabledContext);
  const readOnly = useContext(ReadOnlyContext);
  const { selfInteractions, whenSelfInteractionsBlocked } = props;
  if (!selfInteractions) {
    return false;
  }
  if (
    whenSelfInteractionsBlocked &&
    whenSelfInteractionsBlocked !== "hide" // "refuse" stays and says why, "ignore" is not concerned
  ) {
    return false;
  }
  return Boolean(disabled || readOnly);
};
