import { SYMBOL_IDENTITY } from "../utils/compare_two_js_values.js";

export const NO_PARAMS = { [SYMBOL_IDENTITY]: Symbol("no_params") };

export const createRoutePattern = (urlPatternInput, baseUrl) => {
  // Remove leading slash from urlPattern to make it relative to baseUrl
  const normalizedUrlPattern = urlPatternInput.startsWith("/")
    ? urlPatternInput.slice(1)
    : urlPatternInput;
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

  const applyRoutePattern = (url) => {
    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    if (match) {
      return extractParams(match);
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
        return extractParams(matchWithoutTrailingSlash);
      }
    }
    // Try adding trailing slash to pathname
    else if (!pathname.endsWith("/")) {
      const pathnameWithSlash = `${pathname}/`;
      urlObj.pathname = pathnameWithSlash;
      const normalizedUrl = urlObj.href;
      const matchWithTrailingSlash = urlPattern.exec(normalizedUrl);
      if (matchWithTrailingSlash) {
        return extractParams(matchWithTrailingSlash);
      }
    }
    return null;
  };

  const extractParams = (match) => {
    if (!match) {
      return NO_PARAMS;
    }
    const params = {};

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
            if (value) {
              // Only include non-empty values and non-ignored wildcard indices
              const wildcardKey = String(wildcardOffset + keyAsNumber);
              if (!optionalParamKeySet.has(wildcardKey)) {
                params[wildcardKey] = decodeURIComponent(value);
              }
              localWildcardCount++;
            }
          } else if (!optionalParamKeySet.has(key)) {
            // Named group (:param or {param}) - only include if not ignored
            params[key] = decodeURIComponent(value);
          }
        }
        // Update wildcard offset for next URL part
        wildcardOffset += localWildcardCount;
      }
    }
    return params;
  };

  return {
    urlPattern,
    applyRoutePattern,
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
