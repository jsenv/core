/**
 * Route management with custom pattern matching system
 * Replaces URLPattern-based approach with simpler, more predictable matching
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { documentUrlSignal } from "./browser_integration/document_url_signal.js";
import {
  buildUrlFromPatternWithSegmentFiltering,
  createRoutePattern,
} from "./route_pattern.js";
import { resolveRouteUrl } from "./route_url.js";

const DEBUG = false;

/**
 * Route inheritance system - simplified approach
 */

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

/**
 * Analyzes route patterns to determine inheritance relationships
 * Much simpler than the previous URLPattern-based approach
 */
const analyzeRouteInheritance = (currentPattern) => {
  if (routeSet.size === 0) {
    return {
      canInherit: false,
      inheritanceData: null,
      parameterDefaults: new Map(),
    };
  }

  if (DEBUG) {
    console.debug(`[Inheritance] Analyzing pattern: ${currentPattern}`);
  }

  const currentSegments = parsePatternSegments(currentPattern);

  // Look for existing routes that this pattern can inherit from
  for (const existingRoute of routeSet) {
    const existingProps = getRoutePrivateProperties(existingRoute);
    if (!existingProps) continue;

    const existingPattern = existingProps.originalPattern;
    const existingSegments = parsePatternSegments(existingPattern);
    const existingConnections = existingProps.connections || [];

    if (DEBUG) {
      console.debug(`[Inheritance] Comparing with: ${existingPattern}`);
    }

    // Check if current pattern can inherit from existing pattern
    const inheritanceResult = checkInheritanceCompatibility(
      currentSegments,
      existingSegments,
      existingConnections,
    );

    if (inheritanceResult.canInherit) {
      if (DEBUG) {
        console.debug(
          `[Inheritance] Found inheritance from ${existingPattern}:`,
          inheritanceResult,
        );
      }

      return {
        canInherit: true,
        inheritanceData: inheritanceResult.inheritanceData,
        parameterDefaults: inheritanceResult.parameterDefaults,
      };
    }
  }

  return {
    canInherit: false,
    inheritanceData: null,
    parameterDefaults: new Map(),
  };
};

/**
 * Parse pattern into segments for inheritance analysis
 */
const parsePatternSegments = (pattern) => {
  if (pattern === "/") {
    return [];
  }

  let cleanPattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;

  // Handle wildcards and trailing slashes
  const hasWildcard = cleanPattern.endsWith("*");
  const hasTrailingSlash = pattern.endsWith("/") && !hasWildcard;

  if (hasWildcard) {
    cleanPattern = cleanPattern.slice(0, -1);
  }
  if (hasTrailingSlash) {
    cleanPattern = cleanPattern.slice(0, -1);
  }

  return cleanPattern ? cleanPattern.split("/") : [];
};
const checkInheritanceCompatibility = (
  currentSegments,
  existingSegments,
  existingConnections,
) => {
  // Simple inheritance rules:
  // 1. Current pattern has more literal segments that match existing parameters
  // 2. Current pattern provides literal values where existing has parameters with defaults

  if (currentSegments.length < existingSegments.length) {
    return { canInherit: false };
  }

  const inheritanceData = [];
  const parameterDefaults = new Map();

  // Check each existing segment against current segments
  for (let i = 0; i < existingSegments.length; i++) {
    const existingSeg = existingSegments[i];
    const currentSeg = currentSegments[i];

    if (!currentSeg) break; // Current pattern is shorter

    if (existingSeg === currentSeg) {
      // Exact match - continue
      continue;
    }

    if (existingSeg.startsWith(":")) {
      // Existing has parameter, current has literal
      const paramName = existingSeg.replace(/[?*]/g, "").substring(1);
      const connection = existingConnections.find(
        (c) => c.paramName === paramName,
      );

      if (connection && connection.options?.defaultValue !== undefined) {
        const defaultValue = connection.options.defaultValue;

        // Two cases:
        // 1. Literal matches default - can create short version
        // 2. Literal provides different value - inherit with new default

        inheritanceData.push({
          segmentIndex: i,
          paramName,
          literalValue: currentSeg,
          originalDefault: defaultValue,
          canOmit: currentSeg === defaultValue,
        });

        // Set parameter default to the literal value from current pattern
        parameterDefaults.set(paramName, currentSeg);
      } else {
        // No default value - can't inherit
        return { canInherit: false };
      }
    } else {
      // Both are literals but don't match - can't inherit
      return { canInherit: false };
    }
  }

  // If we found inheritance opportunities, return them
  if (inheritanceData.length > 0) {
    return {
      canInherit: true,
      inheritanceData,
      parameterDefaults,
    };
  }

  return { canInherit: false };
};

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

    // If direct matching failed, try inheritance-based matching
    if (!newMatching && routePrivateProperties.inheritanceData) {
      // Try to match using parent route patterns
      for (const existingRoute of routeSet) {
        if (existingRoute === route) continue; // Skip self

        const existingPrivateProps = getRoutePrivateProperties(existingRoute);
        if (!existingPrivateProps) continue;

        const existingRoutePattern = existingPrivateProps.routePattern;
        const parentParams = existingRoutePattern.applyOn(url);

        if (parentParams) {
          // Check if this route can inherit from the parent route
          const inheritanceInfo = routePrivateProperties.inheritanceData;
          let canInherit = true;
          const inheritedParams = { ...parentParams };

          // Verify inheritance compatibility
          for (const inheritance of inheritanceInfo) {
            const { paramName, literalValue } = inheritance;
            if (parentParams[paramName] === literalValue) {
              // The parent route's parameter matches our literal value - we can inherit
              continue;
            } else {
              canInherit = false;
              break;
            }
          }

          if (canInherit) {
            extractedParams = inheritedParams;
            newMatching = true;
            break; // Found a matching parent
          }
        }
      }
    }

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

