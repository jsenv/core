/**
 *
 *
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { buildRouteRelativeUrl } from "./build_route_relative_url.js";
import { createRoutePattern } from "./route_pattern.js";

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
      exactMatching: false,
      params: null,
    };
    const oldMatching = previousState.matching;
    const oldExactMatching = previousState.exactMatching;
    const oldParams = previousState.params;
    const extractedParams = routePattern.applyOn(url);
    const newMatching = Boolean(extractedParams);

    // Calculate exact matching - true when matching but no wildcards have content
    let newExactMatching = false;
    if (newMatching && extractedParams) {
      // Check if any wildcard parameters (numeric keys) have meaningful content
      const hasWildcardContent = Object.keys(extractedParams).some((key) => {
        const keyAsNumber = parseInt(key, 10);
        if (!isNaN(keyAsNumber)) {
          // This is a wildcard parameter (numeric key)
          const value = extractedParams[key];
          return value && value.trim() !== "";
        }
        return false;
      });
      newExactMatching = !hasWildcardContent;
    }
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
      oldExactMatching,
      newExactMatching,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      matching: newMatching,
      exactMatching: newExactMatching,
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
      newExactMatching,
      newParams,
    } of routeMatchInfoSet) {
      const { updateStatus } = routePrivateProperties;
      const visited = isVisited(route.url);
      updateStatus({
        matching: newMatching,
        exactMatching: newExactMatching,
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
    exactMatching: false,
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
    exactMatchingSignal: null,
    paramsSignal: null,
    visitedSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
    updateStatus: ({ matching, exactMatching, params, visited }) => {
      let someChange = false;
      matchingSignal.value = matching;
      exactMatchingSignal.value = exactMatching;
      paramsSignal.value = params;
      visitedSignal.value = visited;
      if (route.matching !== matching) {
        route.matching = matching;
        someChange = true;
      }
      if (route.exactMatching !== exactMatching) {
        route.exactMatching = exactMatching;
        someChange = true;
      }
      if (route.params !== params) {
        route.params = params;
        someChange = true;
      }
      if (route.visited !== visited) {
        route.visited = visited;
        someChange = true;
      }
      if (someChange) {
        if (DEBUG) {
          console.debug(`${route} status changed:`, {
            matching,
            exactMatching,
            params,
            visited,
          });
        }
        publishStatus({ matching, exactMatching, params, visited });
      }
    },
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);

  const buildRelativeUrl = (params, options) =>
    buildRouteRelativeUrl(urlPatternInput, params, options);
  route.buildRelativeUrl = (params, options) => {
    const { relativeUrl } = buildRelativeUrl(params, options);
    return relativeUrl;
  };

  route.matchesParams = (otherParams) => {
    let params = route.params;
    if (params) {
      const paramsWithoutWildcards = {};
      for (const key of Object.keys(params)) {
        if (!Number.isInteger(Number(key))) {
          paramsWithoutWildcards[key] = params[key];
        }
      }
      params = paramsWithoutWildcards;
    }
    const paramsIsFalsyOrEmpty = !params || Object.keys(params).length === 0;
    const otherParamsFalsyOrEmpty =
      !otherParams || Object.keys(otherParams).length === 0;
    if (paramsIsFalsyOrEmpty) {
      return otherParamsFalsyOrEmpty;
    }
    if (otherParamsFalsyOrEmpty) {
      return false;
    }
    return compareTwoJsValues(params, otherParams);
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
  const exactMatchingSignal = signal(false);
  const paramsSignal = signal(null);
  const visitedSignal = signal(false);
  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const { relativeUrl } = buildRelativeUrl(params);
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
    const currentParams = paramsSignal.peek();
    const updatedParams = { ...currentParams, ...newParams };
    const updatedUrl = route.buildUrl(updatedParams);
    if (route.action) {
      route.action.replaceParams(updatedParams);
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
    routePrivateProperties.exactMatchingSignal = exactMatchingSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
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

  const {
    urlSignal,
    matchingSignal,
    exactMatchingSignal,
    paramsSignal,
    visitedSignal,
  } = routePrivateProperties;

  const url = urlSignal.value;
  const matching = matchingSignal.value;
  const exactMatching = exactMatchingSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    matching,
    exactMatching,
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
  onRouteDefined();
  return routes;
};

// unit test exports
export { createRoute };
