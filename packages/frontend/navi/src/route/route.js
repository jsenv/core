import { batch, computed, effect, signal } from "@preact/signals";
import { createAction } from "../actions.js";
import {
  SYMBOL_IDENTITY,
  compareTwoJsValues,
} from "../utils/compare_two_js_values.js";

let baseUrl = import.meta.dev
  ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
  : window.location.origin;

export const setBaseUrl = (value) => {
  baseUrl = new URL(value, window.location).href;
};

const DEBUG = true;
const NO_PARAMS = { [SYMBOL_IDENTITY]: Symbol("no_params") };
// Controls what happens to actions when their route becomes inactive:
// 'abort' - Cancel the action immediately when route deactivates
// 'keep-loading' - Allow action to continue running after route deactivation
//
// The 'keep-loading' strategy could act like preloading, keeping data ready for potential return.
// However, since route reactivation triggers action reload anyway, the old data won't be used
// so it's better to abort the action to avoid unnecessary resource usage.
const ROUTE_DEACTIVATION_STRATEGY = "abort"; // 'abort', 'keep-loading'

const routeSet = new Set();
// Store previous route states to detect changes
const routePreviousStateMap = new WeakMap();
// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();
export const updateRoutes = (url) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { urlPattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      active: false,
      params: NO_PARAMS,
    };
    const oldActive = previousState.active;
    const oldParams = previousState.params;
    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    const newActive = Boolean(match);
    let newParams;
    if (match) {
      const extractedParams = extractParams(urlPattern, url);
      if (compareTwoJsValues(oldParams, extractedParams)) {
        // No change in parameters, keep the old params
        newParams = oldParams;
      } else {
        newParams = extractedParams;
      }
    } else {
      newParams = NO_PARAMS;
    }

    const routeMatchInfo = {
      route,
      routePrivateProperties,
      oldActive,
      newActive,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      active: newActive,
      params: newParams,
    });
  }

  // Apply all signal updates in a batch
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newActive,
      newParams,
    } of routeMatchInfoSet) {
      const { activeSignal, paramsSignal } = routePrivateProperties;
      activeSignal.value = newActive;
      paramsSignal.value = newParams;
      route.active = newActive;
      route.params = newParams;
    }
  });

  // must be after paramsSignal.value update to ensure the proxy target is set
  // (so after the batch call)
  const toLoadSet = new Set();
  const toReloadSet = new Set();
  const abortSignalMap = new Map();
  const routeLoadRequestedMap = new Map();

  for (const {
    route,
    routePrivateProperties,
    newActive,
    oldActive,
    newParams,
    oldParams,
  } of routeMatchInfoSet) {
    const routeAction = route.action;
    if (!routeAction) {
      continue;
    }

    const becomesActive = newActive && !oldActive;
    const becomesInactive = !newActive && oldActive;
    const paramsChangedWhileActive =
      newActive && oldActive && newParams !== oldParams;

    // Handle actions for routes that become active
    if (becomesActive) {
      if (DEBUG) {
        console.debug(
          `Route ${routePrivateProperties.urlPattern} became active with params:`,
          newParams,
        );
      }
      const currentAction = routeAction.getCurrentAction();
      toReloadSet.add(currentAction);
      routeLoadRequestedMap.set(route, currentAction);

      // Create a new abort controller for this action
      const actionAbortController = new AbortController();
      actionAbortControllerWeakMap.set(currentAction, actionAbortController);
      abortSignalMap.set(currentAction, actionAbortController.signal);

      continue;
    }

    // Handle actions for routes that become inactive - abort them
    if (becomesInactive && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      const currentAction = routeAction.getCurrentAction();
      const actionAbortController =
        actionAbortControllerWeakMap.get(currentAction);
      if (actionAbortController) {
        actionAbortController.abort(`route no longer matching`);
        actionAbortControllerWeakMap.delete(currentAction);
      }
      continue;
    }

    // Handle parameter changes while route stays active
    if (paramsChangedWhileActive) {
      if (DEBUG) {
        console.debug(
          `Route ${routePrivateProperties.urlPattern} params changed:`,
          newParams,
        );
      }
      const currentAction = routeAction.getCurrentAction();
      toReloadSet.add(currentAction);
      routeLoadRequestedMap.set(route, currentAction);

      // Create a new abort controller for the reload
      const actionAbortController = new AbortController();
      actionAbortControllerWeakMap.set(currentAction, actionAbortController);
      abortSignalMap.set(currentAction, actionAbortController.signal);
      continue;
    }
  }

  return {
    loadSet: toLoadSet,
    reloadSet: toReloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
  };
};
const extractParams = (urlPattern, url) => {
  const match = urlPattern.exec(url);
  if (!match) {
    return NO_PARAMS;
  }
  const params = {};

  // Collect all parameters from URLPattern groups, handling both named and numbered groups
  let wildcardOffset = 0;
  for (const property of URL_PATTERN_PROPERTIES_WITH_GROUP_SET) {
    const urlPartMatch = match[property];
    if (urlPartMatch && urlPartMatch.groups) {
      let localWildcardCount = 0;
      for (const key of Object.keys(urlPartMatch.groups)) {
        const value = urlPartMatch.groups[key];
        const keyAsNumber = parseInt(key, 10);
        if (!isNaN(keyAsNumber)) {
          if (value) {
            // Only include non-empty values
            params[wildcardOffset + keyAsNumber] = decodeURIComponent(value);
            localWildcardCount++;
          }
        } else {
          // Named group (:param or {param})
          params[key] = decodeURIComponent(value);
        }
      }
      // Update wildcard offset for next URL part
      wildcardOffset += localWildcardCount;
    }
  }
  return params;
};
const URL_PATTERN_PROPERTIES_WITH_GROUP_SET = new Set([
  "protocol",
  "username",
  "password",
  "hostname",
  "pathname",
  "search",
  "hash",
]);

