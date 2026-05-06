import { actionRunEffect } from "../action/action_run_effect.js";

export const routeAction = (
  routeOrRoutes,
  action,
  paramsEffect = () => true,
  options = {},
) => {
  const routes = Array.isArray(routeOrRoutes) ? routeOrRoutes : [routeOrRoutes];
  const actionBoundToRoute = actionRunEffect(
    action,
    () => {
      const matching = routes.some((route) => route.matchingSignal.value);
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
