/**
 * Route inheritance system - simplified approach
 */

const DEBUG = false;

/**
 * Analyzes route patterns to determine inheritance relationships
 * Much simpler than the previous URLPattern-based approach
 */
export const analyzeRouteInheritanceCustom = (
  currentPattern,
  existingRoutes,
  getRouteProperties,
) => {
  if (existingRoutes.size === 0) {
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
  for (const existingRoute of existingRoutes) {
    const existingProps = getRouteProperties(existingRoute);
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

/**
 * Check if current pattern can inherit from existing pattern
 */
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
