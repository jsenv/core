import { batch, computed, signal } from "@preact/signals";
import { updateActions } from "../actions.js";

const baseUrl = import.meta.dev
  ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
  : window.location.origin;

const NO_PARAMS = {};
// Controls what happens to actions when their route becomes inactive:
// 'abort' - Cancel the action immediately when route deactivates
// 'keep-loading' - Allow action to continue running after route deactivation
//
// The 'keep-loading' strategy could act like preloading, keeping data ready for potential return.
// However, since route reactivation triggers action reload anyway, the old data won't be used
// so it's better to abort the action to avoid unnecessary resource usage.
const ROUTE_DEACTIVATION_STRATEGY = "abort"; // 'abort', 'keep-loading'

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
    boundActionSet: new Set(),
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
    routePrivateProperties.boundActionSet.add(actionBoundToUrl);
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

// Store previous route states to detect changes
const routePreviousStateMap = new WeakMap();

// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();

export const applyRouting = (url, { globalAbortSignal, abortSignal }) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { urlPattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      active: false,
      params: NO_PARAMS,
    };
    const oldActive = previousState.active;
    const oldParams = previousState.params;
    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    const newActive = Boolean(match);
    const newParams = match ? extractParams(urlPattern, url) : NO_PARAMS;

    const routeMatchInfo = {
      route,
      routePrivateProperties,
      oldActive,
      newActive,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      active: newActive,
      params: newParams,
    });
  }

  // Apply all signal updates in a batch
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newActive,
      newParams,
    } of routeMatchInfoSet) {
      const { activeSignal, paramsSignal } = routePrivateProperties;
      activeSignal.value = newActive;
      paramsSignal.value = newParams;
      route.active = newActive;
      route.params = newParams;
    }
  });

  // must be after paramsSignal.value update to ensure the proxy target is set
  // (so after the batch call)
  const toLoadSet = new Set();
  const toReloadSet = new Set();
  const abortSignalMap = new Map();

  for (const {
    routePrivateProperties,
    newActive,
    oldActive,
    newParams,
    oldParams,
  } of routeMatchInfoSet) {
    const { boundActionSet } = routePrivateProperties;
    const becomesActive = newActive && !oldActive;
    const becomesInactive = !newActive && oldActive;
    const paramsChangedWhileActive =
      newActive && oldActive && newParams !== oldParams;

    // Handle actions for routes that become active
    if (becomesActive) {
      for (const actionProxy of boundActionSet) {
        const currentAction = actionProxy.getCurrentAction();
        toLoadSet.add(currentAction);

        // Create a new abort controller for this action
        const actionAbortController = new AbortController();
        actionAbortControllerWeakMap.set(currentAction, actionAbortController);
        abortSignalMap.set(currentAction, actionAbortController.signal);
      }
      continue;
    }

    // Handle actions for routes that become inactive - abort them
    if (becomesInactive && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      for (const actionProxy of boundActionSet) {
        const currentAction = actionProxy.getCurrentAction();
        const actionAbortController =
          actionAbortControllerWeakMap.get(currentAction);
        if (actionAbortController) {
          actionAbortController.abort(`route no longer matching`);
          actionAbortControllerWeakMap.delete(currentAction);
        }
      }
      continue;
    }

    // Handle parameter changes while route stays active
    if (paramsChangedWhileActive) {
      for (const actionProxy of boundActionSet) {
        const currentAction = actionProxy.getCurrentAction();
        toReloadSet.add(currentAction);

        // Create a new abort controller for the reload
        const actionAbortController = new AbortController();
        actionAbortControllerWeakMap.set(currentAction, actionAbortController);
        abortSignalMap.set(currentAction, actionAbortController.signal);
      }
    }
  }

  if (toLoadSet.size === 0 && toReloadSet.size === 0) {
    return false;
  }
  const [allResult] = updateActions({
    globalAbortSignal,
    abortSignal,
    loadSet: toLoadSet,
    reloadSet: toReloadSet,
    abortSignalMap,
    reason: `Document navigating to ${url}`,
  });
  return allResult; // null or Promise.all()
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
