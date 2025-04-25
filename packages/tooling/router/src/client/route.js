import { batch, effect, signal } from "@preact/signals";
import { createResourcePattern } from "../shared/resource_pattern.js";
import { createRoutes } from "../shared/routes.js";
import {
  endDocumentRouting,
  startDocumentRouting,
} from "./document_routing.js";
import { documentUrlSignal } from "./document_url.js";
import { normalizeUrl } from "./normalize_url.js";
import { goTo, installNavigation } from "./router.js";

let debug = true;
let debugDocumentRouting = true;
const IDLE = { id: "idle" };
const LOADING = { id: "loading" };
const ABORTED = { id: "aborted" };
const LOADED = { id: "loaded" };
const FAILED = { id: "failed" };

// const getDocumentUrl = () => {
//   const documentUrl = documentUrlSignal.value;
//   const documentUrlObject = new URL(documentUrl);
//   documentUrlObject.search = "";
//   return documentUrlObject;
// };

let baseUrl = window.location.origin;
export const setBaseUrl = (v) => {
  const urlObject = new URL(v);
  urlObject.search = "";
  baseUrl = urlObject.href;
};

let routerUIReady = false;
let resolveRouterUIReadyPromise;
const routerUIReadyPromise = new Promise((resolve) => {
  resolveRouterUIReadyPromise = () => {
    routerUIReady = true;
    resolve();
  };
});
export const onRouterUILoaded = () => {
  resolveRouterUIReadyPromise();
};
const routeSet = new Set();
const matchingRouteSet = new Set();
const routeAbortEnterMap = new Map();
const createAndRegisterRoute = ({
  methodPattern,
  resourcePattern,
  handler,
}) => {
  resourcePattern = resourceFromUrl(resourcePattern);
  const resourcePatternParsed = createResourcePattern(resourcePattern);
  const route = {
    methodPattern,
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
    isMatchingSignal: signal(false),
    loadingStateSignal: signal(IDLE),
    errorSignal: signal(null),
    dataSignal: signal(undefined),
    error: null,
    data: undefined,
    params: {},
    match: ({ method, resource }) => {
      if (route.methodPattern !== method && route.methodPattern !== "*") {
        return false;
      }
      const matchResult = resourcePatternParsed.match(resource);
      if (!matchResult) {
        return false;
      }
      return matchResult;
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
          const { named, stars } = resourcePatternParsed.match(resource);
          const params = { ...named, ...stars };
          const data = await route.loadData({
            signal: enterAbortSignal,
            params,
            formData,
          });
          route.dataSignal.value = data;
        })();
        const loadUIPromise = (async () => {
          if (!routerUIReady) {
            await routerUIReadyPromise;
          }
          if (!route.loadUI) {
            return;
          }
          if (enterAbortSignal.aborted) {
            return;
          }
          await route.loadUI({ signal: enterAbortSignal });
        })();

        await loadDataPromise;
        await loadUIPromise;
        route.loadingStateSignal.value = LOADED;

        const renderUIPromise = (async () => {
          if (!route.renderUI) {
            return;
          }
          if (enterAbortSignal.aborted) {
            return;
          }
          route.node = await route.renderUI();
        })();
        await renderUIPromise;

        if (debug) {
          console.log(`"${route}": route enter end`);
        }
        routeAbortEnterMap.delete(route);
      } catch (e) {
        batch(() => {
          route.reportError(e);
          route.loadingStateSignal.value = FAILED;
        });
        routeAbortEnterMap.delete(route);
        throw e;
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
      if (route.methodPattern === "*" && route.resourcePattern === "*") {
        return "*";
      }
      return `${route.methodPattern} ${route.resourcePattern}`;
    },
    // Not working by design because there is no room
    // to call addRoutePreventingThisOne before navigating to routes
    routePreventingThisOneSet: new Set(),
    addRoutePreventingThisOne: (otherRoute) => {
      route.routePreventingThisOneSet.add(otherRoute);
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
    const documentResource = resourceFromUrl(documentUrl);
    route.params = route.match({ method: "GET", resource: documentResource });
  });
  routeSet.add(route);
  return route;
};
export const registerRoutes = (description) => {
  const routes = createRoutes(description, createAndRegisterRoute);
  installNavigation({ applyRouting, routingWhile });
  return routes;
};

