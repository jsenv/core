/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */

import { globalSignalRegistry } from "../state/state_signal.js";

// Raw URL part functionality for bypassing encoding
const rawUrlPartSymbol = Symbol("raw_url_part");
export const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};

/**
 * Encode parameter values for URL usage, with special handling for raw URL parts.
 * When a parameter is wrapped with rawUrlPart(), it bypasses encoding and is
 * inserted as-is into the URL.
 */
const encodeParamValue = (value, isWildcard = false) => {
  if (value && value[rawUrlPartSymbol]) {
    return value.value;
  }

  if (isWildcard) {
    // For wildcards, only encode characters that are invalid in URL paths,
    // but preserve slashes as they are path separators
    return value
      ? value.replace(/[^a-zA-Z0-9\-._~!$&'()*+,;=:@/]/g, (char) => {
          return encodeURIComponent(char);
        })
      : value;
  }

  // For named parameters and search params, encode everything including slashes
  return encodeURIComponent(value);
};

/**
 * Build query string from parameters, respecting rawUrlPart values
 */
const buildQueryString = (params) => {
  const searchParamPairs = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      const encodedKey = encodeURIComponent(key);

      // Handle boolean values - if true, just add the key without value
      if (value === true || value === "") {
        searchParamPairs.push(encodedKey);
      } else {
        const encodedValue = encodeParamValue(value, false); // Search params encode slashes
        searchParamPairs.push(`${encodedKey}=${encodedValue}`);
      }
    }
  }

  return searchParamPairs.join("&");
};

const DEBUG = false;

// Base URL management
let baseFileUrl;
let baseUrl;
export const setBaseUrl = (value) => {
  baseFileUrl = new URL(
    value,
    typeof window === "undefined" ? "http://localhost/" : window.location,
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

// Pattern registry for building relationships before routes are created
const patternRegistry = new Map(); // pattern -> patternData
const patternRelationships = new Map(); // pattern -> relationships

// Function to detect signals in route patterns and connect them
export const detectSignals = (routePattern) => {
  const signalConnections = [];
  let updatedPattern = routePattern;

  // Look for signals in two formats:
  // 1. Expected format: :paramName={navi_state_signal:id} or ?paramName={navi_state_signal:id} or &paramName={navi_state_signal:id}
  // 2. Typoe format (missing = sign): &paramName{navi_state_signal:id}
  const signalParamRegex = /([?:&])(\w+)(=)?(\{navi_state_signal:[^}]+\})/g;
  let match;

  while ((match = signalParamRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, paramName, equalSign, signalString] = match;

    // Emit warning if equal sign is missing
    if (!equalSign) {
      console.warn(
        `[detectSignals] Missing '=' sign in route pattern: "${prefix}${paramName}${signalString}". ` +
          `Consider using "${prefix}${paramName}=${signalString}" for better clarity.`,
      );
    }

    // Extract the signal ID from the format: {navi_state_signal:id}
    const signalIdMatch = signalString.match(/\{navi_state_signal:([^}]+)\}/);
    if (!signalIdMatch) {
      console.warn(
        `[detectSignals] Failed to extract signal ID from: ${signalString}`,
      );
      continue;
    }

    const signalId = signalIdMatch[1];
    const signalData = globalSignalRegistry.get(signalId);

    if (signalData) {
      const { signal, options } = signalData;

      let replacement;
      if (prefix === ":") {
        // Path parameter: :section={navi_state_signal:...} becomes :section
        replacement = `${prefix}${paramName}`;
      } else if (prefix === "?" || prefix === "&") {
        // Query parameter: ?city={navi_state_signal:...} or &lon{navi_state_signal:...} becomes ?city or &lon
        replacement = `${prefix}${paramName}`;
      }
      updatedPattern = updatedPattern.replace(fullMatch, replacement);

      signalConnections.push({
        signal,
        paramName,
        options,
      });
    } else {
      console.warn(
        `[detectSignals] Signal not found in registry for ID: "${signalId}"`,
      );
      console.warn(
        `[detectSignals] Available signal IDs in registry:`,
        Array.from(globalSignalRegistry.keys()),
      );
      console.warn(`[detectSignals] Full pattern: "${routePattern}"`);
    }
  }

  return [updatedPattern, signalConnections];
};

/**
 * Creates a custom route pattern matcher
 */
