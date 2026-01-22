/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */

import { globalSignalRegistry } from "../state/state_signal.js";
// Remove documentUrlSignal dependency - no longer needed

const DEBUG = false;

// Base URL management
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

// Pattern registry for building relationships before routes are created
const patternRegistry = new Map(); // pattern -> patternData
const patternRelationships = new Map(); // pattern -> relationships
let patternsRegistered = false;

// Function to detect signals in route patterns and connect them
export const detectSignals = (routePattern) => {
  const signalConnections = [];
  let updatedPattern = routePattern;

  // Look for signals in the new syntax: :paramName={navi_state_signal:id} or ?paramName={navi_state_signal:id}
  // Using curly braces to avoid conflicts with underscores in signal IDs
  const signalParamRegex = /([?:])(\w+)=(\{navi_state_signal:[^}]+\})/g;
  let match;

  while ((match = signalParamRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, paramName, signalString] = match;

    // Extract the signal ID from the new format: {navi_state_signal:id}
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
        // Path parameter: :section=__jsenv_signal_1__ becomes :section
        replacement = `${prefix}${paramName}`;
      } else {
        // Search parameter: ?tab=__jsenv_signal_1__ becomes nothing (removed entirely)
        replacement = "";
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

  const resolveParams = (providedParams = {}, { cleanupDefaults } = {}) => {
    const resolvedParams = { ...providedParams };

    // Process all connections for parameter resolution
    for (const connection of connections) {
      const { paramName, signal, options } = connection;
      const defaultValue = options.defaultValue;

      if (paramName in providedParams) {
        // Parameter was explicitly provided - always respect explicit parameters
        if (cleanupDefaults && resolvedParams[paramName] === defaultValue) {
          delete resolvedParams[paramName];
        }
        // Don't check signal value - explicit parameter takes precedence
      } else if (signal?.value !== undefined) {
        // Parameter was not provided, check signal value
        if (cleanupDefaults && signal.value === defaultValue) {
          // Omit default values for shorter URLs
        } else {
          resolvedParams[paramName] = signal.value;
        }
      }
    }

    return resolvedParams;
  };

  /**
   * Build the most precise URL by using route relationships from pattern registry.
   * Each route is responsible for its own URL generation using its own signals.
   */
  const buildMostPreciseUrl = (params = {}) => {
    // Handle parameter resolution internally to preserve user intent detection
    // First pass: resolve parameters without cleaning up defaults to detect user intent
    const resolvedParams = resolveParams(params, { cleanupDefaults: false });

    // Start with resolved parameters
    let finalParams = { ...resolvedParams };

    for (const connection of connections) {
      const { paramName, signal, options } = connection;
      const defaultValue = options.defaultValue;

      if (paramName in finalParams) {
        // Parameter was explicitly provided - ALWAYS respect explicit values
        // If it equals the default value, remove it for shorter URLs
        if (finalParams[paramName] === defaultValue) {
          delete finalParams[paramName];
        }
        // Note: Don't fall through to signal logic - explicit params take precedence
      }
      // Parameter was NOT provided, check signal value
      else if (signal?.value !== undefined && signal.value !== defaultValue) {
        // Only include signal value if it's not the default
        finalParams[paramName] = signal.value;
        // If signal.value === defaultValue, omit the parameter for shorter URL
      }
    }

    // DEEPEST URL GENERATION: Check if we should use a child route instead
    // This happens when:
    // 1. This route's parameters are all defaults (would be omitted)
    // 2. A child route has non-default parameters that should be included

    // DEEPEST URL GENERATION: Only activate when NO explicit parameters provided
    // This prevents overriding explicit user intentions with signal-based "smart" routing
    // We need to distinguish between user-provided params and signal-derived params
    let hasUserProvidedParams = false;

    // Check if provided params contain anything beyond what signals would provide
    const signalDerivedParams = {};
    for (const { paramName, signal, options } of connections) {
      if (signal?.value !== undefined) {
        const defaultValue = options.defaultValue;
        // Only include signal value if it's not the default (same logic as above)
        if (signal.value !== defaultValue) {
          signalDerivedParams[paramName] = signal.value;
        }
      }
    }

    // Check if original params (before resolution) contains anything that's not from signals
    // This preserves user intent detection for explicit parameters
    for (const [key, value] of Object.entries(params)) {
      if (signalDerivedParams[key] !== value) {
        hasUserProvidedParams = true;
        break;
      }
    }

    // Also check if original params has extra keys beyond what signals provide
    const providedKeys = new Set(Object.keys(params));
    const signalKeys = new Set(Object.keys(signalDerivedParams));
    for (const key of providedKeys) {
      if (!signalKeys.has(key)) {
        hasUserProvidedParams = true;
        break;
      }
    }

    // ROOT ROUTE PROTECTION: Never apply deepest URL generation to root route "/"
    // Users must always be able to navigate to home page regardless of app state
    const isRootRoute = pattern === "/";

    const relationships = patternRelationships.get(pattern);
    const childPatterns = relationships?.childPatterns || [];
    if (!hasUserProvidedParams && !isRootRoute && childPatterns.length) {
      // Try to find the most specific child pattern that has active signals
      for (const childPattern of childPatterns) {
        const childPatternData = getPatternData(childPattern);
        if (!childPatternData) continue;

        // Check if any of this child's parameters have non-default signal values
        let hasActiveParams = false;
        const childParams = {};

        // Include parent signal values for child pattern matching
        // But first check if they're compatible with the child pattern
        let parentSignalsCompatibleWithChild = true;
        for (const parentConnection of connections) {
          const { paramName, signal, options } = parentConnection;
          // Only include non-default parent signal values
          if (
            signal?.value !== undefined &&
            signal.value !== options.defaultValue
          ) {
            // Check if child pattern has conflicting literal segments for this parameter
            const childParsedPattern = childPatternData.parsedPattern;

            // Check if parent signal value matches a literal segment in child pattern
            const matchesChildLiteral = childParsedPattern.segments.some(
              (segment) =>
                segment.type === "literal" && segment.value === signal.value,
            );

            // If parent signal matches a literal in child, don't add as parameter
            // (it's already represented in the child URL path)
            if (matchesChildLiteral) {
              // Compatible - signal value matches child literal, no need to add param
              continue;
            }

            // For section parameter specifically, check if child has literal "settings"
            // but parent signal has different value (incompatible case)
            if (paramName === "section" && signal.value !== "settings") {
              const hasSettingsLiteral = childParsedPattern.segments.some(
                (segment) =>
                  segment.type === "literal" && segment.value === "settings",
              );
              if (hasSettingsLiteral) {
                parentSignalsCompatibleWithChild = false;
                break;
              }
            }

            // Only add parent signal as parameter if it doesn't match child literals
            childParams[paramName] = signal.value;
          }
        }

        // Skip this child if parent signals are incompatible
        if (!parentSignalsCompatibleWithChild) {
          continue;
        }

        // Check child connections and see if any have non-default values
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

        // If child has non-default parameters, use the child route
        if (hasActiveParams) {
          const childPatternObj = createRoutePattern(childPattern);
          // Use buildUrl (not buildMostPreciseUrl) to avoid infinite recursion
          const childUrl = childPatternObj.buildUrl(childParams);
          if (childUrl) {
            return childUrl;
          }
        }
      }
    }

    if (!parsedPattern.segments) {
      return "/";
    }

    // Filter out segments for parameters that are not provided (omitted defaults)
    const filteredPattern = {
      ...parsedPattern,
      segments: parsedPattern.segments.filter((segment) => {
        if (segment.type === "param") {
          // Only keep parameter segments if we have a value for them
          return segment.name in finalParams;
        }
        // Always keep literal segments
        return true;
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

  return {
    originalPattern: pattern, // Return the original pattern string
    pattern: parsedPattern,
    cleanPattern, // Return the clean pattern string
    connections, // Return signal connections along with pattern
    applyOn,
    buildUrl,
    buildMostPreciseUrl,
    resolveParams,
  };
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
    };
  }

  // Remove leading slash for processing
  let cleanPattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;

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
  const trailingSlash = !wildcard && pattern.endsWith("/");
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
const matchUrl = (parsedPattern, url, { parameterDefaults, baseUrl }) => {
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
      return extractSearchParams(urlObj);
    }

    // Special case: if URL exactly matches baseUrl, treat as root route
    if (baseUrl) {
      const baseUrlObj = new URL(baseUrl);
      if (originalPathname === baseUrlObj.pathname) {
        return extractSearchParams(urlObj);
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
  const searchParams = extractSearchParams(urlObj);
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
const extractSearchParams = (urlObj) => {
  const params = {};
  for (const [key, value] of urlObj.searchParams) {
    params[key] = value;
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

  // Add search parameters (excluding path parameters)
  const pathParamNames = new Set(
    parsedPattern.segments.filter((s) => s.type === "param").map((s) => s.name),
  );

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!pathParamNames.has(key) && value !== undefined) {
      searchParams.set(key, value);
    }
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
