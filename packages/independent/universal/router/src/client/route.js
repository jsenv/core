import { batch, effect, signal } from "@preact/signals";
import { parseResourcePattern } from "../universal/resource_pattern.js";
import {
  endDocumentRouting,
  startDocumentRouting,
} from "./document_routing.js";
import { documentUrlSignal } from "./document_url.js";
import { normalizeUrl } from "./normalize_url.js";
import { goTo, installNavigation } from "./router.js";

let debug = true;
let debugDocumentRouting = false;
const IDLE = { id: "idle" };
const LOADING = { id: "loading" };
const ABORTED = { id: "aborted" };
const LOADED = { id: "loaded" };
const FAILED = { id: "failed" };

const getDocumentUrl = () => {
  const documentUrl = documentUrlSignal.value;
  const documentUrlObject = new URL(documentUrl);
  documentUrlObject.search = "";
  return documentUrlObject;
};

let baseUrl = window.location.origin;
export const setBaseUrl = (v) => {
  baseUrl = v;
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
const fallbackRoutePerMethodMap = new Map();
let fallbackRouteAnyMethod = null;
const createRoute = (method, resource, loadData) => {
  const resourcePatternParsed = parseResourcePattern(resource, baseUrl);
  const route = {
    method,
    resource,
    loadData,
    loadUI: null,
    buildUrl: (params) => {
      const documentUrl = getDocumentUrl();
      const documentUrlWithRoute = resourcePatternParsed.build(
        documentUrl,
        params,
      );
      return normalizeUrl(documentUrlWithRoute);
    },
    isMatchingSignal: signal(false),
    loadingStateSignal: signal(IDLE),
    errorSignal: signal(null),
    dataSignal: signal(undefined),
    error: null,
    data: undefined,
    params: {},
    test: ({ method, resource }) => {
      if (route.method !== method && route.method !== "*") {
        return false;
      }
      if (!resourcePatternParsed.match(resource)) {
        return false;
      }
      return true;
    },
    enter: async ({ signal, resource, formData }) => {
      // here we must pass a signal that gets aborted when
      // 1. any route is stopped (browser stop button)
      // 2. route is left
      // if we reach the end we can safely clear the current load signals
      const enterAbortController = new AbortController();
      const enterAbortSignal = enterAbortController.signal;
      const abort = () => {
        if (debug) {
          console.log(`abort entering "${route}"`);
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
        console.log(`"${route}": entering route`);
      }
      try {
        const loadDataPromise = (async () => {
          if (!route.loadData) {
            return;
          }
          const data = await route.loadData({
            signal: enterAbortSignal,
            params: resourcePatternParsed.match(resource),
            formData,
          });
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
          console.log(`"${route}": route enter end`);
        }
      } catch (e) {
        batch(() => {
          route.reportError(e);
          route.loadingStateSignal.value = FAILED;
        });
        routeAbortEnterMap.delete(route);
        console.error(`Error while entering route "${route}":`, e);
      }
    },
    reportError: (e) => {
      route.errorSignal.value = e;
    },
    leave: () => {
      const routeAbortEnter = routeAbortEnterMap.get(route);
      if (routeAbortEnter) {
        if (debug) {
          console.log(`"${route}": aborting route enter`);
        }
        routeAbortEnterMap.delete(route);
        routeAbortEnter();
      }
      if (debug) {
        console.log(`"${route}": leaving route`);
      }
      route.isMatchingSignal.value = false;
      route.loadingStateSignal.value = IDLE;
      matchingRouteSet.delete(route);
    },
    activate: (params) => {
      const documentUrlWithRoute = route.buildUrl(params);
      goTo(documentUrlWithRoute);
    },
    toString: () => {
      return `${route.method} ${route.resource}`;
    },
  };
  effect(() => {
    route.data = route.dataSignal.value;
  });
  effect(() => {
    route.error = route.errorSignal.value;
  });
  effect(() => {
    const documentUrl = documentUrlSignal.value;
    route.params = resourcePatternParsed.match(documentUrl);
  });

  return route;
};
export const registerRoutes = (description) => {
  const routes = [];
  for (const key of Object.keys(description)) {
    const handler = description[key];
    if (key.startsWith("GET ")) {
      const resource = key.slice("GET ".length);
      const route = createRoute("GET", resource, handler);
      routeSet.add(route);
      routes.push(route);
      continue;
    }
    if (key.startsWith("PATCH ")) {
      const resource = key.slice("PATCH ".length);
      const route = createRoute("PATCH", resource, handler);
      routeSet.add(route);
      routes.push(route);
      continue;
    }
    if (key === "GET *") {
      const fallbackGET = createRoute("GET", "*", handler);
      fallbackRoutePerMethodMap.set("GET", fallbackGET);
      continue;
    }
    if (key === "PATCH *") {
      const fallbackPATCH = createRoute("PATCH", "*", handler);
      fallbackRoutePerMethodMap.set("GET", fallbackPATCH);
      continue;
    }
    if (key === "*") {
      fallbackRouteAnyMethod = createRoute("*", "*", handler);
      continue;
    }
  }
  installNavigation({ applyRouting });
  return routes;
};

/**
 *
 */

export const applyRouting = async ({
  method,
  // maybe rename url into resource (because we can't do anything about url outside out domain I guess? TO BE TESTED)
  sourceUrl,
  targetUrl,
  formData,
  state,
  signal,
  reload,
}) => {
  const sourceResource = resourceFromUrl(sourceUrl);
  const targetResource = resourceFromUrl(targetUrl);

  const stopSignal = signalToStopSignal(signal);
  if (debug) {
    console.log(`apply routing on ${method} ${targetResource}`);
  }
  const nextMatchingRouteSet = new Set();
  const testRouteAgainst = (route, methodCandidate, resourceCandidate) => {
    const urlObject = new URL(resourceCandidate);
    const testParams = {
      method: methodCandidate,
      resource: resourceCandidate,
      state,
      searchParams: urlObject.searchParams,
      pathname: urlObject.pathname,
      hash: urlObject.hash,
      formData,
    };
    return route.test(testParams);
  };

  for (const routeCandidate of routeSet) {
    const isMatchingTargetUrl = testRouteAgainst(
      routeCandidate,
      method,
      targetResource,
    );
    if (isMatchingTargetUrl) {
      nextMatchingRouteSet.add(routeCandidate);
    }
  }
  if (nextMatchingRouteSet.size === 0) {
    if (debug) {
      console.log("no route has matched -> use fallback route");
    }
    const fallbackRouteForThisMethod = fallbackRoutePerMethodMap.get(method);
    if (fallbackRouteForThisMethod) {
      nextMatchingRouteSet.add(fallbackRouteForThisMethod);
    } else if (fallbackRouteAnyMethod) {
      nextMatchingRouteSet.add(fallbackRouteAnyMethod);
    }
  }
  const routeToLeaveSet = new Set();
  const routeToEnterSet = new Set();
  for (const activeRoute of matchingRouteSet) {
    if (nextMatchingRouteSet.has(activeRoute)) {
      continue;
    }
    if (sourceResource !== targetResource) {
      // when we route to a new url but we stay on the current url
      // until routing is done (POST/PATCH/PUT)
      // then we keep the route active during that time
      if (testRouteAgainst(activeRoute, "GET", sourceResource)) {
        if (debug) {
          console.log(
            `${activeRoute.ressource}: stays active while navigating to ${targetResource}`,
          );
        }
        continue;
      }
    }
    routeToLeaveSet.add(activeRoute);
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
      const routeEnterPromise = routeToEnter.enter({
        signal: stopSignal,
        resource: targetResource,
        formData,
      });
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
