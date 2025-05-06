import { useMemo, useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { EXECUTING, ABORTED } from "./action_status.js";

const routeActionParamsSet = new Map();
export const useAction = (route, params = {}) => {
  let routeParamsSet = routeActionParamsSet.get(route);
  if (!routeParamsSet) {
    routeParamsSet = new Map();
    routeActionParamsSet.set(route, routeParamsSet);
  }
  if (!routeParamsSet.has(params)) {
    let existingParams;
    for (const paramsCandidate of routeParamsSet) {
      if (compareParams(paramsCandidate, params)) {
        existingParams = paramsCandidate;
        break;
      }
    }
    if (existingParams) {
      params = existingParams;
    } else {
      routeParamsSet.add(params);
    }
  }
  const action = useMemo(() => {
    const fn = (navParams) => {
      return route.handler({
        ...navParams,
        ...params,
      });
    };
    fn.route = route;
    fn.pendingSignal = signal(false);
    fn.errorSignal = signal(null);
    action.subscribeCount = 0;
    return fn;
  }, [params]);

  action.subscribeCount++;
  // when no one is interested by this action anymore
  // we can delete the usage of this param and eventually the route
  useEffect(() => {
    return () => {
      action.subscribeCount--;
      if (action.subscribeCount === 0) {
        routeParamsSet.delete(params);
        if (routeParamsSet.size === 0) {
          routeActionParamsSet.delete(route);
        }
      }
    };
  }, []);

  return action;
};
const compareParams = (a, b) => {
  if (a === b) {
    return true;
  }
  // TODO: real comparison
  return false;
};

export const useActionStatus = (action) => {
  // je peux pas faire ça:
  // puisque la route est partagé par les actions
  // il faut bel et bien que je mette cet action quelque part
  const pending = action.executionStateSignal.value === EXECUTING;
  const error = action.errorSignal.value;
  const aborted = action.executionStateSignal.value === ABORTED;
  return { aborted, pending, error };
};
