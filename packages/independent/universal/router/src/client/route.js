import { computed, signal } from "@preact/signals";
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
  const newDocumentUrl = build(documentUrlObject);
  return normalizeUrl(newDocumentUrl);
};

const routeSet = new Set();
const matchingRouteSet = new Set();
const routeAbortEnterMap = new Map();
let fallbackRoute;
const createRoute = (name, { urlTemplate, load }, { baseUrl }) => {
  const route = {};

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
  const test = ({ pathname, searchParams }) => {
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
  };
  const addToUrl = (urlObject) => {
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
  const removeFromUrl = (urlObject) => {
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

  const urlSignal = computed(() => {
    return buildUrlFromDocument(addToUrl);
  });
  const isMatchingSignal = signal(false);
  const readyStateSignal = signal(IDLE);
  const errorSignal = signal(null);
  const dataMapSignal = signal();

  const activate = () => {
    const documentUrlWithRoute = buildUrlFromDocument(addToUrl);
    goTo(documentUrlWithRoute);
  };
  const deactivate = () => {
    const documentUrlWithoutRoute = buildUrlFromDocument(removeFromUrl);
    goTo(documentUrlWithoutRoute);
  };

  const enterTaskSet = new Set();
  const enter = async ({ signal }) => {
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
      readyStateSignal.value = ABORTED;
      enterAbortController.abort();
    };
    signal.addEventListener("abort", abort);
    routeAbortEnterMap.set(route, abort);

    isMatchingSignal.value = true;
    readyStateSignal.value = LOADING;
    errorSignal.value = null;
    matchingRouteSet.add(route);
    if (debug) {
      console.log(`"${route.name}": entering route`);
    }
    const promises = [];
    for (const { taskSignal, callback } of enterTaskSet) {
      taskSignal.value = LOADING;
      const callbackPromise = Promise.resolve(
        callback({ signal: enterAbortSignal }),
      );
      enterAbortSignal.addEventListener("abort", () => {
        taskSignal.value = ABORTED;
      });
      promises.push(
        callbackPromise.then(
          (result) => {
            taskSignal.value = { result };
          },
          (e) => {
            // TODO: catch AbortError I guess
            taskSignal.value = { error: e };
            throw e;
          },
        ),
      );
    }
    try {
      await Promise.all(promises);
      readyStateSignal.value = LOADED;
      if (debug) {
        console.log(`"${route.name}": route enter end`);
      }
    } catch (e) {
      readyStateSignal.value = FAILED;
      routeAbortEnterMap.delete(route);
      console.error(`Error while entering route named "${route.name}":`, e);
      reportError(e);
    }
  };
  const reportError = (e) => {
    errorSignal.value = e;
  };
  const leave = () => {
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
    isMatchingSignal.value = false;
    readyStateSignal.value = IDLE;
    matchingRouteSet.delete(route);
  };

  const addEnterTask = (callback) => {
    const taskSignal = signal(IDLE);
    enterTaskSet.add({ taskSignal, callback });
    return taskSignal;
  };

  if (load) {
    const loadTaskSignal = addEnterTask(load);
    route.loadTaskSignal = loadTaskSignal;
  }

  Object.assign(route, {
    name,
    urlSignal,
    test,
    enter,
    leave,

    isMatchingSignal,
    readyStateSignal,
    errorSignal,
    dataMapSignal,

    reportError,
    addEnterTask,
    activate,
    deactivate,
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
    const nextMatchingRouteReadyState =
      nextMatchingRoute.readyStateSignal.peek();
    const nextMatchingRouteError = nextMatchingRoute.errorSignal.peek();
    if (
      reload ||
      !matchingRouteSet.has(nextMatchingRoute) ||
      nextMatchingRouteReadyState === ABORTED ||
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
      const loadReturnValue = routeToEnter.enter({
        signal: stopSignal,
      });
      const loadPromise = Promise.resolve(loadReturnValue);
      promises.push(loadPromise);
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

export const useRouteUrl = (route) => {
  const routeUrl = route.urlSignal.value;
  return routeUrl;
};
export const useRouteReadyState = (route) => {
  const readyState = route.readyStateSignal.value;
  if (readyState === IDLE) {
    return "idle";
  }
  if (readyState === LOADING) {
    return "loading";
  }
  if (readyState === ABORTED) {
    return "aborted";
  }
  if (readyState.error) {
    return "load_error";
  }
  return "loaded";
};
export const useRouteIsMatching = (route) => {
  return route.isMatchingSignal.value;
};
export const useRouteIsLoading = (route) => {
  return route.readyStateSignal.value === LOADING;
};
export const useRouteLoadIsAborted = (route) => {
  return route.readyStateSignal.value === ABORTED;
};
export const useRouteError = (route) => {
  return route.errorSignal.value;
};
export const useRouteLoadError = (route) => {
  const readyState = route.readyStateSignal.value;
  const error = route.errorSignal.value;
  return readyState === FAILED ? error : null;
};
export const useRouteIsLoaded = (route) => {
  return route.readyStateSignal.value === LOADED;
};
export const useRouteLoadData = (route) => {
  const { loadTaskSignal } = route;
  if (loadTaskSignal) {
    const loadTaskValue = loadTaskSignal.value;
    if (loadTaskValue === LOADING) {
      return undefined;
    }
    if (loadTaskValue === ABORTED) {
      return undefined;
    }
    if (loadTaskValue.error) {
      return undefined;
    }
    return loadTaskValue.result;
  }
  return undefined;
};
