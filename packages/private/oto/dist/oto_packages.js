import { A, d, _, q, y, d$1, w, T } from "/oto_node_modules.js";

const useFontFace = (
  family,
  { url, style = "normal", weight = "normal", stretch = "condensed" },
) => {
  const fontRef = A(false);
  const [fontReady, fontReadySetter] = d(false);
  if (!fontRef.current) {
    const font = new FontFace(family, `url(${url})`, {
      style,
      weight,
      stretch,
    });
    fontRef.current = font;
    font.load().then(() => {
      document.fonts.add(font);
      fontReadySetter(true);
    });
  }
  return fontReady;







};

const useResizeObserver = (
  {
    ref,
    getElementToObserve = (refElement) => refElement,
    onResize,
    ignoreInitial = false,
  },
  deps = [],
) => {
  const [size, sizeSetter] = d({
    width: undefined,
    height: undefined,
  });
  const isMountedRef = A(false);
  const previousSizeRef = A(size);
  const getElementToObserveRef = A(getElementToObserve);
  const elementToObserveRef = A(null);

  _(() => {
    let elementToObserve = ref.current;
    if (!elementToObserve) {
      isMountedRef.current = false;
      return null;
    }
    elementToObserve = getElementToObserveRef.current(elementToObserve);
    if (!elementToObserve) {
      isMountedRef.current = false;
      return null;
    }
    elementToObserveRef.current = elementToObserve;
    if (!isMountedRef.current) {
      const boundingClientRect = elementToObserve.getBoundingClientRect();
      const currentSize = {
        width: boundingClientRect.width,
        height: boundingClientRect.height,
      };
      previousSizeRef.current = currentSize;
      if (ignoreInitial) ; else if (onResize) {
        onResize(currentSize, elementToObserve);
      } else {
        sizeSetter(currentSize);
      }
      isMountedRef.current = true;
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [ref, ignoreInitial]);

  const resizeObserverRef = A(null);
  const resizeObserverStateRef = A("idle");
  const observe = q(() => {
    if (resizeObserverStateRef.state === "observing") {
      return;
    }
    let resizeObserver = resizeObserverRef.current;
    const elementToObserve = elementToObserveRef.current;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry) {
          return;
        }
        if (!isMountedRef.current) {

          return;
        }
        const boundingClientRect = elementToObserve.getBoundingClientRect();
        const newSize = {
          width: boundingClientRect.width,
          height: boundingClientRect.height,
        };
        const hasChanged =
          previousSizeRef.current.width !== newSize.width ||
          previousSizeRef.current.height !== newSize.height;
        if (!hasChanged) {
          return;
        }
        previousSizeRef.current = newSize;
        if (onResize) {
          unobserve();
          onResize(newSize, elementToObserve);
          observe();
        } else if (isMountedRef.current) {
          sizeSetter(newSize);
        }
      });
      resizeObserverRef.current = resizeObserver;
    }
    const boundingClientRect = elementToObserve.getBoundingClientRect();
    const currentSize = {
      width: boundingClientRect.width,
      height: boundingClientRect.height,
    };
    previousSizeRef.current = currentSize;
    resizeObserverStateRef.current = "observing";
    resizeObserver.observe(elementToObserve);
  }, [onResize]);
  const unobserve = q(() => {
    if (resizeObserverStateRef.current === "idle") {
      return;
    }
    const resizeObserver = resizeObserverRef.current;
    if (!resizeObserver) {
      return;
    }
    const elementToObserve = elementToObserveRef.current;
    resizeObserverStateRef.current = "idle";
    resizeObserver.unobserve(elementToObserve);
  }, []);

  const performSizeSideEffects = q((callback) => {
    unobserve();
    callback();
    observe();
  }, []);

  y(() => {
    observe();
    return () => {
      const resizeObserver = resizeObserverRef.current;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [ref, observe, unobserve, ...deps]);

  return [size.width, size.height, performSizeSideEffects];
};

const canGoBackSignal = d$1(false);
const updateCanGoBack = (can) => {
  canGoBackSignal.value = can;
};
const updateCanGoForward = (can) => {
  canGoBackSignal.value = can;
};

const documentUrlSignal = d$1(window.location.href);
const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};

const documentIsNavigatingSignal = d$1(false);
const startDocumentNavigation = () => {
  documentIsNavigatingSignal.value = true;
};
const endDocumentNavigation = () => {
  documentIsNavigatingSignal.value = false;
};

const normalizeUrl = (url) => {
  url = String(url);
  if (url.includes("?")) {

    if (url.startsWith("data:")) {
      return url;
    }
    return url.replace(/[=](?=&|$)/g, "");
  }
  return url;
};

const documentIsLoadingSignal = d$1(true);
if (document.readyState === "complete") {
  documentIsLoadingSignal.value = false;
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      documentIsLoadingSignal.value = false;
    }
  });
}

updateCanGoBack(true);
updateCanGoForward(true);
updateDocumentUrl(window.location.href);

