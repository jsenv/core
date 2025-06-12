import { createResourcePattern } from "@jsenv/url-pattern";
import { batch, effect, signal } from "@preact/signals";
import { applyAction } from "../action/action.js";
import { routingWhile } from "../document_routing.js";
import { normalizeUrl } from "../normalize_url.js";
import { goTo, installNavigation, reload } from "../router.js";
import { ABORTED, FAILED, IDLE, LOADED, LOADING } from "./route_status.js";

let debug = false;

let baseUrl = import.meta.dev
  ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
  : window.location.origin;
let baseDirectoryUrl = new URL("./", baseUrl).href;

if (debug) {
  console.debug(`Router baseUrl initial value set to "${baseUrl}"`);
}

export const setBaseUrl = (v) => {
  const urlObject = new URL(v);
  urlObject.search = "";
  baseUrl = urlObject.href;
  baseDirectoryUrl = new URL("./", baseUrl).href;
};
const resourceFromUrl = (url) => {
  url = String(url);
  if (url[0] === "/") {
    url = url.slice(1);
  }
  // if (url[0] !== "/") url = `/${url}`;
  const urlObject = new URL(url, baseUrl);
  const resource = urlObject.href.slice(urlObject.origin.length);
  return resource;
};

// const getDocumentUrl = () => {
//   const documentUrl = documentUrlSignal.value;
//   const documentUrlObject = new URL(documentUrl);
//   documentUrlObject.search = "";
//   return documentUrlObject;
// };

let routerUIReady = false;
export const onRouterUILoaded = () => {
  if (routerUIReady) {
    return;
  }
  routerUIReady = true;
  installNavigation({ applyRouting, applyAction });
};

const routeAbortEnterMap = new Map();
const routeEnterPromiseMap = new Map();
const routeWeakRefSet = new Set(); // WeakRef de toutes les routes
const matchingRouteSet = new Set();

const getAliveRouteSet = () => {
  const aliveRouteSet = new Set();
  for (const weakRef of routeWeakRefSet) {
    const route = weakRef.deref();
    if (route) {
      aliveRouteSet.add(route);
    } else {
      routeWeakRefSet.delete(weakRef);
    }
  }

  return aliveRouteSet;
};

export const registerRoute = (firstArg, secondArg) => {
  let route;

  if (typeof firstArg === "string") {
    if (typeof secondArg === "function") {
      secondArg = {
        load: secondArg,
      };
    }
    route = createRouteConnectedWithUrl(firstArg, secondArg);
  } else {
    route = createRouteConnectedWithState(firstArg);
  }
  const weakRef = new WeakRef(route);
  routeWeakRefSet.add(weakRef);
  return route;
};

