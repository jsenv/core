import { batch, computed, effect, signal } from "@preact/signals";
import {
  endDocumentRouting,
  startDocumentRouting,
} from "./document_routing.js";
import { documentUrlSignal } from "./document_url.js";
import { normalizeUrl } from "./normalize_url.js";
import { goTo, installNavigation } from "./router.js";

let debug = false;
let debugDocumentRouting = false;
const IDLE = { id: "idle" };
const LOADING = { id: "loading" };
const ABORTED = { id: "aborted" };
const LOADED = { id: "loaded" };
const FAILED = { id: "failed" };

const buildUrlFromDocument = (build) => {
  const documentUrl = documentUrlSignal.value;
  const documentUrlObject = new URL(documentUrl);
  documentUrlObject.search = "";
  const newDocumentUrl = build(documentUrlObject);
  return normalizeUrl(newDocumentUrl);
};

let resolveRouterUIReadyPromise;
const routerUIReadyPromise = new Promise((resolve) => {
  resolveRouterUIReadyPromise = resolve;
});
export const onRouterUILoaded = () => {
  resolveRouterUIReadyPromise();
};
const routeSet = new Set();
const matchingRouteSet = new Set();
const routeAbortEnterMap = new Map();
let fallbackRoute;
const createRoute = (name, { urlTemplate, loadData, loadUI }, { baseUrl }) => {
  let routePathname;
  let routeSearchParams;
  if (urlTemplate) {
    if (urlTemplate.startsWith("/")) {
      urlTemplate = urlTemplate.slice(1);
    }
    const routeUrlInstance = new URL(urlTemplate, baseUrl);
    if (routeUrlInstance.pathname !== "/") {
      routePathname = routeUrlInstance.pathname;
    }
    if (routeUrlInstance.searchParams.toString() !== "") {
      routeSearchParams = routeUrlInstance.searchParams;
    }
  }
  const addToUrl = (urlObject, params) => {
    if (routePathname) {
      urlObject.pathname = routePathname;
    }
    if (routeSearchParams) {
      for (const [key, value] of routeSearchParams) {
        urlObject.searchParams.set(key, value);
      }
    }
    return urlObject;
  };
  const removeFromUrl = (urlObject, params) => {
    if (routePathname) {
      urlObject.pathname = "/";
    }
    if (routeSearchParams) {
      for (const [key] of routeSearchParams) {
        urlObject.searchParams.delete(key);
      }
    }
    return urlObject;
  };
  const route = {
    name,
    loadData,
    loadUI,
    buildUrl: (params) =>
      buildUrlFromDocument((urlObject) => addToUrl(urlObject, params)),
    isMatchingSignal: signal(false),
    loadingStateSignal: signal(IDLE),
    errorSignal: signal(null),
    dataSignal: signal(undefined),
    error: null,
    data: undefined,
    test: ({ pathname, searchParams }) => {
      if (urlTemplate) {
        if (routePathname && !pathname.startsWith(routePathname)) {
          return false;
        }
        if (routeSearchParams) {
          for (const [
            routeSearchParamKey,
            routeSearchParamValue,
          ] of routeSearchParams) {
            if (routeSearchParamValue === "") {
              if (!searchParams.has(routeSearchParamKey)) {
                return false;
              }
            }
            const value = searchParams.get(routeSearchParamKey);
            if (value !== routeSearchParamValue) {
              return false;
            }
          }
        }
      }
      return true;
    },
    enter: async ({ signal }) => {
      // here we must pass a signal that gets aborted when
      // 1. any route is stopped (browser stop button)
      // 2. route is left
      // if we reach the end we can safely clear the current load signals
      const enterAbortController = new AbortController();
      const enterAbortSignal = enterAbortController.signal;
      const abort = () => {
        if (debug) {
          console.log(`abort entering "${route.name}"`);
        }
        route.loadingStateSignal.value = ABORTED;
        enterAbortController.abort();
      };
      signal.addEventListener("abort", abort);
      routeAbortEnterMap.set(route, abort);

      route.isMatchingSignal.value = true;
      route.loadingStateSignal.value = LOADING;
      route.errorSignal.value = null;
      matchingRouteSet.add(route);
      if (debug) {
        console.log(`"${route.name}": entering route`);
      }
      try {
        const loadDataPromise = (async () => {
          if (!route.loadData) {
            return;
          }
          const data = await route.loadData({ signal: enterAbortSignal });
          route.dataSignal.value = data;
        })();
        const loadUIPromise = (async () => {
          await routerUIReadyPromise;
          if (!route.loadUI) {
            return;
          }
          if (enterAbortSignal.aborted) {
            return;
          }
          await route.loadUI({ signal: enterAbortSignal });
        })();
        await Promise.all([loadDataPromise, loadUIPromise]);
        route.loadingStateSignal.value = LOADED;
        if (debug) {
          console.log(`"${route.name}": route enter end`);
        }
      } catch (e) {
        batch(() => {
          route.reportError(e);
          route.loadingStateSignal.value = FAILED;
        });
        routeAbortEnterMap.delete(route);
        console.error(`Error while entering route named "${route.name}":`, e);
      }
    },
    reportError: (e) => {
      route.errorSignal.value = e;
    },
    leave: () => {
      const routeAbortEnter = routeAbortEnterMap.get(route);
      if (routeAbortEnter) {
        if (debug) {
          console.log(`"${route.name}": aborting route enter`);
        }
        routeAbortEnterMap.delete(route);
        routeAbortEnter();
      }
      if (debug) {
        console.log(`"${route.name}": leaving route`);
      }
      route.isMatchingSignal.value = false;
      route.loadingStateSignal.value = IDLE;
      matchingRouteSet.delete(route);
    },
    activate: (params) => {
      const documentUrlWithRoute = buildUrlFromDocument((urlObject) =>
        addToUrl(urlObject, params),
      );
      goTo(documentUrlWithRoute);
    },
    deactivate: (params) => {
      const documentUrlWithoutRoute = buildUrlFromDocument((urlObject) =>
        removeFromUrl(urlObject, params),
      );
      goTo(documentUrlWithoutRoute);
    },
  };
  effect(() => {
    route.data = route.dataSignal.value;
  });
  effect(() => {
    route.error = route.errorSignal.value;
  });
  return route;
};
export const registerRoutes = (
  { fallback, ...rest },
  baseUrl = window.location.origin,
) => {
  const routes = {};
  for (const key of Object.keys(rest)) {
    const route = createRoute(key, rest[key], { baseUrl });
    routeSet.add(route);
    routes[key] = route;
  }
  if (fallback) {
    fallbackRoute = createRoute("fallback", fallback, { baseUrl });
  }
  installNavigation({ applyRouting });
  return routes;
};