const routePrivatePropertiesMap = new Map();
export const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};

export const registerRoute = (urlPatternRaw) => {
  if (DEBUG) {
    console.debug(`Registering route: ${urlPatternRaw}`);
    console.debug(
      `Existing routes: ${Array.from(routeSet)
        .map((r) => r.urlPattern)
        .join(", ")}`,
    );
  }

  // Create custom route pattern - it will detect and process signals internally
  const routePatternResult = createRoutePattern(urlPatternRaw, baseFileUrl);
  const { cleanPattern, connections } = routePatternResult;
  // Analyze inheritance opportunities with existing routes using custom system
  const inheritanceResult = analyzeRouteInheritance(cleanPattern);
  // Build parameter defaults from inheritance and connections
  const parameterDefaults = new Map();
  // Add defaults from signal connections
  for (const { paramName, options = {} } of connections) {
    if (options.defaultValue !== undefined) {
      parameterDefaults.set(paramName, options.defaultValue);
    }
  }
  // Override with inheritance defaults if available
  if (inheritanceResult.canInherit) {
    for (const [
      paramName,
      defaultValue,
    ] of inheritanceResult.parameterDefaults) {
      parameterDefaults.set(paramName, defaultValue);
    }
  }
  // Now create the final route pattern with defaults
  const routePattern = createRoutePattern(
    urlPatternRaw,
    baseFileUrl,
    parameterDefaults,
  );
  const urlPattern = cleanPattern;

  if (DEBUG) {
    console.debug(`Parameter defaults:`, parameterDefaults);
    if (inheritanceResult.canInherit) {
      console.debug(`Inheritance data:`, inheritanceResult.inheritanceData);
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

  // Store inheritance relationships during registration
  const segmentDefaults = new Map(); // Map segment index -> default value for that segment

  if (inheritanceResult.canInherit && inheritanceResult.inheritanceData) {
    for (const inheritance of inheritanceResult.inheritanceData) {
      const { segmentIndex, paramName, literalValue } = inheritance;

      // Find the parent signal that provides the default for this parameter
      for (const existingRoute of routeSet) {
        const existingPrivateProps = getRoutePrivateProperties(existingRoute);
        const existingConnections = existingPrivateProps?.connections || [];

        for (const {
          signal,
          paramName: existingParamName,
        } of existingConnections) {
          if (
            existingParamName === paramName &&
            signal &&
            signal.value !== undefined
          ) {
            // Store that this segment can be omitted if its value matches the signal default
            segmentDefaults.set(segmentIndex, {
              paramName,
              literalValue,
              signalDefault: signal.value,
            });
            break;
          }
        }
      }
    }
  }

  // Also check this route's own signal connections for segment defaults
  // This handles cases where a route has signals with defaults but doesn't inherit from other routes
  if (connections && connections.length > 0) {
    const parsedPattern = routePatternResult.pattern;

    for (const { signal, paramName, options } of connections) {
      if (
        signal &&
        signal.value !== undefined &&
        options.defaultValue !== undefined
      ) {
        // Find which segment corresponds to this parameter
        for (
          let segmentIndex = 0;
          segmentIndex < parsedPattern.segments.length;
          segmentIndex++
        ) {
          const segment = parsedPattern.segments[segmentIndex];

          if (segment.type === "param" && segment.name === paramName) {
            // This is a parameter segment that has a signal with a default value
            segmentDefaults.set(segmentIndex, {
              paramName,
              literalValue: options.defaultValue, // Use the signal's default as the literal value
              signalDefault: signal.value,
            });
            break;
          }
        }
      }
    }
  }

  // Store pattern info in route private properties for future pattern matching
  const originalPatternBeforeTransforms = cleanPattern;
  const originalRoutePattern = createRoutePattern(
    originalPatternBeforeTransforms,
    baseUrl,
    inheritanceResult.parameterDefaults,
  );

  const route = {
    urlPattern,
    pattern: cleanPattern, // Expose the clean pattern string
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
    routePattern,
    originalPattern: originalPatternBeforeTransforms,
    originalPatternParsed: originalRoutePattern.pattern,
    pattern: cleanPattern, // Store the current pattern used
    inheritanceData: inheritanceResult.inheritanceData, // Store inheritance info for this route
    parameterDefaults: inheritanceResult.parameterDefaults, // Store parameter defaults
    segmentDefaults, // Store which segments can be omitted based on signal defaults
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

    // Add inherited defaults from other routes for missing parameters
    const routePrivateProps = getRoutePrivateProperties(route);
    const inheritanceInfo = routePrivateProps?.inheritanceData;
    const literalParameterNames = new Set(); // Track literal parameters to exclude them throughout

    if (inheritanceInfo) {
      // Create a set of parameters that correspond to literal segments in the original pattern
      // These should not be exposed in the final params since they're "hardcoded" in the route
      const originalPatternSegments = routePrivateProps.originalPattern
        .split("/")
        .filter((s) => s !== "");

      if (DEBUG) {
        console.debug("Original pattern segments:", originalPatternSegments);
        console.debug("Inheritance info:", inheritanceInfo);
      }

      for (const inheritance of inheritanceInfo) {
        const { paramName, literalValue, segmentIndex } = inheritance;
        // If the original pattern had a literal segment at this position,
        // don't include this parameter in the final params
        if (segmentIndex < originalPatternSegments.length) {
          const originalSegment = originalPatternSegments[segmentIndex];
          if (DEBUG) {
            console.debug(
              `Checking segment ${segmentIndex}: original="${originalSegment}" vs literal="${literalValue}"`,
            );
          }
          if (originalSegment === literalValue) {
            literalParameterNames.add(paramName);
            if (DEBUG) {
              console.debug(`Filtering out literal parameter: ${paramName}`);
            }
          }
        }
      }
    }

    // First, add raw params that have defined values
    // But exclude literal parameters that correspond to hardcoded segments
    if (rawParams) {
      for (const name of Object.keys(rawParams)) {
        const value = rawParams[name];
        if (value !== undefined) {
          if (DEBUG) {
            console.debug(`Processing raw param: ${name}=${value}`);
          }
          // Skip literal parameters that correspond to hardcoded segments in original pattern
          if (literalParameterNames.has(name)) {
            if (DEBUG) {
              console.debug(
                `Excluding literal parameter ${name} from raw params`,
              );
            }
            continue;
          }
          mergedParams[name] = rawParams[name];
          paramNameSet.delete(name);
        }
      }
    }

    // Add inherited defaults for parameters not in raw params and not literal
    if (inheritanceInfo) {
      for (const inheritance of inheritanceInfo) {
        const { paramName, defaultValue } = inheritance;
        if (
          !(paramName in mergedParams) &&
          !literalParameterNames.has(paramName)
        ) {
          mergedParams[paramName] = defaultValue;
          paramNameSet.delete(paramName);
        } else if (literalParameterNames.has(paramName)) {
          if (DEBUG) {
            console.debug(
              `Excluded literal parameter ${paramName} from inheritance defaults`,
            );
          }
        }
      }
    }

    // Then, for parameters not in URL, check localStorage and apply defaults
    // But exclude literal parameters that correspond to hardcoded segments
    for (const paramName of paramNameSet) {
      if (literalParameterNames.has(paramName)) {
        if (DEBUG) {
          console.debug(
            `Skipping literal parameter ${paramName} in default processing`,
          );
        }
        continue; // Skip literal parameters
      }
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
    const currentParams = rawParamsSignal.value;

    // Determine which parameters correspond to literal segments and should be omitted
    const routePrivateProps = getRoutePrivateProperties(route);
    const inheritanceInfo = routePrivateProps?.inheritanceData;
    const literalParameterNames = new Set(); // Track literal parameters to exclude them

    if (inheritanceInfo) {
      // Create a set of parameters that correspond to literal segments in the original pattern
      // These should not be exposed in the final params since they're "hardcoded" in the route
      const originalPatternSegments = routePrivateProps.originalPattern
        .split("/")
        .filter((s) => s !== "");

      for (const inheritance of inheritanceInfo) {
        const { paramName, literalValue, segmentIndex } = inheritance;
        // If the original pattern had a literal segment at this position,
        // don't include this parameter in the final params
        if (segmentIndex < originalPatternSegments.length) {
          const originalSegment = originalPatternSegments[segmentIndex];
          if (originalSegment === literalValue) {
            literalParameterNames.add(paramName);
          }
        }
      }
    }

    // Start with all current parameters, then overlay provided parameters
    const paramNameSet = new Set();
    if (currentParams) {
      for (const paramName of Object.keys(currentParams)) {
        // Skip literal parameters that correspond to hardcoded segments
        if (!literalParameterNames.has(paramName)) {
          paramNameSet.add(paramName);
        }
      }
    }
    if (providedParams) {
      for (const paramName of Object.keys(providedParams)) {
        // Skip literal parameters that correspond to hardcoded segments
        if (!literalParameterNames.has(paramName)) {
          paramNameSet.add(paramName);
        }
      }
    }

    const paramConfigNameSet = new Set(paramConfigMap.keys());
    const mergedParams = {};

    // First, process parameters that have configurations (signals)
    for (const paramName of paramConfigNameSet) {
      // Skip literal parameters
      if (literalParameterNames.has(paramName)) {
        continue;
      }
      if (paramNameSet.has(paramName)) {
        // Skip configured params that are provided - they'll be handled in the second loop
        continue;
      }
      const currentValue = currentParams?.[paramName];
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
            // mergedParams[paramName] = undefined;
            continue;
          }
          mergedParams[paramName] = fallbackValue;
          continue;
        }
      }
      if (cleanupDefaults) {
        // When cleaning up defaults, include as undefined so prepareRouteRelativeUrl can remove the param
        // mergedParams[paramName] = undefined;
        continue;
      }
      if (defaultValue !== undefined) {
        mergedParams[paramName] = defaultValue;
        continue;
      }
      continue;
    }

    // Then, process provided parameters (including those without configurations)
    for (const paramName of paramNameSet) {
      // Skip literal parameters
      if (literalParameterNames.has(paramName)) {
        continue;
      }
      const providedValue = providedParams?.[paramName];
      const currentValue = currentParams?.[paramName];

      // Use provided value if available, otherwise use current value
      const valueToUse =
        providedValue !== undefined ? providedValue : currentValue;

      if (cleanupDefaults) {
        const paramConfig = paramConfigMap.get(paramName);
        if (paramConfig && paramConfig.defaultValue === valueToUse) {
          // When cleaning up defaults, include as undefined so prepareRouteRelativeUrl can remove the param
          // mergedParams[paramName] = undefined;
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
      // cleanup defaults to keep url as short as possible
      cleanupDefaults: true,
    });

    // Use smart segment filtering from route_pattern.js
    // This handles both trailing slash inheritance and segment filtering
    const routePrivateProps = getRoutePrivateProperties(route);
    const parsedPattern = routePrivateProps.routePattern.pattern;
    const parameterDefaults = routePrivateProps.parameterDefaults || new Map();
    const segmentDefaults = routePrivateProps.segmentDefaults || new Map();
    const connections = routePrivateProps.connections || [];

    const routeRelativeUrl = buildUrlFromPatternWithSegmentFiltering(
      parsedPattern,
      resolvedParams,
      parameterDefaults,
      {
        segmentDefaults,
        connections,
      },
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
    const currentParams = route.params;
    const resolvedParams = resolveParams(providedParams);
    const same = compareTwoJsValues(currentParams, resolvedParams);
    return same;
  };

  const relativeUrlSignal = computed(() => {
    const rawParams = rawParamsSignal.value;

    // For patterns with trailing slash, create dependency on documentUrlSignal
    // to automatically update when document URL changes (for path inheritance)
    const routePrivateProps = getRoutePrivateProperties(route);
    if (routePrivateProps?.routePattern?.pattern?.trailingSlash) {
      // eslint-disable-next-line no-unused-expressions
      documentUrlSignal.value; // Create reactive dependency on documentUrlSignal
    }

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
