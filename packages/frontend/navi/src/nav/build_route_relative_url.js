const rawUrlPartSymbol = Symbol("raw_url_part");
export const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};

const removeOptionalParts = (url) => {
  // Only remove optional parts that still have ? (weren't replaced with actual values)
  // Find the first unused optional part and remove everything from there onwards
  let result = url;

  // Find the first occurrence of an unused optional part (still has ?)
  const optionalPartMatch = result.match(/(\/?\*|\/:[^/?]*|\{[^}]*\})\?/);

  if (optionalPartMatch) {
    // Remove everything from the start of the first unused optional part
    const optionalStartIndex = optionalPartMatch.index;
    result = result.substring(0, optionalStartIndex);

    // Clean up trailing slashes
    result = result.replace(/\/$/, "");
  }

  return result;
};

export const buildRouteRelativeUrl = (
  urlPatternInput,
  params = {},
  { extraParamEffect = "inject_as_search_param" } = {},
) => {
  let relativeUrl = urlPatternInput;
  let hasRawUrlPartWithInvalidChars = false;

  // Handle string params (query string)
  if (typeof params === "string") {
    let queryString = params;
    // Remove leading ? if present
    if (queryString.startsWith("?")) {
      queryString = queryString.slice(1);
    }

    if (queryString) {
      relativeUrl += (relativeUrl.includes("?") ? "&" : "?") + queryString;
    }

    return {
      relativeUrl,
      hasRawUrlPartWithInvalidChars,
    };
  }

  // Encode parameter values for URL usage, with special handling for raw URL parts.
  // When a parameter is wrapped with rawUrlPart(), it bypasses encoding and is
  // inserted as-is into the URL. This allows including pre-encoded values or
  // special characters that should not be percent-encoded.
  const encodeParamValue = (value) => {
    if (value && value[rawUrlPartSymbol]) {
      const rawValue = value.value;
      // Check if raw value contains invalid URL characters
      if (/[\s<>{}|\\^`]/.test(rawValue)) {
        hasRawUrlPartWithInvalidChars = true;
      }
      return rawValue;
    }
    return encodeURIComponent(value);
  };

  const keys = Object.keys(params);
  const extraParamSet = new Set(keys);

  // Replace named parameters (:param and {param}) and remove optional markers
  for (const key of keys) {
    const value = params[key];
    const encodedValue = encodeParamValue(value);
    const beforeReplace = relativeUrl;

    // Replace parameter and remove optional marker if present
    relativeUrl = relativeUrl.replace(`:${key}?`, encodedValue);
    relativeUrl = relativeUrl.replace(`:${key}`, encodedValue);
    relativeUrl = relativeUrl.replace(`{${key}}?`, encodedValue);
    relativeUrl = relativeUrl.replace(`{${key}}`, encodedValue);

    // If the URL changed, no need to inject this param
    if (relativeUrl !== beforeReplace) {
      extraParamSet.delete(key);
    }
  }

  // Handle complex optional groups like {/time/:duration}?
  // Replace parameters inside optional groups and remove the optional marker
  relativeUrl = relativeUrl.replace(/\{([^}]*)\}\?/g, (match, group) => {
    let processedGroup = group;
    let hasReplacements = false;

    // Check if any parameters in the group were provided
    for (const key of keys) {
      if (params[key] !== undefined) {
        const encodedValue = encodeParamValue(params[key]);
        const paramPattern = new RegExp(`:${key}\\b`);
        if (paramPattern.test(processedGroup)) {
          processedGroup = processedGroup.replace(paramPattern, encodedValue);
          hasReplacements = true;
          extraParamSet.delete(key);
        }
      }
    }

    // Also check for literal parts that match parameter names (like /time where time is a param)
    for (const key of keys) {
      if (params[key] !== undefined) {
        const encodedValue = encodeParamValue(params[key]);
        // Check for literal parts like /time that match parameter names
        const literalPattern = new RegExp(`\\/${key}\\b`);
        if (literalPattern.test(processedGroup)) {
          processedGroup = processedGroup.replace(
            literalPattern,
            `/${encodedValue}`,
          );
          hasReplacements = true;
          extraParamSet.delete(key);
        }
      }
    }

    // If we made replacements, include the group (without the optional marker)
    // If no replacements, return empty string (remove the optional group)
    return hasReplacements ? processedGroup : "";
  });

  // Clean up any double slashes or trailing slashes that might result
  relativeUrl = relativeUrl.replace(/\/+/g, "/").replace(/\/$/, "");

  // Handle remaining wildcards
  let wildcardIndex = 0;
  relativeUrl = relativeUrl.replace(/\*/g, () => {
    const paramKey = wildcardIndex.toString();
    const paramValue = params[paramKey];
    if (paramValue) {
      extraParamSet.delete(paramKey);
    }
    const replacement = paramValue ? encodeParamValue(paramValue) : "*";
    wildcardIndex++;
    return replacement;
  });

  // Handle optional parts after parameter replacement
  // This includes patterns like /*?, {/time/*}?, :param?, etc.
  relativeUrl = removeOptionalParts(relativeUrl);
  // we did not replace anything, or not enough to remove the last "*"
  if (relativeUrl.endsWith("*")) {
    relativeUrl = relativeUrl.slice(0, -1);
  }

  // Add remaining parameters as search params
  if (extraParamSet.size > 0) {
    if (extraParamEffect === "inject_as_search_param") {
      const searchParamPairs = [];
      for (const key of extraParamSet) {
        const value = params[key];
        if (value !== undefined && value !== null) {
          const encodedKey = encodeURIComponent(key);
          const encodedValue = encodeParamValue(value);
          searchParamPairs.push(`${encodedKey}=${encodedValue}`);
        }
      }
      if (searchParamPairs.length > 0) {
        const searchString = searchParamPairs.join("&");
        relativeUrl += (relativeUrl.includes("?") ? "&" : "?") + searchString;
      }
    } else if (extraParamEffect === "warn") {
      console.warn(
        `Unknown parameters given to "${urlPatternInput}":`,
        Array.from(extraParamSet),
      );
    }
  }

  return {
    relativeUrl,
    hasRawUrlPartWithInvalidChars,
  };
};
