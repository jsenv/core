import { batch, effect, signal } from "@preact/signals";
import { createResourcePattern } from "../../shared/resource_pattern.js";
import { normalizeUrl } from "../normalize_url.js";
import { goTo, installNavigation } from "../router.js";
import { IDLE, LOADING, ABORTED, LOADED, FAILED } from "./route_status.js";
import { routingWhile } from "../document_routing.js";

let debug = true;

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
  installNavigation({ applyRouting, routingWhile });
};

const routeAbortEnterMap = new Map();
export const registerRoute = (resourcePattern, handler) => {
  resourcePattern = resourceFromUrl(resourcePattern);
  const resourcePatternParsed = createResourcePattern(resourcePattern);
  const route = {
    resourcePattern,
    loadData: handler,
    loadUI: null,
    renderUI: null,
    node: null,
    buildUrl: (params) => {
      const routeResource = resourcePatternParsed.generate(params);
      const routeUrl = new URL(routeResource, window.location).href;
      const routeUrlNormalized = normalizeUrl(routeUrl);
      return routeUrlNormalized;
    },
    urlSignal: signal(null),
    paramsSignal: signal({}),
    isMatchingSignal: signal(false),
    loadingStateSignal: signal(IDLE),
    errorSignal: signal(null),
    dataSignal: signal(undefined),
    error: null,
    data: undefined,
    params: {},
    match: (resource) => {
      const matchResult = resourcePatternParsed.match(resource);
      if (!matchResult) {
        return false;
      }
      return matchResult;
    },
    reportError: (e) => {
      route.errorSignal.value = e;
    },
    activate: (params) => {
      const documentUrlWithRoute = route.buildUrl(params);
      goTo(documentUrlWithRoute);
    },
    toString: () => {
      return `${route.resourcePattern}`;
    },
  };
  effect(() => {
    route.url = route.urlSignal.value;
  });
  effect(() => {
    route.params = route.paramsSignal.value;
  });
  effect(() => {
    route.data = route.dataSignal.value;
  });
  effect(() => {
    route.error = route.errorSignal.value;
  });
  routeSet.add(route);
  return route;
};

const routeSet = new Set();
const matchingRouteSet = new Set();
export const applyRouting = async ({
  // sourceUrl,
  targetUrl,
  state,
  stopSignal,
  isReload,
  // isReplace,
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
    state,
    searchParams: targetUrlObject.searchParams,
    pathname: targetUrlObject.pathname,
    hash: targetUrlObject.hash,
  };
  const routeToLeaveSet = new Set();
  const routeToEnterMap = new Map();
  const routeToKeepActiveSet = new Set();
  for (const routeCandidate of routeSet) {
    const matchResult = routeCandidate.match(targetResource, matchParams);
    if (!matchResult) {
      continue;
    }
    const params = {
      ...matchResult.named,
      ...matchResult.stars,
    };
    const routeUrl = routeCandidate.buildUrl(params);
    const currentRouteUrl = routeCandidate.urlSignal.peek();
    const enterParams = {
      signal: stopSignal,
      url: routeUrl,
      resource: targetResource,
      params,
    };
    if (routeUrl === currentRouteUrl) {
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
const enterRoute = async (route, { signal, url, params }) => {
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
    route.urlSignal.value = url;
    route.paramsSignal.value = params;
    route.isMatchingSignal.value = true;
    route.loadingStateSignal.value = LOADING;
    route.errorSignal.value = null;
  });

  try {
    const promisesToWait = [];
    if (route.loadData && !enterAbortSignal.aborted) {
      const loadDataPromise = (async () => {
        const data = await route.loadData({
          signal: enterAbortSignal,
          params,
        });
        route.dataSignal.value = data;
      })();
      promisesToWait.push(loadDataPromise);
    }
    if (route.loadUI && !enterAbortSignal.aborted) {
      const loadUIPromise = (async () => {
        await route.loadUI({ signal: enterAbortSignal });
      })();
      promisesToWait.push(loadUIPromise);
    }
    if (promisesToWait.length) {
      await Promise.all(promisesToWait);
    }
    route.loadingStateSignal.value = LOADED;

    if (route.renderUI && !enterAbortSignal.aborted) {
      route.node = await route.renderUI();
    }
    if (debug) {
      console.log(`"${route}": route enter end`);
    }
    routeAbortEnterMap.delete(route);
    if (!route.renderUI) {
      route.leave(`"${route}" has no renderUI`);
    }
  } catch (e) {
    routeAbortEnterMap.delete(route);
    if (!route.renderUI) {
      route.leave(`"${route}" error`);
    }
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
    routeAbortEnterMap.delete(route);
    routeAbortEnter(reason);
  }
  if (debug) {
    console.log(`"${route}": leaving route`);
  }
  batch(() => {
    route.isMatchingSignal.value = false;
    route.loadingStateSignal.value = IDLE;
  });
  matchingRouteSet.delete(route);
};
