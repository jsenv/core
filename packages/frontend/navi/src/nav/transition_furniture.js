/**
 * The furniture around the pages — the fixed bars — photographed with them for
 * the length of a route transition, so that a piece of it belonging to ONE of
 * the two states takes part in the movement instead of appearing or vanishing
 * in a frame.
 *
 * Whether a bar is the frame or part of what changes is a fact about the PAIR
 * of states, never about the bar: the top bar of a list is the frame while one
 * goes into a row of that list, and part of what changes when the next page
 * takes the whole screen. So nothing is declared — a name is written on every
 * bar for the length of the movement, and the browser derives the rest:
 *
 * - a bar the two states SHARE is one element wearing one name on both sides.
 *   The browser pairs the two pictures into one group and holds it where it
 *   stands: the frame, and the pages move behind it exactly as before.
 * - a bar only one state has never meets a counterpart. It belongs to the page
 *   that has it, so it travels with that page — leaving by the keyframes the
 *   page being left leaves by, arriving by the ones the page arriving arrives
 *   by — instead of going out with the render. Under the pages, so a page
 *   coming over it covers it (see the z-order in route_transition.jsx).
 *
 * Which keyframes those are is published by the movement itself
 * (--navi-route-transition-leave / -enter, see route_transition.jsx): a
 * selector cannot say "the bars that have no counterpart" — the names are per
 * element, so there is nothing static to write — so the rule is written for
 * the length of the movement, over the names this one turned out to have.
 *
 * The name is per ELEMENT and kept for the element's whole life, which is what
 * makes "shared" mean shared: several bars can live on one edge
 * (layout/fixed_bar/fixed_bar_space.js), so a bar leaving and another one
 * arriving on that same edge are two names and two movements, not one bar
 * changing its mind.
 *
 * Worn only while a transition of navi's plays: named the rest of the time, a
 * bar would be captured during every view transition the APPLICATION starts —
 * dead to the pointer and drawn in the top layer for the length of a movement
 * that has nothing to do with it. Being unable to answer a press is the price
 * of being photographed, and a route transition is where it costs nothing:
 * both pages are pictures for those few hundred milliseconds anyway.
 */

// What counts as furniture: what is pinned to an edge of the window and gives
// its room back to the content (layout/fixed_bar/fixed_bar.jsx). A sticky row
// inside the pages needs none of this — it lives in the area, so it is already
// part of the pages' own picture.
const FURNITURE_SELECTOR = ".navi_fixed_bar";
// Worn by the root for the length of a route transition (route_transition.jsx
// owns it). Written out rather than imported: importing the module that owns
// it back into this one would close a cycle.
const TRANSITION_ATTRIBUTE = "data-navi-route-transition";
const NAME_PROPERTY = "view-transition-name";
export const FURNITURE_NAME_PREFIX = "navi-transition-furniture-";

const nameByElement = new WeakMap();
let nameCount = 0;

// Whose movement the names belong to, for the same reason the window has an
// owner (transition_window.js): a movement ending after another has replaced
// it must not strip what the new one is wearing.
let furnitureOwner = null;
let namedElements = new Set();
// The rule giving the one-sided bars their movement, written for one movement
// and taken down with it.
let travelStyleElement = null;

/**
 * Name what stands around the area, before the picture of the state being left
 * is taken: the browser reads the names off the DOM as it stands when the
 * transition starts.
 */
export const nameTransitionFurniture = (owner, areaElement) => {
  if (owner !== furnitureOwner) {
    furnitureOwner = owner;
    namedElements = new Set();
  }
  nameFurnitureAround(areaElement);
};

/**
 * The state arriving has rendered and the second picture has not been taken:
 * the one moment both states of the furniture are known. A bar that just
 * mounted is named — one that survived the render keeps the name it has, which
 * is what pairs its two pictures — and the bars only one of the two states has
 * are given the movement of the page they belong to.
 */
export const holdTransitionFurniture = (owner, areaElement) => {
  if (owner !== furnitureOwner) {
    return;
  }
  const namesLeaving = [];
  for (const element of namedElements) {
    if (!element.isConnected) {
      namesLeaving.push(nameByElement.get(element));
    }
  }
  const namesArriving = nameFurnitureAround(areaElement);
  const cssText = `${travelRule("old", namesLeaving, "--navi-route-transition-leave")}${travelRule("new", namesArriving, "--navi-route-transition-enter")}`;
  if (!cssText) {
    return;
  }
  travelStyleElement = document.createElement("style");
  travelStyleElement.textContent = cssText;
  document.head.appendChild(travelStyleElement);
};

// Returns the elements it had to name, which are the ones the state arriving
// brought: everything else was already wearing its name from the first pass.
const nameFurnitureAround = (areaElement) => {
  const namesAdded = [];
  for (const element of document.querySelectorAll(FURNITURE_SELECTOR)) {
    if (namedElements.has(element)) {
      continue;
    }
    // Inside the area it is not furniture, it is the page: naming it would
    // punch a hole in the picture the movement is played on.
    if (areaElement.contains(element)) {
      continue;
    }
    let name = nameByElement.get(element);
    if (!name) {
      // A name the application wrote itself answers for that element, and it
      // is saying something navi is not: it wants that bar moved on the pages'
      // clock, by its own CSS. Asked only of a bar navi has never named — a
      // bar wearing one of ITS names is one this movement inherited from the
      // one it interrupted, and taking it for the application's would leave it
      // named for the rest of the document's life.
      if (getComputedStyle(element).viewTransitionName !== "none") {
        continue;
      }
      nameCount++;
      name = `${FURNITURE_NAME_PREFIX}${nameCount}`;
      nameByElement.set(element, name);
    }
    element.style.setProperty(NAME_PROPERTY, name);
    namedElements.add(element);
    namesAdded.push(name);
  }
  return namesAdded;
};

// The movement, played on pictures no static rule can name. The keyframes are
// read rather than guessed: a type navi ships publishes them, and so may one
// an application writes — a type that publishes nothing leaves its furniture
// to the browser's own fade, which is what the rule not being written means.
const travelRule = (side, names, movementProperty) => {
  if (names.length === 0) {
    return "";
  }
  const animationName = getComputedStyle(document.documentElement)
    .getPropertyValue(movementProperty)
    .trim();
  if (!animationName) {
    return "";
  }
  const selector = names
    .map(
      (name) =>
        `:root[${TRANSITION_ATTRIBUTE}]::view-transition-${side}(${name})`,
    )
    .join(",");
  return `${selector}{animation-name:${animationName};animation-timing-function:ease;animation-fill-mode:both}`;
};

export const releaseTransitionFurniture = (owner) => {
  if (owner !== furnitureOwner) {
    return;
  }
  furnitureOwner = null;
  for (const element of namedElements) {
    element.style.removeProperty(NAME_PROPERTY);
  }
  namedElements = new Set();
  if (travelStyleElement) {
    travelStyleElement.remove();
    travelStyleElement = null;
  }
};
