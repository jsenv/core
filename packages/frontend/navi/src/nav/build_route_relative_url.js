const rawUrlPartSymbol = Symbol("raw_url_part");
export const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};

const removeOptionalParts = (url) => {
  // Remove optional parts from right to left to handle nested optionals
  let result = url;
  let changed = true;

  while (changed) {
    changed = false;
    const originalLength = result.length;

    // Handle optional patterns ending with ?
    // Remove: /*?, :param?, {param}?, {/time/*}?, etc.
    result = result.replace(/(\/?\*|\/:[^/?]*|\{[^}]*\})\?$/g, "");

    // Clean up trailing slashes that might be left over
    result = result.replace(/\/+$/, "");

    if (result.length !== originalLength) {
      changed = true;
    }
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
