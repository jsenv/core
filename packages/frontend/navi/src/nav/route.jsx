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

import { useUITransitionContentId } from "../components/ui_transition/ui_transition.jsx";
import { useForceRender } from "./use_force_render.js";

const DEBUG = false;
const debug = (...args) => {
  if (!DEBUG) return;
  console.debug(...args);
};

const RootElement = () => {
  return <Route.Slot />;
};
const SlotContext = createContext(null);
const RouteInfoContext = createContext(null);

export const Routes = ({ element = RootElement, children }) => {
  return <Route element={element}>{children}</Route>;
};

export const useActiveRouteInfo = () => useContext(RouteInfoContext);
export const Route = ({ element, route, fallback, meta, children }) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const activeInfoRef = useRef(null);

  if (!hasDiscoveredRef.current) {
    return (
      <ActiveRouteManager
        element={element}
        route={route}
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
  const registerChildRoute = (
    ChildActiveElement,
    childRoute,
    childFallback,
    childMeta,
  ) => {
    const childElementId = getElementSignature(ChildActiveElement);
    debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add({
      ActiveElement: ChildActiveElement,
      route: childRoute,
      fallback: childFallback,
      meta: childMeta,
    });
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
      fallback,
      meta,
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
  fallback,
  meta,
  candidateSet,
  onActiveInfoChange,
  registerChildRouteFromContext,
}) => {
  const [teardown, addTeardown] = createPubSub();

  const elementId = getElementSignature(element);
  const candidateElementIds = Array.from(candidateSet, (c) =>
    getElementSignature(c.ActiveElement),
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
    let fallbackInfo = null;
    for (const candidate of candidateSet) {
      if (candidate.route?.active) {
        return candidate;
      }
      // fallback without route can match when no other route matches.
      // This is useful solely for "catch all" fallback used on the <Routes>
      // otherwise a fallback would always match and make the parent route always active
      if (candidate.fallback && !candidate.route.routeFromProps) {
        fallbackInfo = candidate;
      }
    }
    return fallbackInfo;
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
          ActiveElement: null,
          route,
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
      SlotActiveElementSignal.value = newActiveInfo.ActiveElement;
      onActiveInfoChange({
        ActiveElement,
        SlotActiveElement: newActiveInfo.ActiveElement,
        route: newActiveInfo.route,
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
    registerChildRouteFromContext(
      ActiveElement,
      compositeRoute,
      fallback,
      meta,
    );
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
