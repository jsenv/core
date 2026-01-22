const rawUrlPartSymbol = Symbol("raw_url_part");
export const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};

const escapeRegexChars = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    result = result.slice(0, optionalStartIndex);

    // Clean up trailing slashes
    result = result.replace(/\/$/, "");
  }

  return result;
};

export const prepareRouteRelativeUrl = (
  urlPatternInput,
  params,
  { extraParamEffect = "inject_as_search_param" } = {},
) => {
  let relativeUrl = urlPatternInput;
  // let hasRawUrlPartWithInvalidChars = false;
  let stringQueryParams = "";

  // Handle string params (query string) - store for later appending
  if (typeof params === "string") {
    stringQueryParams = params;
    // Remove leading ? if present for processing
    if (stringQueryParams.startsWith("?")) {
      stringQueryParams = stringQueryParams.slice(1);
    }
    // Set params to empty object so the rest of the function processes the URL pattern
    params = null;
  }

  // Encode parameter values for URL usage, with special handling for raw URL parts.
  // When a parameter is wrapped with rawUrlPart(), it bypasses encoding and is
  // inserted as-is into the URL. This allows including pre-encoded values or
  // special characters that should not be percent-encoded.
  //
  // For wildcard parameters (isWildcard=true), we preserve slashes as path separators.
  // For named parameters and search params (isWildcard=false), we encode slashes.
  const encodeParamValue = (value, isWildcard = false) => {
    if (value && value[rawUrlPartSymbol]) {
      const rawValue = value.value;
      // Check if raw value contains invalid URL characters
      // if (/[\s<>{}|\\^`]/.test(rawValue)) {
      //   hasRawUrlPartWithInvalidChars = true;
      // }
      return rawValue;
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
  const extraParamMap = new Map();
  let wildcardIndex = 0; // Declare wildcard index in the main scope

  if (params) {
    const keys = Object.keys(params);

    // First, handle special case: optional groups immediately followed by wildcards
    // This handles patterns like {/}?* where the optional part should be included when wildcard has content
    relativeUrl = relativeUrl.replace(/\{([^}]*)\}\?\*/g, (match, group) => {
      const paramKey = wildcardIndex.toString();
      const paramValue = params[paramKey];

      if (paramValue) {
        // Don't add to extraParamMap since we're processing it here
        // For wildcards, preserve slashes as path separators
        const wildcardValue = encodeParamValue(paramValue, true);
        wildcardIndex++;
        // Include the optional group content when wildcard has value
        return group + wildcardValue;
      }
      wildcardIndex++;
      // Remove the optional group and wildcard when no value
      return "";
    });

    // Replace named parameters (:param and {param}) and remove optional markers
    // BUT skip parameters that are inside optional groups {...}? - those will be handled separately
    for (const key of keys) {
      // Skip numeric keys (wildcards) if they were already processed
      if (!isNaN(key) && parseInt(key) < wildcardIndex) {
        continue;
      }

      // Skip numeric keys entirely - they represent wildcards, not named parameters
      if (!isNaN(key)) {
        continue;
      }

      const value = params[key];
      const beforeReplace = relativeUrl;

      // Create patterns for this parameter using helper function
      const escapedKey = escapeRegexChars(key);
      const basePatterns = [`:${escapedKey}`, `\\{${escapedKey}\\}`];

      // Determine replacement based on value
      let replacement;
      if (value === undefined) {
        replacement = ""; // Remove parameter entirely
      } else {
        replacement = encodeParamValue(value, false); // Named parameters should encode slashes
      }

      // Process both optional and normal patterns in a single loop
      for (const basePattern of basePatterns) {
        if (value === undefined) {
          // For undefined values, remove the parameter and any preceding slash
          const paramPattern = new RegExp(
            `\\/${basePattern}(\\?)?(?=\/|$)`,
            "g",
          );
          relativeUrl = relativeUrl.replace(paramPattern, "");

          // Also handle parameter at the start or without preceding slash
          const startPattern = new RegExp(`(^|\\/)${basePattern}(\\?)?`, "g");
          relativeUrl = relativeUrl.replace(startPattern, (match, prefix) => {
            return prefix === "/" ? "" : prefix;
          });
        } else {
          // For defined values, use normal replacement logic
          // Create regex that matches both optional (?-suffixed) and normal patterns
          const combinedPattern = new RegExp(`(${basePattern})(\\?)?`, "g");

          relativeUrl = relativeUrl.replace(
            combinedPattern,
            (match, paramPart, optionalMarker, offset, string) => {
              // Check if this match is inside an optional group {...}?
              const beforeMatch = string.slice(0, offset);
              const afterMatch = string.slice(offset + match.length);

              // Count unclosed { before this match
              const openBraces = (beforeMatch.match(/\{/g) || []).length;
              const closeBraces = (beforeMatch.match(/\}/g) || []).length;
              const isInsideOptionalGroup =
                openBraces > closeBraces && afterMatch.includes("}?");

              // Only replace if NOT inside an optional group
              return isInsideOptionalGroup ? match : replacement;
            },
          );
        }
      }

      // If the URL did not change we'll maybe delete that param
      if (relativeUrl === beforeReplace) {
        extraParamMap.set(key, value);
      }
    }
    // Handle complex optional groups like {/time/:duration}?
    // Replace parameters inside optional groups and remove the optional marker
    relativeUrl = relativeUrl.replace(/\{([^}]*)\}\?/g, (match, group) => {
      let processedGroup = group;
      let hasReplacements = false;

      // Check if any parameters in the group were provided and not undefined
      for (const key of keys) {
        if (params[key] !== undefined) {
          const encodedValue = encodeParamValue(params[key], false); // Named parameters encode slashes
          const paramPattern = new RegExp(`:${key}\\b`);
          if (paramPattern.test(processedGroup)) {
            processedGroup = processedGroup.replace(paramPattern, encodedValue);
            hasReplacements = true;
            extraParamMap.delete(key);
          }
        }
      }

      // If we made replacements, include the group (without the optional marker)
      // If no replacements, return empty string (remove the optional group)
      return hasReplacements ? processedGroup : "";
    });
  }

  // Clean up any double slashes or trailing slashes that might result
  relativeUrl = relativeUrl.replace(/\/+/g, "/").replace(/\/$/, "");

  // Handle remaining wildcards (those not processed by optional group + wildcard above)
  if (params) {
    relativeUrl = relativeUrl.replace(/\*/g, (match, offset, string) => {
      const paramKey = wildcardIndex.toString();
      const paramValue = params[paramKey];

      if (paramValue !== undefined) {
        extraParamMap.delete(paramKey);
        const replacement = encodeParamValue(paramValue, true); // Wildcards preserve slashes
        wildcardIndex++;
        return replacement;
      }
      // Handle undefined wildcards by removing them and any preceding slash
      const beforeWildcard = string.slice(0, offset);
      if (beforeWildcard.endsWith("/")) {
        // Remove the preceding slash as well by returning a marker that we'll clean up
        wildcardIndex++;
        return "___REMOVE_WILDCARD_WITH_SLASH___";
      }
      wildcardIndex++;
      return ""; // Just remove the wildcard
    });

    // Clean up wildcard removal markers
    relativeUrl = relativeUrl.replace(
      /\/___REMOVE_WILDCARD_WITH_SLASH___/g,
      "",
    );
  }

  // Handle optional parts after parameter replacement
  // This includes patterns like /*?, {/time/*}?, :param?, etc.
  relativeUrl = removeOptionalParts(relativeUrl);
  // we did not replace anything, or not enough to remove the last "*"
  if (relativeUrl.endsWith("*")) {
    relativeUrl = relativeUrl.slice(0, -1);
  }

  // Normalize trailing slash: always favor URLs without trailing slash
  // except for root path which should remain "/"
  if (relativeUrl.endsWith("/") && relativeUrl.length > 1) {
    relativeUrl = relativeUrl.slice(0, -1);
  }

  // Add remaining parameters as search params
  if (extraParamMap.size > 0) {
    if (extraParamEffect === "inject_as_search_param") {
      const searchParamPairs = [];
      for (const [key, value] of extraParamMap) {
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
      if (searchParamPairs.length > 0) {
        const searchString = searchParamPairs.join("&");
        relativeUrl += (relativeUrl.includes("?") ? "&" : "?") + searchString;
      }
    } else if (extraParamEffect === "warn") {
      console.warn(
        `Unknown parameters given to "${urlPatternInput}":`,
        Array.from(extraParamMap.keys()),
      );
    }
  }

  // Append string query params if any
  if (stringQueryParams) {
    relativeUrl += (relativeUrl.includes("?") ? "&" : "?") + stringQueryParams;
  }

  return relativeUrl;
};