export const createRoutePattern = (pattern) => {
  // Detect and process signals in the pattern first
  const [cleanPattern, connections] = detectSignals(pattern);

  // Build parameter defaults from signal connections
  const parameterDefaults = new Map();
  for (const connection of connections) {
    const { paramName, options } = connection;
    if (options.defaultValue !== undefined) {
      parameterDefaults.set(paramName, options.defaultValue);
    }
  }

  const parsedPattern = parsePattern(cleanPattern, parameterDefaults);

  if (DEBUG) {
    console.debug(`[CustomPattern] Created pattern:`, parsedPattern);
    console.debug(`[CustomPattern] Signal connections:`, connections);
  }

  const applyOn = (url) => {
    const result = matchUrl(parsedPattern, url, {
      parameterDefaults,
      baseUrl,
      connections,
    });

    if (DEBUG) {
      console.debug(
        `[CustomPattern] Matching "${url}" against "${cleanPattern}":`,
        result,
      );
    }

    return result;
  };

  const buildUrl = (params = {}) => {
    return buildUrlFromPattern(parsedPattern, params, pattern);
  };

  const resolveParams = (providedParams = {}) => {
    let resolvedParams = { ...providedParams };

    // Process all connections for parameter resolution
    for (const connection of connections) {
      const { paramName, signal } = connection;

      if (paramName in providedParams) {
        // Parameter was explicitly provided - always respect explicit parameters
        // Don't check signal value - explicit parameter takes precedence
      } else if (signal?.value !== undefined) {
        // Parameter was not provided, check signal value
        resolvedParams[paramName] = signal.value;
      }
    }

    return resolvedParams;
  };

  /**
   * Build the most precise URL by using route relationships from pattern registry.
   * Each route is responsible for its own URL generation using its own signals.
   */

  /**
   * Helper: Filter out default values from parameters for cleaner URLs
   */
  const removeDefaultValues = (params) => {
    const filtered = { ...params };

    for (const connection of connections) {
      const { paramName, signal, options } = connection;
      const defaultValue = options.defaultValue;

      if (paramName in filtered && filtered[paramName] === defaultValue) {
        delete filtered[paramName];
      } else if (
        !(paramName in filtered) &&
        signal?.value !== undefined &&
        signal.value !== defaultValue
      ) {
        filtered[paramName] = signal.value;
      }
    }

    return filtered;
  };

  /**
   * Helper: Check if parameters are compatible with child route
   */
  const checkChildRouteCompatibility = (childPatternObj, params) => {
    const childParams = {};
    let isCompatible = true;

    if (DEBUG) {
      console.debug(
        `[${pattern}] Checking compatibility with child: ${childPatternObj.originalPattern}`,
      );
      console.debug(`[${pattern}] Params passed to buildUrl:`, params);
    }

    // Check both parent signals AND user-provided params for child route matching
    const paramsToCheck = [
      ...connections,
      ...Object.entries(params).map(([key, value]) => ({
        paramName: key,
        userValue: value,
        isUserProvided: true,
      })),
    ];

    for (const item of paramsToCheck) {
      const result = processParameterForChildRoute(
        item,
        childPatternObj.pattern,
      );

      if (DEBUG) {
        console.debug(
          `[${pattern}] Processing param '${item.paramName}' (userProvided: ${item.isUserProvided}, value: ${item.isUserProvided ? item.userValue : item.signal?.value}) for child ${childPatternObj.originalPattern}: compatible=${result.isCompatible}, shouldInclude=${result.shouldInclude}`,
        );
      }

      if (!result.isCompatible) {
        isCompatible = false;
        if (DEBUG) {
          console.debug(
            `[${pattern}] Child ${childPatternObj.originalPattern} INCOMPATIBLE due to param '${item.paramName}'`,
          );
        }
        break;
      }

      if (result.shouldInclude) {
        childParams[result.paramName] = result.paramValue;
      }
    }

    if (DEBUG) {
      console.debug(
        `[${pattern}] Final compatibility result for ${childPatternObj.originalPattern}: ${isCompatible}`,
      );
    }

    return { isCompatible, childParams };
  };

  /**
   * Helper: Process a single parameter for child route compatibility
   */
  const processParameterForChildRoute = (item, childParsedPattern) => {
    let paramName;
    let paramValue;

    if (item.isUserProvided) {
      paramName = item.paramName;
      paramValue = item.userValue;
    } else {
      const { paramName: name, signal, options } = item;
      paramName = name;
      // Only include non-default parent signal values
      if (
        signal?.value === undefined ||
        signal.value === options.defaultValue
      ) {
        return { isCompatible: true, shouldInclude: false };
      }
      paramValue = signal.value;
    }

    // Check if parameter value matches a literal segment in child pattern
    const matchesChildLiteral = paramMatchesChildLiteral(
      paramValue,
      childParsedPattern,
    );

    if (matchesChildLiteral) {
      // Compatible - parameter value matches child literal
      return {
        isCompatible: true,
        shouldInclude: !item.isUserProvided,
        paramName,
        paramValue,
      };
    }

    // Check if this is a query parameter in the parent pattern
    const isParentQueryParam = parsedPattern.queryParams.some(
      (qp) => qp.name === paramName,
    );

    if (isParentQueryParam) {
      // Query parameters are always compatible and can be inherited by child routes
      return {
        isCompatible: true,
        shouldInclude: !item.isUserProvided && !matchesChildLiteral,
        paramName,
        paramValue,
      };
    }

    // Check for generic parameter-literal conflicts (only for path parameters)
    if (!matchesChildLiteral) {
      // Check if this is a path parameter from parent pattern
      const isParentPathParam = connections.some(
        (conn) => conn.paramName === paramName,
      );

      if (isParentPathParam) {
        // Parameter value (from user or signal) doesn't match this child's literals
        // Check if child has any literal segments that would conflict with this parameter
        const hasConflictingLiteral = childParsedPattern.segments.some(
          (segment) =>
            segment.type === "literal" && segment.value !== paramValue,
        );

        if (hasConflictingLiteral) {
          return { isCompatible: false };
        }
      }
    }

    // Compatible but should only include if from signal (not user-provided)
    return {
      isCompatible: true,
      shouldInclude: !item.isUserProvided && !matchesChildLiteral,
      paramName,
      paramValue,
    };
  };

  /**
   * Helper: Determine if child route should be used based on active parameters
   */
  const shouldUseChildRoute = (childPatternObj, params, compatibility) => {
    // CRITICAL: Check if user explicitly passed undefined for parameters that would
    // normally be used to select this child route via sibling route relationships
    for (const [paramName, paramValue] of Object.entries(params)) {
      if (paramValue === undefined) {
        // Look for sibling routes (other children of the same parent) that use this parameter
        const relationships = patternRelationships.get(pattern);
        const siblingPatternObjs = relationships?.childPatterns || [];

        for (const siblingPatternObj of siblingPatternObjs) {
          if (siblingPatternObj === childPatternObj) continue; // Skip self

          // Check if sibling route uses this parameter
          const siblingUsesParam = siblingPatternObj.connections.some(
            (conn) => conn.paramName === paramName,
          );

          if (siblingUsesParam) {
            // Found a sibling that uses this parameter - get the signal value
            const siblingConnection = siblingPatternObj.connections.find(
              (conn) => conn.paramName === paramName,
            );

            if (
              siblingConnection &&
              siblingConnection.signal?.value !== undefined
            ) {
              const signalValue = siblingConnection.signal.value;

              // Check if this child route has a literal that matches the signal value
              const signalMatchesThisChildLiteral =
                childPatternObj.pattern.segments.some(
                  (segment) =>
                    segment.type === "literal" && segment.value === signalValue,
                );

              if (signalMatchesThisChildLiteral) {
                // This child route's literal matches the sibling's signal value
                // User passed undefined to override that signal - don't use this child route
                if (DEBUG) {
                  console.debug(
                    `[${pattern}] Blocking child route ${childPatternObj.originalPattern} because ${paramName}:undefined overrides sibling signal value "${signalValue}"`,
                  );
                }
                return false;
              }
            }
          }
        }
      }
    }

    // Check if child has active non-default signal values
    let hasActiveParams = false;
    const childParams = { ...compatibility.childParams };

    for (const connection of childPatternObj.connections) {
      const { paramName, signal, options } = connection;
      const defaultValue = options.defaultValue;

      // Check if parameter was explicitly provided by user
      const hasExplicitParam = paramName in params;
      const explicitValue = params[paramName];

      if (hasExplicitParam) {
        // User explicitly provided this parameter - use their value
        childParams[paramName] = explicitValue;
        if (explicitValue !== undefined && explicitValue !== defaultValue) {
          hasActiveParams = true;
        }
      } else if (signal?.value !== undefined) {
        // No explicit override - use signal value
        childParams[paramName] = signal.value;
        if (signal.value !== defaultValue) {
          hasActiveParams = true;
        }
      }
    }

    // Check if child pattern can be fully satisfied
    const initialMergedParams = { ...childParams, ...params };
    const canBuildChildCompletely = childPatternObj.pattern.segments.every(
      (segment) => {
        if (segment.type === "literal") return true;
        if (segment.type === "param") {
          return (
            segment.optional || initialMergedParams[segment.name] !== undefined
          );
        }
        return true;
      },
    );

    // Count only non-undefined provided parameters
    const nonUndefinedParams = Object.entries(params).filter(
      ([, value]) => value !== undefined,
    );
    const hasProvidedParams = nonUndefinedParams.length > 0;

    // Use child route if:
    // 1. Child has active non-default parameters, OR
    // 2. User provided non-undefined params AND child can be built completely
    const shouldUse =
      hasActiveParams || (hasProvidedParams && canBuildChildCompletely);

    if (DEBUG && shouldUse) {
      console.debug(
        `[${pattern}] Will use child route ${childPatternObj.originalPattern}`,
      );
    }

    return shouldUse;
  };

  /**
   * Helper: Build URL for selected child route with proper parameter filtering
   */
  const buildChildRouteUrl = (
    childPatternObj,
    params,
    parentResolvedParams = {},
  ) => {
    // Start with child signal values
    const baseParams = {};
    for (const connection of childPatternObj.connections) {
      const { paramName, signal, options } = connection;

      // Check if parameter was explicitly provided by user
      const hasExplicitParam = paramName in params;
      const explicitValue = params[paramName];

      if (hasExplicitParam) {
        // User explicitly provided this parameter - use their value (even if undefined)
        if (explicitValue !== undefined) {
          baseParams[paramName] = explicitValue;
        }
        // If explicitly undefined, don't include it (which means don't use child route)
      } else if (
        signal?.value !== undefined &&
        signal.value !== options.defaultValue
      ) {
        // No explicit override - use signal value if non-default
        baseParams[paramName] = signal.value;
      }
    }

    // Add parent parameters that should be inherited (excluding defaults and consumed parameters)
    for (const [paramName, parentValue] of Object.entries(
      parentResolvedParams,
    )) {
      // Skip if child route already handles this parameter
      const childConnection = childPatternObj.connections.find(
        (conn) => conn.paramName === paramName,
      );
      if (childConnection) {
        continue; // Child route handles this parameter directly
      }

      // Skip if parameter is consumed by child's literal path segments
      const isConsumedByChildPath = childPatternObj.pattern.segments.some(
        (segment) =>
          segment.type === "literal" && segment.value === parentValue,
      );
      if (isConsumedByChildPath) {
        continue; // Parameter is consumed by child's literal path
      }

      // Check if parent parameter is at default value
      const parentConnection = connections.find(
        (conn) => conn.paramName === paramName,
      );
      const parentDefault = parentConnection?.options?.defaultValue;
      if (parentValue === parentDefault) {
        continue; // Don't inherit default values
      }

      // Inherit this parameter as it's not handled by child and not at default
      baseParams[paramName] = parentValue;
    }

    // Apply user params with filtering logic
    for (const [paramName, userValue] of Object.entries(params)) {
      const childConnection = childPatternObj.connections.find(
        (conn) => conn.paramName === paramName,
      );

      if (childConnection) {
        const { options } = childConnection;
        const defaultValue = options.defaultValue;

        // Only include if it's NOT the signal's default value
        if (userValue !== defaultValue) {
          baseParams[paramName] = userValue;
        } else {
          // User provided the default value - complete omission
          delete baseParams[paramName];
        }
      } else {
        // Check if param corresponds to a literal segment in child pattern
        const isConsumedByChildPath = childPatternObj.pattern.segments.some(
          (segment) =>
            segment.type === "literal" && segment.value === userValue,
        );

        if (!isConsumedByChildPath) {
          // Not consumed by child path, keep it as query param
          baseParams[paramName] = userValue;
        }
      }
    }

    // Build child URL using buildUrl (not buildMostPreciseUrl) to prevent recursion
    const childUrl = childPatternObj.buildUrl(baseParams);

    if (childUrl && !childUrl.includes(":")) {
      // Check for parent optimization before returning
      const optimizedUrl = checkChildParentOptimization(
        childPatternObj.originalPattern,
        childUrl,
        baseParams,
      );
      return optimizedUrl || childUrl;
    }

    return null;
  };

  /**
   * Helper: Check if parent route optimization applies to child route
   */
  const checkChildParentOptimization = (childPattern, childUrl, baseParams) => {
    if (Object.keys(baseParams).length > 0) {
      return null; // No optimization if parameters exist
    }

    const childRelationships = patternRelationships.get(childPattern);
    const childParentObjs = childRelationships?.parentPatterns || [];

    for (const childParentObj of childParentObjs) {
      if (childParentObj.originalPattern === pattern) {
        // Get the child pattern object from relationships instead of recreating
        const childPatternObj = childRelationships;

        const allChildParamsAreDefaults = (
          childPatternObj.connections || []
        ).every((childConnection) => {
          const { signal, options } = childConnection;
          return signal?.value === options.defaultValue;
        });

        if (allChildParamsAreDefaults) {
          // Build current route URL for comparison
          const resolvedParams = resolveParams({});
          const finalParams = removeDefaultValues(resolvedParams);
          const currentUrl = buildUrlFromPattern(
            parsedPattern,
            finalParams,
            pattern,
          );
          if (currentUrl.length < childUrl.length) {
            return currentUrl;
          }
        }
      }
    }
    return null;
  };

  const buildMostPreciseUrl = (params = {}) => {
    if (DEBUG) {
      console.debug(`[${pattern}] buildMostPreciseUrl called`);
    }

    // Step 1: Resolve and clean parameters
    const resolvedParams = resolveParams(params);

    // Step 2: Try ancestors first - find the highest ancestor that works
    const relationships = patternRelationships.get(pattern);
    const parentPatternObjs = relationships?.parentPatterns || [];

    if (DEBUG) {
      console.debug(
        `[${pattern}] Available ancestors:`,
        parentPatternObjs.map((p) => p.originalPattern),
      );
    }

    let bestAncestorUrl = null;
    for (const parentPatternObj of parentPatternObjs) {
      // Skip root route - never use as optimization target
      if (parentPatternObj.originalPattern === "/") {
        continue;
      }

      // Try to use this ancestor and traverse up to find the highest possible
      const highestAncestorUrl = findHighestAncestor(
        parentPatternObj,
        resolvedParams,
      );
      if (DEBUG) {
        console.debug(
          `[${pattern}] Highest ancestor from ${parentPatternObj.originalPattern}:`,
          highestAncestorUrl,
        );
      }

      if (highestAncestorUrl) {
        // Take the first valid highest ancestor we find (they should all lead to same result)
        bestAncestorUrl = highestAncestorUrl;
        break;
      }
    }

    if (bestAncestorUrl) {
      if (DEBUG) {
        console.debug(`[${pattern}] Using ancestor optimization`);
      }
      return bestAncestorUrl;
    }

    // Step 3: Remove default values for normal URL building
    let finalParams = removeDefaultValues(resolvedParams);

    // Step 4: Try descendants - find the deepest descendant that works
    const childPatternObjs = relationships?.childPatterns || [];

    let bestDescendantUrl = null;
    for (const childPatternObj of childPatternObjs) {
      const deepestDescendantUrl = findDeepestDescendant(
        childPatternObj,
        params,
        resolvedParams,
      );
      if (deepestDescendantUrl) {
        // Take the first valid deepest descendant we find (or keep deepest among multiple)
        if (!bestDescendantUrl) {
          bestDescendantUrl = deepestDescendantUrl;
        } else {
          // If we have multiple valid descendants, we could prioritize by specificity
          // For now, take the first one found
        }
      }
    }

    if (bestDescendantUrl) {
      if (DEBUG) {
        console.debug(`[${pattern}] Using descendant optimization`);
      }
      return bestDescendantUrl;
    }
    if (DEBUG) {
      console.debug(`[${pattern}] No suitable child route found`);
    }

    // Step 5: Inherit parameters from parent routes
    inheritParentParameters(finalParams, relationships);

    // Step 6: Build the current route URL
    const generatedUrl = buildCurrentRouteUrl(finalParams);

    return generatedUrl;
  };

  /**
   * Helper: Find the highest ancestor by traversing parent chain recursively
   */
  const findHighestAncestor = (startAncestor) => {
    // Check if we can use this ancestor directly
    const directUrl = tryUseAncestor(startAncestor);
    if (!directUrl) {
      return null;
    }

    // Look for an even higher ancestor by checking the ancestor's parent
    const ancestorRelationships = patternRelationships.get(
      startAncestor.originalPattern,
    );
    if (ancestorRelationships && ancestorRelationships.parent) {
      const higherAncestor = ancestorRelationships.parent;

      // Skip root pattern
      if (higherAncestor.originalPattern === "/") {
        return directUrl;
      }

      // Recursively check if we can optimize to an even higher ancestor
      const higherUrl = findHighestAncestor(higherAncestor);
      if (higherUrl) {
        return higherUrl; // Found a higher ancestor, return that
      }
    }

    // No higher ancestor found, return the direct optimization
    return directUrl;
  };

  /**
   * Helper: Find the deepest descendant that can be used for this route
   */
  const findDeepestDescendant = (startChild, params, resolvedParams) => {
    // Check if we can use this child directly
    const directUrl = tryUseDescendant(startChild, params, resolvedParams);
    if (!directUrl) {
      return null;
    }

    // Now traverse down the child chain to find the deepest possible descendant
    let currentChild = startChild;
    let deepestUrl = directUrl;

    while (true) {
      const childRelationships = patternRelationships.get(
        currentChild.originalPattern,
      );
      const childChildren = childRelationships?.childPatterns || [];

      let foundDeeper = false;
      for (const deeperChild of childChildren) {
        const deeperUrl = tryUseDescendant(deeperChild, params, resolvedParams);
        if (deeperUrl) {
          // Found a deeper descendant that works
          deepestUrl = deeperUrl;
          currentChild = deeperChild;
          foundDeeper = true;
          break;
        }
      }

      if (!foundDeeper) {
        break; // No deeper descendant found, we're at the bottom
      }
    }

    return deepestUrl;
  };

  /**
   * Helper: Try to use an ancestor route (only for literal routes)
   */
  const tryUseAncestor = (ancestorPatternObj) => {
    // Only optimize literal routes (no parameters)
    const hasParameters =
      connections.length > 0 ||
      parsedPattern.segments.some((seg) => seg.type === "param");

    if (hasParameters) {
      if (DEBUG) {
        console.debug(`[${pattern}] tryUseAncestor: Has parameters, skipping`);
      }
      return null;
    }

    if (DEBUG) {
      console.debug(
        `[${pattern}] tryUseAncestor: Trying ancestor ${ancestorPatternObj.originalPattern}`,
      );
    }

    const result = tryDirectOptimization(
      parsedPattern,
      connections,
      ancestorPatternObj,
    );
    if (DEBUG) {
      console.debug(
        `[${pattern}] tryUseAncestor: tryDirectOptimization result:`,
        result,
      );
    }
    return result;
  };

  /**
   * Helper: Check if current literal route can be optimized to target ancestor
   */
  const tryDirectOptimization = (
    sourcePattern,
    sourceConnections,
    targetAncestor,
  ) => {
    const sourceLiterals = sourcePattern.segments
      .filter((seg) => seg.type === "literal")
      .map((seg) => seg.value);

    const targetLiterals = targetAncestor.pattern.segments
      .filter((seg) => seg.type === "literal")
      .map((seg) => seg.value);

    const targetParams = targetAncestor.pattern.segments.filter(
      (seg) => seg.type === "param",
    );

    if (DEBUG) {
      console.debug(
        `[${pattern}] tryDirectOptimization: sourceLiterals:`,
        sourceLiterals,
      );
      console.debug(
        `[${pattern}] tryDirectOptimization: targetLiterals:`,
        targetLiterals,
      );
      console.debug(
        `[${pattern}] tryDirectOptimization: targetParams:`,
        targetParams,
      );
    }

    // Source must extend target's literal path
    if (sourceLiterals.length <= targetLiterals.length) {
      if (DEBUG) {
        console.debug(`[${pattern}] tryDirectOptimization: Source too short`);
      }
      return null;
    }

    // Source must start with same literals as target
    for (let i = 0; i < targetLiterals.length; i++) {
      if (sourceLiterals[i] !== targetLiterals[i]) {
        if (DEBUG) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Literal mismatch at ${i}`,
          );
        }
        return null;
      }
    }

    // For literal-only optimization: if both source and target have only literals,
    // and source extends target, we can optimize directly
    const sourceHasOnlyLiterals = sourcePattern.segments.every(
      (seg) => seg.type === "literal",
    );
    const targetHasOnlyLiterals = targetAncestor.pattern.segments.every(
      (seg) => seg.type === "literal",
    );

    if (sourceHasOnlyLiterals && targetHasOnlyLiterals) {
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Both are literal-only routes, allowing optimization`,
        );
      }
      return targetAncestor.buildUrl({});
    }

    // For parametric optimization: remaining segments must match target's parameter defaults
    const extraSegments = sourceLiterals.slice(targetLiterals.length);
    if (extraSegments.length !== targetParams.length) {
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Extra segments ${extraSegments.length} != target params ${targetParams.length}`,
        );
      }
      return null;
    }

    for (let i = 0; i < extraSegments.length; i++) {
      const segment = extraSegments[i];
      const param = targetParams[i];
      const connection = targetAncestor.connections.find(
        (conn) => conn.paramName === param.name,
      );
      if (!connection || connection.options.defaultValue !== segment) {
        if (DEBUG) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Parameter default mismatch for ${param.name}`,
          );
        }
        return null;
      }
    }

    if (DEBUG) {
      console.debug(
        `[${pattern}] tryDirectOptimization: SUCCESS! Returning ancestor URL`,
      );
    }
    return targetAncestor.buildUrl({});
  };

  /**
   * Helper: Try to use a descendant route (simple compatibility check)
   */
  const tryUseDescendant = (
    descendantPatternObj,
    params,
    parentResolvedParams,
  ) => {
    // Check basic compatibility
    const compatibility = checkChildRouteCompatibility(
      descendantPatternObj,
      params,
    );
    if (!compatibility.isCompatible) {
      return null;
    }

    // Check if we should use this descendant
    const shouldUse = shouldUseChildRoute(
      descendantPatternObj,
      params,
      compatibility,
    );
    if (!shouldUse) {
      return null;
    }

    // Build descendant URL using buildUrl (not buildMostPreciseUrl) to prevent recursion
    return buildChildRouteUrl(
      descendantPatternObj,
      params,
      parentResolvedParams,
    );
  };

  /**
   * Helper: Inherit query parameters from parent patterns
   */
  const inheritParentParameters = (finalParams, relationships) => {
    const parentPatternObjs = relationships?.parentPatterns || [];

    for (const parentPatternObj of parentPatternObjs) {
      // Check parent's signal connections for non-default values to inherit
      for (const parentConnection of parentPatternObj.connections) {
        const { paramName, signal, options } = parentConnection;
        const defaultValue = options.defaultValue;

        // Only inherit if we don't have this param and parent has non-default value
        if (
          !(paramName in finalParams) &&
          signal?.value !== undefined &&
          signal.value !== defaultValue
        ) {
          // Don't inherit if parameter corresponds to a literal in our path
          const shouldInherit = !isParameterRedundantWithLiteralSegments(
            parsedPattern,
            parentPatternObj.pattern,
            paramName,
            signal.value,
          );

          if (shouldInherit) {
            finalParams[paramName] = signal.value;
          }
        }
      }
    }
  };

  /**
   * Helper: Build URL for current route with filtered pattern
   */
  const buildCurrentRouteUrl = (finalParams) => {
    if (!parsedPattern.segments) {
      return "/";
    }

    // Filter out parameter segments that don't have values
    const filteredPattern = {
      ...parsedPattern,
      segments: parsedPattern.segments.filter((segment) => {
        if (segment.type === "param") {
          return segment.name in finalParams;
        }
        return true; // Keep literal segments
      }),
    };

    // Remove trailing slash if we filtered out segments
    if (
      filteredPattern.segments.length < parsedPattern.segments.length &&
      parsedPattern.trailingSlash
    ) {
      filteredPattern.trailingSlash = false;
    }

    return buildUrlFromPattern(filteredPattern, finalParams, pattern);
  };

  // Calculate depth based on pattern relationships
  const depth = calculatePatternDepth(pattern);

  return {
    originalPattern: pattern, // Return the original pattern string
    pattern: parsedPattern,
    cleanPattern, // Return the clean pattern string
    connections, // Return signal connections along with pattern
    depth, // Depth in the pattern hierarchy
    applyOn,
    buildUrl,
    buildMostPreciseUrl,
    resolveParams,
  };
};