const routePrivatePropertiesWeakMap = new WeakMap();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesWeakMap.get(route);
};
export const createRoute = (urlPatternInput) => {
  const route = {
    active: false,
    params: NO_PARAMS,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
    action: null,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    urlPattern: undefined,
    activeSignal: null,
    paramsSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
  };
  routePrivatePropertiesWeakMap.set(route, routePrivateProperties);

  const buildRelativeUrl = (params = {}) => {
    let relativeUrl = urlPatternInput;
    // Replace named parameters (:param and {param})
    for (const key of Object.keys(params)) {
      const value = params[key];
      const encodedValue = encodeURIComponent(value);
      relativeUrl = relativeUrl.replace(`:${key}`, encodedValue);
      relativeUrl = relativeUrl.replace(`{${key}}`, encodedValue);
    }
    // Replace wildcards (*) with numbered parameters (0, 1, 2, etc.)
    let wildcardIndex = 0;
    relativeUrl = relativeUrl.replace(/\*/g, () => {
      const paramKey = wildcardIndex.toString();
      const replacement = params[paramKey]
        ? encodeURIComponent(params[paramKey])
        : "*";
      wildcardIndex++;
      return replacement;
    });
    return relativeUrl;
  };
  const buildUrl = (params = {}) => {
    let relativeUrl = buildRelativeUrl(params);
    if (relativeUrl[0] === "/") {
      relativeUrl = relativeUrl.slice(1);
    }
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  };
  route.buildUrl = buildUrl;

  const activeSignal = signal(false);
  const paramsSignal = signal(NO_PARAMS);
  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const relativeUrl = buildRelativeUrl(params);
    return relativeUrl;
  });
  effect(() => {
    route.relativeUrl = relativeUrlSignal.value;
  });
  const urlSignal = computed(() => {
    const relativeUrl = relativeUrlSignal.value;
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  });
  effect(() => {
    route.url = urlSignal.value;
  });

  const bindAction = (action) => {
    const actionBoundToThisRoute = action.bindParams(paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };
  route.bindAction = bindAction;

  private_properties: {
    // Remove leading slash from urlPattern to make it relative to baseUrl
    const normalizedUrlPattern = urlPatternInput.startsWith("/")
      ? urlPatternInput.slice(1)
      : urlPatternInput;
    const urlPattern = new URLPattern(normalizedUrlPattern, baseUrl, {
      ignoreCase: true,
    });
    routePrivateProperties.urlPattern = urlPattern;
    routePrivateProperties.activeSignal = activeSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
    routePrivateProperties.urlSignal = urlSignal;
  }

  return route;
};
export const useRouteStatus = (route) => {
  const routePrivateProperties = getRoutePrivateProperties(route);

  if (!routePrivateProperties) {
    throw new Error(
      "Route is not properly initialized. Make sure defineRoutes() is called before using routes.",
    );
  }

  const { activeSignal, paramsSignal } = routePrivateProperties;

  const active = activeSignal.value;
  const params = paramsSignal.value;

  return {
    active,
    params,
  };
};

let onRouteDefined = () => {};
export const setOnRouteDefined = (v) => {
  onRouteDefined = v;
};
// All routes MUST be created at once because any url can be accessed
// at any given time (url can be shared, reloaded, etc..)
// Later I'll consider adding ability to have dynamic import into the mix
// (An async function returning an action)
export const defineRoutes = (routeDefinition) => {
  const routeArray = [];
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = createRoute(key);
    if (typeof value === "function") {
      const actionFromFunction = createAction(value);
      route.bindAction(actionFromFunction);
    } else if (value) {
      route.bindAction(value);
    }
    routeArray.push(route);
  }
  onRouteDefined();

  return routeArray;
};

if (import.meta.hot) {
  import.meta.dispose(() => {
    routeSet.clear();
  });
}