const createRouteConnectedWithUrl = (
  resourcePattern,
  { load, canDisplayOldData },
) => {
  const resourcePatternParsed = createResourcePattern(
    resourceFromUrl(resourcePattern),
  );

  const isMatchingSignal = signal(false);
  const loadingStateSignal = signal(IDLE);
  let error;
  const errorSignal = signal(null);
  const reportError = (e) => {
    errorSignal.value = e;
  };
  const initialData = undefined;
  let data = initialData;
  const dataSignal = signal(initialData);
  const loadData = load ? ({ signal }) => load({ signal, params }) : undefined;

  const initialUrl = undefined;
  let url = initialUrl;
  const urlSignal = signal(url);
  const buildUrl = (url, values) => {
    const routeResource = resourcePatternParsed.generate(values);
    const routeUrlObject = new URL(encodeURI(routeResource), baseUrl);
    const urlObject = new URL(url);
    const searchParams = urlObject.searchParams;
    for (const [key, value] of searchParams) {
      routeUrlObject.searchParams.append(key, value);
    }
    const hash = urlObject.hash;
    if (!routeUrlObject.hash) {
      routeUrlObject.hash = hash;
    }
    const routeUrlNormalized = normalizeUrl(routeUrlObject);
    const routeUrlEncoded = encodeURI(routeUrlNormalized);
    return routeUrlEncoded;
  };
  const initialParams = {};
  let params = initialParams;
  const paramsSignal = signal(params);
  const replaceParams = (values) => {
    const newValues = { ...params, ...values };
    paramsSignal.value = newValues;
    const routeUrl = buildUrl(window.location.href, newValues);
    goTo(routeUrl, { replace: true, routesLoaded: [route] });
  };

  const match = () => {
    const resource = resourceFromUrl(window.location.href);
    const matchResult = resourcePatternParsed.match(resource);
    if (!matchResult) {
      return false;
    }
    return matchResult;
  };
  const enterEffect = ({ matchResult }) => {
    batch(() => {
      isMatchingSignal.value = true;
      errorSignal.value = null;
      loadingStateSignal.value = LOADING;
      urlSignal.value = window.location.href;
      paramsSignal.value = matchResult;
    });
  };
  const leaveEffect = () => {
    batch(() => {
      isMatchingSignal.value = false;
      errorSignal.value = null;
      loadingStateSignal.value = IDLE;
      urlSignal.value = initialUrl;
      paramsSignal.value = initialParams;
    });
  };
  const shouldReload = () => {
    const documentUrl = window.location.href;
    if (documentUrl === url) {
      return false;
    }
    const documentUrlWithoutSearch = urlWithoutSearch(documentUrl);
    const currentUrlWithoutSearch = urlWithoutSearch(url);
    if (documentUrlWithoutSearch.startsWith(`${currentUrlWithoutSearch}/`)) {
      // this is a sub url of the current url
      // so we should not reload the route
      // even if search params are different
      // we suppose the other url/search params compbination will be handled by a sub route
      return false;
    }
    if (documentUrlWithoutSearch !== currentUrlWithoutSearch) {
      return true;
    }
    // same url, check for search params
    // so we should reload the route if search params are different
    const currentUrlSearchParams = new URL(url).searchParams;
    const documentUrlSearchParams = new URL(documentUrl).searchParams;

    const allParamNames = new Set([
      ...Array.from(currentUrlSearchParams.keys()),
      ...Array.from(documentUrlSearchParams.keys()),
    ]);
    for (const paramName of allParamNames) {
      const currentValues = currentUrlSearchParams.getAll(paramName);
      const documentValues = documentUrlSearchParams.getAll(paramName);
      // Different number of values for this parameter
      if (currentValues.length !== documentValues.length) {
        return true; // Reload needed
      }
      // Compare each value in order (for params with multiple values)
      for (let i = 0; i < currentValues.length; i++) {
        if (currentValues[i] !== documentValues[i]) {
          return true; // Reload needed
        }
      }
    }
    // Search params are identical (or both empty)
    return false;
  };
  const go = ({ replace } = {}) => {
    goTo(url, { replace });
  };

  const toString = () => {
    const isMatching = isMatchingSignal.peek();
    if (isMatching) {
      const urlRelativeToBaseUrl = url.slice(baseDirectoryUrl.length);
      return urlRelativeToBaseUrl;
    }
    return resourcePattern;
  };

  const route = {
    isMatchingSignal,
    loadingStateSignal,
    error,
    errorSignal,
    reportError,
    data,
    dataSignal,
    loadData,
    loadUI: undefined,
    renderUI: undefined,
    node: undefined,
    canDisplayOldData,

    url,
    urlSignal,
    params,
    paramsSignal,
    replaceParams,
    buildUrl,

    match,
    enterEffect,
    leaveEffect,
    shouldReload,
    toString,
    reload,
    go,
    get name() {
      return toString();
    },
  };
  Object.preventExtensions(route);

  const routeWeakRef = new WeakRef(route);
  const routeWeakEffect = (callback) => {
    const dispose = effect(() => {
      const routeInstance = routeWeakRef.deref();
      if (routeInstance) {
        callback(routeInstance);
      } else {
        dispose();
      }
    });
  };
  routeWeakEffect((routeInstance) => {
    error = errorSignal.value;
    routeInstance.error = error;
  });
  routeWeakEffect((routeInstance) => {
    data = dataSignal.value;
    routeInstance.data = data;
  });
  routeWeakEffect((routeInstance) => {
    params = paramsSignal.value;
    routeInstance.params = params;
  });

  return route;
};
// https://github.com/WICG/navigation-api?tab=readme-ov-file#setting-the-current-entrys-state-without-navigating
const createRouteConnectedWithState = ({
  match,
  enter,
  leave,
  load,
  name,
  canDisplayOldData,
}) => {
  const isMatchingSignal = signal(false);
  const loadingStateSignal = signal(IDLE);
  let error;
  const errorSignal = signal(null);
  const reportError = (e) => {
    errorSignal.value = e;
  };
  const initialData = undefined;
  let data = initialData;
  const dataSignal = signal(initialData);
  const loadData = load ? ({ signal }) => load({ signal, state }) : undefined;

  const getMatchResult = () => {
    const matchResult = match();
    if (matchResult === true) {
      return {};
    }
    return matchResult;
  };

  const initialState = getMatchResult();
  let state = initialState;
  const stateSignal = signal(state);

  const routeMatchMethod = () => {
    return getMatchResult();
  };
  const enterEffect = () => {
    batch(() => {
      isMatchingSignal.value = true;
      errorSignal.value = null;
      loadingStateSignal.value = LOADING;
      stateSignal.value = getMatchResult();
    });
  };
  const leaveEffect = () => {
    batch(() => {
      isMatchingSignal.value = false;
      errorSignal.value = null;
      loadingStateSignal.value = IDLE;
      stateSignal.value = initialState;
    });
  };

  const shouldReload = () => {
    return false;
  };
  const toString = () => name;

  const route = {
    isMatchingSignal,
    loadingStateSignal,
    error,
    errorSignal,
    reportError,
    data,
    dataSignal,
    loadData,
    loadUI: undefined,
    renderUI: undefined,
    node: undefined,
    canDisplayOldData,

    state,
    stateSignal,

    match: routeMatchMethod,
    enterEffect,
    leaveEffect,
    shouldReload,
    reload,
    toString,
    enter: async () => {
      const isMatching = isMatchingSignal.peek();
      if (isMatching) {
        if (debug) {
          console.debug(`"${route}" is already matching, no need to enter`);
        }
        return;
      }
      enter();
      await goTo(window.location.href, {
        routesToEnter: [route],
      });
    },
    leave: async () => {
      const isMatching = isMatchingSignal.peek();
      if (!isMatching) {
        if (debug) {
          console.debug(`"${route}" is not matching, no need to leave`);
        }
        return;
      }
      leave();
      await goTo(window.location.href, {
        routesToLeave: [route],
      });
    },
    name,
  };
  Object.preventExtensions(route);

  const routeWeakRef = new WeakRef(route);
  const routeWeakEffect = (callback) => {
    const dispose = effect(() => {
      const routeInstance = routeWeakRef.deref();
      if (routeInstance) {
        callback(routeInstance);
      } else {
        dispose();
      }
    });
  };
  routeWeakEffect((routeInstance) => {
    error = errorSignal.value;
    routeInstance.error = error;
  });
  routeWeakEffect((routeInstance) => {
    data = dataSignal.value;
    routeInstance.data = data;
  });
  routeWeakEffect((routeInstance) => {
    state = stateSignal.value;
    routeInstance.state = state;
  });

  return route;
};