/**
 *
 */

export const applyRouting = async ({ url, state, signal, reload }) => {
  const stopSignal = signalToStopSignal(signal);
  if (debug) {
    console.log("try to match routes against", { url });
  }
  const nextMatchingRouteSet = new Set();
  for (const routeCandidate of routeSet) {
    const urlObject = new URL(url);
    const returnValue = routeCandidate.test({
      url,
      state,
      searchParams: urlObject.searchParams,
      pathname: urlObject.pathname,
      hash: urlObject.hash,
    });
    if (returnValue) {
      nextMatchingRouteSet.add(routeCandidate);
    }
  }
  if (nextMatchingRouteSet.size === 0) {
    if (debug) {
      console.log("no route has matched -> use fallback route");
    }
    nextMatchingRouteSet.add(fallbackRoute);
  }
  const routeToLeaveSet = new Set();
  const routeToEnterSet = new Set();
  for (const activeRoute of matchingRouteSet) {
    if (!nextMatchingRouteSet.has(activeRoute)) {
      routeToLeaveSet.add(activeRoute);
    }
  }
  for (const nextMatchingRoute of nextMatchingRouteSet) {
    const nextMatchingRouteLoadingState =
      nextMatchingRoute.loadingStateSignal.peek();
    const nextMatchingRouteError = nextMatchingRoute.errorSignal.peek();
    if (
      reload ||
      !matchingRouteSet.has(nextMatchingRoute) ||
      nextMatchingRouteLoadingState === ABORTED ||
      nextMatchingRouteError
    ) {
      routeToEnterSet.add(nextMatchingRoute);
    }
  }
  nextMatchingRouteSet.clear();
  for (const routeToLeave of routeToLeaveSet) {
    routeToLeave.leave();
  }
  if (routeToEnterSet.size === 0) {
    if (debug) {
      console.log("no effect on routes, early return");
    }
    return;
  }
  if (debugDocumentRouting) {
    console.log("routing started");
  }
  startDocumentRouting();
  try {
    const promises = [];
    for (const routeToEnter of routeToEnterSet) {
      const routeEnterPromise = routeToEnter.enter({ signal: stopSignal });
      promises.push(routeEnterPromise);
    }
    await Promise.all(promises);
  } catch (e) {
    console.error(e);
  } finally {
    if (debugDocumentRouting) {
      console.log("routing ended");
    }
    endDocumentRouting();
  }
};

let applyRoutingEffect = () => {};
const signalToStopSignal = (signal) => {
  applyRoutingEffect();
  const stopAbortController = new AbortController();
  const stopSignal = stopAbortController.signal;
  signal.addEventListener("abort", async () => {
    const timeout = setTimeout(() => {
      applyRoutingEffect = () => {};
      if (debug) {
        console.log("aborted because stop");
      }
      stopAbortController.abort();
    });
    applyRoutingEffect = () => {
      if (debug) {
        console.log("aborted because new navigation");
      }
      clearTimeout(timeout);
    };
  });
  return stopSignal;
};

export const useRouteUrl = (route, params) => {
  return route.buildUrl(params);
};
export const useRouteLoadingState = (route) => {
  const loadingState = route.loadingStateSignal.value;
  if (loadingState === IDLE) {
    return "idle";
  }
  if (loadingState === LOADING) {
    return "loading";
  }
  if (loadingState === ABORTED) {
    return "aborted";
  }
  if (loadingState.error) {
    return "load_error";
  }
  return "loaded";
};
export const useRouteIsMatching = (route) => {
  return route.isMatchingSignal.value;
};
export const useRouteIsLoading = (route) => {
  return route.loadingStateSignal.value === LOADING;
};
export const useRouteLoadIsAborted = (route) => {
  return route.loadingStateSignal.value === ABORTED;
};
export const useRouteIsLoaded = (route) => {
  return route.loadingStateSignal.value === LOADED;
};
export const useRouteError = (route) => {
  return route.errorSignal.value;
};
export const useRouteData = (route) => {
  return route.dataSignal.value;
};
