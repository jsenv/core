import { computed, effect } from "@preact/signals";
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
    bindAction: null,
    relativeUrl: null,
    relativeUrlSignal: null,
    url: null,
    urlSignal: null,
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

              params[wildcardOffset + keyAsNumber] = value;
              localWildcardCount++;
            }
          } else {
            // Named group (:param or {param})
            params[key] = value;
          }
        }
        // Update wildcard offset for next URL part
        wildcardOffset += localWildcardCount;
      }
    }

    route.params = params;
    return params;
  });
  route.paramsSignal = paramsSignal;

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

  const bindAction = (action) => {
    const actionBoundToUrl = action.bindParams(paramsSignal);
    const actionWeakRef = new WeakRef(actionBoundToUrl);

    let wasActive = false;
    let lastParams = null;
    let previousRelativeUrl = null;

    // Watch for route activation/deactivation and param changes
    const unsubscribe = effect(() => {
      const isActive = activeSignal.value;
      const currentParams = paramsSignal.value;
      const currentRelativeUrl = relativeUrlSignal.value;

      // Check if the action is still alive
      const currentAction = actionWeakRef.deref();
      if (!currentAction) {
        // Action was garbage collected, clean up the effect
        unsubscribe();
        return;
      }

      if (isActive && !wasActive) {
        // First time route matches - load
        currentAction.load({ reason: `${currentRelativeUrl} is matching` });
      } else if (isActive && wasActive && currentParams !== lastParams) {
        // Params changed while active - reload to ensure fresh data
        currentAction.reload({
          reason: `Moved from ${previousRelativeUrl} to ${currentRelativeUrl}`,
        });
      }
      // Note: We no longer unload when route stops matching
      // This allows actions to stay in memory for transitions and preloading
      // They will be garbage collected naturally when no longer referenced

      wasActive = isActive;
      lastParams = currentParams;
      previousRelativeUrl = currentRelativeUrl;
    });

    // Store cleanup function for manual cleanup if needed
    actionBoundToUrl.meta.cleanup = unsubscribe;

    return actionBoundToUrl;
  };
  route.bindAction = bindAction;

  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const relativeUrl = buildRelativeUrl(params);
    route.relativeUrl = relativeUrl;
    return relativeUrl;
  });
  route.relativeUrlSignal = relativeUrlSignal;

  const urlSignal = computed(() => {
    const relativeUrl = relativeUrlSignal.value;
    const url = new URL(relativeUrl, baseUrl).href;
    route.url = url;
    return url;
  });
  route.urlSignal = urlSignal;

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
