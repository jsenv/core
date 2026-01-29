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

const DEBUG =
  typeof process === "object" ? process.env.DEBUG === "true" : false;

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

// Function to detect signals in route patterns and connect them
const detectSignals = (routePattern) => {
  const signalConnections = [];
  let updatedPattern = routePattern;

  // First check for the common mistake: :${signalName} without parameter name
  const anonymousSignalRegex = /([?:&])(\{navi_state_signal:[^}]+\})/g;
  let anonymousMatch;
  while ((anonymousMatch = anonymousSignalRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, signalString] = anonymousMatch;
    console.warn(
      `[detectSignals] Anonymous signal parameter detected: "${fullMatch}". ` +
        `This pattern won't work correctly because it lacks a parameter name. ` +
        `Consider using "${prefix}paramName=${signalString}" instead. ` +
        `For example, if this should be a "mode" parameter, use "${prefix}mode=${signalString}".`,
    );
  }

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

  // Create signalSet to track all signals this pattern depends on
  const signalSet = new Set();
  for (const connection of connections) {
    if (connection.signal) {
      signalSet.add(connection.signal);
    }
  }

  if (DEBUG) {
    console.debug(`[CustomPattern] Created pattern:`, parsedPattern);
    console.debug(`[CustomPattern] Signal connections:`, connections);
    console.debug(`[CustomPattern] SignalSet size:`, signalSet.size);
  }

  const applyOn = (url) => {
    const result = matchUrl(parsedPattern, url, {
      parameterDefaults,
      baseUrl,
      connections,
      patternObj: patternObject,
    });

    if (DEBUG) {
      console.debug(
        `[CustomPattern] Matching "${url}" against "${cleanPattern}":`,
        result,
      );
    }

    return result;
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

    // Include active non-default parameters from child routes for URL optimization
    // Only include from child routes that would actually match the current parameters
    const childPatternObjs = patternObject.children || [];
    for (const childPatternObj of childPatternObjs) {
      // Check if this child route would match the current resolved parameters
      // by simulating URL building and seeing if the child segments align
      let childWouldMatch = true;

      // Compare child segments with what would be built from current params
      for (let i = 0; i < childPatternObj.pattern.segments.length; i++) {
        const childSegment = childPatternObj.pattern.segments[i];
        const parentSegment = parsedPattern.segments[i];

        if (childSegment.type === "literal") {
          if (parentSegment && parentSegment.type === "param") {
            // Child has literal where parent has parameter - check if values match
            const paramValue = resolvedParams[parentSegment.name];
            if (paramValue !== childSegment.value) {
              childWouldMatch = false;
              break;
            }
          }
          // If parent also has literal at this position, they should already match from route hierarchy
        }
        // Parameter segments are always compatible
      }

      if (childWouldMatch) {
        for (const childConnection of childPatternObj.connections) {
          const {
            paramName: childParam,
            signal: childSignal,
            options: childOptions,
          } = childConnection;

          // Only include if not already resolved and is non-default
          if (
            !(childParam in resolvedParams) &&
            childSignal?.value !== undefined &&
            childSignal.value !== childOptions.defaultValue
          ) {
            resolvedParams[childParam] = childSignal.value;
          }
        }
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
      const { paramName, signal } = connection;
      const defaultValue = parameterDefaults.get(paramName);

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
   * Helper: Check if a literal value can be reached through available parameters
   */
  const canReachLiteralValue = (literalValue, params) => {
    // Check parent's own parameters (signals and user params)
    const parentCanProvide = connections.some((conn) => {
      const signalValue = conn.signal?.value;
      const userValue = params[conn.paramName];
      const effectiveValue = userValue !== undefined ? userValue : signalValue;
      return (
        effectiveValue === literalValue &&
        effectiveValue !== conn.options.defaultValue
      );
    });

    // Check user-provided parameters
    const userCanProvide = Object.entries(params).some(
      ([, value]) => value === literalValue,
    );

    // Check if any signal in the current pattern tree can provide this literal
    // We traverse ancestors and descendants to find signals that could provide the literal
    const getAncestorSignals = (pattern) => {
      const signals = [];
      let current = pattern;
      while (current) {
        signals.push(...current.connections);
        current = current.parent;
      }
      return signals;
    };

    const getDescendantSignals = (pattern) => {
      const signals = [...pattern.connections];
      for (const child of pattern.children || []) {
        signals.push(...getDescendantSignals(child));
      }
      return signals;
    };

    const allRelevantSignals = [
      ...getAncestorSignals(patternObject),
      ...getDescendantSignals(patternObject),
    ];

    const systemCanProvide = allRelevantSignals.some((conn) => {
      const signalValue = conn.signal?.value;
      return (
        signalValue === literalValue &&
        signalValue !== conn.options.defaultValue
      );
    });

    return parentCanProvide || userCanProvide || systemCanProvide;
  };
  const checkChildRouteCompatibility = (childPatternObj, params) => {
    const childParams = {};
    let isCompatible = true;

    // CRITICAL: Check if parent route can reach all child route's literal segments
    // A route can only optimize to a descendant if there's a viable path through parameters
    // to reach all the descendant's literal segments (e.g., "/" cannot reach "/admin"
    // without a parameter that produces "admin")
    const childLiterals = childPatternObj.pattern.segments.filter(
      (segment) => segment.type === "literal",
    );
    // Check each child literal segment
    for (let i = 0; i < childLiterals.length; i++) {
      const childLiteral = childLiterals[i];
      const childPosition = childLiteral.index;
      const literalValue = childLiteral.value;

      // Check what the parent has at this position
      const parentSegmentAtPosition = parsedPattern.segments.find(
        (segment) => segment.index === childPosition,
      );

      if (parentSegmentAtPosition) {
        if (parentSegmentAtPosition.type === "literal") {
          // Parent has a literal at this position
          if (parentSegmentAtPosition.value === literalValue) {
            // Same literal - no problem
            continue;
          }
          // Different literal - incompatible
          if (DEBUG) {
            console.debug(
              `[${pattern}] INCOMPATIBLE with ${childPatternObj.originalPattern}: conflicting literal "${parentSegmentAtPosition.value}" vs "${literalValue}" at position ${childPosition}`,
            );
          }
          return { isCompatible: false, childParams: {} };
        }
        if (parentSegmentAtPosition.type === "param") {
          // Parent has a parameter at this position - child literal can satisfy this parameter
          // BUT we need to check if the parent's parameter value matches the child's literal

          // Find the parent's parameter value from signals or params
          const paramName = parentSegmentAtPosition.name;
          let parentParamValue = params[paramName];

          // If not in params, check signals
          if (parentParamValue === undefined) {
            const parentConnection = connections.find(
              (conn) => conn.paramName === paramName,
            );
            if (parentConnection && parentConnection.signal) {
              parentParamValue = parentConnection.signal.value;
            }
          }

          // If parent has a specific value for this parameter, it must match the child literal
          if (
            parentParamValue !== undefined &&
            parentParamValue !== literalValue
          ) {
            return { isCompatible: false, childParams: {} };
          }

          continue;
        }
      }
      // Parent doesn't have a segment at this position - child extends beyond parent
      // Check if any available parameter can produce this literal value
      else if (!canReachLiteralValue(literalValue, params)) {
        if (DEBUG) {
          console.debug(
            `[${pattern}] INCOMPATIBLE with ${childPatternObj.originalPattern}: cannot reach literal segment "${literalValue}" at position ${childPosition} - no viable parameter path`,
          );
        }
        return { isCompatible: false, childParams: {} };
      }
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

    // ROBUST FIX: For path parameters, check semantic compatibility by verifying
    // that parent parameter values can actually produce the child route structure
    const isParentPathParam = connections.some(
      (conn) => conn.paramName === paramName,
    );
    if (isParentPathParam) {
      // Check if parent parameter value matches any child literal where it should
      // The key insight: if parent has a specific parameter value, child route must
      // be reachable with that value or they're incompatible
      const parameterCanReachChild = canParameterReachChildRoute(
        paramName,
        paramValue,
        parsedPattern,
        childParsedPattern,
      );

      if (!parameterCanReachChild) {
        return { isCompatible: false };
      }
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
  const shouldUseChildRoute = (
    childPatternObj,
    params,
    compatibility,
    resolvedParams,
  ) => {
    // CRITICAL: Check if user explicitly passed undefined for parameters that would
    // normally be used to select this child route via sibling route relationships
    for (const [paramName, paramValue] of Object.entries(params)) {
      if (paramValue === undefined) {
        // Look for sibling routes (other children of the same parent) that use this parameter
        const siblingPatternObjs = patternObject.children || [];

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

    // Count only non-undefined provided parameters that are NOT default values
    const nonDefaultParams = Object.entries(params).filter(
      ([paramName, value]) => {
        if (value === undefined) return false;

        // Check if this parameter has a default value in child's connections
        const childConnection = childPatternObj.connections.find(
          (conn) => conn.paramName === paramName,
        );
        if (childConnection) {
          return value !== childConnection.options.defaultValue;
        }

        // Check if this parameter has a default value in parent's connections (current pattern)
        const parentConnection = connections.find(
          (conn) => conn.paramName === paramName,
        );
        if (parentConnection) {
          return value !== parentConnection.options.defaultValue;
        }

        return true; // Non-connection parameters are considered non-default
      },
    );

    const hasNonDefaultProvidedParams = nonDefaultParams.length > 0;

    // Use child route if:
    // 1. Child has active non-default parameters, OR
    // 2. User provided non-default params AND child can be built completely
    // EXCEPT: Don't use child if parent can produce cleaner URL by omitting defaults
    let shouldUse =
      hasActiveParams ||
      (hasNonDefaultProvidedParams && canBuildChildCompletely);

    // Optimization: Check if child would include literal segments that represent default values
    if (shouldUse) {
      // Check if child pattern has literal segments that correspond to default parameter values
      const childLiterals = childPatternObj.pattern.segments
        .filter((seg) => seg.type === "literal")
        .map((seg) => seg.value);

      const parentLiterals = parsedPattern.segments
        .filter((seg) => seg.type === "literal")
        .map((seg) => seg.value);

      // If child has more literal segments than parent, check if the extra ones are defaults
      if (childLiterals.length > parentLiterals.length) {
        const extraLiterals = childLiterals.slice(parentLiterals.length);

        // Check if any extra literal matches a default parameter value
        // BUT only skip if user didn't explicitly provide that parameter AND
        // both conditions are true:
        // 1. The parameters that would cause us to use this child route are defaults
        // 2. The child route doesn't have non-default parameters that would be lost
        let childSpecificParamsAreDefaults = true;

        // Check if parameters that determine child selection are non-default
        // OR if any descendant parameters indicate explicit navigation
        for (const connection of connections) {
          const { paramName } = connection;
          const defaultValue = parameterDefaults.get(paramName);
          const resolvedValue = resolvedParams[paramName];
          const userProvidedParam = paramName in params;

          if (extraLiterals.includes(defaultValue)) {
            // This literal corresponds to a parameter in the parent
            if (
              userProvidedParam ||
              (resolvedValue !== undefined && resolvedValue !== defaultValue)
            ) {
              // Parameter was explicitly provided or has non-default value - child is needed
              childSpecificParamsAreDefaults = false;
              break;
            }
          }
        }

        // Additional check: if child route has path parameters that are non-default,
        // this indicates explicit navigation even if structural parameters happen to be default
        // (Query parameters don't count as they don't indicate structural navigation)
        if (childSpecificParamsAreDefaults) {
          for (const childConnection of childPatternObj.connections) {
            const childParamName = childConnection.paramName;
            const childDefaultValue = childConnection.options?.defaultValue;
            const childResolvedValue = resolvedParams[childParamName];

            // Only consider path parameters, not query parameters
            const isPathParam = childPatternObj.pattern.segments.some(
              (seg) => seg.type === "param" && seg.name === childParamName,
            );

            if (
              isPathParam &&
              childResolvedValue !== undefined &&
              childResolvedValue !== childDefaultValue
            ) {
              // Child has non-default path parameters, indicating explicit navigation
              childSpecificParamsAreDefaults = false;
              if (DEBUG) {
                console.debug(
                  `[${pattern}] Child has non-default path parameter '${childParamName}=${childResolvedValue}' (default: ${childDefaultValue}) - indicates explicit navigation`,
                );
              }
              break;
            }
          }
        }

        // When structural parameters (those that determine child selection) are defaults,
        // prefer parent route regardless of whether child has other non-default parameters
        if (childSpecificParamsAreDefaults) {
          for (const connection of connections) {
            const { paramName } = connection;
            const defaultValue = parameterDefaults.get(paramName);
            const userProvidedParam = paramName in params;

            if (extraLiterals.includes(defaultValue) && !userProvidedParam) {
              // This child includes a literal that represents a default value
              // AND user didn't explicitly provide this parameter
              // When structural parameters are defaults, prefer parent for cleaner URL
              shouldUse = false;
              if (DEBUG) {
                console.debug(
                  `[${pattern}] Preferring parent over child - child includes default literal '${defaultValue}' for param '${paramName}' (structural parameter is default)`,
                );
              }
              break;
            }
          }
        } else if (DEBUG) {
          console.debug(
            `[${pattern}] Using child route - parameters that determine child selection are non-default`,
          );
        }
      }
    }

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

    // Collect parameters from ALL ancestor routes in the hierarchy (not just immediate parent)
    const collectAncestorParameters = (currentPatternObj) => {
      if (!currentPatternObj?.parent) {
        return; // No more ancestors
      }

      const parentPatternObj = currentPatternObj.parent;

      // Add parent's signal parameters
      for (const connection of parentPatternObj.connections) {
        const { paramName, signal, options } = connection;
        const defaultValue = options.defaultValue;

        // Skip if child route already handles this parameter
        const childConnection = childPatternObj.connections.find(
          (conn) => conn.paramName === paramName,
        );
        if (childConnection) {
          continue; // Child route handles this parameter directly
        }

        // Skip if parameter is already collected
        if (paramName in baseParams) {
          continue; // Already have this parameter
        }

        // Only include non-default signal values
        if (signal?.value !== undefined && signal.value !== defaultValue) {
          // Skip if parameter is consumed by child's literal path segments
          const isConsumedByChildPath = childPatternObj.pattern.segments.some(
            (segment) =>
              segment.type === "literal" && segment.value === signal.value,
          );
          if (!isConsumedByChildPath) {
            baseParams[paramName] = signal.value;
          }
        }
      }

      // Recursively collect from higher ancestors
      collectAncestorParameters(parentPatternObj);
    };

    // Start collecting from the child's parent
    collectAncestorParameters(childPatternObj);

    // Add parent parameters from the immediate calling context
    for (const [paramName, parentValue] of Object.entries(
      parentResolvedParams,
    )) {
      // Skip if already collected from ancestors or child handles it
      if (paramName in baseParams) {
        continue;
      }

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
    const childUrl = buildUrlFromPattern(
      childPatternObj.pattern,
      baseParams,
      childPatternObj.originalPattern,
      childPatternObj,
    );

    if (childUrl && !childUrl.includes(":")) {
      // Check for parent optimization before returning
      const optimizedUrl = checkChildParentOptimization(
        childPatternObj,
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
  const checkChildParentOptimization = (
    childPatternObj,
    childUrl,
    baseParams,
  ) => {
    if (Object.keys(baseParams).length > 0) {
      return null; // No optimization if parameters exist
    }

    const childParent = childPatternObj.parent;

    if (childParent && childParent.originalPattern === pattern) {
      // Check if child has any non-default signal values
      const hasNonDefaultChildParams = (childPatternObj.connections || []).some(
        (childConnection) => {
          const { signal, options } = childConnection;
          return signal?.value !== options.defaultValue;
        },
      );

      if (hasNonDefaultChildParams) {
        // Child has non-default signal values - use child URL instead of parent
        if (DEBUG) {
          console.debug(
            `[${pattern}] Using child route ${childPatternObj.originalPattern} because it has non-default signal values`,
          );
        }
        return childUrl;
      }
    }

    return null;
  };

  const buildMostPreciseUrl = (params = {}) => {
    if (DEBUG) {
      console.debug(`[${pattern}] buildMostPreciseUrl called`);
    }

    // Use the pattern object's signalSet (updated by setupPatterns)
    const effectiveSignalSet = patternObject.signalSet;

    // Access signal.value to trigger dependency tracking
    if (DEBUG) {
      console.debug(
        `[${pattern}] Reading ${effectiveSignalSet.size} signals for reactive dependencies`,
      );
    }
    // for (const signal of effectiveSignalSet) {
    //   // Access signal.value to trigger dependency tracking
    //   // eslint-disable-next-line no-unused-expressions
    //   signal.value; // This line is critical for signal reactivity - when commented out, routes may not update properly
    // }

    // Step 1: Resolve and clean parameters
    const resolvedParams = resolveParams(params);

    // Step 2: Try ancestors first - find the highest ancestor that works
    const parentPattern = patternObject.parent;

    if (DEBUG && parentPattern) {
      console.debug(
        `[${pattern}] Available ancestor:`,
        parentPattern.originalPattern,
      );
    }

    let bestAncestorUrl = null;
    if (parentPattern) {
      // Skip root route - never use as optimization target
      if (parentPattern.originalPattern !== "/") {
        // Try to use this ancestor and traverse up to find the highest possible
        const highestAncestorUrl = findHighestAncestor(
          parentPattern,
          resolvedParams,
        );
        if (DEBUG) {
          console.debug(
            `[${pattern}] Highest ancestor from ${parentPattern.originalPattern}:`,
            highestAncestorUrl,
          );
        }

        if (highestAncestorUrl) {
          bestAncestorUrl = highestAncestorUrl;
        }
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
    const childPatternObjs = patternObject.children || [];

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
    inheritParentParameters(finalParams);

    // Step 6: Build the current route URL
    const generatedUrl = buildCurrentRouteUrl(finalParams);

    return generatedUrl;
  };

  /**
   * Helper: Find the highest ancestor by traversing parent chain recursively
   */
  const findHighestAncestor = (startAncestor, resolvedParams) => {
    // Check if we can use this ancestor directly
    const directUrl = tryUseAncestor(startAncestor, resolvedParams);
    if (!directUrl) {
      return null;
    }

    // Look for an even higher ancestor by checking the ancestor's parent
    if (startAncestor.parent) {
      const higherAncestor = startAncestor.parent;

      // Skip root pattern
      if (higherAncestor.originalPattern === "/") {
        return directUrl;
      }

      // Recursively check if we can optimize to an even higher ancestor
      const higherUrl = findHighestAncestor(higherAncestor, resolvedParams);
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
      const childChildren = currentChild.children || [];

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
   * Helper: Try to use an ancestor route (only immediate parent for parameter optimization)
   */
  const tryUseAncestor = (ancestorPatternObj, resolvedParams) => {
    // Check if this ancestor is the immediate parent (for parameter optimization safety)
    const immediateParent = patternObject.parent;

    if (
      immediateParent &&
      immediateParent.originalPattern === ancestorPatternObj.originalPattern
    ) {
      // This is the immediate parent - check if we can optimize
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryUseAncestor: Trying immediate parent ${ancestorPatternObj.originalPattern}`,
        );
      }

      // For immediate parent optimization with parameters, only allow if:
      // 1. All path/route parameters have default values, OR
      // 2. The source route has only query parameters that are non-default
      const hasNonDefaultPathParams = connections.some((connection) => {
        const resolvedValue = resolvedParams[connection.paramName];
        const defaultValue = connection.options.defaultValue;
        // Check if this is a query parameter (not in the pattern path)
        const isQueryParam = parsedPattern.queryParams.some(
          (qp) => qp.name === connection.paramName,
        );
        // Allow non-default query parameters, but not path parameters
        return !isQueryParam && resolvedValue !== defaultValue;
      });

      if (hasNonDefaultPathParams) {
        if (DEBUG) {
          console.debug(
            `[${pattern}] tryUseAncestor: Has non-default path parameters, skipping`,
          );
        }
        return null;
      }

      const result = tryDirectOptimization(
        parsedPattern,
        connections,
        ancestorPatternObj,
        resolvedParams,
      );
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryUseAncestor: tryDirectOptimization result:`,
          result,
        );
      }
      return result;
    }

    // For non-immediate parents, only allow optimization if all resolved parameters have default values
    const hasNonDefaultParameters = connections.some((connection) => {
      const resolvedValue = resolvedParams[connection.paramName];
      const defaultValue = connection.options.defaultValue;
      return resolvedValue !== defaultValue;
    });

    if (hasNonDefaultParameters) {
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryUseAncestor: Non-immediate parent with non-default parameters, skipping`,
        );
      }
      return null;
    }

    // This is not the immediate parent - only allow literal-only optimization
    const hasParameters =
      connections.length > 0 ||
      parsedPattern.segments.some((seg) => seg.type === "param");

    if (hasParameters) {
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryUseAncestor: Non-immediate parent with parameters, skipping`,
        );
      }
      return null;
    }

    // Pure literal route - only optimize to pure literal ancestors (not parametric ones)
    const ancestorHasParameters =
      ancestorPatternObj.connections.length > 0 ||
      ancestorPatternObj.pattern.segments.some((seg) => seg.type === "param");

    if (ancestorHasParameters) {
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryUseAncestor: Literal route cannot optimize to parametric ancestor ${ancestorPatternObj.originalPattern}`,
        );
      }
      return null;
    }

    // Both are pure literal routes - can optimize
    if (DEBUG) {
      console.debug(
        `[${pattern}] tryUseAncestor: Trying literal-to-literal optimization to ${ancestorPatternObj.originalPattern}`,
      );
    }

    const result = tryDirectOptimization(
      parsedPattern,
      connections,
      ancestorPatternObj,
      resolvedParams,
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
    resolvedParams,
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

    // For literal-only optimization: if both source and target have only literals AND no parameters,
    // and source extends target, we can optimize directly
    const sourceHasOnlyLiterals =
      sourcePattern.segments.every((seg) => seg.type === "literal") &&
      sourceConnections.length === 0;

    const targetHasOnlyLiterals =
      targetAncestor.pattern.segments.every((seg) => seg.type === "literal") &&
      targetAncestor.connections.length === 0;

    if (sourceHasOnlyLiterals && targetHasOnlyLiterals) {
      // Check if user provided any parameters that would be lost in optimization
      const hasUserProvidedParams = Object.keys(resolvedParams).some(
        (paramName) => {
          // Check if this parameter was explicitly provided by the user
          // (not just inherited from signal values with default values)
          const userProvided = resolvedParams[paramName] !== undefined;
          return userProvided;
        },
      );

      if (hasUserProvidedParams) {
        if (DEBUG) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Cannot optimize literal-only routes - would lose user-provided parameters`,
            Object.keys(resolvedParams),
          );
        }
        return null;
      }

      if (DEBUG) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Both are pure literal-only routes, allowing optimization`,
        );
      }
      return buildUrlFromPattern(
        targetAncestor.pattern,
        {},
        targetAncestor.originalPattern,
      );
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
      console.debug(
        `[${pattern}] tryDirectOptimization: resolvedParams:`,
        resolvedParams,
      );
    }

    // Build ancestor URL with inherited parameters that don't conflict with optimization
    const ancestorParams = {};

    // First, add extra parameters from the original resolvedParams
    // These are parameters that don't correspond to any pattern segments or query params
    const sourcePatternParamNames = new Set(
      sourceConnections.map((conn) => conn.paramName),
    );
    const sourceQueryParamNames = new Set(
      sourcePattern.queryParams.map((qp) => qp.name),
    );
    const targetPatternParamNames = new Set(
      targetAncestor.connections.map((conn) => conn.paramName),
    );
    const targetQueryParamNames = new Set(
      targetAncestor.pattern.queryParams.map((qp) => qp.name),
    );

    for (const [paramName, value] of Object.entries(resolvedParams)) {
      if (DEBUG) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Considering param ${paramName}=${value}`,
        );
      }
      // Include parameters that target pattern specifically needs
      if (targetQueryParamNames.has(paramName)) {
        // Only include if the value is not the default value
        const connection = targetAncestor.connections.find(
          (conn) => conn.paramName === paramName,
        );
        if (connection && connection.options.defaultValue !== value) {
          ancestorParams[paramName] = value;
          if (DEBUG) {
            console.debug(
              `[${pattern}] tryDirectOptimization: Added target param ${paramName}=${value}`,
            );
          }
        }
      }
      // Include source query parameters (these should be inherited during ancestor optimization)
      else if (sourceQueryParamNames.has(paramName)) {
        // Only include if the value is not the default value
        const connection = sourceConnections.find(
          (conn) => conn.paramName === paramName,
        );
        if (connection && connection.options.defaultValue !== value) {
          ancestorParams[paramName] = value;
          if (DEBUG) {
            console.debug(
              `[${pattern}] tryDirectOptimization: Added source param ${paramName}=${value}`,
            );
          }
        }
      }
      // Include extra parameters that are not part of either pattern (true extra parameters)
      else if (
        !sourcePatternParamNames.has(paramName) &&
        !targetPatternParamNames.has(paramName)
      ) {
        ancestorParams[paramName] = value;
        if (DEBUG) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Added extra param ${paramName}=${value}`,
          );
        }
      }
    }

    // Also check target ancestor's own signal values for parameters not in resolvedParams
    for (const connection of targetAncestor.connections) {
      const { paramName, signal, options } = connection;
      const defaultValue = options.defaultValue;

      // Only include if not already processed and has non-default value
      if (
        !(paramName in ancestorParams) &&
        signal?.value !== undefined &&
        signal.value !== defaultValue
      ) {
        // Don't include path parameters that correspond to literal segments we're optimizing away
        const targetParam = targetParams.find((p) => p.name === paramName);
        const isPathParam = targetParam !== undefined; // Any param in segments is a path param
        if (isPathParam) {
          // Skip path parameters - we want them to use default values for optimization
          if (DEBUG) {
            console.debug(
              `[${pattern}] tryDirectOptimization: Skipping path param ${paramName}=${signal.value} (will use default)`,
            );
          }
          continue;
        }

        ancestorParams[paramName] = signal.value;
        if (DEBUG) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Added target signal param ${paramName}=${signal.value}`,
          );
        }
      }
    }

    // Then, get all ancestors starting from the target ancestor's parent (skip the target itself)
    let currentParent = targetAncestor.parent;

    while (currentParent) {
      for (const connection of currentParent.connections) {
        const { paramName, signal, options } = connection;
        const defaultValue = options.defaultValue;

        // Only inherit non-default values that we don't already have
        if (
          !(paramName in ancestorParams) &&
          signal?.value !== undefined &&
          signal.value !== defaultValue
        ) {
          // Check if this parameter would be redundant with target ancestor's literal segments
          const isRedundant = isParameterRedundantWithLiteralSegments(
            targetAncestor.pattern,
            currentParent.pattern,
            paramName,
            signal.value,
          );

          if (!isRedundant) {
            ancestorParams[paramName] = signal.value;
          }
        }
      }

      // Move up the parent chain
      currentParent = currentParent.parent;
    }

    return buildUrlFromPattern(
      targetAncestor.pattern,
      ancestorParams,
      targetAncestor.originalPattern,
      targetAncestor,
    );
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
      parentResolvedParams,
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
  const inheritParentParameters = (finalParams) => {
    let currentParent = patternObject.parent;

    // Traverse up the parent chain to inherit parameters
    while (currentParent) {
      // Check parent's signal connections for non-default values to inherit
      for (const parentConnection of currentParent.connections) {
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
            currentParent.pattern,
            paramName,
            signal.value,
          );

          if (shouldInherit) {
            finalParams[paramName] = signal.value;
          }
        }
      }
      // Move to the next parent up the chain
      currentParent = currentParent.parent;
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

    return buildUrlFromPattern(
      filteredPattern,
      finalParams,
      pattern,
      patternObject,
    );
  };

  // Pattern object with unified data and methods
  const patternObject = {
    // Pattern data properties (formerly patternData)
    urlPatternRaw: pattern,
    cleanPattern,
    connections,
    parsedPattern,
    signalSet,
    parameterDefaults, // Add parameterDefaults for signal clearing logic
    children: [],
    parent: null,
    depth: 0, // Will be calculated after relationships are built

    // Pattern methods (formerly patternObj methods)
    originalPattern: pattern,
    pattern: parsedPattern,
    applyOn,
    buildMostPreciseUrl,
    resolveParams,
  };

  return patternObject;
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
 * Helper: Check if a parent parameter can semantically reach a child route
 * This replaces the fragile position-based matching with semantic verification
 */
const canParameterReachChildRoute = (
  paramName,
  paramValue,
  parentPattern,
  childPattern,
) => {
  // Find the parent parameter segment
  const parentParamSegment = parentPattern.segments.find(
    (segment) => segment.type === "param" && segment.name === paramName,
  );

  if (!parentParamSegment) {
    return true; // Not a path parameter, no conflict
  }

  // Get parameter's logical path position (not array index)
  const paramPathPosition = parentParamSegment.index;

  // Find corresponding child segment at the same logical path position
  const childSegmentAtSamePosition = childPattern.segments.find(
    (segment) => segment.index === paramPathPosition,
  );

  if (!childSegmentAtSamePosition) {
    return true; // Child doesn't extend to this position, no conflict
  }

  if (childSegmentAtSamePosition.type === "literal") {
    // Child has a literal at this position - parent parameter must match exactly
    return childSegmentAtSamePosition.value === paramValue;
  }

  // Child has parameter at same position - compatible
  return true;
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
 * Check if a literal segment can be treated as optional based on pattern hierarchy
 */
const checkIfLiteralCanBeOptionalWithPatternObj = (
  literalValue,
  patternObj,
) => {
  if (!patternObj) {
    return false; // No pattern object available, cannot determine optionality
  }

  // Check current pattern's connections
  for (const connection of patternObj.connections) {
    if (connection.options.defaultValue === literalValue) {
      return true;
    }
  }

  // Check parent pattern's connections
  let currentParent = patternObj.parent;
  while (currentParent) {
    for (const connection of currentParent.connections) {
      if (connection.options.defaultValue === literalValue) {
        return true;
      }
    }
    currentParent = currentParent.parent;
  }

  // Check children pattern's connections
  const checkChildrenRecursively = (pattern) => {
    for (const child of pattern.children || []) {
      for (const connection of child.connections) {
        if (connection.options.defaultValue === literalValue) {
          return true;
        }
      }
      if (checkChildrenRecursively(child)) {
        return true;
      }
    }
    return false;
  };

  return checkChildrenRecursively(patternObj);
};

/**
 * Match a URL against a parsed pattern
 */
const matchUrl = (
  parsedPattern,
  url,
  { parameterDefaults, baseUrl, connections = [], patternObj = null },
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
        // Check if this literal segment can be treated as optional based on pattern hierarchy
        const canBeOptional = checkIfLiteralCanBeOptionalWithPatternObj(
          patternSeg.value,
          patternObj,
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
  // BUT: if pattern has children, it can also match additional segments (hierarchical matching)
  const hasChildren = patternObj && patternObj.children && patternObj.children.length > 0;
  if (
    !parsedPattern.wildcard &&
    !parsedPattern.trailingSlash &&
    !hasChildren &&
    urlSegmentIndex < urlSegments.length
  ) {
    return null; // Pattern without trailing slash/wildcard/children should not match extra segments
  }
  // If pattern has trailing slash, wildcard, or children, allow extra segments

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
      // Handle boolean query parameters:
      // ?walk=true → true
      // ?walk=1 → true
      // ?walk → true (parameter present without value)
      // ?walk=false → false
      // ?walk=0 → false
      params[key] = value === "true" || value === "1" || value === "";
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
  patternObj,
) => {
  const queryParams = {};
  const processedParams = new Set();

  // Get pattern data for this pattern - use direct pattern object or null
  const patternData = patternObj;

  // Collect all ancestors by traversing parent chain - only if we have pattern data
  const ancestorPatterns = [];
  if (patternData) {
    let currentParent = patternData.parent;
    while (currentParent) {
      ancestorPatterns.unshift(currentParent); // Add to front for correct order
      // Move to next parent in the chain
      currentParent = currentParent.parent;
    }
  }

  // DEBUG: Log what we found
  if (DEBUG) {
    // Force debug for now
    console.debug(`Building params for ${originalPattern}`);
    console.debug(`parsedPattern:`, parsedPattern.original);
    console.debug(`params:`, params);
    console.debug(
      `ancestorPatterns:`,
      ancestorPatterns.map((p) => p.urlPatternRaw),
    );
  }

  // Step 1: Add query parameters from ancestor patterns (oldest to newest)
  // This ensures ancestor parameters come first in their declaration order
  // ancestorPatterns is in correct order: root ancestor first, then immediate parent

  for (const ancestorPatternObj of ancestorPatterns) {
    if (ancestorPatternObj.parsedPattern?.queryParams) {
      for (const queryParam of ancestorPatternObj.parsedPattern.queryParams) {
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
  patternObj = null,
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
    patternObj,
  );

  const search = buildQueryString(queryParams);

  // No longer handle trailing slash inheritance here

  return path + (search ? `?${search}` : "");
};

/**
 * Check if childPattern is a child route of parentPattern
 * This determines parent-child relationships for signal clearing behavior.
 *
 * Route families vs parent-child relationships:
 * - Different families: preserve signals (e.g., "/" and "/settings")
 * - Parent-child: clear signals when navigating to parent (e.g., "/settings" and "/settings/:tab")
 *
 * E.g., "/admin/settings/:tab" is a child of "/admin/:section/"
 * Also, "/admin/?tab=something" is a child of "/admin/"
 */
const isChildPattern = (childPattern, parentPattern) => {
  if (!childPattern || !parentPattern) {
    return false;
  }

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
  const childSegments = cleanChild.split("/").filter((s) => s);
  const parentSegments = cleanParent.split("/").filter((s) => s);

  // Root route special handling - different families for signal preservation
  if (parentSegments.length === 0) {
    // Parent is root route ("/")
    // Root can only be parent of parameterized routes like "/:section"
    // But NOT literal routes like "/settings" (different families)
    return childSegments.length === 1 && childSegments[0].startsWith(":");
  }

  // For non-root parents, child must have at least as many segments
  if (childSegments.length < parentSegments.length) {
    return false;
  }

  let hasMoreSpecificSegment = false;

  // Check if all parent segments match child segments (allowing for parameters)
  for (let i = 0; i < parentSegments.length; i++) {
    const parentSeg = parentSegments[i];
    const childSeg = childSegments[i];

    if (parentSeg.startsWith(":")) {
      // Parent has parameter - child can have any value in that position
      // Child is more specific if it has a literal value for a parent parameter
      if (!childSeg.startsWith(":")) {
        hasMoreSpecificSegment = true;
      }
      continue;
    }

    // Parent has literal - child must match exactly
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
  // Create local pattern registry as Set
  const patternRegistry = new Set(); // Set of pattern objects
  const patternsByKey = {}; // key -> pattern object

  // Phase 1: Create all pattern objects
  for (const [key, urlPatternRaw] of Object.entries(patternDefinitions)) {
    // Create the unified pattern object
    const pattern = createRoutePattern(urlPatternRaw);

    // Register in both collections
    patternRegistry.add(pattern);
    patternsByKey[key] = pattern;
  }

  // Phase 2: Build relationships between all patterns
  const allPatterns = Array.from(patternRegistry); // Convert Set to Array

  for (const currentPatternObj of allPatterns) {
    for (const otherPatternObj of allPatterns) {
      if (currentPatternObj === otherPatternObj) continue;

      // Check if current pattern is a child of other pattern using clean patterns
      if (
        currentPatternObj.cleanPattern &&
        otherPatternObj.cleanPattern &&
        isChildPattern(
          currentPatternObj.cleanPattern,
          otherPatternObj.cleanPattern,
        )
      ) {
        // Store the most specific parent (closest parent in hierarchy)
        const getPathSegmentCount = (pattern) => {
          // Only count path segments, not query parameters
          const pathPart = pattern.split("?")[0];
          return pathPart.split("/").filter(Boolean).length;
        };

        const currentSegmentCount = currentPatternObj.parent
          ? getPathSegmentCount(currentPatternObj.parent.originalPattern)
          : 0;
        const otherSegmentCount = getPathSegmentCount(
          otherPatternObj.originalPattern,
        );

        if (
          !currentPatternObj.parent ||
          otherSegmentCount > currentSegmentCount
        ) {
          currentPatternObj.parent = otherPatternObj;
        }
        otherPatternObj.children = otherPatternObj.children || [];
        otherPatternObj.children.push(currentPatternObj);
      }
    }
  }

  // Phase 3: Collect all relevant signals for each pattern based on relationships
  for (const currentPatternObj of patternRegistry) {
    const allRelevantSignals = new Set();

    // Add own signals
    for (const signal of currentPatternObj.signalSet) {
      allRelevantSignals.add(signal);
    }

    // Add signals from ancestors (they might be inherited)
    let parentPatternObj = currentPatternObj.parent;
    while (parentPatternObj) {
      for (const connection of parentPatternObj.connections) {
        if (connection.signal) {
          allRelevantSignals.add(connection.signal);
        }
      }
      // Move up the parent chain
      parentPatternObj = parentPatternObj.parent;
    }

    // Add signals from descendants (they might be used for optimization)
    const addDescendantSignals = (patternObj) => {
      for (const childPatternObj of patternObj.children || []) {
        // Add child's own signals
        for (const connection of childPatternObj.connections) {
          if (connection.signal) {
            allRelevantSignals.add(connection.signal);
          }
        }
        // Recursively add grandchildren signals
        addDescendantSignals(childPatternObj);
      }
    };
    addDescendantSignals(currentPatternObj);

    // Update the pattern's signalSet with all relevant signals
    currentPatternObj.signalSet = allRelevantSignals;

    if (DEBUG && allRelevantSignals.size > 0) {
      console.debug(
        `[${currentPatternObj.urlPatternRaw}] Collected ${allRelevantSignals.size} relevant signals`,
      );
    }
  }

  // Phase 4: Calculate depths for all patterns
  const calculatePatternDepth = (patternObj) => {
    if (patternObj.depth !== 0) return patternObj.depth; // Already calculated

    if (!patternObj.parent) {
      patternObj.depth = 0;
      return 0;
    }

    const parentDepth = calculatePatternDepth(patternObj.parent);
    patternObj.depth = parentDepth + 1;
    return patternObj.depth;
  };

  for (const patternObj of patternRegistry) {
    calculatePatternDepth(patternObj);
  }

  if (DEBUG) {
    console.debug("Pattern registry updated");
  }

  return patternsByKey;
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
