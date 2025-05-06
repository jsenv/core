import { batch, effect, signal } from "@preact/signals";
import { createResourcePattern } from "../shared/resource_pattern.js";
import {
  endDocumentRouting,
  startDocumentRouting,
} from "./document_routing.js";
import { documentUrlSignal } from "./document_url.js";
import { normalizeUrl } from "./normalize_url.js";
import { goTo, installNavigation } from "./router.js";
import { IDLE, LOADING, ABORTED, LOADED, FAILED } from "./route_status.js";

let debug = true;
let debugDocumentRouting = true;

// const getDocumentUrl = () => {
//   const documentUrl = documentUrlSignal.value;
//   const documentUrlObject = new URL(documentUrl);
//   documentUrlObject.search = "";
//   return documentUrlObject;
// };

let baseUrl = import.meta.dev
  ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
  : window.location.origin;
export const setBaseUrl = (v) => {
  const urlObject = new URL(v);
  urlObject.search = "";
  baseUrl = urlObject.href;
};

let routerUIReady = false;
export const onRouterUILoaded = () => {
  if (routerUIReady) {
    return;
  }
  routerUIReady = true;
  installNavigation({ applyRouting, routingWhile });
};
const routeSet = new Set();
const matchingRouteSet = new Set();
const routeAbortEnterMap = new Map();
const createAndRegisterRoute = ({
  methodPattern,
  resourcePattern,
  handler,
  isAction,
}) => {
  const enter = async ({ signal, resource, formAction, formData }) => {
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

    route.isMatchingSignal.value = true;
    route.loadingStateSignal.value = LOADING;
    route.errorSignal.value = null;
    matchingRouteSet.add(route);
    if (debug) {
      console.log(`"${route}": entering route`);
    }

    if (formAction) {
      formAction.isMatchingSignal.value = true;
      formAction.loadingStateSignal.value = true;
      formAction.errorSignal.value = null;
    }

    try {
      const promisesToWait = [];
      if (route.loadData && !enterAbortSignal.aborted) {
        const loadDataPromise = (async () => {
          const { named, stars } = resourcePatternParsed.match(resource);
          const params = { ...named, ...stars };
          const data = await route.loadData({
            signal: enterAbortSignal,
            params,
            formData,
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
      if (formAction) {
        formAction.loadingStateSignal.value = LOADED;
      }
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
        if (formAction) {
          formAction.loadingStateSignal.value = FAILED;
        }
        route.loadingStateSignal.value = ABORTED;
        return;
      }
      batch(() => {
        route.reportError(e);
        route.loadingStateSignal.value = FAILED;
        if (formAction) {
          formAction.loadingStateSignal.value = FAILED;
          formAction.errorSignal.value = e;
        }
      });
      throw e;
    }
  };
  const reportError = (e) => {
    route.errorSignal.value = e;
  };
  const leave = (reason) => {
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
    route.isMatchingSignal.value = false;
    route.loadingStateSignal.value = IDLE;
    matchingRouteSet.delete(route);
  };

  if (isAction) {
    const route = {
      loadData: handler,
      loadUI: null,
      renderUI: null,
      node: null,
      isMatchingSignal: signal(false),
      loadingStateSignal: signal(IDLE),
      errorSignal: signal(null),
      error: null,
      match: ({ formAction }) => formAction.route === route,
      enter,
      leave,
      reportError,
      toString: () => handler.name,
    };
    effect(() => {
      route.error = route.errorSignal.value;
    });
    routeSet.add(route);
    return route;
  }
  methodPattern = methodPattern.toUpperCase();
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
      if (
        route.methodPattern !== method.toUpperCase() &&
        route.methodPattern !== "*"
      ) {
        return false;
      }
      const matchResult = resourcePatternParsed.match(resource);
      if (!matchResult) {
        return false;
      }
      return matchResult;
    },
    enter,
    leave,
    reportError,
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
export const registerRoute = (resourcePattern, handler) => {
  const route = createAndRegisterRoute({
    methodPattern: "GET",
    resourcePattern,
    handler,
  });
  return route;
};
export const registerAction = (fn) => {
  const action = createAndRegisterRoute({
    handler: fn,
    isAction: true,
  });
  return action;
};

const applyRouting = async ({
  method,
  // maybe rename url into resource (because we can't do anything about url outside out domain I guess? TO BE TESTED)
  // sourceUrl,
  targetUrl,
  formData,
  state,
  stopSignal,
  isReload,
  isReplace,
}) => {
  // const sourceResource = resourceFromUrl(sourceUrl);
  const targetResource = resourceFromUrl(targetUrl);
  if (debug) {
    console.log(
      `start routing ${method} ${targetResource} against ${routeSet.size} routes`,
    );
  }

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
      formAction,
    };
    return route.match(matchParams);
  };

  const nextMatchingRouteSet = new Set();
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
  let nextMatchFullyOffscreen = true;
  for (const nextMatchingRoute of nextMatchingRouteSet) {
    if (nextMatchingRoute.loadUI || nextMatchingRoute.renderUI) {
      nextMatchFullyOffscreen = false;
    }
    const isAborted = nextMatchingRoute.loadingStateSignal.peek() === ABORTED;
    const hasError = nextMatchingRoute.errorSignal.peek();
    if (isReload) {
      routeToEnterSet.add(nextMatchingRoute);
    } else if (isAborted) {
      routeToEnterSet.add(nextMatchingRoute);
    } else if (hasError) {
      routeToEnterSet.add(nextMatchingRoute);
    } else if (matchingRouteSet.has(nextMatchingRoute)) {
      if (isReplace) {
      } else {
        routeToLeaveSet.add(nextMatchingRoute);
        routeToEnterSet.add(nextMatchingRoute);
      }
    } else {
      routeToEnterSet.add(nextMatchingRoute);
    }
  }
  for (const activeRoute of matchingRouteSet) {
    if (nextMatchingRouteSet.has(activeRoute)) {
      continue;
    }
    if (nextMatchFullyOffscreen) {
      if (debug) {
        console.log(
          `${activeRoute.methodPattern} ${activeRoute.resourcePattern}: stays active while navigating to ${targetResource}`,
        );
      }
      continue;
    }
    routeToLeaveSet.add(activeRoute);
  }
  nextMatchingRouteSet.clear();
  for (const routeToLeave of routeToLeaveSet) {
    const firstRoute = Array.from(routeToEnterSet.values())[0];
    routeToLeave.leave(`Navigating to ${firstRoute}`);
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
        formAction,
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
