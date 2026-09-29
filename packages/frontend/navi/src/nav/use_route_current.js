import { computed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { getParamsCacheKey } from "./route.js";

/**
 * Whether the page one is on is `route` with `params` — what a link or a button
 * pointing at a route shows as current.
 *
 * Read through a computed of that one answer, so the component reading it
 * re-renders when the answer flips, and not whenever the route's status moves:
 * a page arriving on the route with other params — one profile opening, under a
 * list of links to a hundred other profiles — starts the route matching and
 * changes its params, and leaves every one of those links exactly as it was.
 *
 * `except`: routes whose matching vetoes the answer — a route named there is
 * somewhere else, whatever the rest of the reading says. `also`: routes whose
 * matching grants it. Both take a route or a list of routes.
 */
export const useRouteCurrent = (route, params, { except, also } = {}) => {
  const exceptRoutes = toRouteList(except);
  const alsoRoutes = toRouteList(also);
  const paramsKey = getParamsCacheKey(params);
  const exceptKey = routeListKey(exceptRoutes);
  const alsoKey = routeListKey(alsoRoutes);
  const currentSignal = useMemo(() => {
    if (paramsKey === null) {
      return null;
    }
    return computed(() =>
      readRouteCurrent(route, params, exceptRoutes, alsoRoutes),
    );
  }, [route, paramsKey, exceptKey, alsoKey]);
  if (!currentSignal) {
    // Params no key can be made of (a date, an object): read on the spot, the
    // component then re-renders with the status of every route it reads.
    return readRouteCurrent(route, params, exceptRoutes, alsoRoutes);
  }
  return currentSignal.value;
};

// Every signal is read even once the answer is known: reading is what
// subscribes, and a route skipped today is the one whose change has to be heard
// tomorrow.
const readRouteCurrent = (route, params, exceptRoutes, alsoRoutes) => {
  const matching = route.matchingSignal.value;
  const paramsMatching = route.matchesParams(params);
  let someExceptMatching = false;
  for (const exceptRoute of exceptRoutes) {
    if (exceptRoute.matchingSignal.value) {
      someExceptMatching = true;
    }
  }
  let someAlsoMatching = false;
  for (const alsoRoute of alsoRoutes) {
    if (alsoRoute.matchingSignal.value) {
      someAlsoMatching = true;
    }
  }
  if (someExceptMatching) {
    return false;
  }
  return (matching && paramsMatching) || someAlsoMatching;
};

const toRouteList = (routes) => {
  if (!routes) {
    return [];
  }
  return Array.isArray(routes) ? routes : [routes];
};

// A list of routes as a key, since an inline `currentAlso={[A, B]}` is a new
// array at every render of the parent.
const routeIdByRoute = new WeakMap();
let routeIdCount = 0;
const routeListKey = (routes) => {
  let key = "";
  for (const route of routes) {
    let id = routeIdByRoute.get(route);
    if (id === undefined) {
      id = ++routeIdCount;
      routeIdByRoute.set(route, id);
    }
    key += `${id},`;
  }
  return key;
};
