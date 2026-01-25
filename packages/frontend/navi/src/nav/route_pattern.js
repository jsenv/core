/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */

import { globalSignalRegistry } from "../state/state_signal.js";

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
let patternsRegistered = false;

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
    return buildUrlFromPattern(parsedPattern, params, parameterDefaults);
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
   * Helper: Find the best child route that matches current parameters and signals
   */
  const findBestChildRoute = (params, relationships) => {
    const childPatterns = relationships?.childPatterns || [];
    if (pattern === "/" || !childPatterns.length) {
      return null;
    }

    // Try each child pattern to find the most specific match
    for (const childPattern of childPatterns) {
      const childPatternData = getPatternData(childPattern);
      if (!childPatternData) continue;

      const childRouteCandidate = evaluateChildRoute(
        childPattern,
        childPatternData,
        params,
      );

      if (childRouteCandidate) {
        return childRouteCandidate;
      }
    }
    return null;
  };

  /**
   * Helper: Evaluate if a specific child route is suitable for current params/signals
   */
  const evaluateChildRoute = (childPattern, childPatternData, params) => {
    // Step 1: Check parameter compatibility
    const compatibility = checkChildRouteCompatibility(
      childPatternData,
      params,
    );
    if (!compatibility.isCompatible) {
      return null;
    }

    // Step 2: Determine if child route should be used
    const shouldUseChild = shouldUseChildRoute(
      childPatternData,
      params,
      compatibility,
    );
    if (!shouldUseChild) {
      return null;
    }

    // Step 3: Build child route URL with proper parameter filtering
    return buildChildRouteUrl(childPattern, childPatternData, params);
  };

  /**
   * Helper: Check if parameters are compatible with child route
   */
  const checkChildRouteCompatibility = (childPatternData, params) => {
    const childParams = {};
    let isCompatible = true;

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
        childPatternData.parsedPattern,
      );

      if (!result.isCompatible) {
        isCompatible = false;
        break;
      }

      if (result.shouldInclude) {
        childParams[result.paramName] = result.paramValue;
      }
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

    // Check for incompatible cases
    if (item.isUserProvided && !matchesChildLiteral) {
      // Check if this is a path parameter from parent pattern
      const isParentPathParam = connections.some(
        (conn) => conn.paramName === paramName,
      );

      if (isParentPathParam) {
        // User provided a path param value that doesn't match this child's literals
        return { isCompatible: false };
      }
    }

    // Special case: section parameter with settings literal
    if (paramName === "section" && paramValue !== "settings") {
      const hasSettingsLiteral = childParsedPattern.segments.some(
        (segment) => segment.type === "literal" && segment.value === "settings",
      );
      if (hasSettingsLiteral) {
        return { isCompatible: false };
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
  const shouldUseChildRoute = (childPatternData, params, compatibility) => {
    // Check if child has active non-default signal values
    let hasActiveParams = false;
    const childParams = { ...compatibility.childParams };

    for (const connection of childPatternData.connections) {
      const { paramName, signal, options } = connection;
      const defaultValue = options.defaultValue;

      if (signal?.value !== undefined) {
        childParams[paramName] = signal.value;
        if (signal.value !== defaultValue) {
          hasActiveParams = true;
        }
      }
    }

    // Check if child pattern can be fully satisfied
    const initialMergedParams = { ...childParams, ...params };
    const childPatternObj = createRoutePattern(childPatternData.urlPatternRaw);
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

    const hasProvidedParams = Object.keys(params).length > 0;

    // Use child route if:
    // 1. Child has active non-default parameters, OR
    // 2. User provided params AND child can be built completely
    return hasActiveParams || (hasProvidedParams && canBuildChildCompletely);
  };

  /**
   * Helper: Build URL for selected child route with proper parameter filtering
   */
  const buildChildRouteUrl = (childPattern, childPatternData, params) => {
    // Start with child signal values
    const baseParams = {};
    for (const connection of childPatternData.connections) {
      const { paramName, signal, options } = connection;
      if (
        signal?.value !== undefined &&
        signal.value !== options.defaultValue
      ) {
        baseParams[paramName] = signal.value;
      }
    }

    // Apply user params with filtering logic
    for (const [paramName, userValue] of Object.entries(params)) {
      const childConnection = childPatternData.connections.find(
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
        const isConsumedByChildPath =
          childPatternData.parsedPattern.segments.some(
            (segment) =>
              segment.type === "literal" && segment.value === userValue,
          );

        if (!isConsumedByChildPath) {
          // Not consumed by child path, keep it as query param
          baseParams[paramName] = userValue;
        }
      }
    }

    // Build child URL
    const childPatternObj = createRoutePattern(childPattern);
    const childUrl = childPatternObj.buildUrl(baseParams);

    if (childUrl && !childUrl.includes(":")) {
      // Check for parent optimization before returning
      const optimizedUrl = checkChildParentOptimization(
        childPattern,
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

    createRoutePattern(childPattern);
    const childRelationships = patternRelationships.get(childPattern);
    const childParents = childRelationships?.parentPatterns || [];

    for (const childParentPattern of childParents) {
      if (childParentPattern === pattern) {
        // Check if child has all default parameters
        const childPatternData = getPatternData(childPattern);
        if (!childPatternData) continue;

        const allChildParamsAreDefaults = childPatternData.connections.every(
          (childConnection) => {
            const { signal, options } = childConnection;
            return signal?.value === options.defaultValue;
          },
        );

        if (allChildParamsAreDefaults) {
          // Build current route URL for comparison
          const resolvedParams = resolveParams({});
          const finalParams = removeDefaultValues(resolvedParams);
          const currentUrl = buildUrlFromPattern(
            parsedPattern,
            finalParams,
            new Map(),
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
    // Step 1: Resolve and clean parameters
    const resolvedParams = resolveParams(params);
    let finalParams = removeDefaultValues(resolvedParams);

    // Step 2: Try to find a more specific child route
    const relationships = patternRelationships.get(pattern);
    const childRouteUrl = findBestChildRoute(params, relationships);
    if (childRouteUrl) {
      return childRouteUrl;
    }

    // Step 3: Inherit parameters from parent routes
    inheritParentParameters(finalParams, relationships);

    // Step 4: Build the current route URL
    const generatedUrl = buildCurrentRouteUrl(finalParams);

    // Step 5: Check for parent route optimization
    const optimizedUrl = checkParentRouteOptimization(
      generatedUrl,
      finalParams,
      relationships,
    );

    return optimizedUrl || generatedUrl;
  };

  /**
   * Helper: Inherit query parameters from parent patterns
   */
  const inheritParentParameters = (finalParams, relationships) => {
    const parentPatterns = relationships?.parentPatterns || [];

    for (const parentPattern of parentPatterns) {
      const parentPatternData = getPatternData(parentPattern);
      if (!parentPatternData) continue;

      // Check parent's signal connections for non-default values to inherit
      for (const parentConnection of parentPatternData.connections) {
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
            parentPatternData.parsedPattern,
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

    return buildUrlFromPattern(filteredPattern, finalParams, new Map());
  };

  /**
   * Helper: Check if parent route can provide a shorter equivalent URL
   */
  const checkParentRouteOptimization = (
    generatedUrl,
    finalParams,
    relationships,
  ) => {
    // Only optimize if current route has no final params and all signals are default
    const allParamsAreDefaults = connections.every(
      (conn) => conn.signal?.value === conn.options.defaultValue,
    );

    if (Object.keys(finalParams).length > 0 || !allParamsAreDefaults) {
      return null;
    }

    const possibleParents = relationships?.parentPatterns || [];

    for (const parentPattern of possibleParents) {
      // Skip root route and routes without parameters
      if (parentPattern === "/" || !parentPattern.includes(":")) {
        continue;
      }

      const optimizedParentUrl = evaluateParentOptimization(
        parentPattern,
        generatedUrl,
      );

      if (optimizedParentUrl) {
        return optimizedParentUrl;
      }
    }

    return null;
  };

  /**
   * Helper: Evaluate a specific parent pattern for URL optimization
   */
  const evaluateParentOptimization = (parentPattern, generatedUrl) => {
    const parentPatternObj = createRoutePattern(parentPattern);
    const parentPatternData = getPatternData(parentPattern);
    if (!parentPatternData) return null;

    // Check if parent's default values match our literals
    const parentPointsToCurrentRoute = parentPatternData.connections.every(
      (parentConnection) => {
        const { options } = parentConnection;
        const defaultValue = options.defaultValue;
        const currentLiterals = getPatternLiterals(parsedPattern);
        return currentLiterals.includes(defaultValue);
      },
    );

    if (parentPointsToCurrentRoute) {
      const parentUrl = parentPatternObj.buildUrl({});
      if (
        parentUrl &&
        parentUrl.length < generatedUrl.length &&
        parentUrl !== "/"
      ) {
        return parentUrl;
      }
    }

    return null;
  };

  return {
    originalPattern: pattern, // Return the original pattern string
    pattern: parsedPattern,
    cleanPattern, // Return the clean pattern string
    connections, // Return signal connections along with pattern
    specificity: calculatePatternSpecificity(parsedPattern), // Pre-calculate specificity
    applyOn,
    buildUrl,
    buildMostPreciseUrl,
    resolveParams,
  };
};

/**
 * Helper: Extract literal values from pattern segments
 */
const getPatternLiterals = (pattern) => {
  return pattern.segments
    .filter((seg) => seg.type === "literal")
    .map((seg) => seg.value);
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
 * Calculate pattern specificity score for route matching
 * Higher score = more specific route
 */
const calculatePatternSpecificity = (parsedPattern) => {
  let specificity = 0;

  // Count path segments (ignoring query params for specificity)
  const pathSegments = parsedPattern.segments || [];

  for (const segment of pathSegments) {
    if (segment.type === "literal") {
      // Literal segments are more specific than parameters
      specificity += 100; // High score for literal segments
    } else if (segment.type === "param") {
      // Parameter segments are less specific
      specificity += 10; // Lower score for parameters
    }
  }

  // Add base score for number of path segments (more segments = more specific)
  specificity += pathSegments.length;

  return specificity;
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
 * Build a URL from a pattern and parameters
 */
const buildUrlFromPattern = (parsedPattern, params = {}) => {
  if (parsedPattern.segments.length === 0) {
    // Root route
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, value);
      }
    }
    const search = searchParams.toString();
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
        segments.push(encodeURIComponent(value));
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

  // Add search parameters
  const pathParamNames = new Set(
    parsedPattern.segments.filter((s) => s.type === "param").map((s) => s.name),
  );

  // Add query parameters defined in the pattern first
  const queryParamNames = new Set();
  const searchParams = new URLSearchParams();

  // Handle pattern-defined query parameters (from ?tab, &lon, etc.)
  if (parsedPattern.queryParams) {
    for (const queryParam of parsedPattern.queryParams) {
      const paramName = queryParam.name;
      queryParamNames.add(paramName);

      const value = params[paramName];
      if (value !== undefined) {
        searchParams.set(paramName, value);
      }
      // If no value provided, don't add the parameter to keep URLs clean
    }
  }

  // Add remaining parameters as additional query parameters (excluding path and pattern query params)
  // Sort extra params alphabetically for consistent order
  const extraParams = [];
  for (const [key, value] of Object.entries(params)) {
    if (
      !pathParamNames.has(key) &&
      !queryParamNames.has(key) &&
      value !== undefined
    ) {
      // Check if this parameter is redundant with literal segments in the path
      // E.g., don't add "section=analytics" if path is already "/admin/analytics"
      const isRedundantWithPath = parsedPattern.segments.some(
        (segment) => segment.type === "literal" && segment.value === value,
      );

      if (!isRedundantWithPath) {
        extraParams.push([key, value]);
      }
    }
  }

  // Sort extra params alphabetically for consistent order
  extraParams.sort(([a], [b]) => a.localeCompare(b));

  // Add sorted extra params to searchParams
  for (const [key, value] of extraParams) {
    searchParams.set(key, value);
  }

  const search = searchParams.toString();

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

  // Phase 1: Register all patterns
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
        currentData.parentPatterns.push(otherPattern);
        otherData.childPatterns.push(currentPattern);
      }
    }

    // Store relationships for easy access
    patternRelationships.set(currentPattern, {
      pattern: currentData.parsedPattern,
      parsedPattern: currentData.parsedPattern,
      connections: currentData.connections,
      childPatterns: currentData.childPatterns, // Store child patterns
      parentPatterns: currentData.parentPatterns, // Store parent patterns
      originalPattern: currentPattern,
    });
  }

  patternsRegistered = true;

  if (DEBUG) {
    console.debug("Patterns registered:", patternRegistry.size);
    for (const [pattern, data] of patternRegistry) {
      console.debug(`Pattern: ${pattern}`, {
        children: data.childPatterns,
        parents: data.parentPatterns,
      });
    }
  }
};

/**
 * Get pattern data for a registered pattern
 */
export const getPatternData = (urlPatternRaw) => {
  return patternRegistry.get(urlPatternRaw);
};

/**
 * Get pattern relationships for route creation
 */
export const getPatternRelationships = () => {
  if (!patternsRegistered) {
    throw new Error(
      "Patterns must be registered before accessing relationships",
    );
  }
  return patternRelationships;
};

/**
 * Clear all registered patterns
 */
export const clearPatterns = () => {
  patternRegistry.clear();
  patternRelationships.clear();
  patternsRegistered = false;
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
