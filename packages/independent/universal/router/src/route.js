import { computed, signal } from "@preact/signals";
import {
  endDocumentNavigation,
  startDocumentNavigation,
} from "./document_navigating.js";
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
const createRoute = (name, { urlTemplate, load = () => {} } = {}) => {
  const documentRootUrl = new URL("/", window.location.origin);
  const routeUrlInstance = new URL(urlTemplate, documentRootUrl);

  let routePathname;
  let routeSearchParams;
  if (routeUrlInstance.pathname !== "/") {
    routePathname = routeUrlInstance.pathname;
  }
  if (routeUrlInstance.searchParams.toString() !== "") {
    routeSearchParams = routeUrlInstance.searchParams;
  }
  const test = ({ pathname, searchParams }) => {
    if (urlTemplate) {
      if (routePathname && !pathname.startsWith(routePathname)) {
        return false;
      }
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
  const readyStateSignal = signal(IDLE);
  const isActiveSignal = computed(() => {
    return readyStateSignal.value !== IDLE;
  });

  const onLeave = () => {
    readyStateSignal.value = IDLE;
  };
  const onEnter = () => {
    readyStateSignal.value = LOADING;
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
    readyStateSignal,
    isActiveSignal,
  };
};
export const registerRoutes = ({ fallback, ...rest }) => {
  const routes = {};
  for (const key of Object.keys(rest)) {
    const route = createRoute(key, rest[key]);
    routeSet.add(route);
    routes[key] = route;
  }
  if (fallback) {
    fallbackRoute = createRoute(fallback);
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
const activeRouteSet = new Set();
export const applyRouting = async ({ url, state, signal }) => {
  startDocumentNavigation();
  const nextActiveRouteSet = new Set();
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
      nextActiveRouteSet.add(routeCandidate);
    }
  }
  if (nextActiveRouteSet.size === 0) {
    nextActiveRouteSet.add(fallbackRoute);
  }
  const routeToLeaveSet = new Set();
  const routeToEnterSet = new Set();
  for (const activeRoute of activeRouteSet) {
    if (!nextActiveRouteSet.has(activeRoute)) {
      routeToLeaveSet.add(activeRoute);
    }
  }
  for (const nextActiveRoute of nextActiveRouteSet) {
    if (!activeRouteSet.has(nextActiveRoute)) {
      routeToEnterSet.add(nextActiveRoute);
    }
  }
  nextActiveRouteSet.clear();
  for (const routeToLeave of routeToLeaveSet) {
    if (debug) {
      console.log(`"${routeToLeave.name}": leaving route`);
    }
    activeRouteSet.delete(routeToLeave);
    routeToLeave.onLeave();
  }

  signal.addEventListener("abort", () => {
    for (const activeRoute of activeRouteSet) {
      activeRoute.onAbort();
    }
    endDocumentNavigation();
  });

  try {
    const promises = [];
    for (const routeToEnter of routeToEnterSet) {
      if (debug) {
        console.log(`"${routeToEnter.name}": entering route`);
      }
      activeRouteSet.add(routeToEnter);
      routeToEnter.onEnter();
      const loadPromise = Promise.resolve(routeToEnter.load({ signal }));
      loadPromise.then(
        () => {
          routeToEnter.onLoadEnd();
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
    endDocumentNavigation();
  }
};

export const useRouteUrl = (route) => {
  const routeUrl = route.urlSignal.value;
  return routeUrl;
};
export const useRouteIsActive = (route) => {
  return route.readyStateSignal.value !== IDLE;
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
