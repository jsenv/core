/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */

import { globalSignalRegistry } from "../state/state_signal.js";
// Remove documentUrlSignal dependency - no longer needed

const DEBUG = false;

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
export const createRoutePattern = (
  pattern,
  baseUrl,
  parameterDefaults = new Map(),
) => {
  // Detect and process signals in the pattern first
  const [cleanPattern, connections] = detectSignals(pattern);
  const parsedPattern = parsePattern(cleanPattern, parameterDefaults);

  if (cleanPattern.includes("__navi_state_signal:")) {
    debugger;
  }

  if (DEBUG) {
    console.debug(`[CustomPattern] Created pattern:`, parsedPattern);
    console.debug(`[CustomPattern] Signal connections:`, connections);
  }

  const applyOn = (url) => {
    const result = matchUrl(parsedPattern, url, { parameterDefaults, baseUrl });

    if (DEBUG) {
      console.debug(
        `[CustomPattern] Matching "${url}" against "${cleanPattern}":`,
        result,
      );
    }

    return result;
  };

  return {
    pattern: parsedPattern,
    cleanPattern, // Return the clean pattern string
    connections, // Return signal connections along with pattern
    applyOn,
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
 * Match a URL against a parsed pattern
 */
const matchUrl = (parsedPattern, url, { parameterDefaults, baseUrl }) => {
  // Parse the URL
  const urlObj = new URL(url, baseUrl);
  let pathname = urlObj.pathname;

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

  // Handle root route
  if (parsedPattern.segments.length === 0) {
    if (pathname === "/" || pathname === "") {
      return extractSearchParams(urlObj);
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
      // Must match exactly
      if (urlSegmentIndex >= urlSegments.length) {
        return null; // URL too short
      }

      const urlSeg = urlSegments[urlSegmentIndex];
      if (urlSeg !== patternSeg.value) {
        return null; // Literal mismatch
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
  // We don't check for remaining URL segments here.
  // A pattern is allowed to match a prefix of a URL.
  // The routing logic will then find the most specific route that matches.
  // For instance /admin/:section can match /admin/settings/advanced
  // and the router will be able to select a more specific route
  // if one is registered for /admin/settings/:tab
  // if (!parsedPattern.wildcard && urlSegmentIndex < urlSegments.length) {
  //   return null;
  // }
  // If wildcard is present, we allow extra segments (no additional check needed)

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
export const buildUrlFromPattern = (
  parsedPattern,
  params = {},
  parameterDefaults = new Map(),
) => {
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
      const defaultValue = parameterDefaults.get(patternSeg.name);

      // If value is provided, include it (unless it's optional and matches default)
      if (value !== undefined) {
        // Only omit if parameter is optional AND matches default
        if (patternSeg.optional && value === defaultValue) {
          // Omit optional parameter that matches default
        } else {
          segments.push(encodeURIComponent(value));
        }
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
 * Build the most precise URL by using local storage values for the route's own parameters.
 * Each route is responsible for its own URL generation using its own signals.
 */
export const buildMostPreciseUrl = (route, params = {}, routeRelationships) => {
  // Get route private properties to access connections and patterns
  const routePrivateProps = routeRelationships.get(route);
  if (!routePrivateProps) {
    // Fallback to basic URL building if no relationships found
    return buildUrlFromPattern(
      route.pattern?.segments
        ? route.pattern
        : { segments: [], trailingSlash: false },
      params,
      new Map(),
    );
  }

  // Start with provided parameters
  let finalParams = { ...params };

  // Process all route connections for parameter handling
  for (const connection of routePrivateProps.connections) {
    const { paramName, signal, options } = connection;
    const defaultValue = options?.defaultValue;

    if (paramName in finalParams) {
      // Parameter was explicitly provided
      // If it equals the default value, remove it for shorter URLs
      if (finalParams[paramName] === defaultValue) {
        delete finalParams[paramName];
      }
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
  const hasExplicitParams = Object.keys(params).length > 0;

  // ROOT ROUTE PROTECTION: Never apply deepest URL generation to root route "/"
  // Users must always be able to navigate to home page regardless of app state
  const isRootRoute = route.pattern === "/";

  if (
    !hasExplicitParams &&
    !isRootRoute &&
    routePrivateProps.childRoutes?.length
  ) {
    // Only use deepest URL when user didn't provide any explicit params
    // This route has child routes - check if any child route is more specific
    for (const childRoute of routePrivateProps.childRoutes) {
      const childPrivateProps = routeRelationships.get(childRoute);
      if (childPrivateProps?.connections) {
        let childHasNonDefaults = false;
        let childParams = {};

        // Check child route parameters using only signal values (no explicit overrides)
        for (const connection of childPrivateProps.connections) {
          const { paramName, signal, options } = connection;

          if (signal?.value !== undefined) {
            const defaultValue = options?.defaultValue;

            if (signal.value !== defaultValue) {
              childHasNonDefaults = true;
              childParams[paramName] = signal.value;
            }
          }
        }

        if (childHasNonDefaults) {
          // Use child route to build URL instead - but only when no explicit params provided
          // IMPORTANT: Only pass parameters that the child route actually expects
          // The child route may have literal segments that don't need parent parameters

          // Get parameters that the child route expects (from its connections)
          const childExpectedParams = new Set(
            childPrivateProps.connections.map((conn) => conn.paramName),
          );

          // Filter merged params to only include what child route expects
          const filteredParams = {};
          for (const [key, value] of Object.entries({
            ...finalParams,
            ...childParams,
          })) {
            if (childExpectedParams.has(key)) {
              filteredParams[key] = value;
            }
          }

          return buildMostPreciseUrl(
            childRoute,
            filteredParams,
            routeRelationships,
          );
        }
      }
    }
  }

  // Get the parsed pattern
  const parsedPattern = routePrivateProps?.parsedPattern ||
    routePrivateProps?.routePattern?.pattern || {
      segments: [],
      trailingSlash: false,
    };

  if (!parsedPattern?.segments) {
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

// Compatibility alias for existing tests - will be updated later
export const buildUrlFromPatternWithSegmentFiltering = buildUrlFromPattern;
