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
 * where the movement goes. That is what is published here, by whoever starts
 * the movement — route_transition.jsx for a relation between two pages,
 * route_travel.jsx for a row a finger pushes — before their transition starts.
 * The navigation's own announcement (before_routing.js) cannot stand in for
 * it: a travel a finger sets off starts its transition first and navigates
 * from inside it.
 *
 * Only one movement plays at a time (one view transition per document), which
 * is what lets both say it in one place. Taken down by the one that put it up,
 * and by it alone: a movement ending after another has replaced it must not
 * wipe what the new one stands on.
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
