import { computed, signal } from "@preact/signals";

import { actionRunEffect } from "../action/action_run_effect.js";
import { createAction } from "../action/actions.js";
import { registerRoutePreload } from "./route.js";

/**
 * Binds an action to a route: it runs when the route matches, with the params
 * the effect reads off the address, and is aborted when the route is left.
 * Its data, its wait and its failure are read by the page through
 * `useAsyncData`.
 *
 * A page's CODE is declared the same way — the import is one more thing the
 * address asks for, started with the data rather than after it:
 *
 * ```js
 * const GAME_PAGE_CODE = routeAction(GAME_ROUTE, () =>
 *   import("./game_page.jsx").then((m) => m.GamePage),
 * );
 * ```
 *
 * @param {object | object[]} routeOrRoutes - the route, or the routes, this
 *   action belongs to.
 * @param {object | Function} action - an action, or a function made into one.
 * @param {() => any} [paramsEffect] - what the action runs with, read off
 *   signals (the route's params, a search param): re-read when they change.
 *   Return a falsy value to run nothing. Without it the action asks nothing of
 *   the address, which is also what makes it worth fetching AHEAD of the
 *   arrival: a link to the route preruns it when the pointer or the focus
 *   reaches the link (see docs/dynamic_import.md). An action whose params
 *   come from the address is never prefetched — a prefetch has no address.
 * @param {object} [options]
 * @param {boolean} [options.prefetch=true] - `false` keeps a param-less action
 *   from being prerun on intent, when the read is not worth a hover.
 */
export const routeAction = (
  routeOrRoutes,
  action,
  paramsEffect,
  { prefetch = true, ...options } = {},
) => {
  if (typeof action === "function") {
    action = createAction(action);
  }
  const routes = Array.isArray(routeOrRoutes) ? routeOrRoutes : [routeOrRoutes];
  const routeMatchingSignal =
    routes.length === 1
      ? routes[0].matchingSignal
      : anyMatchingRouteSignal(routes);
  const readParams = paramsEffect || (() => true);
  const actionBoundToRoute = actionRunEffect(
    action,
    () => {
      const matching = routeMatchingSignal.value;
      const params = readParams();
      if (!matching) {
        return null;
      }
      return params;
    },
    options,
  );
  if (!paramsEffect && prefetch) {
    for (const route of routes) {
      registerRoutePreload(route, () => {
        prefetchParamless(action);
      });
    }
  }
  return actionBoundToRoute;
};

// The instance the effect above runs on the match is the one bound to `true`
// (the default params), so a prerun here is what the arrival promotes to a
// run. A prefetch that fails is not reported: nothing on screen asked for it,
// and the failure stays on the instance, where a run asks again — a FAILED
// action is run, only RUNNING and COMPLETED are left alone — and the arrival
// shows its own. It is left FAILED on purpose, not reset: the press that
// brings the arrival also focuses the link, so a prerun can be in flight when
// the arrival promotes it, and a reset landing after that would pull the
// answer from under the page that is reading it.
const prefetchParamless = (action) => {
  const instance = action.bindParams(true);
  let result;
  try {
    result = instance.prerun({ reason: "intent" });
  } catch {
    return;
  }
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
};

// I delibrately prefer the term "any" and avoid "some" so dev are not tempted to think
// "well I could just use array.some" and bypass this helper entirely, which would be incorrect:
// This helper does return if some/any route is matching but ensure all route matching signals are read (subscribed to)
// array.some would return as soon as it finds a match and would not subscribe to the rest of the signals.
export const anyMatchingRouteSignal = (routes) => {
  if (routes.length === 0) {
    return signal(false);
  }
  if (routes.length === 1) {
    const [route] = routes;
    return route.matchingSignal;
  }
  const anyMatchingSignal = computed(() => {
    let someMatching;
    for (const route of routes) {
      const matching = route.matchingSignal.value;
      if (matching) {
        someMatching = true;
      }
    }
    return someMatching;
  });
  return anyMatchingSignal;
};
