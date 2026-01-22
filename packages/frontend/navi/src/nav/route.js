/**
 * Route management with custom pattern matching system
 * Replaces URLPattern-based approach with simpler, more predictable matching
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import {
  baseUrl,
  buildMostPreciseUrl,
  clearPatterns,
  createRoutePattern,
  getPatternData,
  setupPatterns,
} from "./route_pattern.js";
import { resolveRouteUrl } from "./route_url.js";

const DEBUG = false;

/**
 * Route inheritance system - simplified approach
 */

// Controls what happens to actions when their route stops matching:
// 'abort' - Cancel the action immediately when route stops matching
// 'keep-loading' - Allow action to continue running after route stops matching
//
// The 'keep-loading' strategy could act like preloading, keeping data ready for potential return.
// However, since route reactivation triggers action reload anyway, the old data won't be used
// so it's better to abort the action to avoid unnecessary resource usage.
const ROUTE_DEACTIVATION_STRATEGY = "abort"; // 'abort', 'keep-loading'
const ROUTE_NOT_MATCHING_PARAMS = {};

const routeSet = new Set();
// Store previous route states to detect changes
const routePrivatePropertiesMap = new Map();

const routePreviousStateMap = new WeakMap();
// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();

export const updateRoutes = (
  url,
  {
    navigationType = "push",
    isVisited = () => false,
    // state
  } = {},
) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { routePattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      matching: false,
      params: ROUTE_NOT_MATCHING_PARAMS,
    };
    const oldMatching = previousState.matching;
    const oldParams = previousState.params;

    // Use custom pattern matching - much simpler than URLPattern approach
    let extractedParams = routePattern.applyOn(url);
    let newMatching = Boolean(extractedParams);

    let newParams;

    if (extractedParams) {
      // No need for complex wildcard correction - custom system handles it properly
      if (compareTwoJsValues(oldParams, extractedParams)) {
        // No change in parameters, keep the old params
        newParams = oldParams;
      } else {
        newParams = extractedParams;
      }
    } else {
      newParams = ROUTE_NOT_MATCHING_PARAMS;
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
      if (
        navigationType === "replace" ||
        currentAction.aborted ||
        currentAction.error
      ) {
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

export const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};

const registerRoute = (urlPatternRaw) => {
  if (DEBUG) {
    console.debug(`Creating route: ${urlPatternRaw}`);
  }

  // Get pre-registered pattern data
  const patternData = getPatternData(urlPatternRaw);
  if (!patternData) {
    throw new Error(
      `Pattern ${urlPatternRaw} not found in registry. Make sure to call setupRoutes() instead of registerRoute() directly.`,
    );
  }

  const { cleanPattern, connections } = patternData;

  // Create route pattern with connections
  const routePattern = createRoutePattern(urlPatternRaw);

  // Build parameter defaults from signal connections
  const parameterDefaults = new Map();
  for (const { paramName, options = {} } of connections) {
    if (options.defaultValue !== undefined) {
      parameterDefaults.set(paramName, options.defaultValue);
    }
  }

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const [publishStatus, subscribeStatus] = createPubSub();

  const route = {
    urlPattern: cleanPattern,
    pattern: cleanPattern,
    isRoute: true,
    matching: false,
    params: ROUTE_NOT_MATCHING_PARAMS,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
    action: null,
    cleanup,
    toString: () => {
      return `route "${cleanPattern}"`;
    },
    replaceParams: undefined,
    subscribeStatus,
  };

  routeSet.add(route);

  const routePrivateProperties = {
    routePattern,
    originalPattern: urlPatternRaw,
    pattern: cleanPattern,
    connections,
    parameterDefaults,
    matchingSignal: null,
    paramsSignal: null,
    rawParamsSignal: null,
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

  const paramConfigMap = new Map();
  route.paramConfigMap = paramConfigMap;
  const matchingSignal = signal(false);
  const rawParamsSignal = signal(ROUTE_NOT_MATCHING_PARAMS);

  // Set up signal connections
  for (const { signal: stateSignal, paramName, options = {} } of connections) {
    const { debug } = options;
    paramConfigMap.set(paramName, {
      getFallbackValue: options.getFallbackValue,
      defaultValue: options.defaultValue,
    });

    // URL -> Signal synchronization
    effect(() => {
      const matching = matchingSignal.value;
      const params = rawParamsSignal.value;
      const urlParamValue = params[paramName];

      if (!matching) {
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal] URL -> Signal: ${paramName}=${urlParamValue}`,
        );
      }
      stateSignal.value = urlParamValue;
    });

    // Signal -> URL synchronization
    effect(() => {
      const value = stateSignal.value;
      const params = rawParamsSignal.value;
      const urlParamValue = params[paramName];
      const matching = matchingSignal.value;

      if (!matching || value === urlParamValue) {
        return;
      }

      if (debug) {
        console.debug(`[stateSignal] Signal -> URL: ${paramName}=${value}`);
      }

      route.replaceParams({ [paramName]: value });
    });
  }

  const paramsSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    if (!rawParams && paramConfigMap.size === 0) {
      return rawParams;
    }
    const mergedParams = {};

    // First, add raw params that have defined values
    if (rawParams) {
      for (const name of Object.keys(rawParams)) {
        const value = rawParams[name];
        if (value !== undefined) {
          mergedParams[name] = value;
        }
      }
    }

    // Then add defaults for parameters not in raw params
    for (const [paramName, paramConfig] of paramConfigMap) {
      if (!(paramName in mergedParams)) {
        const { defaultValue } = paramConfig;
        if (defaultValue !== undefined) {
          mergedParams[paramName] = defaultValue;
        }
      }
    }

    return mergedParams;
  });

  const visitedSignal = signal(false);

  route.navTo = (params) => {
    if (!browserIntegration) {
      if (import.meta.dev) {
        console.warn(
          `navTo called but browserIntegration not set for route ${route}`,
        );
      }
      return Promise.resolve();
    }
    return browserIntegration.navTo(route.buildUrl(params));
  };

  route.redirectTo = (params) => {
    if (!browserIntegration) {
      if (import.meta.dev) {
        console.warn(
          `redirectTo called but browserIntegration not set for route ${route}`,
        );
      }
      return Promise.resolve();
    }
    return browserIntegration.navTo(route.buildUrl(params), {
      replace: true,
    });
  };

  const replaceParams = (newParams) => {
    const matching = matchingSignal.peek();
    if (!matching) {
      console.warn(
        `Cannot replace params on route ${route} because it is not matching the current URL.`,
      );
      return null;
    }
    if (route.action) {
      // For action: merge with resolved params (includes defaults) so action gets complete params
      const currentResolvedParams = resolveParams();
      const updatedActionParams = { ...currentResolvedParams, ...newParams };
      route.action.replaceParams(updatedActionParams);
    }
    return route.redirectTo(newParams);
  };
  route.replaceParams = replaceParams;

  const resolveParams = (providedParams, { cleanupDefaults } = {}) => {
    const currentParams = rawParamsSignal.value;
    const paramNameSet = new Set();

    if (currentParams) {
      for (const paramName of Object.keys(currentParams)) {
        paramNameSet.add(paramName);
      }
    }
    if (providedParams) {
      for (const paramName of Object.keys(providedParams)) {
        paramNameSet.add(paramName);
      }
    }

    const mergedParams = {};

    // First, process parameters that have configurations (signals)
    for (const [paramName, paramConfig] of paramConfigMap) {
      if (paramNameSet.has(paramName)) {
        continue; // Will be handled in the second loop
      }
      const currentValue = currentParams?.[paramName];
      if (currentValue !== undefined) {
        mergedParams[paramName] = currentValue;
        continue;
      }
      const { getFallbackValue, defaultValue } = paramConfig;
      if (getFallbackValue) {
        const fallbackValue = getFallbackValue();
        if (fallbackValue !== undefined) {
          if (cleanupDefaults && fallbackValue === defaultValue) {
            continue;
          }
          mergedParams[paramName] = fallbackValue;
          continue;
        }
      }
      if (cleanupDefaults) {
        continue;
      }
      if (defaultValue !== undefined) {
        mergedParams[paramName] = defaultValue;
      }
    }

    // Then, process provided parameters
    for (const paramName of paramNameSet) {
      const providedValue = providedParams?.[paramName];
      const currentValue = currentParams?.[paramName];
      const valueToUse =
        providedValue !== undefined ? providedValue : currentValue;

      if (cleanupDefaults && providedValue === undefined) {
        const paramConfig = paramConfigMap.get(paramName);
        if (paramConfig && paramConfig.defaultValue === valueToUse) {
          continue;
        }
      }

      if (valueToUse !== undefined) {
        mergedParams[paramName] = valueToUse;
      }
    }

    return mergedParams;
  };

  route.buildRelativeUrl = (params) => {
    const resolvedParams = resolveParams(params, {
      cleanupDefaults: true, // Clean up defaults so we get shorter URLs
    });

    // Use most precise URL generation approach - delegate to pattern system
    const mostPreciseUrl = buildMostPreciseUrl(route, resolvedParams);
    return mostPreciseUrl;
  };

  route.matchesParams = (providedParams) => {
    const currentParams = route.params;
    const resolvedParams = resolveParams(providedParams);
    const same = compareTwoJsValues(currentParams, resolvedParams);
    return same;
  };

  // Create URL signals that can now access route relationships immediately
  const relativeUrlSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    const relativeUrl = route.buildRelativeUrl(rawParams);
    return relativeUrl;
  });

  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = relativeUrlSignal.value;
  });
  cleanupCallbackSet.add(disposeRelativeUrlEffect);

  const urlSignal = computed(() => {
    const routeUrl = route.builUrl();
    return routeUrl;
  });
  const buildUrl = (params) => {
    const routeRelativeUrl = route.buildRelativeUrl(params);
    const routeUrl = resolveRouteUrl(routeRelativeUrl, baseUrl);
    return routeUrl;
  };
  route.buildUrl = buildUrl;

  const disposeUrlEffect = effect(() => {
    route.url = urlSignal.value;
  });
  cleanupCallbackSet.add(disposeUrlEffect);

  const bindAction = (action) => {
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

    const actionBoundToThisRoute = action.bindParams(paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };
  route.bindAction = bindAction;

  // Store private properties for internal access
  routePrivateProperties.matchingSignal = matchingSignal;
  routePrivateProperties.paramsSignal = paramsSignal;
  routePrivateProperties.rawParamsSignal = rawParamsSignal;
  routePrivateProperties.visitedSignal = visitedSignal;
  routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
  routePrivateProperties.urlSignal = urlSignal;
  routePrivateProperties.cleanupCallbackSet = cleanupCallbackSet;

  return route;
};

export const unregisterRoute = (route) => {
  if (!route || !route.isRoute) {
    return false;
  }

  const wasRegistered = routeSet.has(route);
  if (wasRegistered) {
    route.cleanup();
    routeSet.delete(route);
    routePrivatePropertiesMap.delete(route);
    routePreviousStateMap.delete(route);
  }

  return wasRegistered;
};

export const clearAllRoutes = () => {
  for (const route of routeSet) {
    route.cleanup();
  }
  routeSet.clear();
  routePrivatePropertiesMap.clear();
  // Clear patterns as well
  clearPatterns();
  // Don't clear signal registry here - let tests manage it explicitly
  // This prevents clearing signals that are still being used across multiple route registrations
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
  // Prevent calling setupRoutes when routes already exist - enforce clean setup
  if (routeSet.size > 0) {
    throw new Error(
      "Routes already exist. Call clearAllRoutes() first to clean up existing routes before creating new ones. This prevents cross-test pollution and ensures clean state.",
    );
  }
  // PHASE 1: Register all patterns and build their relationships
  setupPatterns(routeDefinition);
  // PHASE 2: Create routes (patterns are ready, so routes can create signals immediately)
  const routes = {};
  for (const key of Object.keys(routeDefinition)) {
    const urlPatternRaw = routeDefinition[key];
    const route = registerRoute(urlPatternRaw);
    routes[key] = route;
  }
  onRouteDefined();

  return routes;
};
