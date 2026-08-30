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
 * - a bar only one state has never meets a counterpart. It stands where it was
 *   photographed while the pages move OVER it (see the z-order in
 *   route_transition.jsx) — covered progressively as a page comes over it,
 *   uncovered as one leaves — rather than going out with the render.
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
const NAME_PROPERTY = "view-transition-name";
export const FURNITURE_NAME_PREFIX = "navi-transition-furniture-";

const nameByElement = new WeakMap();
let nameCount = 0;

// Whose movement the names belong to, for the same reason the window has an
// owner (transition_window.js): a movement ending after another has replaced
// it must not strip what the new one is wearing.
let furnitureOwner = null;
let namedElements = new Set();

/**
 * Name what stands around the area. Called twice for one movement: before the
 * picture of the state being left is taken, and again once the state arriving
 * has rendered — a bar that just mounted has to wear its name before the
 * second picture, and one that survived the render is left with the name it
 * already has.
 */
export const nameTransitionFurniture = (owner, areaElement) => {
  if (owner !== furnitureOwner) {
    furnitureOwner = owner;
    namedElements = new Set();
  }
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
  }
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
};
