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
export const setBaseUrl = (v) => {
  const urlObject = new URL(v);
  urlObject.search = "";
  baseUrl = urlObject.href;
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
export const registerRoute = (resourcePattern, handler) => {
  const route = {
    resourcePattern: undefined,
    isMatchingSignal: undefined,
    match: undefined,

    url: undefined,
    urlSignal: undefined,
    buildUrl: undefined,
    compareUrl: undefined,
    go: undefined,

    params: undefined,
    paramsSignal: undefined,
    replaceParams: undefined,

    loadData: handler,
    loadUI: undefined,
    renderUI: undefined,
    node: undefined,
    loadingStateSignal: undefined,
    error: undefined,
    errorSignal: undefined,
    reportError: undefined,
    data: undefined,
    dataSignal: undefined,
    reload: undefined,

    toString: undefined,
  };
  routeSet.add(route);

  resourcePattern = resourceFromUrl(resourcePattern);
  const resourcePatternParsed = createResourcePattern(resourcePattern);
  matching: {
    const isMatchingSignal = signal(false);
    const match = ({ resource }) => {
      const matchResult = resourcePatternParsed.match(resource);
      if (!matchResult) {
        return false;
      }
      return matchResult;
    };

    route.resourcePattern = resourcePattern;
    route.isMatchingSignal = isMatchingSignal;
    route.match = match;
  }

  url: {
    let url;
    const urlSignal = signal(url);
    effect(() => {
      url = urlSignal.value;
      route.url = url;
    });
    const buildUrl = (url, params) => {
      const routeResource = resourcePatternParsed.generate(params);
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
    const compareUrl = (urlToCompare) => {
      const currentUrl = urlSignal.peek();
      if (!currentUrl) {
        return false;
      }
      // TODO:
      // 1. si une url fini par ?* alors on gardera les search params
      // 2. si une url fait ceci: ?foo=*&bar=* alors on considere que l'url a changé
      // que si le param foo ou bar a changé mais pas si un autre param a changé
      const urlToCompareWithoutSearch = urlWithoutSearch(urlToCompare);
      const currentUrlWithoutSearch = urlWithoutSearch(currentUrl);
      if (urlToCompareWithoutSearch === currentUrlWithoutSearch) {
        return true;
      }
      return false;
    };
    route.urlSignal = urlSignal;
    route.buildUrl = buildUrl;
    route.compareUrl = compareUrl;

    let params = {};
    const paramsSignal = signal(params);
    effect(() => {
      params = paramsSignal.value;
      route.params = params;
    });
    const replaceParams = (params) => {
      paramsSignal.value = params;
      const routeUrl = buildUrl(window.location.href, params);
      urlSignal.value = routeUrl;
      goTo(routeUrl, { replace: true, routesLoaded: [route] });
    };
    route.paramsSignal = paramsSignal;
    route.replaceParams = replaceParams;

    route.go = ({ replace } = {}) => {
      goTo(route.url, { replace });
    };
  }

  loading: {
    const loadingStateSignal = signal(IDLE);
    route.loadingStateSignal = loadingStateSignal;

    let error;
    const errorSignal = signal(null);
    const reportError = (e) => {
      errorSignal.value = e;
    };
    effect(() => {
      error = errorSignal.value;
      route.error = error;
    });
    route.errorSignal = errorSignal;
    route.reportError = reportError;

    let data;
    const dataSignal = signal(undefined);
    effect(() => {
      data = dataSignal.value;
      route.data = data;
    });
    route.dataSignal = dataSignal;

    route.reload = () => {
      reload();
    };
  }

  const toString = () => {
    const isMatching = route.isMatchingSignal.peek();
    return isMatching ? route.url : resourcePattern;
  };
  route.toString = toString;

  return route;
};

// https://github.com/WICG/navigation-api?tab=readme-ov-file#setting-the-current-entrys-state-without-navigating
export const registerInlineRoute = (statePattern, handler) => {
  const inlineRoute = {
    statePattern,
    isMatchingSignal: undefined,
    match: undefined,

    state: undefined,
    stateSignal: undefined,
    replaceState: undefined,
    go: undefined,

    loadData: handler,
    loadUI: undefined,
    renderUI: undefined,
    node: undefined,
    loadingStateSignal: undefined,
    error: undefined,
    errorSignal: undefined,
    reportError: undefined,
    data: undefined,
    dataSignal: undefined,
    reload: undefined,

    toString: undefined,
  };

  matching: {
    const isMatchingSignal = signal(false);
    const match = ({ state }) => {
      if (!state) {
        return false;
      }
      const matchResult = { named: {}, stars: [] };
      for (const key of Object.keys(statePattern)) {
        const valuePattern = statePattern[key];
        const value = state[key];
        if (valuePattern !== value) {
          return false;
        }
      }
      return matchResult;
    };

    inlineRoute.isMatchingSignal = isMatchingSignal;
    inlineRoute.match = match;
  }

  state: {
    let state = {};
    const stateSignal = signal(state);
    effect(() => {
      state = stateSignal.value;
      inlineRoute.state = state;
    });
    inlineRoute.stateSignal = stateSignal;

    inlineRoute.replaceState = (newState) => {
      const currentState = stateSignal.peek();
      const updatedState = { ...currentState, ...newState };
      goTo(window.location.href, {
        state: updatedState,
        replace: true,
      });
    };

    inlineRoute.go = ({ replace = true } = {}) => {
      goTo(window.location.href, {
        state: statePattern,
        replace,
      });
    };
  }

  loading: {
    const loadingStateSignal = signal(IDLE);
    inlineRoute.loadingStateSignal = loadingStateSignal;

    let error;
    const errorSignal = signal(null);
    const reportError = (e) => {
      errorSignal.value = e;
    };
    effect(() => {
      error = errorSignal.value;
      inlineRoute.error = error;
    });
    inlineRoute.errorSignal = errorSignal;
    inlineRoute.reportError = reportError;

    let data;
    const dataSignal = signal(undefined);
    effect(() => {
      data = dataSignal.value;
      inlineRoute.data = data;
    });
    inlineRoute.dataSignal = dataSignal;

    inlineRoute.reload = () => {
      reload();
    };
  }

  inlineRoute.toString = () => {
    return JSON.stringify(statePattern);
  };

  routeSet.add(inlineRoute);
  return inlineRoute;
};

const routeSet = new Set();
const matchingRouteSet = new Set();
export const applyRouting = async ({
  // sourceUrl,
  targetUrl,
  targetState,
  stopSignal,
  isReload,
  // isReplace,
  info,
}) => {
  // const sourceResource = resourceFromUrl(sourceUrl);
  const targetResource = resourceFromUrl(targetUrl);
  if (debug) {
    console.log(
      `start routing ${targetResource} against ${routeSet.size} routes`,
    );
  }

  const targetUrlObject = new URL(targetResource, baseUrl);
  const matchParams = {
    resource: targetResource,
    state: targetState,
    searchParams: targetUrlObject.searchParams,
    pathname: targetUrlObject.pathname,
    hash: targetUrlObject.hash,
  };
  const routeToLeaveSet = new Set();
  const routeToEnterMap = new Map();
  const routeToKeepActiveSet = new Set();
  for (const routeCandidate of routeSet) {
    if (
      info &&
      info.routesLoaded &&
      info.routesLoaded.includes(routeCandidate)
    ) {
      routeToKeepActiveSet.add(routeCandidate);
      continue;
    }
    const matchResult = routeCandidate.match(matchParams);
    if (!matchResult) {
      continue;
    }
    const params = {
      ...matchResult.named,
      ...matchResult.stars,
    };
    const enterParams = {
      signal: stopSignal,
      url: routeCandidate.buildUrl
        ? routeCandidate.buildUrl(targetUrl, params)
        : undefined,
      resource: targetResource,
      state: targetState,
      params,
    };
    if (routeCandidate.compareUrl && routeCandidate.compareUrl(targetUrl)) {
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
    } else {
      routeToEnterMap.set(routeCandidate, enterParams);
    }
  }
  if (routeToEnterMap.size === 0 && matchingRouteSet.size === 0) {
    if (debug) {
      console.log("no effect on routes, early return");
    }
    return;
  }
  if (routeToEnterMap.size === 0) {
    const routeLeftSet = new Set();
    for (const routeToLeave of matchingRouteSet) {
      if (routeToKeepActiveSet.has(routeToLeave)) {
        continue;
      }
      routeLeftSet.add(routeToLeave);
      leaveRoute(routeToLeave, `Navigating to ${targetResource}`);
    }
    if (debug) {
      console.log(`does not match new routes.
route still active: ${routeToKeepActiveSet.size === 0 ? "none" : Array.from(routeToKeepActiveSet).join(", ")}
route left: ${routeLeftSet.size === 0 ? "none" : Array.from(routeLeftSet).join(", ")}`);
    }
    return;
  }
  for (const activeRoute of matchingRouteSet) {
    if (routeToEnterMap.has(activeRoute)) {
      continue;
    }
    routeToLeaveSet.add(activeRoute);
  }
  for (const routeToLeave of routeToLeaveSet) {
    leaveRoute(routeToLeave, `Navigating to ${targetResource}`);
  }
  await routingWhile(async () => {
    const promises = [];
    for (const [routeToEnter, enterParams] of routeToEnterMap) {
      const routeEnterPromise = enterRoute(routeToEnter, enterParams);
      promises.push(routeEnterPromise);
    }
    await Promise.all(promises);
  });
};
const enterRoute = async (route, { signal, url, params, state }) => {
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
  signal.addEventListener("abort", () => {
    abort(signal.reason);
  });
  routeAbortEnterMap.set(route, abort);

  if (debug) {
    console.log(`"${route}": entering route`);
  }
  matchingRouteSet.add(route);
  batch(() => {
    if (route.urlSignal) {
      route.urlSignal.value = url;
    }
    if (route.paramsSignal) {
      route.paramsSignal.value = params;
    }
    if (route.stateSignal) {
      route.stateSignal.value = state;
    }
    route.isMatchingSignal.value = true;
    route.loadingStateSignal.value = LOADING;
    route.errorSignal.value = null;
  });

  try {
    const promisesToWait = [];
    if (route.loadData) {
      const loadDataPromise = (async () => {
        const data = await route.loadData({
          signal: enterAbortSignal,
          params,
        });
        route.dataSignal.value = data;
      })();
      promisesToWait.push(loadDataPromise);
    }
    if (route.loadUI) {
      const loadUIPromise = (async () => {
        await route.loadUI({ signal: enterAbortSignal });
      })();
      promisesToWait.push(loadUIPromise);
    }
    if (promisesToWait.length) {
      await Promise.all(promisesToWait);
      if (enterAbortSignal.aborted) {
        return;
      }
    }
    route.loadingStateSignal.value = LOADED;
    if (route.renderUI) {
      route.node = await route.renderUI();
      if (enterAbortSignal.aborted) {
        return;
      }
    }
    if (debug) {
      console.log(`"${route}": route enter end`);
    }
    routeAbortEnterMap.delete(route);
  } catch (e) {
    routeAbortEnterMap.delete(route);
    if (enterAbortSignal.aborted && e === enterAbortSignal.reason) {
      route.loadingStateSignal.value = ABORTED;
      return;
    }
    batch(() => {
      route.reportError(e);
      route.loadingStateSignal.value = FAILED;
    });
    throw e;
  }
};
const leaveRoute = (route, reason) => {
  const routeAbortEnter = routeAbortEnterMap.get(route);
  if (routeAbortEnter) {
    if (debug) {
      console.log(`"${route}": aborting route enter`);
    }
    routeAbortEnter(reason);
  }
  if (debug) {
    console.log(`"${route}": leaving route`);
  }
  batch(() => {
    if (route.urlSignal) {
      route.urlSignal.value = null;
    }
    if (route.paramsSignal) {
      route.paramsSignal.value = {};
    }
    if (route.stateSignal) {
      route.stateSignal.value = {};
    }
    route.isMatchingSignal.value = false;
    route.loadingStateSignal.value = IDLE;
    route.errorSignal.value = null;
  });
  matchingRouteSet.delete(route);
};

const urlWithoutSearch = (url) => {
  const urlObject = new URL(url);
  urlObject.search = "";
  const withoutSearch = urlObject.href;
  return withoutSearch;
};