/**
 * Helper: Check if parameter matches any literal in child pattern
 */
const paramMatchesChildLiteral = (paramValue, childParsedPattern) => {
  return childParsedPattern.segments.some(
    (segment) => segment.type === "literal" && segment.value === paramValue,
  );
};

/**
 * Parse a route pattern string into structured segments
 */
const parsePattern = (pattern, parameterDefaults = new Map()) => {
  // Handle root route
  if (pattern === "/") {
    return {
      original: pattern,
      segments: [],
      trailingSlash: true,
      wildcard: false,
      queryParams: [],
    };
  }

  // Separate path and query portions
  const [pathPortion, queryPortion] = pattern.split("?");

  // Parse query parameters if present
  const queryParams = [];
  if (queryPortion) {
    // Split query parameters by & and parse each one
    const querySegments = queryPortion.split("&");
    for (const querySegment of querySegments) {
      if (querySegment.includes("=")) {
        // Parameter with potential value: tab=value or just tab
        const [paramName, paramValue] = querySegment.split("=", 2);
        queryParams.push({
          type: "query_param",
          name: paramName,
          hasDefaultValue: paramValue === undefined, // No value means it uses signal/default
        });
      } else {
        // Parameter without value: tab
        queryParams.push({
          type: "query_param",
          name: querySegment,
          hasDefaultValue: true,
        });
      }
    }
  }

  // Remove leading slash for processing the path portion
  let cleanPattern = pathPortion.startsWith("/")
    ? pathPortion.slice(1)
    : pathPortion;

  // Check for wildcard first
  const wildcard = cleanPattern.endsWith("*");
  if (wildcard) {
    cleanPattern = cleanPattern.slice(0, -1); // Remove *
    // Also remove the slash before * if present
    if (cleanPattern.endsWith("/")) {
      cleanPattern = cleanPattern.slice(0, -1);
    }
  }

  // Check for trailing slash (after wildcard check)
  const trailingSlash = !wildcard && pathPortion.endsWith("/");
  if (trailingSlash) {
    cleanPattern = cleanPattern.slice(0, -1); // Remove trailing /
  }

  // Split into segments (filter out empty segments)
  const segmentStrings = cleanPattern
    ? cleanPattern.split("/").filter((s) => s !== "")
    : [];
  const segments = segmentStrings.map((seg, index) => {
    if (seg.startsWith(":")) {
      // Parameter segment
      const paramName = seg.slice(1).replace("?", ""); // Remove : and optional ?
      const isOptional = seg.endsWith("?") || parameterDefaults.has(paramName);

      return {
        type: "param",
        name: paramName,
        optional: isOptional,
        index,
      };
    }
    // Literal segment
    return {
      type: "literal",
      value: seg,
      index,
    };
  });

  return {
    original: pattern,
    segments,
    queryParams, // Add query parameters to the parsed pattern
    trailingSlash,
    wildcard,
  };
};

