/**
 *
 * . Refactor les actions pour qu'elles utilisent use. Ce qui va ouvrir la voie pour
 * Suspense et ErrorBoundary sur tous les composants utilisant des actions
 *
 * . Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 * 3. Ajouter la possibilite d'avoir des action sur les routes
 * Tester juste les data pour commencer
 * On aura ptet besoin d'un useRouteData au lieu de passer par un element qui est une fonction
 * pour que react ne re-render pas tout
 *
 * 4. Utiliser use() pour compar Suspense et ErrorBoundary lorsque route action se produit.
 *
 *
 */

import { createPubSub, getElementSignature } from "@jsenv/dom";
import { signal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { useUITransitionContentId } from "../ui_transition/ui_transition.jsx";
import { replaceUrl } from "./browser_integration/browser_integration.js";
import { useDocumentUrl } from "./browser_integration/document_url_signal.js";
import { useForceRender } from "./use_force_render.js";

const DEBUG = false;
const debug = (...args) => {
  if (!DEBUG) return;
  console.debug(...args);
};

// Check if a route is a "parent" route (catches multiple routes) and if current URL matches exactly
const isParentRouteExactMatch = (route) => {
  if (!route) {
    return false;
  }
  const currentUrl = window.location.href;
  const parentUrl = route.buildUrl();
  if (currentUrl === parentUrl) {
    return true;
  }
  const currentUrlObject = new URL(currentUrl);
  if (!currentUrlObject.pathname.endsWith("/")) {
    return false;
  }
  const pathnameWithoutSlash = currentUrlObject.pathname.slice(0, -1);
  currentUrlObject.pathname = pathnameWithoutSlash;
  const currentUrlWithoutTrailingSlash = currentUrlObject.href;
  return currentUrlWithoutTrailingSlash === parentUrl;
};

const RootElement = () => {
  return <Route.Slot />;
};
const SlotContext = createContext(null);
const RouteInfoContext = createContext(null);

export const Routes = ({ element = RootElement, children }) => {
  const routeInfo = useMatchingRouteInfo();
  const route = routeInfo?.route;

  return (
    <Route route={route} element={element}>
      {children}
    </Route>
  );
};

export const useMatchingRouteInfo = () => useContext(RouteInfoContext);
export const Route = ({
  element,
  route,
  index,
  fallback,
  meta,
  children,
  routeParams,
}) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const matchingInfoRef = useRef(null);

  if (!hasDiscoveredRef.current) {
    return (
      <MatchingRouteManager
        element={element}
        route={route}
        index={index}
        fallback={fallback}
        meta={meta}
        routeParams={routeParams}
        onMatchingInfoChange={(matchingInfo) => {
          hasDiscoveredRef.current = true;
          matchingInfoRef.current = matchingInfo;
          forceRender();
        }}
      >
        {children}
      </MatchingRouteManager>
    );
  }

  const matchingInfo = matchingInfoRef.current;
  if (!matchingInfo) {
    return null;
  }
  const { MatchingElement } = matchingInfo;
  return <MatchingElement />;
};

const RegisterChildRouteContext = createContext(null);

/* This component is ensure to be rendered once
So no need to cleanup things or whatever we know and ensure that 
it's executed once for the entire app lifecycle */
const MatchingRouteManager = ({
  element,
  route,
  index,
  fallback,
  meta,
  routeParams,
  onMatchingInfoChange,
  children,
}) => {
  if (route && fallback) {
    throw new Error("Route cannot have both route and fallback props");
  }

  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);
  const elementId = getElementSignature(element);
  const candidateSet = new Set();
  let indexCandidate = null;
  let fallbackCandidate = null;
  const registerChildRoute = (childRouteInfo) => {
    const childElementId = getElementSignature(childRouteInfo.element);
    debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add(childRouteInfo);

    if (childRouteInfo.index) {
      if (indexCandidate) {
        throw new Error(`Multiple index routes registered under the same parent route (${elementId}):
- ${getElementSignature(indexCandidate.element)}
- ${childElementId}`);
      }
      indexCandidate = childRouteInfo;
    }
    if (childRouteInfo.fallback) {
      if (fallbackCandidate) {
        throw new Error(`Multiple fallback routes registered under the same parent route (${elementId}):
- ${getElementSignature(fallbackCandidate.element)}
- ${childElementId}`);
      }
      if (childRouteInfo.route.routeFromProps) {
        throw new Error(
          `Fallback route cannot have a route prop (${childElementId})`,
        );
      }
      fallbackCandidate = childRouteInfo;
    }
  };
  if (DEBUG) {
    console.group(`👶 Discovery of ${elementId}`);
  }
  useLayoutEffect(() => {
    if (DEBUG) {
      console.groupEnd();
    }
    initRouteObserver({
      element,
      route,
      index,
      fallback,
      meta,
      routeParams,
      indexCandidate,
      fallbackCandidate,
      candidateSet,
      onMatchingInfoChange,
      registerChildRouteFromContext,
    });
  }, []);

  return (
    <RegisterChildRouteContext.Provider value={registerChildRoute}>
      {children}
    </RegisterChildRouteContext.Provider>
  );
};

