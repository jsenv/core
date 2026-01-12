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

  const applyOn = (url) => {
    if (import.meta.dev) {
      const urlObj = new URL(url, baseUrl);
      if (urlObj.href === baseUrl) {
        const rootUrl = new URL("./", baseUrl).href;
        url = rootUrl;
      }
    }

    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    if (match) {
      return extractParams(match, url);
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
        return extractParams(matchWithoutTrailingSlash, url);
      }
    }
    // Try adding trailing slash to pathname
    else if (!pathname.endsWith("/")) {
      const pathnameWithSlash = `${pathname}/`;
      urlObj.pathname = pathnameWithSlash;
      const normalizedUrl = urlObj.href;
      const matchWithTrailingSlash = urlPattern.exec(normalizedUrl);
      if (matchWithTrailingSlash) {
        return extractParams(matchWithTrailingSlash, url);
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
