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
    for (const property of URL_PATTERN_PROPERTIES_WITH_GROUP_SET) {
      const urlPartMatch = match[property];
      Object.assign(params, urlPartMatch.groups);
    }
    return params;
  });
  route.paramsSignal = paramsSignal;

  const buildUrl = (params = {}) => {
    let relativeUrl = urlPatternInput;
    // Replace named parameters (:param and {param})
    for (const key of Object.keys(params)) {
      const value = params[key];
      const encodedValue = encodeURIComponent(value);
      relativeUrl = relativeUrl.replace(`:${key}`, encodedValue);
      relativeUrl = relativeUrl.replace(`{${key}}`, encodedValue);
    }
    // Replace wildcards (*) with numbered parameters (0, 1, 2, etc.)
    let wildcardIndex = 0;
    relativeUrl = relativeUrl.replace(/\*/g, () => {
      const paramKey = wildcardIndex.toString();
      const replacement = params[paramKey]
        ? encodeURIComponent(params[paramKey])
        : "*";
      wildcardIndex++;
      return replacement;
    });

    return new URL(relativeUrl, baseUrl).href;
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

const URL_PATTERN_PROPERTIES_WITH_GROUP_SET = new Set([
  "protocol",
  "username",
  "password",
  "hostname",
  "pathname",
  "search",
  "hash",
]);