const initRouteObserver = ({
  element,
  route,
  index,
  fallback,
  meta,
  routeParams,
  indexCandidate,
  fallbackCandidate,
  candidateSet,
  onMatchingInfoChange,
  registerChildRouteFromContext,
}) => {
  if (
    !fallbackCandidate &&
    indexCandidate &&
    indexCandidate.fallback !== false
  ) {
    // no fallback + an index -> index behaves as a fallback (handle urls under a parent when no sibling matches)
    // to disable this behavior set fallback={false} on the index route
    // (in that case no route will be rendered when no child matches meaning only parent route element will be shown)
    fallbackCandidate = indexCandidate;
  }

  const [teardown, addTeardown] = createPubSub();

  const elementId = getElementSignature(element);
  const candidateElementIds = Array.from(candidateSet, (c) =>
    getElementSignature(c.element),
  );
  if (candidateElementIds.length === 0) {
    debug(`initRouteObserver ${elementId}, no children`);
  } else {
    debug(
      `initRouteObserver ${elementId}, child candidates:
  - ${candidateElementIds.join("\n  - ")}`,
    );
  }
  const [publishCompositeStatus, subscribeCompositeStatus] = createPubSub();
  const compositeRoute = {
    urlPattern: `composite(${candidateElementIds})`,
    isComposite: true,
    matching: false,
    subscribeStatus: subscribeCompositeStatus,
    toString: () => `composite(${candidateSet.size} candidates)`,
    routeFromProps: route,
    elementFromProps: element,
  };

  const findMatchingChildInfo = () => {
    for (const candidate of candidateSet) {
      if (candidate.route?.matching) {
        return candidate;
      }
    }
    if (indexCandidate) {
      if (indexCandidate === fallbackCandidate) {
        // the index is also used as fallback (catch all routes under a parent)
        return indexCandidate;
      }
      // Only return the index candidate if the current URL matches exactly the parent route
      // This allows fallback routes to handle non-defined URLs under this parent route
      if (route && isParentRouteExactMatch(route)) {
        return indexCandidate;
      }
    }
    if (fallbackCandidate) {
      return fallbackCandidate;
    }
    return null;
  };
  const getMatchingInfo = route
    ? () => {
        if (!route.matching) {
          // we have a route and it does not match no need to go further
          return null;
        }

        // Check if routeParams match current route parameters
        if (routeParams && !route.matchesParams(routeParams)) {
          return null; // routeParams don't match, don't render
        }

        // we have a route and it is matching
        // we search the first matching child to put it in the slot
        const matchingChildInfo = findMatchingChildInfo();
        if (matchingChildInfo) {
          return matchingChildInfo;
        }
        return {
          route,
          element: null,
          meta,
        };
      }
    : () => {
        // we don't have a route, do we have a matching child?
        const matchingChildInfo = findMatchingChildInfo();
        if (matchingChildInfo) {
          return matchingChildInfo;
        }
        return null;
      };

  const matchingRouteInfoSignal = signal();
  const SlotMatchingElementSignal = signal();
  const MatchingElement = () => {
    const matchingRouteInfo = matchingRouteInfoSignal.value;
    useUITransitionContentId(
      matchingRouteInfo
        ? matchingRouteInfo.route.urlPattern
        : fallback
          ? "fallback"
          : undefined,
    );
    const SlotMatchingElement = SlotMatchingElementSignal.value;
    if (typeof element === "function") {
      const Element = element;
      element = <Element />;
    }
    // ensure we re-render on document url change (useful when navigating from /users/list to /users)
    // so that we re-replace urls back to /users/list when /users/list is an index
    useDocumentUrl();

    if (
      matchingRouteInfo &&
      matchingRouteInfo.index &&
      !matchingRouteInfo.route.matching
    ) {
      const routeUrl = matchingRouteInfo.route.routeFromProps.buildUrl();
      replaceUrl(routeUrl);
    }

    return (
      <RouteInfoContext.Provider value={matchingRouteInfo}>
        <SlotContext.Provider value={SlotMatchingElement}>
          {element}
        </SlotContext.Provider>
      </RouteInfoContext.Provider>
    );
  };
  MatchingElement.underlyingElementId =
    candidateSet.size === 0
      ? `${getElementSignature(element)} without slot`
      : `[${getElementSignature(element)} with slot one of ${candidateElementIds}]`;

  const updateMatchingInfo = () => {
    const newMatchingInfo = getMatchingInfo();
    if (newMatchingInfo) {
      compositeRoute.matching = true;
      matchingRouteInfoSignal.value = newMatchingInfo;
      SlotMatchingElementSignal.value = newMatchingInfo.element;
      onMatchingInfoChange({
        route: newMatchingInfo.route,
        MatchingElement,
        SlotMatchingElement: newMatchingInfo.element,
        index: newMatchingInfo.index,
        fallback: newMatchingInfo.fallback,
        meta: newMatchingInfo.meta,
      });
    } else {
      compositeRoute.matching = false;
      matchingRouteInfoSignal.value = null;
      SlotMatchingElementSignal.value = null;
      onMatchingInfoChange(null);
    }
  };
  const onChange = () => {
    updateMatchingInfo();
    publishCompositeStatus();
  };
  if (route) {
    if (DEBUG) {
      console.debug(`${elementId} subscribing to ${route}`);
    }
    addTeardown(route.subscribeStatus(onChange));
  }
  for (const candidate of candidateSet) {
    if (DEBUG) {
      console.debug(
        `${elementId} subscribing to child candidate ${candidate.route}`,
      );
    }
    addTeardown(candidate.route.subscribeStatus(onChange));
  }
  if (registerChildRouteFromContext) {
    registerChildRouteFromContext({
      route: compositeRoute,
      element: MatchingElement,
      index,
      fallback,
      meta,
    });
  }
  updateMatchingInfo();

  return () => {
    teardown();
  };
};

export const RouteSlot = () => {
  const SlotElement = useContext(SlotContext);
  if (SlotElement === undefined) {
    return <p>RouteSlot must be used inside a Route</p>;
  }
  if (SlotElement === null) {
    return null;
  }
  return <SlotElement />;
};
Route.Slot = RouteSlot;
