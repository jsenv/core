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
  if (!route || !route.urlPattern) {
    return false;
  }

  const pattern = route.urlPattern;

  // Check if this looks like a parent route (contains wildcards like {/}?* or /*)
  const isParentRoute = pattern.includes("*") || pattern.includes("{/}");

  if (!isParentRoute) {
    return false;
  }

  // Get the base pattern without wildcards
  const basePattern = pattern
    .replace("{/}?*", "") // Remove {/}?* wildcard
    .replace("/*", "") // Remove /* wildcard
    .replace("*", ""); // Remove any remaining * wildcard

  const currentUrl = window.location.pathname;

  // Check exact match: "monitoring" -> yes, "monitoring/" -> yes, "monitoring/any" -> no
  return currentUrl === basePattern || currentUrl === `${basePattern}/`;
};

const RootElement = () => {
  return <Route.Slot />;
};
const SlotContext = createContext(null);
const RouteInfoContext = createContext(null);

export const Routes = ({ element = RootElement, children }) => {
  const routeInfo = useActiveRouteInfo();
  const route = routeInfo?.route;

  return (
    <Route route={route} element={element}>
      {children}
    </Route>
  );
};

export const useActiveRouteInfo = () => useContext(RouteInfoContext);
export const Route = ({ element, route, index, fallback, meta, children }) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const activeInfoRef = useRef(null);

  if (!hasDiscoveredRef.current) {
    return (
      <ActiveRouteManager
        element={element}
        route={route}
        index={index}
        fallback={fallback}
        meta={meta}
        onActiveInfoChange={(activeInfo) => {
          hasDiscoveredRef.current = true;
          activeInfoRef.current = activeInfo;
          forceRender();
        }}
      >
        {children}
      </ActiveRouteManager>
    );
  }

  const activeInfo = activeInfoRef.current;
  if (!activeInfo) {
    return null;
  }
  const { ActiveElement } = activeInfo;
  return <ActiveElement />;
};

const RegisterChildRouteContext = createContext(null);

/* This component is ensure to be rendered once
So no need to cleanup things or whatever we know and ensure that 
it's executed once for the entier app lifecycle */
const ActiveRouteManager = ({
  element,
  route,
  index,
  fallback,
  meta,
  onActiveInfoChange,
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
      indexCandidate,
      fallbackCandidate,
      candidateSet,
      onActiveInfoChange,
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
  indexCandidate,
  fallbackCandidate,
  candidateSet,
  onActiveInfoChange,
  registerChildRouteFromContext,
}) => {
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
    active: false,
    subscribeStatus: subscribeCompositeStatus,
    toString: () => `composite(${candidateSet.size} candidates)`,
    routeFromProps: route,
    elementFromProps: element,
  };

  const findActiveChildInfo = () => {
    for (const candidate of candidateSet) {
      if (candidate.route?.active) {
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
      // URL doesn't match exactly, let fallback handle it if available
      if (fallbackCandidate) {
        return fallbackCandidate;
      }
      return indexCandidate;
    }
    if (fallbackCandidate) {
      return fallbackCandidate;
    }
    return null;
  };
  const getActiveInfo = route
    ? () => {
        if (!route.active) {
          // we have a route and it does not match no need to go further
          return null;
        }
        // we have a route and it is active (it matches)
        // we search the first active child to put it in the slot
        const activeChildInfo = findActiveChildInfo();
        if (activeChildInfo) {
          return activeChildInfo;
        }
        return {
          route,
          element: null,
          meta,
        };
      }
    : () => {
        // we don't have a route, do we have an active child?
        const activeChildInfo = findActiveChildInfo();
        if (activeChildInfo) {
          return activeChildInfo;
        }
        return null;
      };

  const activeRouteInfoSignal = signal();
  const SlotActiveElementSignal = signal();
  const ActiveElement = () => {
    const activeRouteInfo = activeRouteInfoSignal.value;
    useUITransitionContentId(
      activeRouteInfo
        ? activeRouteInfo.route.urlPattern
        : fallback
          ? "fallback"
          : undefined,
    );
    const SlotActiveElement = SlotActiveElementSignal.value;
    if (typeof element === "function") {
      const Element = element;
      element = <Element />;
    }
    // ensure we re-render on document url change (useful when navigating from /users/list to /users)
    // so that we re-replace urls back to /users/list when /users/list is an index
    useDocumentUrl();

    if (
      activeRouteInfo &&
      activeRouteInfo.index &&
      !activeRouteInfo.route.active
    ) {
      const routeUrl = activeRouteInfo.route.routeFromProps.buildUrl();
      replaceUrl(routeUrl);
    }

    return (
      <RouteInfoContext.Provider value={activeRouteInfo}>
        <SlotContext.Provider value={SlotActiveElement}>
          {element}
        </SlotContext.Provider>
      </RouteInfoContext.Provider>
    );
  };
  ActiveElement.underlyingElementId =
    candidateSet.size === 0
      ? `${getElementSignature(element)} without slot`
      : `[${getElementSignature(element)} with slot one of ${candidateElementIds}]`;

  const updateActiveInfo = () => {
    const newActiveInfo = getActiveInfo();
    if (newActiveInfo) {
      compositeRoute.active = true;
      activeRouteInfoSignal.value = newActiveInfo;
      SlotActiveElementSignal.value = newActiveInfo.element;
      onActiveInfoChange({
        route: newActiveInfo.route,
        ActiveElement,
        SlotActiveElement: newActiveInfo.element,
        index: newActiveInfo.index,
        fallback: newActiveInfo.fallback,
        meta: newActiveInfo.meta,
      });
    } else {
      compositeRoute.active = false;
      activeRouteInfoSignal.value = null;
      SlotActiveElementSignal.value = null;
      onActiveInfoChange(null);
    }
  };
  const onChange = () => {
    updateActiveInfo();
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
      element: ActiveElement,
      index,
      fallback,
      meta,
    });
  }
  updateActiveInfo();

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
