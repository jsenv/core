/**
 * Where a row of routes scrolled by the browser stands, for what is drawn about
 * it elsewhere: the bar under the tabs, in a <Nav> that sits outside the box and
 * knows nothing of it. A tab says which page it is through its address, so a
 * nav follows any row it holds tabs for, with nothing to wire.
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
 * @param {{basePath: string, towardPath: string|null, progress: number}|null} move
 *   - the two pages the row stands between, by the pathname of their address,
 *   and how far past the first in the terms of --slide-travel-progress. `null`
 *   once it has stopped.
 */
export const publishRouteRowMove = (move) => {
  for (const follower of followers) {
    follower(move);
  }
};
