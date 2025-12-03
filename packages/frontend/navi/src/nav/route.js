/**
 *
 *
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { buildRouteRelativeUrl } from "./build_route_relative_url.js";
import { NO_PARAMS, createRoutePattern } from "./route_pattern.js";

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
      active: false,
      params: NO_PARAMS,
    };
    const oldActive = previousState.active;
    const oldParams = previousState.params;
    const extractedParams = routePattern.applyOn(url);
    const newActive = Boolean(extractedParams);
    let newParams;
    if (extractedParams) {
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
  const activeRouteSet = new Set();
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newActive,
      newParams,
    } of routeMatchInfoSet) {
      const { updateStatus } = routePrivateProperties;
      const visited = isVisited(route.url);
      updateStatus({
        active: newActive,
        params: newParams,
        visited,
      });
      if (newActive) {
        activeRouteSet.add(route);
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
          `${routePrivateProperties} became active with params:`,
          newParams,
        );
      }
      shouldLoad(route);
      continue;
    }

    // Handle actions for routes that become inactive - abort them
    if (becomesInactive && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      shouldAbort(route);
      continue;
    }

    // Handle parameter changes while route stays active
    if (paramsChangedWhileActive) {
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
    activeRouteSet,
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
    active: false,
    params: NO_PARAMS,
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
    activeSignal: null,
    paramsSignal: null,
    visitedSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
    updateStatus: ({ active, params, visited }) => {
      let someChange = false;
      activeSignal.value = active;
      paramsSignal.value = params;
      visitedSignal.value = visited;
      if (route.active !== active) {
        route.active = active;
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
            active,
            params,
            visited,
          });
        }
        publishStatus({ active, params, visited });
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
      processedRelativeUrl = processedRelativeUrl.slice(1);
    }
    if (hasRawUrlPartWithInvalidChars) {
      return `${baseUrl}${processedRelativeUrl}`;
    }
    const url = new URL(processedRelativeUrl, baseUrl).href;
    return url;
  };
  route.buildUrl = buildUrl;

  const activeSignal = signal(false);
  const paramsSignal = signal(NO_PARAMS);
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
    routePrivateProperties.activeSignal = activeSignal;
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

  const { urlSignal, activeSignal, paramsSignal, visitedSignal } =
    routePrivateProperties;

  const url = urlSignal.value;
  const active = activeSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    active,
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
