/**
 * A target of its own inside a zone that belongs to another control.
 *
 * A pressable row, a picker's façade, a slide that travels under the finger:
 * each of them answers a press that lands anywhere in its box. An affordance an
 * application draws in there — a chip's cross, an eye that opens a profile, a
 * diskette that saves a guest — is aimed AT, not merely inside, and the press
 * belongs to it alone.
 *
 * Saying that by hand takes three guards, one per moment of the same press: the
 * pointerdown where gestures are arbitrated, the mousedown where a picker opens,
 * the click where it opens too when a gesture disputed the press. All three are
 * navi's own knowledge of navi's own event flow, and an application that gets
 * one wrong finds out by opening a popup it meant to keep shut. `ownTarget` is
 * that knowledge, said once.
 *
 * The other half is interactivity: the affordance is a control, so it already
 * refuses on its own terms once the zone around it holds it read-only — but a
 * caller's `onClick` is plain DOM and fires before any gate. So an own target
 * withholds the caller's handler until its own gate has allowed it, and by
 * default goes rather than greys: a remove cross that still removes is worse
 * than no cross, and one that refuses politely still says "there is something to
 * remove here" on a row that is only being read.
 */

import { useContext } from "preact/hooks";

import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
} from "./control_context.js";

export const OWN_TARGET_ATTRIBUTE = "data-navi-own-target";

/**
 * Whether `event` was aimed at an own target sitting below this control — in
 * which case the control is not what the press was for and must not answer it.
 *
 * Read from the event's target rather than from a mark left by a handler: the
 * question is "who is this press for", and the DOM between the pointer and the
 * control is the whole answer. Nothing is asked of the own target itself, which
 * is what lets it be anything — a button, a link, a field.
 */
export const isAimedAtOwnTargetBelow = (event, controlHost) => {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") {
    return false;
  }
  const ownTarget = target.closest(`[${OWN_TARGET_ATTRIBUTE}]`);
  if (!ownTarget) {
    return false;
  }
  // The claim is against what is ABOVE it: the control that IS the own target,
  // and any control living inside it, are being aimed at like anything else.
  if (ownTarget === controlHost || ownTarget.contains(controlHost)) {
    return false;
  }
  // From the root rather than the host: a layered control (a picker holding an
  // input) has its gate on the input, and what the application drew sits beside
  // it, not in it.
  const controlRoot = controlHost.closest("[navi-control]") || controlHost;
  return controlRoot.contains(ownTarget);
};

/**
 * Whether an own target has nothing to offer where it sits: the zone around it
 * is read-only, disabled or busy, so the affordance goes.
 *
 * `ownTarget="refuse"` keeps it on screen instead, refusing with a callout like
 * every other navi control — for an affordance whose presence is information in
 * itself (an eye that opens a profile is worth seeing on a row being read).
 */
export const useOwnTargetHidden = (props) => {
  const disabled = useContext(DisabledContext);
  const readOnly = useContext(ReadOnlyContext);
  const loading = useContext(LoadingContext);
  const { ownTarget } = props;
  if (!ownTarget || ownTarget === "refuse") {
    return false;
  }
  return Boolean(disabled || readOnly || loading);
};
