import { computed } from "@preact/signals";
import { documentUrlSignal } from "./document_url_signal.js";

const baseUrl = import.meta.dev
  ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
  : window.location.origin;

const NO_PARAMS = {};
export const createRoute = (urlPatternInput) => {
  const route = {
    active: false,
    activeSignal: null,
    params: NO_PARAMS,
    paramsSignal: null,
    buildUrl: null,
  };

  const urlPattern = new URLPattern(urlPatternInput, baseUrl, {
    ignoreCase: true,
  });
  const activeSignal = computed(() => {
    const documentUrl = documentUrlSignal.value;
    const active = urlPattern.test(documentUrl);
    route.active = active;
    return active;
  });
  route.activeSignal = activeSignal;

  const paramsSignal = computed(() => {
    const documentUrl = documentUrlSignal.value;
    const match = urlPattern.exec(documentUrl);
    if (!match) {
      route.params = NO_PARAMS;
      return NO_PARAMS;
    }
    const params = {};
    for (const property of URL_PATTERN_PROPERTIES_WITH_GROUPS) {
      Object.assign(params, match[property].groups);
    }
    return params;
  });
  route.paramsSignal = paramsSignal;

  const buildUrl = (params = {}) => {
    try {
      // Handle both string patterns and URLPattern objects
      let patternString;
      if (typeof urlPatternInput === "string") {
        patternString = urlPatternInput;
      } else if (urlPatternInput.pathname) {
        patternString = urlPatternInput.pathname;
      } else {
        patternString = "/";
      }

      let builtPath = patternString;

      // Replace named parameters (:param and {param})
      for (const [key, value] of Object.entries(params)) {
        const encodedValue = encodeURIComponent(value);
        builtPath = builtPath.replace(`:${key}`, encodedValue);
        builtPath = builtPath.replace(`{${key}}`, encodedValue);
      }

      // Replace wildcards (*) with numbered parameters (0, 1, 2, etc.)
      let wildcardIndex = 0;
      builtPath = builtPath.replace(/\*/g, () => {
        const paramKey = wildcardIndex.toString();
        const replacement = params[paramKey]
          ? encodeURIComponent(params[paramKey])
          : "*";
        wildcardIndex++;
        return replacement;
      });

      return new URL(builtPath, baseUrl).href;
    } catch (error) {
      console.warn("Failed to build URL:", error);
      return baseUrl;
    }
  };
  route.buildUrl = buildUrl;

  return route;
};
export const useRouteStatus = (route) => {
  const { activeSignal, paramsSignal } = route;

  const active = activeSignal.value;
  const params = paramsSignal.value;

  return {
    active,
    params,
  };
};

const URL_PATTERN_PROPERTIES_WITH_GROUPS = new Set([
  "protocol",
  "username",
  "password",
  "host",
  "pathname",
  "search",
  "hash",
]);
