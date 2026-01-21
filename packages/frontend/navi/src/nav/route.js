/**
 *
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { detectSignals } from "../state/state_signal.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { createRoutePattern } from "./route_pattern.js";
import { prepareRouteRelativeUrl, resolveRouteUrl } from "./route_url.js";

const DEBUG = false;
let baseFileUrl;
let baseUrl;
export const setBaseUrl = (value) => {
  baseFileUrl = new URL(
    value,
    typeof window === "undefined" ? "http://localhost" : window.location,
  ).href;
  baseUrl = new URL(".", baseFileUrl).href;
};
setBaseUrl(
  typeof window === "undefined"
    ? "/"
    : import.meta.dev
      ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
      : window.location.origin,
);

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

const routePrivatePropertiesMap = new Map();
export const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};

export const registerRoute = (urlPattern) => {
  const originalUrlPatternInput = urlPattern;
  // Detect and connect signals in the route pattern
  const { pattern, connections } = detectSignals(urlPattern);
  let internalUrlPattern = pattern;

  // Make parameters with default values optional by modifying the pattern
  for (const { paramName, options = {} } of connections) {
    if (options.defaultValue !== undefined) {
      // Replace :param with :param? to make the parameter itself optional
      const paramRegex = new RegExp(`:${paramName}(?!\\?)\\b`, "g");
      internalUrlPattern = internalUrlPattern.replace(
        paramRegex,
        `:${paramName}?`,
      );
    }
  }
  // Cross-route optimization: allow routes with literal segments that match parameter defaults
  // to also match shorter URLs where those segments are omitted
  const literalSegmentDefaults = new Map();

  if (DEBUG) {
    console.debug(`Registering route: ${urlPattern} -> ${internalUrlPattern}`);
    console.debug(
      `Existing routes: ${Array.from(routeSet)
        .map((r) => r.urlPattern)
        .join(", ")}`,
    );
  }

  // Inherit parameter defaults from other routes to create short versions
  // Check if we can make this route match shorter URLs by inheriting defaults from other registered routes
  if (routeSet.size > 0) {
    if (DEBUG) {
      console.debug(
        `\nAnalyzing route for inheriting defaults from other routes: ${internalUrlPattern}`,
      );
      console.debug(`Total existing routes: ${routeSet.size}`);
    }

    // Compare current pattern against previously registered routes to find inheritance opportunities
    for (const existingRoute of routeSet) {
      const existingPrivateProps = getRoutePrivateProperties(existingRoute);
      if (!existingPrivateProps) continue;
      const { connections: existingConnections } = existingPrivateProps;

      // Use the existing route's processed internal pattern for comparison
      const existingInternalPattern = existingPrivateProps.internalPattern;

      if (DEBUG) {
        console.debug(
          `Comparing against existing route: ${existingInternalPattern}`,
          existingConnections.map(
            (c) => `${c.paramName}=${c.options.defaultValue}`,
          ),
        );
      }

      // Check if current pattern can have a short version based on defaults from existing routes
      const currentSegments = internalUrlPattern
        .split("/")
        .filter((s) => s !== "");
      const existingSegments = existingInternalPattern
        .split("/")
        .filter((s) => s !== "");

      if (DEBUG) {
        console.debug(`Current segments:`, currentSegments);
        console.debug(`Existing segments:`, existingSegments);
      }

      // Look for cases where current pattern can inherit from existing patterns
      // This includes cases where:
      // 1. Current has more segments (existing logic)
      // 2. Current has same number of segments but can inherit parameter values
      if (currentSegments.length >= existingSegments.length) {
        let canCreateShortVersion = true;
        const defaultInheritances = [];

        // Compare each segment up to the length of the existing pattern
        for (
          let i = 0;
          i < existingSegments.length && i < currentSegments.length;
          i++
        ) {
          const existingSeg = existingSegments[i];
          const currentSeg = currentSegments[i];

          if (DEBUG) {
            console.debug(
              `Comparing segment ${i}: existing="${existingSeg}" vs current="${currentSeg}"`,
            );
          }

          if (existingSeg === currentSeg) {
            // Identical segments - continue
            continue;
          } else if (
            existingSeg.startsWith(":") &&
            !currentSeg.startsWith(":")
          ) {
            // Existing has parameter, current has literal
            const paramName = existingSeg.replace(/[?*]/g, "").substring(1); // Remove : prefix and suffixes
            const existingConnection = existingConnections.find(
              (c) => c.paramName === paramName,
            );

            if (DEBUG) {
              console.debug(
                `Found param ${paramName} with default:`,
                existingConnection?.options.defaultValue,
              );
            }

            if (existingConnection) {
              // Two types of inheritance:
              // 1. Literal matches default - can create short version (existing behavior)
              // 2. Literal provides value for parameter - inherit parameter structure
              if (existingConnection.options.defaultValue === currentSeg) {
                // Case 1: Literal segment matches parameter default - can create short version
                defaultInheritances.push({
                  segmentIndex: i,
                  literalValue: currentSeg,
                  paramName,
                  defaultValue: existingConnection.options.defaultValue,
                });
              } else {
                // Case 2: Literal provides value - inherit parameter structure
                defaultInheritances.push({
                  segmentIndex: i,
                  literalValue: currentSeg,
                  paramName,
                  defaultValue: currentSeg, // Use literal value as the parameter value
                });
              }
            } else {
              // No parameter connection found - can't create short version with this route
              canCreateShortVersion = false;
              break;
            }
          } else {
            // Other mismatch - can't create short version with this route
            canCreateShortVersion = false;
            break;
          }
        }

        // Apply short version creation if we found valid default inheritances from other routes
        if (canCreateShortVersion && defaultInheritances.length > 0) {
          // Transform the internal pattern to make literal segments optional
          let segments = internalUrlPattern.split("/").filter((s) => s !== "");

          if (DEBUG) {
            console.debug(
              `Applying default inheritances from other routes:`,
              defaultInheritances,
            );
            console.debug(`Original segments:`, segments);
          }

          // Apply each default inheritance to create short version
          for (const inheritance of defaultInheritances) {
            // Replace literal with optional parameter
            segments[inheritance.segmentIndex] = `:${inheritance.paramName}?`;
          }

          const shortVersionPattern = `/${segments.join("/")}`;

          if (DEBUG) {
            console.debug(`Short version pattern: ${shortVersionPattern}`);
          }

          // Update the internal pattern to the short version
          internalUrlPattern = shortVersionPattern;

          // Store the default inheritance info using the transformed pattern as key
          literalSegmentDefaults.set(internalUrlPattern, defaultInheritances);

          if (DEBUG) {
            console.debug(
              `Route transformed: ${urlPattern} -> ${internalUrlPattern} inheriting defaults from other routes`,
            );
          }
          break; // Found transformation, stop looking at other routes
        }
      }
    }
  }

  // Make trailing slashes flexible - if pattern ends with /, make it match anything after
  // Exception: don't transform root route "/" to avoid matching everything
  // TODO: Temporarily disabled to isolate route matching issues
  // if (internalUrlPattern.endsWith("/") && internalUrlPattern !== "/") {
  //   // Transform /path/ to /path/*
  //   // This allows matching /path/, /path/anything, /path/anything/else
  //   internalUrlPattern = `${internalUrlPattern.slice(0, -1)}/*`;
  // }
  if (DEBUG) {
    console.debug(urlPattern, `->`, internalUrlPattern);
  }

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const [publishStatus, subscribeStatus] = createPubSub();

  // Transform inheritance info into format expected by createRoutePattern
  const parameterDefaults = new Map();
  const inheritanceInfo = literalSegmentDefaults.get(internalUrlPattern);
  if (inheritanceInfo) {
    for (const inheritance of inheritanceInfo) {
      parameterDefaults.set(inheritance.paramName, inheritance.defaultValue);
    }
  }

  const routePattern = createRoutePattern(
    internalUrlPattern,
    baseFileUrl,
    parameterDefaults,
  );

  // Store pattern info in route private properties for future pattern matching
  const originalPatternBeforeTransforms = detectSignals(
    originalUrlPatternInput,
  ).pattern;

  const route = {
    urlPattern,
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
      return `route "${urlPattern}"`;
    },
    replaceParams: undefined,
    subscribeStatus,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    routePattern: null,
    originalPattern: originalPatternBeforeTransforms,
    internalPattern: internalUrlPattern, // Store processed pattern for inheritance logic
    literalSegmentDefaults, // Store inheritance info for this route
    connections,
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
  route_state_signals: {
    for (const { signal, paramName, options = {} } of connections) {
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
        signal.value = urlParamValue;
      });

      // Signal -> URL synchronization
      effect(() => {
        const value = signal.value;
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
  }

  const paramsSignal = computed(() => {
    const rawParams = rawParamsSignal.value;
    if (!rawParams && paramConfigMap.size === 0) {
      return rawParams;
    }
    const mergedParams = {};
    const paramNameSet = new Set(paramConfigMap.keys());

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

    // Add inherited defaults from other routes for missing parameters
    const routePrivateProps = getRoutePrivateProperties(route);
    const inheritanceInfo =
      routePrivateProps?.literalSegmentDefaults?.get(internalUrlPattern);
    if (inheritanceInfo) {
      for (const inheritance of inheritanceInfo) {
        const { paramName, defaultValue } = inheritance;
        if (!(paramName in mergedParams)) {
          mergedParams[paramName] = defaultValue;
          paramNameSet.delete(paramName);
        }
      }
    }

    // Then, for parameters not in URL, check localStorage and apply defaults
    for (const paramName of paramNameSet) {
      const paramConfig = paramConfigMap.get(paramName);
      const { defaultValue } = paramConfig;
      if (defaultValue !== undefined) {
        mergedParams[paramName] = defaultValue;
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
    const paramNameSet = providedParams
      ? new Set(Object.keys(providedParams))
      : new Set();
    const paramConfigNameSet = new Set(paramConfigMap.keys());
    const mergedParams = {};
    const currentParams = rawParamsSignal.value;
    for (const paramName of paramConfigNameSet) {
      if (paramNameSet.has(paramName)) {
        continue;
      }
      const currentValue = currentParams[paramName];
      if (currentValue !== undefined) {
        paramNameSet.delete(paramName);
        mergedParams[paramName] = currentValue;
        continue;
      }
      const paramConfig = paramConfigMap.get(paramName);
      if (!paramConfig) {
        continue;
      }
      const { getFallbackValue, defaultValue } = paramConfig;
      if (getFallbackValue) {
        const fallbackValue = getFallbackValue();
        if (fallbackValue !== undefined) {
          if (cleanupDefaults && fallbackValue === defaultValue) {
            // When cleaning up defaults, include as undefined so prepareRouteRelativeUrl can remove the param
            mergedParams[paramName] = undefined;
            continue;
          }
          mergedParams[paramName] = fallbackValue;
          continue;
        }
      }
      if (cleanupDefaults) {
        // When cleaning up defaults, include as undefined so prepareRouteRelativeUrl can remove the param
        mergedParams[paramName] = undefined;
        continue;
      }
      if (defaultValue !== undefined) {
        mergedParams[paramName] = defaultValue;
        continue;
      }
      continue;
    }
    for (const paramName of paramNameSet) {
      const providedValue = providedParams[paramName];
      if (cleanupDefaults) {
        const paramConfig = paramConfigMap.get(paramName);
        if (paramConfig && paramConfig.defaultValue === providedValue) {
          // When cleaning up defaults, include as undefined so prepareRouteRelativeUrl can remove the param
          mergedParams[paramName] = undefined;
          continue;
        }
      }
      mergedParams[paramName] = providedValue;
    }
    return mergedParams;
  };

  route.buildRelativeUrl = (params) => {
    const resolvedParams = resolveParams(params, {
      // cleanup defaults to keep url as short as possible
      cleanupDefaults: true,
    });

    const routeRelativeUrl = prepareRouteRelativeUrl(
      internalUrlPattern,
      resolvedParams,
    );
    return routeRelativeUrl;
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
  const buildUrl = (params) => {
    const routeRelativeUrl = route.buildRelativeUrl(params);
    const routeUrl = resolveRouteUrl(routeRelativeUrl, baseUrl);
    return routeUrl;
  };
  route.buildUrl = buildUrl;

  route.matchesParams = (providedParams) => {
    // Wildcard routes (ending with *) should match any parameters
    // since they are parent routes meant to catch child routes
    if (internalUrlPattern.endsWith("*")) {
      return true;
    }

    const currentParams = route.params;
    const resolvedParams = resolveParams(providedParams);
    const same = compareTwoJsValues(currentParams, resolvedParams);
    return same;
  };

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
    const relativeUrl = relativeUrlSignal.value;
    const url = resolveRouteUrl(relativeUrl, baseUrl);
    return url;
  });
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
  {
    routePrivateProperties.matchingSignal = matchingSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
    routePrivateProperties.rawParamsSignal = rawParamsSignal;
    routePrivateProperties.visitedSignal = visitedSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
    routePrivateProperties.urlSignal = urlSignal;
    routePrivateProperties.cleanupCallbackSet = cleanupCallbackSet;
    routePrivateProperties.routePattern = routePattern;
  }

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
  clearAllRoutes();

  const routes = {};
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = registerRoute(value);

    routes[key] = route;
  }

  onRouteDefined();

  return routes;
};