/**
 * Check if a literal segment can be treated as optional based on parent route signal defaults
 */
const checkIfLiteralCanBeOptional = (literalValue, patternRegistry) => {
  // Look through all registered patterns for parent patterns that might have this literal as a default
  for (const [, patternData] of patternRegistry) {
    // Check if any signal connection has this literal value as default
    for (const connection of patternData.connections) {
      if (connection.options.defaultValue === literalValue) {
        return true; // This literal matches a signal default, so it can be optional
      }
    }
  }
  return false;
};

/**
 * Match a URL against a parsed pattern
 */
const matchUrl = (
  parsedPattern,
  url,
  { parameterDefaults, baseUrl, connections = [] },
) => {
  // Parse the URL
  const urlObj = new URL(url, baseUrl);
  let pathname = urlObj.pathname;
  const originalPathname = pathname; // Store original pathname before baseUrl processing

  // If baseUrl is provided, calculate the pathname relative to the baseUrl's directory
  if (baseUrl) {
    const baseUrlObj = new URL(baseUrl);
    // if the base url is a file, we want to be relative to the directory containing that file
    const baseDir = baseUrlObj.pathname.endsWith("/")
      ? baseUrlObj.pathname
      : baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf("/"));
    if (pathname.startsWith(baseDir)) {
      pathname = pathname.slice(baseDir.length);
    }
  }

  // Handle root route - only matches empty path or just "/"
  // OR when URL exactly matches baseUrl (treating baseUrl as root)
  if (parsedPattern.segments.length === 0) {
    if (pathname === "/" || pathname === "") {
      return extractSearchParams(urlObj, connections);
    }

    // Special case: if URL exactly matches baseUrl, treat as root route
    if (baseUrl) {
      const baseUrlObj = new URL(baseUrl);
      if (originalPathname === baseUrlObj.pathname) {
        return extractSearchParams(urlObj, connections);
      }
    }

    return null;
  }

  // Remove leading slash and split into segments
  let urlSegments = pathname.startsWith("/")
    ? pathname
        .slice(1)
        .split("/")
        .filter((s) => s !== "")
    : pathname.split("/").filter((s) => s !== "");

  // Handle trailing slash flexibility: if pattern has trailing slash but URL doesn't (or vice versa)
  // and we're at the end of segments, allow the match
  const urlHasTrailingSlash = pathname.endsWith("/") && pathname !== "/";
  const patternHasTrailingSlash = parsedPattern.trailingSlash;

  const params = {};
  let urlSegmentIndex = 0;

  // Process each pattern segment
  for (let i = 0; i < parsedPattern.segments.length; i++) {
    const patternSeg = parsedPattern.segments[i];

    if (patternSeg.type === "literal") {
      // Check if URL has this segment
      if (urlSegmentIndex >= urlSegments.length) {
        // URL is too short for this literal segment
        // Check if this literal segment can be treated as optional based on parent route defaults
        const canBeOptional = checkIfLiteralCanBeOptional(
          patternSeg.value,
          patternRegistry,
        );
        if (canBeOptional) {
          // Skip this literal segment, don't increment urlSegmentIndex
          continue;
        }
        return null; // URL too short and literal is not optional
      }

      const urlSeg = urlSegments[urlSegmentIndex];
      if (urlSeg !== patternSeg.value) {
        // Literal mismatch - this route doesn't match this URL
        return null;
      }
      urlSegmentIndex++;
    } else if (patternSeg.type === "param") {
      // Parameter segment
      if (urlSegmentIndex >= urlSegments.length) {
        // No URL segment for this parameter
        if (patternSeg.optional) {
          // Optional parameter - use default if available
          const defaultValue = parameterDefaults.get(patternSeg.name);
          if (defaultValue !== undefined) {
            params[patternSeg.name] = defaultValue;
          }
          continue;
        }
        // Required parameter missing - but check if we can use trailing slash logic
        // If this is the last segment and we have a trailing slash difference, it might still match
        const isLastSegment = i === parsedPattern.segments.length - 1;
        if (isLastSegment && patternHasTrailingSlash && !urlHasTrailingSlash) {
          // Pattern expects trailing slash segment, URL doesn't have it
          const defaultValue = parameterDefaults.get(patternSeg.name);
          if (defaultValue !== undefined) {
            params[patternSeg.name] = defaultValue;
            continue;
          }
        }
        return null; // Required parameter missing
      }

      // Capture URL segment as parameter value
      const urlSeg = urlSegments[urlSegmentIndex];
      params[patternSeg.name] = decodeURIComponent(urlSeg);
      urlSegmentIndex++;
    }
  }

  // Check for remaining URL segments
  // Patterns with trailing slashes can match additional URL segments (like wildcards)
  // Patterns without trailing slashes should match exactly (unless they're wildcards)
  if (
    !parsedPattern.wildcard &&
    !parsedPattern.trailingSlash &&
    urlSegmentIndex < urlSegments.length
  ) {
    return null; // Pattern without trailing slash should not match extra segments
  }
  // If pattern has trailing slash or wildcard, allow extra segments (no additional check needed)

  // Add search parameters
  const searchParams = extractSearchParams(urlObj, connections);
  Object.assign(params, searchParams);

  // Apply remaining parameter defaults for unmatched parameters
  for (const [paramName, defaultValue] of parameterDefaults) {
    if (!(paramName in params)) {
      params[paramName] = defaultValue;
    }
  }

  return params;
};