const applyRouteEnterEffect = async (route, { signal, matchResult }) => {
  // here we must pass a signal that gets aborted when
  // 1. any route is stopped (browser stop button)
  // 2. route is left
  // if we reach the end we can safely clear the current load signals
  const enterAbortController = new AbortController();
  const enterAbortSignal = enterAbortController.signal;
  const abort = (reason) => {
    if (debug) {
      console.log(`abort entering "${route}"`);
    }
    route.loadingStateSignal.value = ABORTED;
    enterAbortController.abort(reason);
    routeAbortEnterMap.delete(route);
  };
  const onabort = () => {
    abort(signal.reason);
  };
  signal.addEventListener("abort", onabort);
  routeAbortEnterMap.set(route, abort);
  route.enterEffect({ matchResult });
  matchingRouteSet.add(route);

  await loadRoute(route, {
    signal: enterAbortSignal,
    onError: () => {
      signal.removeEventListener("abort", onabort);
    },
  });
};
const applyRouteLeaveEffect = (route, reason) => {
  const routeAbortEnter = routeAbortEnterMap.get(route);
  if (routeAbortEnter) {
    if (debug) {
      console.log(`"${route}": aborting route enter (reason: ${reason})`);
    }
    routeAbortEnter(reason);
  } else if (debug) {
    console.log(`"${route}": leaving route (reason: ${reason})`);
  }
  route.leaveEffect(reason);
  matchingRouteSet.delete(route);
  routeEnterPromiseMap.delete(route);
};

