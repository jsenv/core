/**
 * Route management with pattern-first architecture
 * Routes work with relative URLs, patterns handle base URL resolution
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { resolveRouteUrl, setupPatterns } from "./route_pattern.js";

const DEBUG = false;

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

const registerRoute = (routePattern) => {
  const urlPatternRaw = routePattern.originalPattern;
  if (DEBUG) {
    console.debug(`Creating route: ${urlPatternRaw}`);
  }
  const { cleanPattern, connections } = routePattern;

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

  const matchingSignal = signal(false);
  const rawParamsSignal = signal(ROUTE_NOT_MATCHING_PARAMS);
  const paramsSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    // Pattern system handles parameter defaults, routes just work with raw params
    return rawParams || {};
  });
  const visitedSignal = signal(false);
  for (const { signal: stateSignal, paramName, options = {} } of connections) {
    const { debug } = options;

    if (debug) {
      console.debug(
        `[route] connecting param "${paramName}" to signal`,
        stateSignal,
      );
    }

    // URL -> Signal synchronization with parent-child route hierarchy checking
    effect(() => {
      const matching = matchingSignal.value;
      const params = rawParamsSignal.value;
      const urlParamValue = params[paramName];

      if (debug) {
        console.debug(
          `[route] URL->Signal effect triggered for ${paramName}: matching=${matching}, urlParamValue=${urlParamValue}, currentSignalValue=${stateSignal.value}`,
        );
      }

      if (matching) {
        // When route matches, sync signal with URL parameter value
        // This ensures URL is the source of truth
        if (debug) {
          console.debug(
            `[route] Route matching: setting ${paramName} signal to URL value: ${urlParamValue}`,
          );
        }
        stateSignal.value = urlParamValue;
      } else {
        // When route doesn't match, check if we're navigating to a parent route
        let parentRouteMatching = false;
        for (const otherRoute of routeSet) {
          if (otherRoute === route || !otherRoute.matching) {
            continue;
          }
          const otherRouteProperties = getRoutePrivateProperties(otherRoute);
          const otherPatternObj = otherRouteProperties.routePattern;

          // Check if the other route pattern is a parent of this route pattern
          // Using the built relationships in the pattern objects
          let currentParent = routePattern.parent;
          let foundParent = false;
          while (currentParent) {
            if (currentParent === otherPatternObj) {
              foundParent = true;
              break;
            }
            currentParent = currentParent.parent;
          }

          if (!foundParent) {
            continue;
          }

          // Found a parent route that's matching, but check if there's a more specific
          // sibling route also matching (indicating sibling navigation, not parent navigation)
          let hasMatchingSibling = false;
          for (const siblingCandidateRoute of routeSet) {
            if (
              siblingCandidateRoute === route ||
              siblingCandidateRoute === otherRoute ||
              !siblingCandidateRoute.matching
            ) {
              continue;
            }

            const siblingProperties = getRoutePrivateProperties(
              siblingCandidateRoute,
            );
            const siblingPatternObj = siblingProperties.routePattern;

            // Check if this is a sibling (shares the same parent)
            if (siblingPatternObj.parent === currentParent) {
              hasMatchingSibling = true;
              break;
            }
          }

          // Only treat as parent navigation if no sibling is matching
          if (!hasMatchingSibling) {
            parentRouteMatching = true;
            break; // Found the parent route, no need to check other routes
          }
        }

        if (parentRouteMatching) {
          // We're navigating to a parent route - clear this signal to reflect the hierarchy
          const defaultValue = routePattern.parameterDefaults?.get(paramName);
          if (debug) {
            console.debug(
              `[route] Parent route ${parentRouteMatching} matching: clearing ${paramName} signal to default: ${defaultValue}`,
            );
          }
          stateSignal.value = defaultValue;
        } else if (debug) {
          // We're navigating to a different route family - preserve signal for future URL building
          // Keep current signal value unchanged
          console.debug(
            `[route] Different route family: preserving ${paramName} signal value: ${stateSignal.value}`,
          );
        }
      }
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

  route.navTo = (params) => {
    if (!browserIntegration) {
      if (import.meta.dev) {
        console.warn(
          `navTo called but browserIntegration not set for route ${route}`,
        );
      }
      return Promise.resolve();
    }
    const routeUrl = route.buildUrl(params);
    return browserIntegration.navTo(routeUrl);
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
  route.replaceParams = (newParams) => {
    const matching = matchingSignal.peek();
    if (!matching) {
      console.warn(
        `Cannot replace params on route ${route} because it is not matching the current URL.`,
      );
      return null;
    }

    // Find all matching routes and update their actions, then delegate to most specific
    const allMatchingRoutes = Array.from(routeSet).filter((r) => r.matching);

    // Update action params on all matching routes
    for (const matchingRoute of allMatchingRoutes) {
      if (matchingRoute.action) {
        const matchingRoutePrivateProperties =
          getRoutePrivateProperties(matchingRoute);
        if (matchingRoutePrivateProperties) {
          const { routePattern: matchingRoutePattern } =
            matchingRoutePrivateProperties;
          const currentResolvedParams = matchingRoutePattern.resolveParams();
          const updatedActionParams = {
            ...currentResolvedParams,
            ...newParams,
          };
          matchingRoute.action.replaceParams(updatedActionParams);
        }
      }
    }

    // Find the most specific route using pattern depth (deeper = more specific)
    let mostSpecificRoute = route;
    const routePrivateProperties = getRoutePrivateProperties(route);
    let maxDepth = routePrivateProperties.routePattern.depth;

    for (const matchingRoute of allMatchingRoutes) {
      if (matchingRoute === route) {
        continue;
      }
      const matchingRoutePrivateProperties =
        getRoutePrivateProperties(matchingRoute);
      const depth = matchingRoutePrivateProperties.routePattern.depth;

      if (depth > maxDepth) {
        maxDepth = depth;
        mostSpecificRoute = matchingRoute;
      }
    }

    // If we found a more specific route, delegate to it; otherwise handle it ourselves
    if (mostSpecificRoute !== route) {
      if (DEBUG) {
        console.debug(
          `${route} delegating redirect to more specific route ${mostSpecificRoute}`,
        );
      }
      return mostSpecificRoute.redirectTo(newParams);
    }

    // This route is the most specific, handle the redirect ourselves
    return route.redirectTo(newParams);
  };
  route.buildRelativeUrl = (params) => {
    // buildMostPreciseUrl now handles parameter resolution internally
    return routePattern.buildMostPreciseUrl(params);
  };
  route.buildUrl = (params) => {
    const routeRelativeUrl = route.buildRelativeUrl(params);
    const routeUrl = resolveRouteUrl(routeRelativeUrl);
    return routeUrl;
  };
  route.matchesParams = (providedParams) => {
    const currentParams = route.params;
    const resolvedParams = routePattern.resolveParams({
      ...currentParams,
      ...providedParams,
    });
    const same = compareTwoJsValues(currentParams, resolvedParams);
    return same;
  };

  // relativeUrl/url
  const relativeUrlSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    const relativeUrl = route.buildRelativeUrl(rawParams);
    return relativeUrl;
  });
  const urlSignal = computed(() => {
    const routeUrl = route.buildUrl();
    return routeUrl;
  });
  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = relativeUrlSignal.value;
  });
  const disposeUrlEffect = effect(() => {
    route.url = urlSignal.value;
  });
  cleanupCallbackSet.add(disposeRelativeUrlEffect);
  cleanupCallbackSet.add(disposeUrlEffect);

  // action stuff (for later)
  route.bindAction = (action) => {
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
  // PHASE 1: Setup patterns with unified objects (includes all relationships and signal connections)
  const routePatterns = setupPatterns(routeDefinition);

  // PHASE 2: Create routes using the unified pattern objects
  const routes = {};
  for (const key of Object.keys(routeDefinition)) {
    const routePattern = routePatterns[key];
    const route = registerRoute(routePattern);
    routes[key] = route;
  }
  onRouteDefined();

  return routes;
};

// for unit tests
export const clearAllRoutes = () => {
  for (const route of routeSet) {
    route.cleanup();
  }
  routeSet.clear();
  routePrivatePropertiesMap.clear();
  // Pattern registry is now local to setupPatterns, no global cleanup needed
  // Don't clear signal registry here - let tests manage it explicitly
  // This prevents clearing signals that are still being used across multiple route registrations
};