/**
 * Extract search parameters from URL
 */
const extractSearchParams = (urlObj, connections = []) => {
  const params = {};

  // Create a map for quick signal type lookup
  const signalTypes = new Map();
  for (const connection of connections) {
    if (connection.options.type) {
      signalTypes.set(connection.paramName, connection.options.type);
    }
  }

  for (const [key, value] of urlObj.searchParams) {
    const signalType = signalTypes.get(key);

    // Cast value based on signal type
    if (signalType === "number" || signalType === "float") {
      const numberValue = Number(value);
      params[key] = isNaN(numberValue) ? value : numberValue;
    } else if (signalType === "boolean") {
      params[key] = value === "true" || value === "1";
    } else {
      params[key] = value;
    }
  }
  return params;
};

/**
 * Build query parameters respecting hierarchical order from ancestor patterns
 */
const buildHierarchicalQueryParams = (
  parsedPattern,
  params,
  originalPattern,
) => {
  const queryParams = {};
  const processedParams = new Set();

  // Get relationships for this pattern
  const relationships = patternRelationships.get(originalPattern);
  const parentPatterns = relationships?.parentPatterns || [];

  // DEBUG: Log what we found
  if (DEBUG) {
    console.debug(`Building params for ${originalPattern}`);
  }

  // Step 1: Add query parameters from ancestor patterns (oldest to newest)
  // This ensures ancestor parameters come first in their declaration order
  const ancestorPatterns = parentPatterns; // Process in order: root ancestor first, then immediate parent

  for (const ancestorPatternObj of ancestorPatterns) {
    if (ancestorPatternObj.pattern?.queryParams) {
      for (const queryParam of ancestorPatternObj.pattern.queryParams) {
        const paramName = queryParam.name;
        if (
          params[paramName] !== undefined &&
          !processedParams.has(paramName)
        ) {
          queryParams[paramName] = params[paramName];
          processedParams.add(paramName);

          if (DEBUG) {
            console.debug(
              `Added ancestor param: ${paramName}=${params[paramName]}`,
            );
          }
        }
      }
    }
  }

  // Step 2: Add query parameters from current pattern
  if (parsedPattern.queryParams) {
    if (DEBUG) {
      console.debug(
        `Processing current pattern query params:`,
        parsedPattern.queryParams.map((q) => q.name),
      );
    }

    for (const queryParam of parsedPattern.queryParams) {
      const paramName = queryParam.name;
      if (params[paramName] !== undefined && !processedParams.has(paramName)) {
        queryParams[paramName] = params[paramName];
        processedParams.add(paramName);

        if (DEBUG) {
          console.debug(
            `Added current param: ${paramName}=${params[paramName]}`,
          );
        }
      }
    }
  }

  // Step 3: Add remaining parameters (extra params) alphabetically
  const extraParams = [];

  // Get all path parameter names to exclude them
  const pathParamNames = new Set(
    parsedPattern.segments.filter((s) => s.type === "param").map((s) => s.name),
  );

  for (const [key, value] of Object.entries(params)) {
    if (
      !pathParamNames.has(key) &&
      !processedParams.has(key) &&
      value !== undefined
    ) {
      extraParams.push([key, value]);
    }
  }

  // Sort extra params alphabetically for consistent order
  extraParams.sort(([a], [b]) => a.localeCompare(b));

  // Add sorted extra params
  for (const [key, value] of extraParams) {
    queryParams[key] = value;
  }

  return queryParams;
};