/**
 *
 */

const applyRouting = async ({
  method,
  // maybe rename url into resource (because we can't do anything about url outside out domain I guess? TO BE TESTED)
  sourceUrl,
  targetUrl,
  formData,
  state,
  stopSignal,
  reload,
}) => {
  const sourceResource = resourceFromUrl(sourceUrl);
  const targetResource = resourceFromUrl(targetUrl);
  if (debug) {
    console.log(
      `start routing ${method} ${targetResource} against ${routeSet.size} routes`,
    );
  }
  const nextMatchingRouteSet = new Set();
  const matchRouteAgainst = (route, methodCandidate, resourceCandidate) => {
    const urlObject = new URL(resourceCandidate, baseUrl);
    const matchParams = {
      method: methodCandidate,
      resource: resourceCandidate,
      state,
      searchParams: urlObject.searchParams,
      pathname: urlObject.pathname,
      hash: urlObject.hash,
      formData,
    };
    return route.match(matchParams);
  };

  for (const routeCandidate of routeSet) {
    const isMatchingTargetUrl = matchRouteAgainst(
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
      console.log("no route has matched");
    }
  }
  const routeToLeaveSet = new Set();
  const routeToEnterSet = new Set();
  for (const nextMatchingRoute of nextMatchingRouteSet) {
    let otherRoutePreventingThisOne = null;
    for (const routePreventingThisOne of nextMatchingRoute.routePreventingThisOneSet) {
      if (nextMatchingRouteSet.has(routePreventingThisOne)) {
        otherRoutePreventingThisOne = routePreventingThisOne;
        break;
      }
    }
    if (otherRoutePreventingThisOne) {
      nextMatchingRouteSet.delete(nextMatchingRoute);
      if (debug) {
        console.log(
          `${nextMatchingRoute.methodPattern} ${nextMatchingRoute.resourcePattern}: prevented by ${otherRoutePreventingThisOne.resourcePattern}`,
        );
      }
    } else {
      const isAborted = nextMatchingRoute.loadingStateSignal.peek() === ABORTED;
      const hasError = nextMatchingRoute.errorSignal.peek();
      if (reload) {
        routeToEnterSet.add(nextMatchingRoute);
      } else if (isAborted) {
        routeToEnterSet.add(nextMatchingRoute);
      } else if (hasError) {
        routeToEnterSet.add(nextMatchingRoute);
      } else if (matchingRouteSet.has(nextMatchingRoute)) {
        routeToLeaveSet.add(nextMatchingRoute);
        routeToEnterSet.add(nextMatchingRoute);
      } else {
        routeToEnterSet.add(nextMatchingRoute);
      }
    }
  }
  for (const activeRoute of matchingRouteSet) {
    if (nextMatchingRouteSet.has(activeRoute)) {
      continue;
    }
    if (sourceResource !== targetResource) {
      // when we route to a new url but we stay on the current url
      // until routing is done (POST/PATCH/PUT) (what about DELETE?)
      // then we keep the route active during that time
      if (matchRouteAgainst(activeRoute, "GET", sourceResource)) {
        if (debug) {
          console.log(
            `${activeRoute.methodPattern} ${activeRoute.resourcePattern}: stays active while navigating to ${targetResource}`,
          );
        }
        continue;
      }
    }
    routeToLeaveSet.add(activeRoute);
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
  await routingWhile(async () => {
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
  });
};
const routingWhile = async (fn, ...args) => {
  startDocumentRouting();
  try {
    await fn(...args);
  } finally {
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
