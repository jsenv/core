/**
 * Route management with pattern-first architecture
 * Routes work with relative URLs, patterns handle base URL resolution
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { resolveRouteUrl, setupPatterns } from "./route_pattern.js";

const DEBUG = false;

/**
 * Set up all application routes with reactive state management.
 *
 * Creates route objects that automatically sync with the current URL and provide
 * reactive signals for building dynamic UIs. Each route tracks its matching state,
 * extracted parameters, and computed URLs.
 *
 * @example
 * ```js
 * import { setupRoutes, stateSignal } from "@jsenv/navi";
 *
 * const settingsTabSignal = stateSignal('general', { type: "string", oneOf: ['general', 'overview'] });
 *
 * let { USER_PROFILE } = setupRoutes({
 *   HOME: "/",
 *   SETTINGS: "/settings/:tab=${settingsTabSignal}/",
 * });
 *
 * USER_PROFILE.matching // boolean
 * USER_PROFILE.matchingSignal.value // reactive signal
 * settingsTabSignal.value = 'overview'; // updates URL automatically
 * ```
 *
 * ⚠️ HOT RELOAD: Use 'let' instead of 'const' when destructuring:
 * ```js
 * // ❌ const { HOME, USER_PROFILE } = setupRoutes({...})
 * // ✅ let { HOME, USER_PROFILE } = setupRoutes({...})
 * ```
 *
 * @param {Object} routeDefinition - Object mapping route names to URL patterns
 * @param {string} routeDefinition[key] - URL pattern with optional parameters
 * @returns {Object} Object with route names as keys and route objects as values
 * @returns {Object.<string, {
 *   pattern: string,
 *   matching: boolean,
 *   params: Object,
 *   url: string,
 *   relativeUrl: string,
 *   matchingSignal: import("@preact/signals").Signal<boolean>,
 *   paramsSignal: import("@preact/signals").Signal<Object>,
 *   urlSignal: import("@preact/signals").Signal<string>,
 *   navTo: (params?: Object) => Promise<void>,
 *   redirectTo: (params?: Object) => Promise<void>,
 *   replaceParams: (params: Object) => Promise<void>,
 *   buildUrl: (params?: Object) => string,
 *   buildRelativeUrl: (params?: Object) => string,
 * }>} Route objects with reactive state and navigation methods
 *
 * All routes MUST be created at once because any url can be accessed
 * at any given time (url can be shared, reloaded, etc..)
 */

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

export const useRouteStatus = (route) => {
  if (import.meta.dev && (!route || !route.isRoute)) {
    throw new TypeError(
      `useRouteStatus() requires a route object, but received ${route}.`,
    );
  }
  const { urlSignal, matchingSignal, paramsSignal, visitedSignal } = route;
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

// for unit tests
export const clearAllRoutes = () => {
  for (const [, routePrivateProperties] of routePrivatePropertiesMap) {
    routePrivateProperties.cleanup();
  }
  routeSet.clear();
  routePrivatePropertiesMap.clear();
  // Pattern registry is now local to setupPatterns, no global cleanup needed
  // Don't clear signal registry here - let tests manage it explicitly
  // This prevents clearing signals that are still being used across multiple route registrations
};

// Flag to prevent signal-to-URL synchronization during URL-to-signal synchronization
let isUpdatingRoutesFromUrl = false;

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
const routePrivatePropertiesMap = new Map();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};
// Store previous route states to detect changes
const routePreviousStateMap = new WeakMap();
// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();