const installNavigation$2 = ({ applyRouting }) => {
  window.addEventListener(
    "click",
    (e) => {
      if (e.target.tagName === "A") {
        const href = e.target.href;
        if (href && href.startsWith(window.location.origin)) {
          e.preventDefault();
          window.history.pushState(null, null, e.target.href);
        }
      }
    },
    { capture: true },
  );
  window.addEventListener(
    "submit",
    () => {



    },
    { capture: true },
  );
  window.addEventListener("popstate", async (popstateEvent) => {
    if (abortNavigation) {
      abortNavigation();
    }
    let abortController = new AbortController();
    abortNavigation = () => {
      abortController.abort();
    };
    const url = documentUrlSignal.peek();
    updateDocumentUrl(url);
    const routingPromise = applyRouting({
      url,
      state: popstateEvent.state,
      signal: abortController.signal,
    });
    try {
      await routingPromise;
    } finally {
      abortController = null;
      abortNavigation = null;
    }
  });
  window.history.replaceState(null, null, window.location.href);
};
let abortNavigation;

const goTo$2 = async (url, { state, replace } = {}) => {
  const currentUrl = documentUrlSignal.peek();
  if (url === currentUrl) {
    return;
  }
  if (replace) {
    window.history.replaceState(state, null, url);
  } else {
    window.history.pushState(state, null, url);
  }
};










updateDocumentUrl(navigation.currentEntry.url);
navigation.addEventListener("currententrychange", () => {
  updateDocumentUrl(navigation.currentEntry.url);
});

updateCanGoBack(navigation.canGoBack);
updateCanGoForward(navigation.canGoForward);
navigation.addEventListener("currententrychange", () => {
  updateCanGoBack(navigation.canGoBack);
  updateCanGoForward(navigation.canGoForward);
});
navigation.addEventListener("navigatesuccess", () => {
  updateCanGoBack(navigation.canGoBack);
  updateCanGoForward(navigation.canGoForward);
});

const installNavigation$1 = ({ applyRouting }) => {
  navigation.addEventListener("navigate", (event) => {
    if (!event.canIntercept) {
      return;
    }
    if (event.hashChange || event.downloadRequest !== null) {
      return;
    }
    if (
      !event.userInitiated &&
      event.navigationType === "reload" &&
      event.isTrusted
    ) {


      return;
    }
    const url = event.destination.url;
    const state = event.state;
    const { signal } = event;
    event.intercept({
      handler: async () => {
        await applyRouting({ url, state, signal });
      },
    });
  });
  navigation.navigate(window.location.href, { history: "replace" });
};
const goTo$1 = (url, { state, replace } = {}) => {
  if (replace) {
    navigation.navigate(url, { state, history: "replace" });
    return;
  }
  const currentUrl = documentUrlSignal.peek();
  if (url === currentUrl) {
    return;
  }
  const entries = navigation.entries();
  const prevEntry = entries[navigation.currentEntry.index - 1];
  if (prevEntry && prevEntry.url === url) {
    goBack();
    return;
  }
  const nextEntry = entries[navigation.currentEntry.index + 1];
  if (nextEntry && nextEntry.url === url) {
    goForward();
    return;
  }
  navigation.navigate(url, { state });
};
const goBack = () => {
  navigation.back();
};
const goForward = () => {
  navigation.forward();
};

const canUseNavigation = Boolean(window.navigation);
const installNavigation = canUseNavigation
  ? installNavigation$1
  : installNavigation$2;

