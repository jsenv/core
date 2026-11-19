/**
 * Where a row of routes scrolled by the browser stands, for what is drawn about
 * it elsewhere: the bar under the tabs, in a <Nav> that sits outside the box and
 * knows nothing of it. A tab says which page it is through its address, read
 * the way a RouteTravel reads a pressed link (pageIsAt in route_page.js: the
 * path, and every param the page names), so a nav follows any row it holds
 * tabs for, pages told apart by a search param included, with nothing to wire.
 *
 * Said per scroll and not through a signal: a number written on one element is
 * all it takes, and a signal would make that a render.
 */
const followers = new Set();

export const followRouteRows = (onMove) => {
  followers.add(onMove);
  return () => {
    followers.delete(onMove);
  };
};

/**
 * @param {{basePage: {route: object, params?: object}, towardPage: {route: object, params?: object}|null, progress: number}|null} move
 *   - the two pages the row stands between, the very objects the row holds for
 *   as long as it moves, and how far past the first in the terms of
 *   --slide-travel-progress. `null` once it has stopped.
 */
export const publishRouteRowMove = (move) => {
  for (const follower of followers) {
    follower(move);
  }
};
