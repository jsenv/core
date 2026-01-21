/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */

import { globalSignalRegistry } from "../state/state_signal.js";

const DEBUG = false;

// Function to detect signals in route patterns and connect them
export const detectSignals = (routePattern) => {
  const signalConnections = [];
  let updatedPattern = routePattern;

  // First, look for signals in the explicit syntax: :paramName=__jsenv_signal_1__ or ?paramName=__jsenv_signal_1__
  const signalParamRegex = /([?:])(\w+)=(__jsenv_signal_\d+__)/g;
  let match;

  while ((match = signalParamRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, paramName, signalId] = match;
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
    }
  }

  return {
    pattern: updatedPattern,
    connections: signalConnections,
  };
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
  const { pattern: cleanPattern, connections } = detectSignals(pattern);
  const parsedPattern = parsePattern(cleanPattern);

  if (DEBUG) {
    console.debug(`[CustomPattern] Created pattern:`, parsedPattern);
    console.debug(`[CustomPattern] Signal connections:`, connections);
  }

  const applyOn = (url) => {
    const result = matchUrl(url, parsedPattern, parameterDefaults, baseUrl);

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
const parsePattern = (pattern) => {
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
      const isOptional = seg.endsWith("?");

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
const matchUrl = (url, parsedPattern, parameterDefaults, baseUrl) => {
  // Parse the URL
  const urlObj = new URL(url, baseUrl);
  const pathname = urlObj.pathname;

  // Handle root route
  if (parsedPattern.segments.length === 0) {
    if (pathname === "/" || pathname === "") {
      return extractSearchParams(urlObj);
    }
    return null;
  }

  // Remove leading slash and split into segments
  const urlSegments = pathname.startsWith("/")
    ? pathname
        .slice(1)
        .split("/")
        .filter((s) => s !== "")
    : pathname.split("/").filter((s) => s !== "");

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
        if (patternSeg.optional || parsedPattern.wildcard) {
          // Optional parameter or wildcard present - use default if available
          const defaultValue = parameterDefaults.get(patternSeg.name);
          if (defaultValue !== undefined) {
            params[patternSeg.name] = defaultValue;
          }
          continue;
        } else {
          return null; // Required parameter missing
        }
      }

      // Capture URL segment as parameter value
      const urlSeg = urlSegments[urlSegmentIndex];
      params[patternSeg.name] = decodeURIComponent(urlSeg);
      urlSegmentIndex++;
    }
  }

  // Check for remaining URL segments
  if (!parsedPattern.wildcard && urlSegmentIndex < urlSegments.length) {
    // No wildcard but URL has extra segments - no match
    return null;
  }
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
export const buildUrlFromPattern = (parsedPattern, params = {}) => {
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
      if (value !== undefined) {
        segments.push(encodeURIComponent(value));
      } else if (!patternSeg.optional) {
        throw new Error(`Required parameter "${patternSeg.name}" is missing`);
      }
      // Optional parameters with undefined values are omitted
    }
  }

  let path = `/${segments.join("/")}`;

  // Handle trailing slash
  if (parsedPattern.trailingSlash && !path.endsWith("/")) {
    path += "/";
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
  return path + (search ? `?${search}` : "");
};
