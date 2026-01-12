/**
 *
 *
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { buildRouteRelativeUrl } from "./build_route_relative_url.js";
import { createRoutePattern } from "./route_pattern.js";

// Helper for managing route parameter localStorage storage
const generateStorageKey = (routePattern, paramName) => {
  // Create a scoped key based on route pattern to avoid conflicts
  const routeKey = routePattern.replace(/[^a-zA-Z0-9]/g, "_");
  return `route_param_${routeKey}_${paramName}`;
};
const createRouteParamStorage = () => {
  const storeValue = (paramConfig, value) => {
    const { localStorageKey, default: defaultValue } = paramConfig;
    if (value === defaultValue || value === undefined) {
      // Remove from localStorage when value matches default or is undefined
      localStorage.removeItem(localStorageKey);
    } else {
      // Store in localStorage when value deviates from default
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(value));
      } catch (error) {
        // Gracefully handle localStorage errors (quota exceeded, etc.)
        console.warn(`Failed to store parameter to localStorage:`, error);
      }
    }
  };
  const retrieveValue = (paramConfig) => {
    const { localStorageKey } = paramConfig;
    try {
      const storedValue = localStorage.getItem(localStorageKey);
      if (storedValue !== null) {
        try {
          return JSON.parse(storedValue);
        } catch {
          return storedValue;
        }
      }
      return null;
    } catch (error) {
      console.warn(`Failed to retrieve parameter from localStorage:`, error);
      return null;
    }
  };
  const syncParam = (paramConfig, value) => {
    storeValue(paramConfig, value);
  };
  const getStoredParam = (paramConfig) => {
    return retrieveValue(paramConfig);
  };

  return {
    syncParam,
    getStoredParam,
  };
};

const routeParamStorage = createRouteParamStorage();

let baseUrl;
if (typeof window === "undefined") {
  baseUrl = "http://localhost/";
} else {
  baseUrl = import.meta.dev
    ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
    : window.location.origin;
}

export const setBaseUrl = (value) => {
  baseUrl = new URL(value, window.location).href;
};

const DEBUG = false;
// Controls what happens to actions when their route stops matching:
// 'abort' - Cancel the action immediately when route stops matching
// 'keep-loading' - Allow action to continue running after route stops matching
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
export const updateRoutes = (
  url,
  {
    // state
    replace,
    isVisited,
  },
) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { routePattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      matching: false,
      params: null,
    };
    const oldMatching = previousState.matching;
    const oldParams = previousState.params;
    const extractedParams = routePattern.applyOn(url);
    const newMatching = Boolean(extractedParams);

    let newParams;
    if (extractedParams) {
      if (compareTwoJsValues(oldParams, extractedParams)) {
        // No change in parameters, keep the old params
        newParams = oldParams;
      } else {
        newParams = extractedParams;
      }
    } else {
      newParams = null;
    }

    const routeMatchInfo = {
      route,
      routePrivateProperties,
      oldMatching,
      newMatching,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      matching: newMatching,
      params: newParams,
    });
  }

  // Apply all signal updates in a batch
  const matchingRouteSet = new Set();
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newMatching,
      newParams,
    } of routeMatchInfoSet) {
      const { updateStatus } = routePrivateProperties;
      const visited = isVisited(route.url);
      updateStatus({
        matching: newMatching,
        params: newParams,
        visited,
      });
      if (newMatching) {
        matchingRouteSet.add(route);
      }
    }
  });

  // must be after paramsSignal.value update to ensure the proxy target is set
  // (so after the batch call)
  const toLoadSet = new Set();
  const toReloadSet = new Set();
  const abortSignalMap = new Map();
  const routeLoadRequestedMap = new Map();

  const shouldLoadOrReload = (route, shouldLoad) => {
    const routeAction = route.action;
    const currentAction = routeAction.getCurrentAction();
    if (shouldLoad) {
      if (replace || currentAction.aborted || currentAction.error) {
        shouldLoad = false;
      }
    }
    if (shouldLoad) {
      toLoadSet.add(currentAction);
    } else {
      toReloadSet.add(currentAction);
    }
    routeLoadRequestedMap.set(route, currentAction);
    // Create a new abort controller for this action
    const actionAbortController = new AbortController();
    actionAbortControllerWeakMap.set(currentAction, actionAbortController);
    abortSignalMap.set(currentAction, actionAbortController.signal);
  };

  const shouldLoad = (route) => {
    shouldLoadOrReload(route, true);
  };
  const shouldReload = (route) => {
    shouldLoadOrReload(route, false);
  };
  const shouldAbort = (route) => {
    const routeAction = route.action;
    const currentAction = routeAction.getCurrentAction();
    const actionAbortController =
      actionAbortControllerWeakMap.get(currentAction);
    if (actionAbortController) {
      actionAbortController.abort(`route no longer matching`);
      actionAbortControllerWeakMap.delete(currentAction);
    }
  };

  for (const {
    route,
    routePrivateProperties,
    newMatching,
    oldMatching,
    newParams,
    oldParams,
  } of routeMatchInfoSet) {
    const routeAction = route.action;
    if (!routeAction) {
      continue;
    }

    const becomesMatching = newMatching && !oldMatching;
    const becomesNotMatching = !newMatching && oldMatching;
    const paramsChangedWhileMatching =
      newMatching && oldMatching && newParams !== oldParams;

    // Handle actions for routes that become matching
    if (becomesMatching) {
      if (DEBUG) {
        console.debug(
          `${routePrivateProperties} became matching with params:`,
          newParams,
        );
      }
      shouldLoad(route);
      continue;
    }

    // Handle actions for routes that become not matching - abort them
    if (becomesNotMatching && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      shouldAbort(route);
      continue;
    }

    // Handle parameter changes while route stays matching
    if (paramsChangedWhileMatching) {
      if (DEBUG) {
        console.debug(`${routePrivateProperties} params changed:`, newParams);
      }
      shouldReload(route);
    }
  }

  return {
    loadSet: toLoadSet,
    reloadSet: toReloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    matchingRouteSet,
  };
};

const routePrivatePropertiesMap = new Map();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};

const createRoute = (urlPatternInput) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const [publishStatus, subscribeStatus] = createPubSub();
  const route = {
    urlPattern: urlPatternInput,
    isRoute: true,
    matching: false,
    params: null,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
    action: null,
    cleanup,
    toString: () => {
      return `route "${urlPatternInput}"`;
    },
    replaceParams: undefined,
    subscribeStatus,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    routePattern: null,
    matchingSignal: null,
    paramsSignal: null,
    rawParamsSignal: null, // params from URL without defaults
    visitedSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
    updateStatus: ({ matching, params, visited }) => {
      let someChange = false;
      matchingSignal.value = matching;

      if (route.matching !== matching) {
        route.matching = matching;
        someChange = true;
      }
      visitedSignal.value = visited;
      if (route.visited !== visited) {
        route.visited = visited;
        someChange = true;
      }
      // Store raw params (from URL) - paramsSignal will reactively compute merged params
      rawParamsSignal.value = params;
      // Get merged params for comparison (computed signal will handle the merging)
      const mergedParams = paramsSignal.value;
      if (route.params !== mergedParams) {
        route.params = mergedParams;
        someChange = true;

        // Sync new parameter values to localStorage
        for (const [paramName, paramConfig] of urlParamMap) {
          routeParamStorage.syncParam(paramConfig, params?.[paramName]);
        }
      }
      if (someChange) {
        if (DEBUG) {
          console.debug(`${route} status changed:`, {
            matching,
            params: mergedParams,
            visited,
          });
        }
        publishStatus({
          matching,
          params: mergedParams,
          visited,
        });
      }
    },
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);

  const urlParamMap = new Map();
  route.addUrlParam = (paramName, { default: defaultValue } = {}) => {
    urlParamMap.set(paramName, {
      default: defaultValue,
      localStorageKey: generateStorageKey(urlPatternInput, paramName),
    });
  };

  // Utility function to resolve parameters with inheritance and defaults
  const resolveParams = (providedParams) => {
    const mergedParams = {};

    // Use raw params (without defaults) for inheritance to avoid double-applying defaults
    const currentParams = rawParamsSignal.value;
    for (const [paramName, paramConfig] of urlParamMap) {
      const providedValue = providedParams?.[paramName];
      if (providedValue !== undefined) {
        mergedParams[paramName] = providedValue;
        continue;
      }
      const currentValue = currentParams?.[paramName];
      if (currentValue !== undefined) {
        mergedParams[paramName] = currentValue;
        continue;
      }

      // Always check localStorage as source of truth for stored values
      const storedValue = routeParamStorage.getStoredParam(paramConfig);
      if (storedValue !== null) {
        mergedParams[paramName] = storedValue;
        continue;
      }
      const defaultValue = paramConfig.default;
      if (defaultValue !== undefined) {
        mergedParams[paramName] = defaultValue;
      }
    }

    return mergedParams;
  };

  const buildRelativeUrl = (providedParams, options) => {
    // Inherit current parameters that would not be expliictely provided
    const params = resolveParams(providedParams);
    // Remove parameters that match their default values to keep URLs shorter
    for (const [paramName, paramConfig] of urlParamMap) {
      const { default: defaultValue } = paramConfig;
      if (defaultValue !== undefined && params[paramName] === defaultValue) {
        delete params[paramName];
      }
    }
    return buildRouteRelativeUrl(urlPatternInput, params, options);
  };
  route.buildRelativeUrl = (params = {}, options) => {
    const { relativeUrl } = buildRelativeUrl(params, options);
    return relativeUrl;
  };

  route.matchesParams = (providedParams) => {
    const otherParams = resolveParams(providedParams);
    let currentParams = route.params;
    // Remove wildcards from comparison (they're not user-controllable params)
    if (currentParams) {
      const currentParamsWithoutWildcards = {};
      for (const key of Object.keys(currentParams)) {
        if (!Number.isInteger(Number(key))) {
          currentParamsWithoutWildcards[key] = currentParams[key];
        }
      }
      currentParams = currentParamsWithoutWildcards;
    }
    const paramsIsFalsyOrEmpty =
      !currentParams || Object.keys(currentParams).length === 0;
    const otherParamsFalsyOrEmpty =
      !otherParams || Object.keys(otherParams).length === 0;
    if (paramsIsFalsyOrEmpty) {
      return otherParamsFalsyOrEmpty;
    }
    if (otherParamsFalsyOrEmpty) {
      return false;
    }
    return compareTwoJsValues(otherParams, currentParams);
  };

  /**
   * Builds a complete URL for this route with the given parameters.
   *
   * Takes parameters and substitutes them into the route's URL pattern,
   * automatically URL-encoding values unless wrapped with rawUrlPart().
   * Extra parameters not in the pattern are added as search parameters.
   *
   * @param {Object} params - Parameters to substitute into the URL pattern
   * @returns {string} Complete URL with base URL and encoded parameters
   *
   * @example
   * // For a route with pattern "/items/:id"
   * // Normal parameter encoding
   * route.buildUrl({ id: "hello world" }) // → "https://example.com/items/hello%20world"
   * // Raw parameter (no encoding)
   * route.buildUrl({ id: rawUrlPart("hello world") }) // → "https://example.com/items/hello world"
   *
   */
  const buildUrl = (params = {}) => {
    const { relativeUrl, hasRawUrlPartWithInvalidChars } =
      buildRelativeUrl(params);
    let processedRelativeUrl = relativeUrl;
    if (processedRelativeUrl[0] === "/") {
      // we remove the leading slash because we want to resolve against baseUrl which may
      // not be the root url
      processedRelativeUrl = processedRelativeUrl.slice(1);
    }
    if (hasRawUrlPartWithInvalidChars) {
      if (!baseUrl.endsWith("/")) {
        return `${baseUrl}/${processedRelativeUrl}`;
      }
      return `${baseUrl}${processedRelativeUrl}`;
    }
    const url = new URL(processedRelativeUrl, baseUrl).href;
    return url;
  };
  route.buildUrl = buildUrl;

  const matchingSignal = signal(false);
  const rawParamsSignal = signal(null);
  const paramsSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    if (!rawParams && urlParamMap.size === 0) {
      return rawParams;
    }
    const mergedParams = {};
    const paramNameSet = new Set(urlParamMap.keys());

    // First, add raw params that have defined values
    if (rawParams) {
      for (const name of Object.keys(rawParams)) {
        const value = rawParams[name];
        if (value !== undefined) {
          mergedParams[name] = rawParams[name];
          paramNameSet.delete(name);
        }
      }
    }

    // Then, for parameters not in URL, check localStorage and apply defaults
    for (const paramName of paramNameSet) {
      const paramConfig = urlParamMap.get(paramName);
      const { default: defaultValue } = paramConfig;
      // Always check localStorage as source of truth
      const storedValue = routeParamStorage.getStoredParam(paramConfig);
      if (storedValue !== null) {
        mergedParams[paramName] = storedValue;
        continue;
      }
      // Apply default if no stored value
      if (defaultValue !== undefined) {
        mergedParams[paramName] = defaultValue;
      }
    }

    return mergedParams;
  });
  const visitedSignal = signal(false);
  const relativeUrlSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    const { relativeUrl } = buildRelativeUrl(rawParams);
    return relativeUrl;
  });
  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = relativeUrlSignal.value;
  });
  cleanupCallbackSet.add(disposeRelativeUrlEffect);

  const urlSignal = computed(() => {
    const relativeUrl = relativeUrlSignal.value;
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  });
  const disposeUrlEffect = effect(() => {
    route.url = urlSignal.value;
  });
  cleanupCallbackSet.add(disposeUrlEffect);

  const replaceParams = (newParams) => {
    // Use resolved params as base (includes inheritance) but remove defaults to avoid URL pollution
    const currentResolvedParams = resolveParams();
    const currentRawParams = rawParamsSignal.peek() || {};

    // For URL building: merge with raw params to avoid including unnecessary defaults
    const updatedUrlParams = { ...currentRawParams, ...newParams };
    const updatedUrl = route.buildUrl(updatedUrlParams);

    if (route.action) {
      // For action: merge with resolved params (includes defaults) so action gets complete params
      const updatedActionParams = { ...currentResolvedParams, ...newParams };
      route.action.replaceParams(updatedActionParams);
    }

    browserIntegration.navTo(updatedUrl, { replace: true });
  };
  route.replaceParams = replaceParams;

  const bindAction = (action) => {
    /*
     *
     * here I need to check the store for that action (if any)
     * and listen store changes to do this:
     *
     * When we detect changes we want to update the route params
     * so we'll need to use navTo(buildUrl(params), { replace: true })
     *
     * reinserted is useful because the item id might have changed
     * but not the mutable key
     *
     */

    const { store } = action.meta;
    if (store) {
      const { mutableIdKeys } = store;
      if (mutableIdKeys.length) {
        const mutableIdKey = mutableIdKeys[0];
        const mutableIdValueSignal = computed(() => {
          const params = paramsSignal.value;
          const mutableIdValue = params[mutableIdKey];
          return mutableIdValue;
        });
        const routeItemSignal = store.signalForMutableIdKey(
          mutableIdKey,
          mutableIdValueSignal,
        );
        store.observeProperties(routeItemSignal, (propertyMutations) => {
          const mutableIdPropertyMutation = propertyMutations[mutableIdKey];
          if (!mutableIdPropertyMutation) {
            return;
          }
          route.replaceParams({
            [mutableIdKey]: mutableIdPropertyMutation.newValue,
          });
        });
      }
    }

    /*
    store.registerPropertyLifecycle(activeItemSignal, key, {
    changed: (value) => {
      route.replaceParams({
        [key]: value,
      });
    },
    dropped: () => {
      route.reload();
    },
    reinserted: () => {
      // this will reload all routes which works but
      // - most of the time only "route" is impacted, any other route could stay as is
      // - we already have the data, reloading the route will refetch the backend which is unnecessary
      // we could just remove routing error (which is cause by 404 likely)
      // to actually let the data be displayed
      // because they are available, but in reality the route has no data
      // because the fetch failed
      // so conceptually reloading is fine,
      // the only thing that bothers me a little is that it reloads all routes
      route.reload();
    },
  });
    */

    const actionBoundToThisRoute = action.bindParams(paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };
  route.bindAction = bindAction;

  private_properties: {
    routePrivateProperties.matchingSignal = matchingSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
    routePrivateProperties.rawParamsSignal = rawParamsSignal;
    routePrivateProperties.visitedSignal = visitedSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
    routePrivateProperties.urlSignal = urlSignal;
    routePrivateProperties.cleanupCallbackSet = cleanupCallbackSet;
    const routePattern = createRoutePattern(urlPatternInput, baseUrl);
    routePrivateProperties.routePattern = routePattern;
  }

  return route;
};
export const useRouteStatus = (route) => {
  if (import.meta.dev && (!route || !route.isRoute)) {
    throw new TypeError(
      `useRouteStatus() requires a route object, but received ${route}.`,
    );
  }
  const routePrivateProperties = getRoutePrivateProperties(route);
  if (!routePrivateProperties) {
    if (import.meta.dev) {
      let errorMessage = `Cannot find route private properties for ${route}.`;

      errorMessage += `\nThis might be caused by hot reloading - try refreshing the page.`;
      throw new Error(errorMessage);
    }
    throw new Error(`Cannot find route private properties for ${route}`);
  }

  const { urlSignal, matchingSignal, paramsSignal, visitedSignal } =
    routePrivateProperties;

  const url = urlSignal.value;
  const matching = matchingSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    matching,
    params,
    visited,
  };
};