/**
 * Build a URL from a pattern and parameters
 */
const buildUrlFromPattern = (
  parsedPattern,
  params = {},
  originalPattern = null,
) => {
  if (parsedPattern.segments.length === 0) {
    // Root route
    const queryParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    }
    const search = buildQueryString(queryParams);
    return `/${search ? `?${search}` : ""}`;
  }

  const segments = [];

  for (const patternSeg of parsedPattern.segments) {
    if (patternSeg.type === "literal") {
      segments.push(patternSeg.value);
    } else if (patternSeg.type === "param") {
      const value = params[patternSeg.name];

      // If value is provided, include it
      if (value !== undefined) {
        segments.push(encodeParamValue(value, false)); // Named parameters encode slashes
      } else if (!patternSeg.optional) {
        // For required parameters without values, keep the placeholder
        segments.push(`:${patternSeg.name}`);
      }
      // Optional parameters with undefined values are omitted
    }
  }

  let path = `/${segments.join("/")}`;

  // Handle trailing slash - only add if it serves a purpose
  if (parsedPattern.trailingSlash && !path.endsWith("/") && path !== "/") {
    // Only add trailing slash if the original pattern suggests there could be more content
    // For patterns like "/admin/:section/" where the slash is at the very end,
    // it's not needed in the generated URL if there are no more segments
    const lastSegment =
      parsedPattern.segments[parsedPattern.segments.length - 1];
    const hasMorePotentialContent =
      parsedPattern.wildcard || (lastSegment && lastSegment.type === "literal"); // Only add slash after literals, not parameters

    if (hasMorePotentialContent) {
      path += "/";
    }
  } else if (
    !parsedPattern.trailingSlash &&
    path.endsWith("/") &&
    path !== "/"
  ) {
    // Remove trailing slash for patterns without trailing slash
    path = path.slice(0, -1);
  }

  // Check if we'll have query parameters to decide on trailing slash removal
  const willHaveQueryParams =
    parsedPattern.queryParams?.some((qp) => {
      const value = params[qp.name];
      return value !== undefined;
    }) ||
    Object.entries(params).some(([key, value]) => {
      const isPathParam = parsedPattern.segments.some(
        (s) => s.type === "param" && s.name === key,
      );
      const isQueryParam = parsedPattern.queryParams?.some(
        (qp) => qp.name === key,
      );
      return value !== undefined && !isPathParam && !isQueryParam;
    });

  // Remove trailing slash when we have query params for prettier URLs
  if (willHaveQueryParams && path.endsWith("/") && path !== "/") {
    path = path.slice(0, -1);
  }

  // Always remove trailing slash from simple paths (unless root) for cleaner URLs
  if (path.endsWith("/") && path !== "/" && !willHaveQueryParams) {
    path = path.slice(0, -1);
  }

  // Build query parameters respecting hierarchical order
  const queryParams = buildHierarchicalQueryParams(
    parsedPattern,
    params,
    originalPattern,
  );

  const search = buildQueryString(queryParams);

  // No longer handle trailing slash inheritance here

  return path + (search ? `?${search}` : "");
};

