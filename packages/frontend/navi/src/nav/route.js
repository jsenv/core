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
    navigationType,
    isVisited,
    // state
  },
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

export const registerRoute = (urlPatternInput) => {
  const originalUrlPatternInput = urlPatternInput;
  // Detect and connect signals in the route pattern
  const { pattern, connections } = detectSignals(urlPatternInput);
  urlPatternInput = pattern;

  // Make parameters with default values optional by modifying the pattern
  for (const { paramName, options = {} } of connections) {
    if (options.defaultValue !== undefined) {
      // Replace :param with :param? to make the parameter itself optional
      const paramRegex = new RegExp(`:${paramName}(?!\\?)\\b`, "g");
      urlPatternInput = urlPatternInput.replace(paramRegex, `:${paramName}?`);
    }
  }

  // Make literal path segments optional if they match parameters with defaults in related routes
  // This allows /admin/settings/:tab to match /admin when "settings" corresponds to :section with default
  const literalSegmentDefaults = new Map(); // Track which literal segments correspond to parameter defaults
  // Compare current pattern against previously registered routes to find relationships
  for (const existingRoute of routeSet) {
    const existingPrivateProps = getRoutePrivateProperties(existingRoute);
    if (!existingPrivateProps) continue;
    const { originalPattern, connections } = existingPrivateProps;
    const registeredPattern = originalPattern;

    // Check if current pattern could be a specialized version of a registered pattern
    const currentSegments = urlPatternInput.split("/").filter((s) => s !== "");
    const registeredSegments = registeredPattern
      .split("/")
      .filter((s) => s !== "");

    // Look for patterns where literal segments in current pattern match parameter defaults in registered pattern
    if (currentSegments.length >= registeredSegments.length - 1) {
      // Allow current to be shorter if registered ends with wildcard
      let isRelated = true;
      const transformations = [];

      // Compare segments up to the shorter length, but handle wildcards specially
      const compareLength = Math.min(
        currentSegments.length,
        registeredSegments.length,
      );

      for (let i = 0; i < compareLength; i++) {
        const regSeg = registeredSegments[i];
        const curSeg = currentSegments[i];

        if (regSeg === curSeg) {
          // Identical segments - continue
          continue;
        } else if (regSeg.startsWith(":") && !curSeg.startsWith(":")) {
          // Registered has parameter, current has literal - check if literal matches parameter's default
          const paramName = regSeg.replace(/[?*]/g, ""); // Remove ? and * suffixes
          const connection = connections.find(
            (c) =>
              `:${c.paramName}` === paramName ||
              c.paramName === paramName.substring(1),
          );

          if (connection && connection.options.defaultValue === curSeg) {
            // Found match! This literal segment corresponds to a parameter with matching default
            transformations.push({
              index: i,
              segment: curSeg,
              paramName: connection.paramName,
              defaultValue: connection.options.defaultValue,
            });
          } else {
            // No match - patterns are not related
            isRelated = false;
            break;
          }
        } else if (regSeg === "*" && i === registeredSegments.length - 1) {
          // Registered pattern ends with wildcard - this is compatible with additional segments in current pattern
          break; // Stop comparing, wildcard matches remaining segments
        } else {
          // Different non-matching segments - patterns are not related
          isRelated = false;
          break;
        }
      }

      // Apply transformations if we found valid relationships
      if (isRelated && transformations.length > 0) {
        // Transform to simple optional parameters and store validation info
        // Work with filtered segments since that's what we used for comparison
        let segments = urlPatternInput.split("/").filter((s) => s !== "");

        for (const { index, paramName, defaultValue } of transformations) {
          // Replace literal segment with optional parameter
          segments[index] = `:${paramName}?`;
          // Store the expected default value for validation
          literalSegmentDefaults.set(paramName, defaultValue);
        }

        // Reconstruct the pattern with leading slash
        urlPatternInput = `/${segments.join("/")}`;
        break; // Found a match, stop looking
      }
    }
  }

  // Also include defaults from the current route's own parameters
  for (const { paramName, options = {} } of connections) {
    if (options.defaultValue !== undefined) {
      literalSegmentDefaults.set(paramName, options.defaultValue);
    }
  }

  // Make trailing slashes flexible - if pattern ends with /, make it match anything after
  // Exception: don't transform root route "/" to avoid matching everything
  if (urlPatternInput.endsWith("/") && urlPatternInput !== "/") {
    // Transform /path/ to /path/*
    // This allows matching /path/, /path/anything, /path/anything/else
    urlPatternInput = `${urlPatternInput.slice(0, -1)}/*`;
  }

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const [publishStatus, subscribeStatus] = createPubSub();
  const routePattern = createRoutePattern(
    urlPatternInput,
    baseFileUrl,
    literalSegmentDefaults,
  );

  // Store pattern info in route private properties for future pattern matching
  const originalPatternBeforeTransforms = detectSignals(
    originalUrlPatternInput,
  ).pattern;

  const route = {
    urlPattern: urlPatternInput,
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
      return `route "${urlPatternInput}"`;
    },
    replaceParams: undefined,
    subscribeStatus,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    routePattern: null,
    originalPattern: originalPatternBeforeTransforms,
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
    return browserIntegration.navTo(route.buildUrl(params));
  };
  route.redirectTo = (params) => {
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
      urlPatternInput,
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
    if (urlPatternInput.endsWith("*")) {
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

  private_properties: {
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
  routePreviousStateMap.clear();
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