let browserIntegration;
export const setBrowserIntegration = (integration) => {
  browserIntegration = integration;
};

let onRouteDefined = () => {};
export const setOnRouteDefined = (v) => {
  onRouteDefined = v;
};
/**
 * Define all routes for the application.
 *
 * ⚠️ HOT RELOAD WARNING: When destructuring the returned routes, use 'let' instead of 'const'
 * to allow hot reload to update the route references:
 *
 * ❌ const [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({...})
 * ✅ let [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({...})
 *
 * @param {Object} routeDefinition - Object mapping URL patterns to actions
 * @returns {Array} Array of route objects in the same order as the keys
 */
// All routes MUST be created at once because any url can be accessed
// at any given time (url can be shared, reloaded, etc..)
// Later I'll consider adding ability to have dynamic import into the mix
// (An async function returning an action)
export const setupRoutes = (routeDefinition) => {
  // Clean up existing routes
  for (const route of routeSet) {
    route.cleanup();
  }
  routeSet.clear();

  const routes = {};
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = createRoute(value);
    routes[key] = route;
  }

  setTimeout(() => {
    // give a chance to call addUrlParam
    // TODO: better API to avoid relying on this ugly hack
    onRouteDefined();
  });

  return routes;
};

// unit test exports
export { createRoute };