/**
 * Check if childPattern is a child route of parentPattern
 * E.g., "/admin/settings/:tab" is a child of "/admin/:section/"
 * Also, "/admin/?tab=something" is a child of "/admin/"
 */
const isChildPattern = (childPattern, parentPattern) => {
  // Split path and query parts
  const [childPath, childQuery] = childPattern.split("?");
  const [parentPath, parentQuery] = parentPattern.split("?");

  // Remove trailing slashes for path comparison
  const cleanChild = childPath.replace(/\/$/, "");
  const cleanParent = parentPath.replace(/\/$/, "");

  // CASE 1: Same path, child has query params, parent doesn't
  // E.g., "/admin/?tab=something" is child of "/admin/"
  if (cleanChild === cleanParent && childQuery && !parentQuery) {
    return true;
  }

  // CASE 2: Traditional path-based child relationship
  // Convert patterns to comparable segments for proper comparison
  const childSegments = cleanChild.split("/").filter((s) => s);
  const parentSegments = cleanParent.split("/").filter((s) => s);

  // Child must have at least as many segments as parent
  if (childSegments.length < parentSegments.length) {
    return false;
  }

  let hasMoreSpecificSegment = false;

  // Check if parent segments match child segments (allowing for parameters)
  for (let i = 0; i < parentSegments.length; i++) {
    const parentSeg = parentSegments[i];
    const childSeg = childSegments[i];

    // If parent has parameter, child can have anything in that position
    if (parentSeg.startsWith(":")) {
      // Child is more specific if it has a literal value for a parent parameter
      // But if child also starts with ":", it's also a parameter (not more specific)
      if (!childSeg.startsWith(":")) {
        hasMoreSpecificSegment = true;
      }
      continue;
    }

    // If parent has literal, child must match exactly
    if (parentSeg !== childSeg) {
      return false;
    }
  }

  // Child must be more specific (more segments OR more specific segments)
  return childSegments.length > parentSegments.length || hasMoreSpecificSegment;
};

