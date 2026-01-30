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

    // URL -> Signal synchronization (moved from individual route effects to eliminate circular dependency)
    for (const {
      route,
      routePrivateProperties,
      newMatching,
    } of routeMatchInfoSet) {
      const { routePattern } = routePrivateProperties;
      const { connections } = routePattern;

      for (const {
        signal: stateSignal,
        paramName,
        options = {},
      } of connections) {
        const { debug } = options;
        const params = routePrivateProperties.rawParamsSignal.value;
        const urlParamValue = params[paramName];

        if (!newMatching) {
          // Route doesn't match - check if any matching route extracts this parameter
          let parameterExtractedByMatchingRoute = false;
          let matchingRouteInSameFamily = false;

          for (const otherRoute of routeSet) {
            if (otherRoute === route || !otherRoute.matching) {
              continue;
            }
            const otherRouteProperties = getRoutePrivateProperties(otherRoute);
            const otherParams = otherRouteProperties.rawParamsSignal.value;

            // Check if this matching route extracts the parameter
            if (paramName in otherParams) {
              parameterExtractedByMatchingRoute = true;
            }

            // Check if this matching route is in the same family using parent-child relationships
            const thisPatternObj = routePattern;
            const otherPatternObj = otherRouteProperties.routePattern;

            // Routes are in same family if they share a hierarchical relationship:
            // 1. One is parent/ancestor of the other
            // 2. They share a common parent/ancestor
            let inSameFamily = false;

            // Check if other route is ancestor of this route
            let currentParent = thisPatternObj.parent;
            while (currentParent) {
              if (currentParent === otherPatternObj) {
                inSameFamily = true;
                break;
              }
              currentParent = currentParent.parent;
            }

            // Check if this route is ancestor of other route
            if (!inSameFamily) {
              currentParent = otherPatternObj.parent;
              while (currentParent) {
                if (currentParent === thisPatternObj) {
                  inSameFamily = true;
                  break;
                }
                currentParent = currentParent.parent;
              }
            }

            // Check if they share a common parent (siblings or cousins)
            if (!inSameFamily) {
              const thisAncestors = new Set();
              currentParent = thisPatternObj.parent;
              while (currentParent) {
                thisAncestors.add(currentParent);
                currentParent = currentParent.parent;
              }

              currentParent = otherPatternObj.parent;
              while (currentParent) {
                if (thisAncestors.has(currentParent)) {
                  inSameFamily = true;
                  break;
                }
                currentParent = currentParent.parent;
              }
            }

            if (inSameFamily) {
              matchingRouteInSameFamily = true;
            }
          }

          // Only reset signal if:
          // 1. We're navigating within the same route family (not to completely unrelated routes)
          // 2. AND no matching route extracts this parameter from URL
          // 3. AND parameter has no default value (making it truly optional)
          if (matchingRouteInSameFamily && !parameterExtractedByMatchingRoute) {
            const defaultValue = routePattern.parameterDefaults?.get(paramName);
            if (defaultValue === undefined) {
              // Parameter is not extracted within same family and has no default - reset it
              if (debug) {
                console.debug(
                  `[route] Same family navigation, ${paramName} not extracted and has no default: resetting signal`,
                );
              }
              stateSignal.value = undefined;
            } else if (debug) {
              // Parameter has a default value - preserve current signal value
              console.debug(
                `[route] Parameter ${paramName} has default value ${defaultValue}: preserving signal value: ${stateSignal.value}`,
              );
            }
          } else if (debug) {
            if (!matchingRouteInSameFamily) {
              console.debug(
                `[route] Different route family: preserving ${paramName} signal value: ${stateSignal.value}`,
              );
            } else {
              console.debug(
                `[route] Parameter ${paramName} extracted by matching route: preserving signal value: ${stateSignal.value}`,
              );
            }
          }
          continue;
        }

        // URL -> Signal sync: When route matches, ensure signal matches URL state
        // URL is the source of truth for explicit parameters
        const value = stateSignal.peek();
        if (urlParamValue === undefined) {
          // No URL parameter - reset signal to its current default value
          // (handles both static fallback and dynamic default cases)
          const defaultValue = options.getDefaultValue();
          if (value === defaultValue) {
            // Signal already has correct default value, no sync needed
            continue;
          }
          if (debug) {
            console.debug(
              `[route] URL->Signal: ${paramName} not in URL, reset signal to default (${defaultValue})`,
            );
          }
          stateSignal.value = defaultValue;
          continue;
        }
        if (urlParamValue === value) {
          // Values already match, no sync needed
          continue;
        }
        if (debug) {
          console.debug(
            `[route] URL->Signal: ${paramName}=${urlParamValue} in url, sync signal with url`,
          );
        }
        stateSignal.value = urlParamValue;
        continue;
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
    const resolvedParams = routePattern.resolveParams(rawParams);
    return resolvedParams;
  });
  const visitedSignal = signal(false);

  // Keep route.params synchronized with computed paramsSignal
  // This ensures route.params includes parameters from child routes
  effect(() => {
    const computedParams = paramsSignal.value;
    if (route.params !== computedParams) {
      route.params = computedParams;
    }
  });

  for (const { signal: stateSignal, paramName, options = {} } of connections) {
    const { debug } = options;

    if (debug) {
      console.debug(
        `[route] connecting url param "${paramName}" to signal`,
        stateSignal,
      );
    }

    // URL -> Signal synchronization now handled in updateRoutes() to eliminate circular dependency

    // Signal -> URL sync: When signal changes, update URL to reflect meaningful state
    // Only sync non-default values to keep URLs clean (static fallbacks stay invisible)
    effect(() => {
      const value = stateSignal.value;
      const params = rawParamsSignal.value;
      const urlParamValue = params[paramName];
      const matching = matchingSignal.value;

      if (!matching) {
        // Route not matching, no URL sync needed
        return;
      }
      if (urlParamValue === undefined) {
        // No URL parameter exists - check if signal has meaningful value to add
        const defaultValue = options.getDefaultValue();
        if (value === defaultValue) {
          // Signal using default value, keep URL clean (no parameter needed)
          return;
        }
        if (debug) {
          console.debug(
            `[route] Signal->URL: ${paramName} adding custom value ${value} to URL (default: ${defaultValue})`,
          );
        }
        route.replaceParams({ [paramName]: value });
        return;
      }
      if (value === urlParamValue) {
        // Values already match, no sync needed
        return;
      }
      if (debug) {
        console.debug(
          `[route] Signal->URL: ${paramName} updating URL ${urlParamValue} -> ${value}`,
        );
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
