/**
 * The press that lands on a control the movement turned into a picture.
 *
 * A captured element is dead in both senses: it stops being painted where it
 * stands, and nothing hit-tests to it — the press falls through to the nearest
 * ancestor still being painted, whatever the pseudo-elements are told about
 * pointer events. For the pages that is the whole point: both are pictures of
 * somewhere the reader is no longer, or not yet.
 *
 * For the DOOR it is not. A page reached from the furniture — a gear in a top
 * bar, a "+" in a tab bar — is opened and closed by the same control, and that
 * control is standing exactly where its picture is drawn: the bar the two
 * states share is one group the browser holds still. So a press on it during
 * those few hundred milliseconds is aimed at what the reader can see, and
 * swallowing it makes the toggle feel stuck at the very moment it is being used
 * as one — press to open, press again to close.
 *
 * A control therefore may ask to keep answering, and while a route transition
 * plays the press is caught at the document and handed to it when it fell
 * inside its rectangle — which is where the hand thinks it pressed. The same
 * move route_travel.jsx makes for the box a finger reaches for mid-flight.
 *
 * ASKED FOR, never derived, and that is the whole safety of it: only the
 * application knows the control does not move. One that travels with the pages
 * has a rectangle where it WILL be, not where it is seen, and a press handed to
 * it fires something the reader never aimed at — worse than the press being
 * lost. Hence the dev warning below for a control found inside the area.
 *
 * The click alone is re-aimed, not the pointer stream that leads to it: what
 * has to survive is the press meaning what it meant, and the press feedback is
 * lost anyway — the control is a picture, so nothing it paints for its own
 * `:active` state reaches the screen. Synthesising a pointerdown with no
 * pointer behind it would start gestures (a drag, a hold) that no pointerup
 * ever ends.
 */

// Worn by a control that keeps answering while the pages move. Written by
// <Link pressableDuringRouteTransition> / <Button pressableDuringRouteTransition>,
// and by hand on anything else — this module owns the name and does the reading.
export const PRESSABLE_ATTRIBUTE = "data-navi-route-transition-pressable";
const PRESSABLE_SELECTOR = `[${PRESSABLE_ATTRIBUTE}]`;
// What the pages live in, named here only to say so in a warning
// (route_transition.jsx owns it).
const AREA_ATTRIBUTE = "data-navi-route-transition-area";

let pressOwner = null;

export const holdTransitionPress = (owner, areaElement) => {
  pressOwner = owner;
  // Adding the same listener twice is a no-op, so a movement taking over from
  // another needs nothing but the new owner.
  document.addEventListener("click", onDocumentClick, true);
  if (import.meta.dev) {
    warnAboutPressablesThatMove(areaElement);
  }
};

export const releaseTransitionPress = (owner) => {
  if (owner !== pressOwner) {
    return;
  }
  pressOwner = null;
  document.removeEventListener("click", onDocumentClick, true);
};

const onDocumentClick = (clickEvent) => {
  // A click of our own making, or one an application dispatched by hand: both
  // are already aimed, and re-aiming them by coordinates that mean nothing
  // (0, 0 for a synthetic click) would fire whatever sits in the corner.
  if (!clickEvent.isTrusted) {
    return;
  }
  const pressables = document.querySelectorAll(PRESSABLE_SELECTOR);
  if (pressables.length === 0) {
    return;
  }
  const { target, clientX, clientY } = clickEvent;
  for (const pressable of pressables) {
    if (pressable.contains(target)) {
      // It got there on its own: nothing has been photographed yet, or the
      // control is not part of what was.
      return;
    }
  }
  for (const pressable of pressables) {
    const { left, right, top, bottom } = pressable.getBoundingClientRect();
    if (
      clientX < left ||
      clientX > right ||
      clientY < top ||
      clientY > bottom
    ) {
      continue;
    }
    // The document is not where this press was going. Stopped here so the
    // application sees ONE click, on the control it was aimed at, rather than
    // two: this one falling through and the one below.
    clickEvent.stopPropagation();
    pressable.dispatchEvent(
      new clickEvent.constructor(clickEvent.type, clickEvent),
    );
    return;
  }
};

// Said once per kind: a control asking for this is one fact about the
// application, and repeating it every time the reader moves would bury it.
const warningsSaid = new Set();
const warnAboutPressablesThatMove = (areaElement) => {
  const pressables = document.querySelectorAll(PRESSABLE_SELECTOR);
  if (pressables.length === 0) {
    return;
  }
  if (!areaElement) {
    warnOnce(
      "no-area",
      `A control asks to stay pressable during a route transition, but the movement plays on the whole document — so there is nothing standing still for it to be: every element is inside the one picture that travels, and its rectangle says where it will BE rather than where it is drawn. Wrap the pages in <RouteTransitionArea> so the movement plays on them and the furniture around them keeps its place.`,
    );
    return;
  }
  for (const pressable of pressables) {
    if (!areaElement.contains(pressable)) {
      continue;
    }
    warnOnce(
      "inside-area",
      `A control asking to stay pressable during a route transition stands inside the pages (the element marked ${AREA_ATTRIBUTE}), and the pages are what moves: its rectangle says where it will BE, not where it is drawn, so a press aimed at what is on screen would be handed to whatever ends up under the finger. Only the furniture around the pages stands still for the length of a movement.`,
    );
    return;
  }
};
const warnOnce = (id, message) => {
  if (warningsSaid.has(id)) {
    return;
  }
  warningsSaid.add(id);
  console.warn(message);
};
