import { computed, signal } from "@preact/signals";
import {
  endDocumentRouting,
  startDocumentRouting,
} from "./document_routing.js";
import { documentUrlSignal } from "./document_url.js";
import { normalizeUrl } from "./normalize_url.js";
import { goTo, installNavigation } from "./router.js";

let debug = true;
const IDLE = { id: "idle" };
const LOADING = { id: "loading" };
const ABORTED = { id: "aborted" };

const buildUrlFromDocument = (build) => {
  const documentUrl = documentUrlSignal.value;
  const documentUrlObject = new URL(documentUrl);
  const newDocumentUrl = build(documentUrlObject);
  return normalizeUrl(newDocumentUrl);
};

const routeSet = new Set();
let fallbackRoute;
const createRoute = (name, { urlTemplate, load = () => {} }, { baseUrl }) => {
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

  const onEnter = () => {
    isMatchingSignal.value = true;
    readyStateSignal.value = LOADING;
  };
  const onLeave = () => {
    isMatchingSignal.value = false;
    readyStateSignal.value = IDLE;
  };
  const onAbort = () => {
    readyStateSignal.value = ABORTED;
  };
  const onLoadError = (error) => {
    readyStateSignal.value = {
      error,
    };
  };
  const onLoadEnd = (data) => {
    readyStateSignal.value = {
      data,
    };
  };
  const enter = () => {
    const documentUrlWithRoute = buildUrlFromDocument(addToUrl);
    goTo(documentUrlWithRoute);
  };
  const leave = () => {
    const documentUrlWithoutRoute = buildUrlFromDocument(removeFromUrl);
    goTo(documentUrlWithoutRoute);
  };

  return {
    name,
    urlSignal,
    test,
    load,
    enter,
    leave,

    onLeave,
    onEnter,
    onAbort,
    onLoadError,
    onLoadEnd,
    isMatchingSignal,
    readyStateSignal,
  };
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

/*
 * TODO:
 * - each route should have its own signal
 *   because when navigating to a new url the route might still be relevant
 *   in that case we don't want to abort it
 */
const matchingRouteSet = new Set();
export const applyRouting = async ({ url, state, signal }) => {
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
    if (!matchingRouteSet.has(nextMatchingRoute)) {
      routeToEnterSet.add(nextMatchingRoute);
    }
  }
  nextMatchingRouteSet.clear();
  for (const routeToLeave of routeToLeaveSet) {
    if (debug) {
      console.log(`"${routeToLeave.name}": leaving route`);
    }
    matchingRouteSet.delete(routeToLeave);
    routeToLeave.onLeave();
  }
  if (routeToEnterSet.size === 0) {
    if (debug) {
      console.log("no effect on routes, early return");
    }
    return;
  }
  if (debug) {
    console.log("routing started");
  }
  startDocumentRouting();
  signal.addEventListener("abort", () => {
    if (debug) {
      console.log("routing aborted");
    }
    for (const matchingRoute of matchingRouteSet) {
      matchingRoute.onAbort();
    }
    endDocumentRouting();
  });

  try {
    const promises = [];
    for (const routeToEnter of routeToEnterSet) {
      if (debug) {
        console.log(`"${routeToEnter.name}": entering route`);
      }
      matchingRouteSet.add(routeToEnter);
      routeToEnter.onEnter();
      const loadPromise = Promise.resolve(routeToEnter.load({ signal }));
      loadPromise.then(
        (value) => {
          routeToEnter.onLoadEnd(value);
          if (debug) {
            console.log(`"${routeToEnter.name}": route load end`);
          }
        },
        (e) => {
          routeToEnter.onLoadError(e);
          throw e;
        },
      );
      promises.push(loadPromise);
    }
    await Promise.all(promises);
  } finally {
    if (debug) {
      console.log("routing ended");
    }
    endDocumentRouting();
  }
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
export const useRouteLoadError = (route) => {
  return route.readyStateSignal.value.error;
};
export const useRouteLoadData = (route) => {
  return route.readyStateSignal.value.data;
};