/**
 * Check if a parameter is redundant because the child pattern already has it as a literal segment
 * E.g., parameter "section" is redundant for pattern "/admin/settings/:tab" because "settings" is literal
 */
const isParameterRedundantWithLiteralSegments = (
  childPattern,
  parentPattern,
  paramName,
) => {
  // Find which segment position corresponds to this parameter in the parent
  let paramSegmentIndex = -1;
  for (let i = 0; i < parentPattern.segments.length; i++) {
    const segment = parentPattern.segments[i];
    if (segment.type === "param" && segment.name === paramName) {
      paramSegmentIndex = i;
      break;
    }
  }

  // If parameter not found in parent segments, it's not redundant with path
  if (paramSegmentIndex === -1) {
    return false;
  }

  // Check if child has a literal segment at the same position
  if (childPattern.segments.length > paramSegmentIndex) {
    const childSegment = childPattern.segments[paramSegmentIndex];
    if (childSegment.type === "literal") {
      // Child has a literal segment where parent has parameter
      // This means the child is more specific and shouldn't inherit this parameter
      return true; // Redundant - child already specifies this position with a literal
    }
  }

  return false;
};

/**
 * Register all patterns at once and build their relationships
 */
export const setupPatterns = (patternDefinitions) => {
  // Clear existing patterns
  patternRegistry.clear();
  patternRelationships.clear();

  // Phase 1: Register all patterns and create pattern objects
  const patternObjects = new Map(); // pattern string -> pattern object

  for (const [key, urlPatternRaw] of Object.entries(patternDefinitions)) {
    const [cleanPattern, connections] = detectSignals(urlPatternRaw);
    const parsedPattern = parsePattern(cleanPattern);

    const patternData = {
      key,
      urlPatternRaw,
      cleanPattern,
      connections,
      parsedPattern,
      childPatterns: [],
      parentPatterns: [],
    };

    patternRegistry.set(urlPatternRaw, patternData);

    // Create the full pattern object for this pattern
    const patternObj = createRoutePattern(urlPatternRaw);
    patternObjects.set(urlPatternRaw, patternObj);
  }

  // Phase 2: Build relationships between all patterns
  const allPatterns = Array.from(patternRegistry.keys());

  for (const currentPattern of allPatterns) {
    const currentData = patternRegistry.get(currentPattern);

    for (const otherPattern of allPatterns) {
      if (currentPattern === otherPattern) continue;

      const otherData = patternRegistry.get(otherPattern);

      // Check if current pattern is a child of other pattern using clean patterns
      if (isChildPattern(currentData.cleanPattern, otherData.cleanPattern)) {
        // Store pattern objects instead of pattern strings
        currentData.parentPatterns.push(patternObjects.get(otherPattern));
        otherData.childPatterns.push(patternObjects.get(currentPattern));
      }
    }

    // Store relationships for easy access with pattern objects
    patternRelationships.set(currentPattern, {
      pattern: currentData.parsedPattern,
      parsedPattern: currentData.parsedPattern,
      connections: currentData.connections,
      childPatterns: currentData.childPatterns, // Now contains pattern objects
      parentPatterns: currentData.parentPatterns, // Now contains pattern objects
      originalPattern: currentPattern,
    });
  }

  if (DEBUG) {
    console.debug("Pattern registry updated");
  }
};

/**
 * Calculate the depth of a pattern based on its parent chain
 */
const calculatePatternDepth = (patternString) => {
  const relationships = patternRelationships.get(patternString);
  if (!relationships) {
    if (DEBUG) {
      console.debug(`[calculatePatternDepth] No relationships found for ${patternString}`);
    }
    return 0;
  }

  if (DEBUG) {
    console.debug(`[calculatePatternDepth] Calculating depth for ${patternString}`);
    console.debug(`[calculatePatternDepth] Parent patterns:`, relationships.parentPatterns?.map(p => p.originalPattern));
  }

  // If no parents, depth is 0 (root pattern)
  if (!relationships.parentPatterns || relationships.parentPatterns.length === 0) {
    if (DEBUG) {
      console.debug(`[calculatePatternDepth] Final depth for ${patternString}: 0 (no parents)`);
    }
    return 0;
  }

  // Find the most specific parent (the one with the most segments)
  // This is the direct parent, not a distant ancestor
  let mostSpecificParent = null;
  let maxSegments = -1;
  
  for (const parentPattern of relationships.parentPatterns) {
    const parentSegments = parentPattern.originalPattern.split('/').filter(Boolean);
    if (parentSegments.length > maxSegments) {
      maxSegments = parentSegments.length;
      mostSpecificParent = parentPattern;
    }
  }

  if (!mostSpecificParent) {
    if (DEBUG) {
      console.debug(`[calculatePatternDepth] No valid parent found for ${patternString}`);
    }
    return 0;
  }

  if (DEBUG) {
    console.debug(`[calculatePatternDepth] Most specific parent: ${mostSpecificParent.originalPattern}`);
  }

  // Recursively calculate depth: 1 + parent's depth
  const parentDepth = calculatePatternDepth(mostSpecificParent.originalPattern);
  const depth = parentDepth + 1;
  
  if (DEBUG) {
    console.debug(`[calculatePatternDepth] Final depth for ${patternString}: ${depth} (parent: ${mostSpecificParent.originalPattern} with depth ${parentDepth})`);
  }
  
  return depth;
};

/**
 * Clear all registered patterns
 */
export const clearPatterns = () => {
  patternRegistry.clear();
  patternRelationships.clear();
};

export const resolveRouteUrl = (relativeUrl) => {
  if (relativeUrl[0] === "/") {
    // we remove the leading slash because we want to resolve against baseUrl which may
    // not be the root url
    relativeUrl = relativeUrl.slice(1);
  }

  // we don't use URL constructor on PURPOSE (in case the relativeUrl contains invalid url chars)
  // and we want to support use cases where people WANT to produce invalid urls (for example rawUrlPart with spaces)
  // because these urls will be handled by non standard clients (like a backend service allowing url like stuff)
  if (baseUrl.endsWith("/")) {
    return `${baseUrl}${relativeUrl}`;
  }
  return `${baseUrl}/${relativeUrl}`;
};