const goTo = canUseNavigation ? goTo$1 : goTo$2;

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

  const urlSignal = w(() => {
    return buildUrlFromDocument(addToUrl);
  });
  const readyStateSignal = d$1(IDLE);
  const isActiveSignal = w(() => {
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
const registerRoutes = ({ fallback, ...rest }) => {
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







const activeRouteSet = new Set();
const applyRouting = async ({ url, state, signal }) => {
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
    {
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

w(() => {
  const documentIsLoading = documentIsLoadingSignal.value;
  if (documentIsLoading) {
    return "document_loading";
  }
  const documentIsNavigating = documentIsNavigatingSignal.value;
  if (documentIsNavigating) {
    return "document_navigating";
  }
  return "complete";
});

const useKeyEffect = (keyCallbacks) => {
  const deps = [];
  const keys = Object.keys(keyCallbacks);
  const effects = {};
  for (const key of keys) {
    deps.push(key);
    const keyEffect = keyCallbacks[key];
    if (typeof keyEffect === "function") {
      deps.push(keyEffect);
      effects[key] = { enabled: true, callback: keyEffect };
    } else {
      const { enabled, callback } = keyEffect;
      deps.push(enabled, callback);
      effects[key] = keyEffect;
    }
  }

  y(() => {
    const onKeyDown = (keydownEvent) => {
      const eventKey = keydownEvent.key;
      const keyEffect = effects[eventKey];
      if (keyEffect?.enabled) {
        keydownEvent.preventDefault();
        keyEffect.callback(keydownEvent);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, deps);
};

const useStructuredMemo = (props) => {
  return T(
    () => props,
    Object.keys(props).map((key) => props[key]),
  );
};

const useDrawImage = (
  canvas,
  source,
  { x = 0, y = 0, width, height, opacity = 1, onFirstDraw, onDraw, debug } = {},
) => {
  const firstDrawRef = A(true);
  const draw = () => {
    if (!canvas) return;
    if (typeof source === "function") source = source();
    if (!source) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (width === undefined) {
      width = canvas.width;
    }
    if (height === undefined) {
      height = canvas.height;
    }
    if (debug) {
      console.log("draw image", {
        sx: x,
        sy: y,
        sWidth: width,
        sHeight: height,
        dx: 0,
        dy: 0,
        dWidth: canvas.width,
        dHeight: canvas.height,
      });
    }
    context.globalAlpha = opacity;
    context.drawImage(
      source,
      x,
      y,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    if (onDraw) {
      onDraw();
    }
    if (firstDrawRef.current) {
      firstDrawRef.current = false;
      if (onFirstDraw) {
        onFirstDraw();
      }
    }
  };

  _(() => {
    draw();
  }, [canvas, source, x, y, width, height, opacity, onDraw]);

  return draw;
};

const useSubscription = (get, subscribe) => {
  const [value, valueSetter] = d(get());
  const cleanupRef = A(null);
  if (cleanupRef.current === null) {
    const subscribeReturnValue = subscribe(() => {
      valueSetter(get());
    });
    if (typeof subscribeReturnValue === "function") {
      cleanupRef.current = subscribeReturnValue;
    } else {
      cleanupRef.current = true;
    }
  }
  y(() => {
    return () => {
      const cleanup = cleanupRef.current;
      if (typeof cleanup === "function") {
        cleanup();
      }
      cleanupRef.current = null;
    };
  }, []);
  return value;
};

const useImageLoader = (source) => {
  const dataRef = A({
    image: null,
    loading: false,
    error: null,
  });
  const onLoadStart = () => {
    dataRef.current.loading = true;
  };
  const onLoadError = (image, error) => {
    dataRef.current.image = image;
    dataRef.current.loading = false;
    dataRef.current.error = error;
  };
  const onLoadEnd = (image) => {
    dataRef.current.image = image;
    dataRef.current.loading = false;
  };

  let subscribe;
  if (typeof source === "string" || source instanceof URL) {
    onLoadStart();
    subscribe = (update) => {
      const image = new Image();
      const onerror = (errorEvent) => {
        image.removeEventListener("error", onerror);
        image.removeEventListener("load", onload);
        onLoadError(image, errorEvent);
        update();
      };
      const onload = () => {
        image.removeEventListener("error", onerror);
        image.removeEventListener("load", onload);
        onLoadEnd(image);
        update();
      };
      image.addEventListener("error", onerror);
      image.addEventListener("load", onload);
      image.src = source;
      return () => {
        image.removeEventListener("error", onerror);
        image.removeEventListener("load", onload);
      };
    };
  } else if (
    source instanceof HTMLImageElement ||
    source instanceof SVGImageElement ||
    source instanceof HTMLCanvasElement ||
    source instanceof OffscreenCanvas
  ) {
    onLoadEnd(source);
    subscribe = () => {};
  } else {
    throw new Error("unknown source");
  }

  return useSubscription(() => {
    const { image, loading, error } = dataRef.current;
    if (loading) {
      return [null, null];
    }
    if (error) {
      return [null, error];
    }
    return [image, null];
  }, subscribe);
};



const fromTransformations = ({ flip, translate, rotate, scale }) => {
  let _a = 1;
  let _b = 0;
  let _c = 0;
  let _d = 1;
  let _e = 0;
  let _f = 0;
  const transform = (a, b, c, d, e, f) => {
    _a = _a * a + _c * b;
    _b = _b * a + _d * b;
    _c = _a * c + _c * d;
    _d = _b * c + _d * d;
    _e = _a * e + _c * f + _e;
    _f = _b * e + _d * f + _f;
  };

  if (flip) {
    const { x, y } = flip;
    if (x) {
      transform(-1, 0, 0, 1, 0, 0);
    }
    if (y) {
      transform(1, 0, 0, -1, 0, 0);
    }
  }
  if (translate) {
    const { x, y } = translate;
    if (x !== undefined) {
      transform(1, 0, 0, 1, x, 0);
    }
    if (y !== undefined) {
      transform(1, 0, 0, 1, 0, y);
    }
  }
  if (rotate) {
    const angle = rotate * 0.017453292519943295;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    transform(cos, sin, -sin, cos, 0, 0);
  }
  if (scale) {
    if (typeof scale === "object") {
      const { x, y } = scale;
      if (x !== undefined) {
        transform(x, 0, 0, 1, 0, 0);
      }
      if (y !== undefined) {
        transform(1, 0, 0, y, 0, 0);
      }
    } else {
      transform(scale, 0, 0, scale, 0, 0);
    }
  }

  return [_a, _b, _c, _d, _e, _f];
};

export { fromTransformations, registerRoutes, useDrawImage, useFontFace, useImageLoader, useKeyEffect, useResizeObserver, useStructuredMemo };