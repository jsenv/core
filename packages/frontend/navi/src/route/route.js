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

const DEBUG = false;
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
      const { optionalParamKeySet } = routePrivateProperties;
      const extractedParams = extractParams(
        urlPattern,
        url,
        optionalParamKeySet,
      );
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
      const { activeSignal, paramsSignal, visitedSignal } =
        routePrivateProperties;
      const visited = isVisited(route.url);
      activeSignal.value = newActive;
      paramsSignal.value = newParams;
      visitedSignal.value = visited;
      route.active = newActive;
      route.params = newParams;
      route.visited = visited;
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
          `Route ${routePrivateProperties.urlPattern} became active with params:`,
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
        console.debug(
          `Route ${routePrivateProperties.urlPattern} params changed:`,
          newParams,
        );
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
const extractParams = (urlPattern, url, ignoreSet = new Set()) => {
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
            // Only include non-empty values and non-ignored wildcard indices
            const wildcardKey = String(wildcardOffset + keyAsNumber);
            if (!ignoreSet.has(wildcardKey)) {
              params[wildcardKey] = decodeURIComponent(value);
            }
            localWildcardCount++;
          }
        } else if (!ignoreSet.has(key)) {
          // Named group (:param or {param}) - only include if not ignored
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
  };
  routeSet.add(route);

  const routePrivateProperties = {
    urlPattern: undefined,
    activeSignal: null,
    paramsSignal: null,
    visitedSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
    optionalParamKeySet: null,
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);

  const buildRelativeUrl = (params = {}) => {
    let relativeUrl = urlPatternInput;

    // Replace named parameters (:param and {param})
    for (const key of Object.keys(params)) {
      const value = params[key];
      const encodedValue = encodeURIComponent(value);
      relativeUrl = relativeUrl.replace(`:${key}`, encodedValue);
      relativeUrl = relativeUrl.replace(`{${key}}`, encodedValue);
    }

    // Handle wildcards: if the pattern ends with /*? (optional wildcard)
    // always remove the wildcard part for URL building since it's optional
    if (relativeUrl.endsWith("/*?")) {
      // Always remove the optional wildcard part for URL building
      relativeUrl = relativeUrl.replace(/\/\*\?$/, "");
    } else {
      // For required wildcards (/*) or other patterns, replace normally
      let wildcardIndex = 0;
      relativeUrl = relativeUrl.replace(/\*/g, () => {
        const paramKey = wildcardIndex.toString();
        const replacement = params[paramKey]
          ? encodeURIComponent(params[paramKey])
          : "*";
        wildcardIndex++;
        return replacement;
      });
    }

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
  const visitedSignal = signal(false);
  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const relativeUrl = buildRelativeUrl(params);
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
    browserIntegration.goTo(updatedUrl, { replace: true });
  };
  route.replaceParams = replaceParams;

  const bindAction = (action) => {
    /*
     *
     * here I need to check the store for that action (if any)
     * and listen store changes to do this:
     *
     * When we detect changes we want to update the route params
     * so we'll need to use goTo(buildUrl(params), { replace: true })
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
    routePrivateProperties.visitedSignal = visitedSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
    routePrivateProperties.urlSignal = urlSignal;
    routePrivateProperties.cleanupCallbackSet = cleanupCallbackSet;

    // Analyze pattern once to detect optional params (named and wildcard indices)
    // Note: Wildcard indices are stored as strings ("0", "1", ...) to match keys from extractParams
    const optionalParamKeySet = new Set();
    normalizedUrlPattern.replace(/:([A-Za-z0-9_]+)\?/g, (_m, name) => {
      optionalParamKeySet.add(name);
      return "";
    });
    let wildcardIndex = 0;
    normalizedUrlPattern.replace(/\*(\?)?/g, (_m, opt) => {
      if (opt === "?") {
        optionalParamKeySet.add(String(wildcardIndex));
      }
      wildcardIndex++;
      return "";
    });
    routePrivateProperties.optionalParamKeySet = optionalParamKeySet;
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
export const defineRoutes = (routeDefinition) => {
  // Clean up existing routes
  for (const route of routeSet) {
    route.cleanup();
  }
  routeSet.clear();

  const routeArray = [];
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = createRoute(key);
    if (value && value.isAction) {
      route.bindAction(value);
    } else if (typeof value === "function") {
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

// unit test exports
export { createRoute };