/**
 * Get the isDefaultValue function for a signal from the registry
 * @param {import("@preact/signals").Signal} signal
 * @returns {Function}
 */
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
    // Prevent signal-to-URL synchronization during URL-to-signal synchronization
    isUpdatingRoutesFromUrl = true;

    for (const {
      route,
      routePrivateProperties,
      newMatching,
    } of routeMatchInfoSet) {
      const { routePattern } = routePrivateProperties;
      const { connectionMap } = routePattern;

      for (const [paramName, connection] of connectionMap) {
        const { signal: paramSignal, debug } = connection;
        const rawParams = route.rawParamsSignal.value;
        const urlParamValue = rawParams[paramName];

        if (!newMatching) {
          // Route doesn't match - check if any matching route extracts this parameter
          let parameterExtractedByMatchingRoute = false;
          let matchingRouteInSameFamily = false;

          for (const otherRoute of routeSet) {
            if (otherRoute === route || !otherRoute.matching) {
              continue;
            }
            const otherRawParams = otherRoute.rawParamsSignal.value;
            const otherRoutePrivateProperties =
              getRoutePrivateProperties(otherRoute);

            // Check if this matching route extracts the parameter
            if (paramName in otherRawParams) {
              parameterExtractedByMatchingRoute = true;
            }

            // Check if this matching route is in the same family using parent-child relationships
            const thisPatternObj = routePattern;
            const otherPatternObj = otherRoutePrivateProperties.routePattern;

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
            const defaultValue = connection.getDefaultValue();
            if (defaultValue === undefined) {
              // Parameter is not extracted within same family and has no default - reset it
              if (debug) {
                console.debug(
                  `[route] Same family navigation, ${paramName} not extracted and has no default: resetting signal`,
                );
              }
              paramSignal.value = undefined;
            } else if (debug) {
              // Parameter has a default value - preserve current signal value
              console.debug(
                `[route] Parameter ${paramName} has default value ${defaultValue}: preserving signal value: ${paramSignal.value}`,
              );
            }
          } else if (debug) {
            if (!matchingRouteInSameFamily) {
              console.debug(
                `[route] Different route family: preserving ${paramName} signal value: ${paramSignal.value}`,
              );
            } else {
              console.debug(
                `[route] Parameter ${paramName} extracted by matching route: preserving signal value: ${paramSignal.value}`,
              );
            }
          }
          continue;
        }

        // URL -> Signal sync: When route matches, ensure signal matches URL state
        // URL is the source of truth for explicit parameters
        const value = paramSignal.peek();
        if (urlParamValue === undefined) {
          // No URL parameter - reset signal to its current default value
          // (handles both static fallback and dynamic default cases)
          const defaultValue = connection.getDefaultValue();
          if (connection.isDefaultValue(value)) {
            // Signal already has correct default value, no sync needed
            continue;
          }
          if (debug) {
            console.debug(
              `[route] URL->Signal: ${paramName} not in URL, reset signal to default (${defaultValue})`,
            );
          }
          paramSignal.value = defaultValue;
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
        paramSignal.value = urlParamValue;
        continue;
      }
    }
  });

  // Reset flag after URL -> Signal synchronization is complete
  isUpdatingRoutesFromUrl = false;

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

