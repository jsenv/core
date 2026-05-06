import { computed, signal } from "@preact/signals";

import { actionRunEffect } from "../action/action_run_effect.js";

export const routeAction = (
  routeOrRoutes,
  action,
  paramsEffect = () => true,
  options = {},
) => {
  const routeMatchingSignal = Array.isArray(routeOrRoutes)
    ? anyMatchingRouteSignal(routeOrRoutes)
    : routeOrRoutes.matchingSignal;
  const actionBoundToRoute = actionRunEffect(
    action,
    () => {
      const matching = routeMatchingSignal.value;
      const params = paramsEffect();
      if (!matching) {
        return null;
      }
      return params;
    },
    options,
  );

  return actionBoundToRoute;
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
