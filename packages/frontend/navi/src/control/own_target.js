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
 * The other half is interactivity, and the question that settles it is: **does
 * this affordance write to the control it sits in?**
 *
 * - it does, and once the value cannot be changed it has nothing left to offer:
 *   it GOES. A remove cross that still removes is worse than no cross, and one
 *   that refuses politely still says "there is something to remove here" on a
 *   row that is only being read. That is the default.
 * - it does, but its presence is information in itself: `"refuse"` keeps it and
 *   refuses in its own words, like every other navi control.
 * - it does NOT — a diskette saving a row into the reader's own address book, a
 *   badge explaining why a placement is odd. The read-only around it is about a
 *   value it never touches, so `"always"` ignores it: the affordance stays lit
 *   and stays pressable. It is on the caller to use it only for a gesture that
 *   genuinely writes nothing to the control around it.
 *
 * Whichever mode, the affordance's own handler runs from inside its own gate
 * rather than from the DOM: a caller's `onClick` fires before any of this, and
 * would go off from a button drawn greyed.
 */

import { useContext } from "preact/hooks";

import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
} from "./control_context.js";

/**
 * The whole claim, in the DOM, on any element — a `<button>` an application
 * draws itself as much as a navi control. It is read from the outside and
 * nowhere else: by the controls above (below), and by the gesture readers
 * (@jsenv/dom's DRAG_EXCLUDED_SELECTOR and DRAG_IGNORED_SELECTOR), which is why
 * one attribute is enough and the `ownTarget` prop only writes it.
 *
 * Its value is the mode, when there is one to say: `data-own-target="always"`.
 */
export const OWN_TARGET_ATTRIBUTE = "data-own-target";

/**
 * Whether `event` was aimed at an own target sitting below this control — in
 * which case the control is not what the press was for and must not answer it.
 *
 * Read from the event's target rather than from a mark left by a handler: the
 * question is "who is this press for", and the DOM between the pointer and the
 * control is the whole answer. Nothing is asked of the own target itself, which
 * is what lets it be anything — a button, a link, a field, a bare element.
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
 * Whether the read-only, disabled and busy of the zone around this own target
 * are about it at all — see the modes at the top of this file.
 */
export const ownTargetIgnoresZoneState = (ownTarget) => ownTarget === "always";

/**
 * Whether an own target has nothing to offer where it sits: it writes to the
 * control around it, and that control cannot be changed, so the affordance goes.
 */
export const useOwnTargetHidden = (props) => {
  const disabled = useContext(DisabledContext);
  const readOnly = useContext(ReadOnlyContext);
  const loading = useContext(LoadingContext);
  const { ownTarget } = props;
  if (
    !ownTarget ||
    ownTarget === "refuse" ||
    ownTargetIgnoresZoneState(ownTarget)
  ) {
    return false;
  }
  return Boolean(disabled || readOnly || loading);
};