const registerRoute = (routePattern) => {
  const urlPatternRaw = routePattern.originalPattern;
  if (DEBUG) {
    console.debug(`Creating route: ${urlPatternRaw}`);
  }
  const { cleanPattern, connectionMap } = routePattern;
  const [publishStatus, subscribeStatus] = createPubSub();

  // prepare route object
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
    matchingSignal: null,
    paramsSignal: null,
    urlSignal: null,
    replaceParams: undefined,
    subscribeStatus,
    toString: () => {
      return `route "${cleanPattern}"`;
    },
  };
  routeSet.add(route);
  const routePrivateProperties = {
    routePattern,
    originalPattern: urlPatternRaw,
    pattern: cleanPattern,
    updateStatus: null,
    cleanup: null,
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);
  const cleanupCallbackSet = new Set();
  routePrivateProperties.cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  routePrivateProperties.updateStatus = ({ matching, params, visited }) => {
    let someChange = false;
    route.matchingSignal.value = matching;

    if (route.matching !== matching) {
      route.matching = matching;
      someChange = true;
    }
    route.visitedSignal.value = visited;
    if (route.visited !== visited) {
      route.visited = visited;
      someChange = true;
    }
    // Store raw params (from URL) - paramsSignal will reactively compute merged params
    route.rawParamsSignal.value = params;
    // Get merged params for comparison (computed signal will handle the merging)
    const mergedParams = route.paramsSignal.value;
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
  };

  // populate route object
  route.matchingSignal = signal(false);
  route.rawParamsSignal = signal(ROUTE_NOT_MATCHING_PARAMS);
  route.paramsSignal = computed(() => {
    const rawParams = route.rawParamsSignal.value;
    const resolvedParams = routePattern.resolveParams(rawParams);
    return resolvedParams;
  });
  route.visitedSignal = signal(false);
  // Keep route.params synchronized with computed paramsSignal
  // This ensures route.params includes parameters from child routes
  effect(() => {
    const computedParams = route.paramsSignal.value;
    if (route.params !== computedParams) {
      route.params = computedParams;
    }
  });
  for (const [paramName, connection] of connectionMap) {
    const { signal: paramSignal, debug } = connection;

    if (debug) {
      console.debug(
        `[route] connecting url param "${paramName}" to signal`,
        paramSignal,
      );
    }
    // Signal -> URL sync: When signal changes, update URL to reflect meaningful state
    // Only sync non-default values to keep URLs clean (static fallbacks stay invisible)
    // eslint-disable-next-line no-loop-func
    effect(() => {
      const value = paramSignal.value;
      const rawParams = route.rawParamsSignal.value;
      const urlParamValue = rawParams[paramName];
      const matching = route.matchingSignal.value;

      // Signal returned to default - clean up URL by removing the parameter
      // Skip cleanup during URL-to-signal synchronization to prevent recursion
      if (isUpdatingRoutesFromUrl) {
        return;
      }

      if (!matching) {
        // Route not matching, no URL sync needed
        return;
      }
      if (urlParamValue === undefined) {
        // No URL parameter exists - check if signal has meaningful value to add
        if (connection.isDefaultValue(value)) {
          // Signal using default value, keep URL clean (no parameter needed)
          return;
        }
        if (debug) {
          console.debug(
            `[route] Signal->URL: ${paramName} adding custom value ${value} to URL (default: ${connection.getDefaultValue()})`,
          );
        }
        route.replaceParams({ [paramName]: value });
        return;
      }

      // URL parameter exists - check if we need to update or clean it up
      if (connection.isDefaultValue(value)) {
        if (debug) {
          console.debug(
            `[route] Signal->URL: ${paramName} cleaning URL (removing default value ${value})`,
          );
        }
        route.replaceParams({ [paramName]: undefined });
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
    if (!integration) {
      if (import.meta.dev) {
        console.warn(`navTo called on "${route}" but integration not set`);
      }
      return Promise.resolve();
    }
    const routeUrl = route.buildUrl(params);
    return integration.navTo(routeUrl);
  };
  route.redirectTo = (params) => {
    if (!integration) {
      if (import.meta.dev) {
        console.warn(`redirectTo called on "${route}" but integration not set`);
      }
      return Promise.resolve();
    }
    return integration.navTo(route.buildUrl(params), {
      replace: true,
    });
  };
  route.replaceParams = (newParams) => {
    const matching = route.matchingSignal.peek();
    if (!matching) {
      console.warn(
        `Cannot replace params on route ${route} because it is not matching the current URL.`,
      );
      return null;
    }

    // Find all matching routes and update their actions, then delegate to most specific
    const allMatchingRoutes = Array.from(routeSet).filter((r) => r.matching);

    if (DEBUG) {
      console.debug(
        `[${route}] replaceParams called with:`,
        newParams,
        `\nAll matching routes:`,
        allMatchingRoutes.map(
          (r) =>
            `${r} (depth: ${getRoutePrivateProperties(r).routePattern.depth})`,
        ),
      );
    }

    // Update action params on all matching routes
    for (const matchingRoute of allMatchingRoutes) {
      if (matchingRoute.action) {
        const matchingRoutePrivateProperties =
          getRoutePrivateProperties(matchingRoute);
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

    if (DEBUG) {
      console.debug(
        `[${route}] Most specific route selected: ${mostSpecificRoute} (depth: ${getRoutePrivateProperties(mostSpecificRoute).routePattern.depth})`,
      );
      console.debug(
        `[${route}] Building URL with params:`,
        newParams,
        `on route ${mostSpecificRoute}`,
      );
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
    if (DEBUG) {
      const builtUrl = route.buildUrl(newParams);
      console.debug(
        `[${route}] Built URL:`,
        builtUrl,
        `with params:`,
        newParams,
      );
    }
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
  route.relativeUrlSignal = computed(() => {
    const rawParams = route.rawParamsSignal.value;
    const relativeUrl = route.buildRelativeUrl(rawParams);
    return relativeUrl;
  });
  route.urlSignal = computed(() => {
    const routeUrl = route.buildUrl();
    return routeUrl;
  });
  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = route.relativeUrlSignal.value;
  });
  const disposeUrlEffect = effect(() => {
    route.url = route.urlSignal.value;
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
          const params = route.paramsSignal.value;
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

    const actionBoundToThisRoute = action.bindParams(route.paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };

  return route;
};

let integration;
export const setRouteIntegration = (integrationInterface) => {
  integration = integrationInterface;
};
let onRouteDefined = () => {};
export const setOnRouteDefined = (v) => {
  onRouteDefined = v;
};
