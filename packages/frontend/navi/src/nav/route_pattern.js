export const createRoutePattern = (
  urlPatternInput,
  baseUrl,
  literalSegmentDefaults = new Map(),
) => {
  // Remove leading slash from urlPattern to make it relative to baseUrl
  let normalizedUrlPattern = urlPatternInput.startsWith("/")
    ? urlPatternInput.slice(1)
    : urlPatternInput;

  // Extract and store search parameter mappings from the pattern
  const searchParamMappings = new Map();
  const searchParamRegex = /[?&]([^=&]+)=:([A-Za-z0-9_]+)/g;
  let match;
  while ((match = searchParamRegex.exec(normalizedUrlPattern)) !== null) {
    searchParamMappings.set(match[1], match[2]); // key -> paramName
  }

  // Strip search params from pattern to make them optional
  // Only strip if there are actual search parameter mappings (not URLPattern optional syntax)
  if (searchParamMappings.size > 0) {
    const searchIndex = normalizedUrlPattern.indexOf("?");
    if (searchIndex !== -1) {
      normalizedUrlPattern = normalizedUrlPattern.substring(0, searchIndex);
    }
  }

  const urlPattern = new URLPattern(normalizedUrlPattern, baseUrl, {
    ignoreCase: true,
  });

  // Analyze pattern once to detect optional params (named and wildcard indices)
  // Note: Wildcard indices are stored as strings ("0", "1", ...) to match keys from extractParams
  const optionalParamKeySet = new Set();
  normalizedUrlPattern.replace(/:([A-Za-z0-9_]+)\?/g, (_m, name) => {
    optionalParamKeySet.add(name);
    return "";
  });
  let wildcardIndex = 0;
  normalizedUrlPattern.replace(/\*(\?)?/g, (_m, opt) => {
    if (opt === "?") {
      optionalParamKeySet.add(String(wildcardIndex));
    }
    wildcardIndex++;
    return "";
  });

  const applyOn = (url) => {
    if (import.meta.dev) {
      const urlObj = new URL(url, baseUrl);
      if (urlObj.href === baseUrl) {
        const rootUrl = new URL("./", baseUrl).href;
        url = rootUrl;
      }
    }

    // Validate extracted parameters against expected defaults for literal segments
    const validateParams = (params) => {
      // If no literal segment defaults, all matches are valid
      if (literalSegmentDefaults.size === 0) {
        return true;
      }

      // Check each parameter that corresponds to a literal segment default
      for (const [paramName, expectedDefault] of literalSegmentDefaults) {
        let paramValue = params[paramName];
        
        // If the named parameter is undefined, check if there's a corresponding wildcard parameter
        // The wildcard parameters are numbered starting from 0
        if (paramValue === undefined && "0" in params) {
          // For inherited routes with wildcards, the first wildcard often corresponds to the parameter being validated
          paramValue = params["0"];
        }

        // Parameter is valid if:
        // 1. It's undefined (using default)
        // 2. It equals the expected default value
        if (paramValue !== undefined && paramValue !== expectedDefault) {
          return false; // Parameter value doesn't match expected default
        }
      }

      return true; // All parameters are valid
    };

    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    if (match) {
      const params = extractParams(match, url);
      if (params && validateParams(params)) {
        // Apply default values for undefined parameters from literalSegmentDefaults
        // This happens AFTER validation to ensure literal segment requirements are checked first
        for (const [paramName, defaultValue] of literalSegmentDefaults) {
          if (params[paramName] === undefined) {
            params[paramName] = defaultValue;
          }
        }
        return params;
      }
      return null;
    }

    // If no match, try with normalized URLs (trailing slash handling)
    const urlObj = new URL(url, baseUrl);
    const pathname = urlObj.pathname;

    // Try removing trailing slash from pathname
    if (pathname.endsWith("/") && pathname.length > 1) {
      const pathnameWithoutSlash = pathname.slice(0, -1);
      urlObj.pathname = pathnameWithoutSlash;
      const normalizedUrl = urlObj.href;
      const matchWithoutTrailingSlash = urlPattern.exec(normalizedUrl);
      if (matchWithoutTrailingSlash) {
        const params = extractParams(matchWithoutTrailingSlash, url);
        if (params && validateParams(params)) {
          return params;
        }
      }
    }
    // Try adding trailing slash to pathname
    else if (!pathname.endsWith("/")) {
      const pathnameWithSlash = `${pathname}/`;
      urlObj.pathname = pathnameWithSlash;
      const normalizedUrl = urlObj.href;
      const matchWithTrailingSlash = urlPattern.exec(normalizedUrl);
      if (matchWithTrailingSlash) {
        const params = extractParams(matchWithTrailingSlash, url);
        if (params && validateParams(params)) {
          return params;
        }
      }
    }
    return null;
  };

  const extractParams = (match, originalUrl) => {
    const params = {};

    // Extract search parameters from the original URL
    const urlObj = new URL(originalUrl, baseUrl);
    for (const [key, value] of urlObj.searchParams) {
      params[key] = value;

      // Check if this search param has a mapping in the pattern
      if (searchParamMappings.has(key)) {
        const mappedName = searchParamMappings.get(key);
        params[mappedName] = value;
      }
    }

    // Collect all parameters from URLPattern groups, handling both named and numbered groups
    let wildcardOffset = 0;
    for (const property of URL_PATTERN_PROPERTIES_WITH_GROUP_SET) {
      const urlPartMatch = match[property];
      if (urlPartMatch && urlPartMatch.groups) {
        let localWildcardCount = 0;
        for (const key of Object.keys(urlPartMatch.groups)) {
          const value = urlPartMatch.groups[key];
          const keyAsNumber = parseInt(key, 10);
          if (!isNaN(keyAsNumber)) {
            // Skip group "0" from search params as it captures the entire search string
            if (property === "search" && key === "0") {
              continue;
            }
            if (value) {
              // Only include non-empty values and non-ignored wildcard indices
              const wildcardKey = String(wildcardOffset + keyAsNumber);
              if (!optionalParamKeySet.has(wildcardKey)) {
                params[wildcardKey] =
                  value === undefined ? undefined : decodeURIComponent(value);
              }
              localWildcardCount++;
            }
          } else {
            // Named group (:param or {param}) - always include named parameters
            params[key] =
              value === undefined ? undefined : decodeURIComponent(value);
          }
        }
        // Update wildcard offset for next URL part
        wildcardOffset += localWildcardCount;
      }
    }

    return params;

    return params;
  };

  return {
    urlPattern,
    applyOn,
  };
};

const URL_PATTERN_PROPERTIES_WITH_GROUP_SET = new Set([
  "protocol",
  "username",
  "password",
  "hostname",
  "pathname",
  "search",
  "hash",
]);
