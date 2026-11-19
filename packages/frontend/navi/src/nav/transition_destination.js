/**
 * Where a route movement is heading, said before its first picture is taken.
 *
 * A view transition pairs, across its two pictures, whatever wears the same
 * name on both — and a name is read off the DOM as it stands when the
 * transition starts. So whoever names an element for a movement between two
 * pages (the bar under the current tab of a <Nav>, which glides from one tab
 * to the next) has to decide whether this movement is one it takes part in
 * before that reading: on a page the row is not on, its bar must leave with the
 * page, unnamed.
 *
 * Everything that decision needs is on the page itself, except one thing:
 * where the movement goes. That is what is published here, by
 * route_transition.jsx before its transition starts: once the routing is done
 * — the routes already answer for that address — and while the render is
 * still held, so the DOM is still the page being left. A row a hand pushes
 * (RouteTravel) plays no view transition and publishes nothing here: the bar
 * follows it through route_row_follow.js.
 *
 * Only one movement plays at a time (one view transition per document).
 * Taken down by the one that put it up, and by it alone: a movement ending
 * after another has replaced it must not wipe what the new one stands on.
 */

import { createPubSub } from "@jsenv/dom";

const [publishDestination, observeTransitionDestination] = createPubSub();

let destinationOwner = null;

export const holdTransitionDestination = (owner, url) => {
  destinationOwner = owner;
  publishDestination(new URL(url, window.location.href).href);
};

export const releaseTransitionDestination = (owner) => {
  if (owner !== destinationOwner) {
    return;
  }
  destinationOwner = null;
  publishDestination(null);
};

export { observeTransitionDestination };