const loadRoute = async (route, { signal, onError }) => {
  try {
    const promisesToWait = [];
    if (route.loadData) {
      if (debug) {
        console.log(`"${route}": loadData start`);
      }
      const routeLoadPromise = (async () => {
        const data = await route.loadData({ signal });
        route.dataSignal.value = data;
        if (debug) {
          console.log(`"${route}": loadData end`);
        }
      })();
      promisesToWait.push(routeLoadPromise);
    }
    if (route.loadUI) {
      if (debug) {
        console.log(`"${route}": loadUI start`);
      }
      const loadUIPromise = (async () => {
        await route.loadUI({ signal });
        if (debug) {
          console.log(`"${route}": loadUI end`);
        }
      })();
      promisesToWait.push(loadUIPromise);
    }
    if (promisesToWait.length) {
      await Promise.all(promisesToWait);
      if (signal.aborted) {
        return;
      }
    }
    route.loadingStateSignal.value = LOADED;
    if (route.renderUI) {
      route.node = await route.renderUI();
      if (signal.aborted) {
        return;
      }
      if (debug) {
        console.log(`"${route}": loaded and rendered`);
      }
    } else if (debug) {
      console.log(`"${route}": loaded`);
    }
    routeAbortEnterMap.delete(route);
    routeEnterPromiseMap.delete(route);
  } catch (e) {
    onError(e);
    routeAbortEnterMap.delete(route);
    routeEnterPromiseMap.delete(route);
    if (signal.aborted && e === signal.reason) {
      route.loadingStateSignal.value = ABORTED;
      return;
    }
    batch(() => {
      route.reportError(e);
      route.loadingStateSignal.value = FAILED;
    });
  }
};

