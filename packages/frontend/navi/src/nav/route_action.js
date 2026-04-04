import { actionRunEffect } from "../action/action_run_effect.js";

export const routeAction = (
  route,
  action,
  paramsEffect = () => route.paramsSignal.value,
  options = {},
) => {
  const actionBoundToRoute = actionRunEffect(
    action,
    () => {
      const matching = route.matchingSignal.value;
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
