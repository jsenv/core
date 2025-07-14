import { batch, computed, signal } from "@preact/signals";
import { weakEffect } from "../utils/weak_effect.js";

const baseUrl = import.meta.dev
  ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
  : window.location.origin;

const NO_PARAMS = {};

const routePrivatePropertiesWeakMap = new WeakMap();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesWeakMap.get(route);
};

const routeSet = new Set();

export const createRoute = (urlPatternInput) => {
  const route = {
    active: false,
    params: NO_PARAMS,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    urlPattern: undefined,
    activeSignal: null,
    paramsSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
  };
  routePrivatePropertiesWeakMap.set(route, routePrivateProperties);

  const buildRelativeUrl = (params = {}) => {
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
    return relativeUrl;
  };
  const buildUrl = (params = {}) => {
    const relativeUrl = buildRelativeUrl(params);
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  };
  route.buildUrl = buildUrl;

  const activeSignal = signal(false);
  const paramsSignal = signal(NO_PARAMS);
  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const relativeUrl = buildRelativeUrl(params);
    route.relativeUrl = relativeUrl;
    return relativeUrl;
  });

  const bindAction = (action) => {
    const actionBoundToUrl = action.bindParams(paramsSignal);

    let previousIsActive = false;
    let previousParams = null;
    let previousRelativeUrl = null;

    const unsubscribe = weakEffect(
      [actionBoundToUrl],
      (actionBoundToUrlWeak) => {
        const isActive = activeSignal.value;
        const currentParams = paramsSignal.value;
        const currentRelativeUrl = relativeUrlSignal.value;
        const becomesActive = isActive && !previousIsActive;
        const paramsChangedWhileActive =
          isActive && previousIsActive && currentParams !== previousParams;
        const relativeUrlBefore = previousRelativeUrl;
        previousIsActive = isActive;
        previousParams = currentParams;
        previousRelativeUrl = currentRelativeUrl;

        if (becomesActive) {
          actionBoundToUrlWeak.load({
            reason: `"/${currentRelativeUrl}" route is matching`,
          });
          return;
        }
        if (paramsChangedWhileActive) {
          actionBoundToUrlWeak.reload({
            reason: `Moved from ${relativeUrlBefore} to ${currentRelativeUrl}`,
          });
          return;
        }
      },
    );

    // Store cleanup function for manual cleanup if needed
    actionBoundToUrl.meta.cleanup = unsubscribe;

    return actionBoundToUrl;
  };
  route.bindAction = bindAction;

  private_properties: {
    const urlPattern = new URLPattern(urlPatternInput, baseUrl, {
      ignoreCase: true,
    });
    routePrivateProperties.urlPattern = urlPattern;
    routePrivateProperties.activeSignal = activeSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;

    const urlSignal = computed(() => {
      const relativeUrl = relativeUrlSignal.value;
      const url = new URL(relativeUrl, baseUrl).href;
      route.url = url;
      return url;
    });
    routePrivateProperties.urlSignal = urlSignal;
  }

  return route;
};

export const applyRouting = (url) => {
  const updateCallbackSet = new Set();

  for (const route of routeSet) {
    const { urlPattern, activeSignal, paramsSignal } =
      getRoutePrivateProperties(route);

    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    if (!match) {
      updateCallbackSet.add(() => {
        activeSignal.value = false;
        paramsSignal.value = NO_PARAMS;
      });
      continue;
    }
    // Extract parameters from the URL
    const params = extractParams(urlPattern, url);
    updateCallbackSet.add(() => {
      activeSignal.value = true;
      paramsSignal.value = params;
    });
  }

  batch(() => {
    for (const updateCallback of updateCallbackSet) {
      updateCallback();
    }
  });
};

const extractParams = (urlPattern, url) => {
  const match = urlPattern.exec(url);
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
            // Only include non-empty values
            params[wildcardOffset + keyAsNumber] = decodeURIComponent(value);
            localWildcardCount++;
          }
        } else {
          // Named group (:param or {param})
          params[key] = decodeURIComponent(value);
        }
      }
      // Update wildcard offset for next URL part
      wildcardOffset += localWildcardCount;
    }
  }
  return params;
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

export const useRouteStatus = (route) => {
  const { activeSignal, paramsSignal } = getRoutePrivateProperties(route);

  const active = activeSignal.value;
  const params = paramsSignal.value;

  return {
    active,
    params,
  };
};