export const applyRouting = async ({
  // sourceUrl,
  targetUrl,
  targetState,
  stopSignal,
  isReload,
  isReplace,
  info,
}) => {
  const targetResource = resourceFromUrl(targetUrl);
  const routesToEnter = info?.routesToEnter;
  const routesToLeave = info?.routesToLeave;
  const routesLoaded = info?.routesLoaded;
  const routeToLeaveSet = new Set();
  const routeToEnterMap = new Map();
  let routeToKeepActiveSet;
  let routeCandidateSet;
  if (routesToEnter) {
    routeCandidateSet = new Set(routesToEnter);
    routeToKeepActiveSet = new Set(matchingRouteSet);
  } else if (routesToLeave) {
    routeCandidateSet = new Set();
    routeToKeepActiveSet = new Set(matchingRouteSet);
    for (const routeToLeave of routesToLeave) {
      routeToKeepActiveSet.delete(routeToLeave);
      routeCandidateSet.add(routeToLeave);
    }
  } else {
    // Utiliser toutes les routes actives (non GC)
    routeCandidateSet = getAliveRouteSet();
    routeToKeepActiveSet = new Set();
  }

  if (debug) {
    console.group(`applyRouting on ${routeCandidateSet.size} routes`);
    console.debug(
      `situation at start:
- url: ${targetResource}
- state: ${targetState ? JSON.stringify(targetState) : "undefined"}
- matching routes: ${matchingRouteSet.size === 0 ? "none" : Array.from(matchingRouteSet).join(", ")}
- meta: isReload: ${isReload}, isReplace ${isReplace}`,
    );
  }

  for (const routeCandidate of routeCandidateSet) {
    if (routesLoaded && routesLoaded.includes(routeCandidate)) {
      routeToKeepActiveSet.add(routeCandidate);
      continue;
    }
    const matchResult = routeCandidate.match(targetResource);
    if (!matchResult) {
      continue;
    }
    const targetParams = {
      ...matchResult.named,
      ...matchResult.stars,
    };
    const enterParams = {
      signal: stopSignal,
      matchResult: targetParams,
    };
    const startsMatching = !matchingRouteSet.has(routeCandidate);
    if (startsMatching || routeCandidate.shouldReload({ matchResult })) {
      routeToEnterMap.set(routeCandidate, enterParams);
    } else {
      const hasError = routeCandidate.errorSignal.peek();
      const isAborted = routeCandidate.loadingStateSignal.peek() === ABORTED;
      if (isReload) {
        routeToEnterMap.set(routeCandidate, enterParams);
      } else if (hasError) {
        routeToEnterMap.set(routeCandidate, enterParams);
      } else if (isAborted) {
        routeToEnterMap.set(routeCandidate, enterParams);
      } else {
        routeToKeepActiveSet.add(routeCandidate);
      }
    }
  }
  for (const activeRoute of matchingRouteSet) {
    if (
      routeToEnterMap.has(activeRoute) ||
      routeToKeepActiveSet.has(activeRoute)
    ) {
      continue;
    }
    routeToLeaveSet.add(activeRoute);
  }

  // when there is no effect on routes
  // we stay on the page so we want to preserve the current state
  // without this navigating to the same page with <a> would reset current entry state
  if (targetState && routeToEnterMap.size === 0 && routeToLeaveSet.size === 0) {
    navigation.updateCurrentEntry({
      state: targetState,
    });
  }

  const promises = [];
  const routeLoadingSet = new Set();
  for (const routeToKeepActive of routeToKeepActiveSet) {
    const routeEnterPromise = routeEnterPromiseMap.get(routeToKeepActive);
    if (routeEnterPromise) {
      routeLoadingSet.add(routeToKeepActive);
      promises.push(routeEnterPromise);
    }
  }

  if (
    routeToEnterMap.size === 0 &&
    routeToLeaveSet.size === 0 &&
    routeLoadingSet.size === 0
  ) {
    if (debug) {
      console.debug("no effect on routes, early return");
      console.groupEnd();
    }
    return;
  }

  if (debug) {
    console.debug(`situation before updating routes:
- route to leave: ${routeToLeaveSet.size === 0 ? "none" : Array.from(routeToLeaveSet).join(", ")}
- route to enter: ${routeToEnterMap.size === 0 ? "none" : Array.from(routeToEnterMap.keys()).join(", ")}
- route loading: ${routeLoadingSet.size === 0 ? "none" : Array.from(routeLoadingSet).join(", ")}
- route still active: ${routeToKeepActiveSet.size === 0 ? "none" : Array.from(routeToKeepActiveSet).join(", ")}`);
  }
  for (const routeToLeave of routeToLeaveSet) {
    applyRouteLeaveEffect(routeToLeave, `Navigating to ${targetResource}`);
  }
  await routingWhile(async () => {
    for (const [routeToEnter, enterParams] of routeToEnterMap) {
      const routeEnterPromise = applyRouteEnterEffect(
        routeToEnter,
        enterParams,
      );
      routeEnterPromiseMap.set(routeToEnter, routeEnterPromise);
      promises.push(routeEnterPromise);
    }
    await Promise.all(promises);
  });
  if (debug) {
    console.groupEnd();
  }
};

const urlWithoutSearch = (url) => {
  const urlObject = new URL(url);
  urlObject.search = "";
  const withoutSearch = urlObject.href;
  return withoutSearch;
};
