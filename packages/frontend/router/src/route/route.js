import { createResourcePattern } from "@jsenv/url-pattern";
import { batch, effect, signal } from "@preact/signals";
import { applyAction } from "../action/action.js";
import { routingWhile } from "../document_routing.js";
import { normalizeUrl } from "../normalize_url.js";
import { goTo, installNavigation, reload } from "../router.js";
import { ABORTED, FAILED, IDLE, LOADED, LOADING } from "./route_status.js";

let debug = true;

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
const routeSet = new Set();
const matchingRouteSet = new Set();

export const registerRoute = (firstArg, secondArg) => {
  if (typeof firstArg === "string") {
    if (typeof secondArg === "function") {
      secondArg = {
        load: secondArg,
      };
    }
    const routeConnectedWithUrl = createRouteConnectedWithUrl(
      firstArg,
      secondArg,
    );
    routeSet.add(routeConnectedWithUrl);
    return routeConnectedWithUrl;
  }
  const routeConnectedWithState = createRouteConnectedWithState(firstArg);
  routeSet.add(routeConnectedWithState);
  return routeConnectedWithState;
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

  const match = ({ resource }) => {
    const matchResult = resourcePatternParsed.match(resource);
    if (!matchResult) {
      return false;
    }
    return matchResult;
  };
  const enterEffect = ({ url, params }) => {
    batch(() => {
      isMatchingSignal.value = true;
      errorSignal.value = null;
      loadingStateSignal.value = LOADING;
      urlSignal.value = url;
      paramsSignal.value = params;
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
  const shouldReload = ({ targetUrl }) => {
    if (url === targetUrl) {
      return false;
    }
    const currentUrlWithoutSearch = urlWithoutSearch(url);
    const targetUrlWithoutSearch = urlWithoutSearch(targetUrl);
    if (targetUrlWithoutSearch.startsWith(currentUrlWithoutSearch)) {
      // this is a sub url of the current url
      // so we should not reload the route
      // even if search params are different
      // we suppose the other url/search params compbination will be handled by a sub route
      return false;
    }
    if (targetUrlWithoutSearch !== currentUrlWithoutSearch) {
      return true;
    }
    // same url, check for search params
    // so we should reload the route if search params are different
    const currentUrlSearchParams = new URL(url).searchParams;
    const targetUrlSearchParams = new URL(targetUrl).searchParams;

    const allParamNames = new Set([
      ...Array.from(currentUrlSearchParams.keys()),
      ...Array.from(targetUrlSearchParams.keys()),
    ]);
    for (const paramName of allParamNames) {
      const currentValues = currentUrlSearchParams.getAll(paramName);
      const targetValues = targetUrlSearchParams.getAll(paramName);
      // Different number of values for this parameter
      if (currentValues.length !== targetValues.length) {
        return true; // Reload needed
      }
      // Compare each value in order (for params with multiple values)
      for (let i = 0; i < currentValues.length; i++) {
        if (currentValues[i] !== targetValues[i]) {
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

  effect(() => {
    error = errorSignal.value;
    route.error = error;
  });
  effect(() => {
    data = dataSignal.value;
    route.data = data;
  });
  effect(() => {
    url = urlSignal.value;
    route.url = url;
  });
  effect(() => {
    params = paramsSignal.value;
    route.params = params;
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

  effect(() => {
    error = errorSignal.value;
    route.error = error;
  });
  effect(() => {
    data = dataSignal.value;
    route.data = data;
  });
  effect(() => {
    state = stateSignal.value;
    route.state = state;
  });

  return route;
};

const applyRouteEnterEffect = async (route, { signal, url, params, state }) => {
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
  route.enterEffect({ url, params, state });
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
  // const sourceResource = resourceFromUrl(sourceUrl);
  const targetResource = resourceFromUrl(targetUrl);
  const targetUrlObject = new URL(targetResource, baseUrl);
  const matchParams = {
    resource: targetResource,
    state: targetState,
    searchParams: targetUrlObject.searchParams,
    pathname: targetUrlObject.pathname,
    hash: targetUrlObject.hash,
  };
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
    routeCandidateSet = routeSet;
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
    const matchResult = routeCandidate.match(matchParams);
    if (!matchResult) {
      continue;
    }
    const targetParams = {
      ...matchResult.named,
      ...matchResult.stars,
    };
    const enterParams = {
      signal: stopSignal,
      url: targetUrl,
      resource: targetResource,
      state: targetState,
      params: targetParams,
    };
    const startsMatching = !matchingRouteSet.has(routeCandidate);
    if (
      startsMatching ||
      routeCandidate.shouldReload({ targetUrl, targetState, targetParams })
    ) {
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
  if (
    routeToEnterMap.size === 0 &&
    matchingRouteSet.size === 0 &&
    routeToKeepActiveSet.size === 0 &&
    routeToLeaveSet.size === 0
  ) {
    if (debug) {
      console.debug("no effect on routes, early return");
      console.groupEnd();
    }
    return;
  }

  if (debug) {
    console.debug(`situation before updating routes:
- route still active: ${routeToKeepActiveSet.size === 0 ? "none" : Array.from(routeToKeepActiveSet).join(", ")}
- route to leave: ${routeToLeaveSet.size === 0 ? "none" : Array.from(routeToLeaveSet).join(", ")}
- route to enter: ${routeToEnterMap.size === 0 ? "none" : Array.from(routeToEnterMap.keys()).join(", ")}`);
  }
  for (const routeToLeave of routeToLeaveSet) {
    applyRouteLeaveEffect(routeToLeave, `Navigating to ${targetResource}`);
  }
  await routingWhile(async () => {
    const promises = [];
    for (const routeToKeepActive of routeToKeepActiveSet) {
      const routeEnterPromise = routeEnterPromiseMap.get(routeToKeepActive);
      if (routeEnterPromise) {
        promises.push(routeEnterPromise);
      }
    }
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
