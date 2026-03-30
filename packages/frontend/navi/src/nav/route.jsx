/**
 *
 * . Refactor les actions pour qu'elles utilisent use. Ce qui va ouvrir la voie pour
 * Suspense et ErrorBoundary sur tous les composants utilisant des actions
 *
 * . Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 * 3. Ajouter la possibilite d'avoir des
 *  sur les routes
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

import { ActionRenderer } from "../action/action_renderer.jsx";
import { useUITransitionContentId } from "../ui_transition/ui_transition.jsx";
import { observeRouteMutations } from "./route.js";
import { useForceRender } from "./use_force_render.js";

const DEBUG = true;
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
const SLOT_ROUTE_NO_MATCH = () => null;
const SlotContext = createContext(SLOT_ROUTE_NO_MATCH);
const RouteInfoContext = createContext(null);
const RegisterChildRouteContext = createContext(null);

export const Routes = ({ element = <RootElement />, children }) => {
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
  route,
  element,
  action,
  index,
  fallback,
  meta,
  children,
  routeParams,
}) => {
  const forceRender = useForceRender();
  const matchingInfoRef = useRef(null);
  const initRef = useRef(null);

  // On every render, update the element in case parent re-rendered with new props
  if (initRef.current) {
    initRef.current.elementSignal.value = element;
  }

  // During the first render we enter the "registration" phase:
  // render RouteRegistrar which renders children so they can register,
  // then useLayoutEffect fires initRouteObserver which calls onMatchingInfoChange
  // synchronously, which sets matchingInfoRef and calls forceRender.
  // On the second render (and all subsequent) we have matchingInfo and render output.
  if (!initRef.current) {
    // eslint-disable-next-line signals/no-signal-in-component-body
    const elementSignal = signal(element);
    initRef.current = { elementSignal };
    return (
      <RouteRegistrar
        elementSignal={elementSignal}
        action={action}
        route={route}
        index={index}
        fallback={fallback}
        meta={meta}
        routeParams={routeParams}
        onMatchingInfoChange={(matchingInfo) => {
          matchingInfoRef.current = matchingInfo;
          forceRender();
        }}
      >
        {children}
      </RouteRegistrar>
    );
  }

  const matchingInfo = matchingInfoRef.current;
  if (!matchingInfo) {
    return null;
  }
  const { MatchingElement } = matchingInfo;
  return <MatchingElement />;
};

/*
 * RouteRegistrar renders once to let children register via context,
 * then useLayoutEffect fires initRouteObserver.
 */
const RouteRegistrar = ({
  elementSignal,
  action,
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
  const parentRegisterChildRoute = useContext(RegisterChildRouteContext);

  const elementId = getElementSignature(elementSignal.peek());
  const candidateSet = new Set();
  let indexCandidate = null;
  let fallbackCandidate = null;
  const registerChildRoute = (childRouteInfo) => {
    const childElementId = getElementSignature(
      childRouteInfo.elementSignal.peek(),
    );
    debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add(childRouteInfo);

    if (childRouteInfo.index) {
      if (indexCandidate) {
        throw new Error(`Multiple index routes registered under the same parent route (${elementId}):
- ${getElementSignature(indexCandidate.elementSignal.peek())}
- ${childElementId}`);
      }
      indexCandidate = childRouteInfo;
    }
    if (childRouteInfo.fallback) {
      if (fallbackCandidate) {
        throw new Error(`Multiple fallback routes registered under the same parent route (${elementId}):
- ${getElementSignature(fallbackCandidate.elementSignal.peek())}
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
    console.group(`👶 Registration of ${elementId}`);
  }

  useLayoutEffect(() => {
    if (DEBUG) {
      console.groupEnd();
    }
    return initRouteObserver({
      elementSignal,
      action,
      route,
      index,
      fallback,
      meta,
      routeParams,
      indexCandidate,
      fallbackCandidate,
      candidateSet,
      onMatchingInfoChange,
      parentRegisterChildRoute,
    });
  }, []);

  return (
    <RegisterChildRouteContext.Provider value={registerChildRoute}>
      {children}
    </RegisterChildRouteContext.Provider>
  );
};

const initRouteObserver = ({
  elementSignal,
  action,
  route,
  index,
  fallback,
  meta,
  routeParams,
  indexCandidate,
  fallbackCandidate,
  candidateSet,
  onMatchingInfoChange,
  parentRegisterChildRoute,
}) => {
  if (
    !fallbackCandidate &&
    indexCandidate &&
    indexCandidate.fallback !== false
  ) {
    fallbackCandidate = indexCandidate;
  }

  const [teardown, addTeardown] = createPubSub();

  const elementId = getElementSignature(elementSignal.peek());
  const candidateElementIds = Array.from(candidateSet, (c) =>
    getElementSignature(c.elementSignal.peek()),
  );
  if (candidateElementIds.length === 0) {
    debug(`initRouteObserver ${elementId}, no children`);
  } else {
    debug(
      `initRouteObserver ${elementId}, child candidates:
  - ${candidateElementIds.join("\n  - ")}`,
    );
  }
  const compositeRoute = {
    urlPattern: `composite(${candidateElementIds})`,
    isComposite: true,
    matching: false,
    toString: () => `composite(${candidateSet.size} candidates)`,
    routeFromProps: route,
  };

  const matchingRouteInfoSignal = signal(null);
  const SlotMatchingElementSignal = signal(SLOT_ROUTE_NO_MATCH);

  const MatchingElement = () => {
    const currentElement = elementSignal.value;
    const matchingRouteInfo = matchingRouteInfoSignal.value;
    useUITransitionContentId(
      matchingRouteInfo
        ? matchingRouteInfo.route.urlPattern
        : fallback
          ? "fallback"
          : undefined,
    );
    const SlotMatchingElement = SlotMatchingElementSignal.value;
    const renderedElement = action ? (
      <ActionRenderer action={action}>{currentElement}</ActionRenderer>
    ) : (
      currentElement
    );
    return (
      <RouteInfoContext.Provider value={matchingRouteInfo}>
        <SlotContext.Provider value={SlotMatchingElement}>
          {renderedElement}
        </SlotContext.Provider>
      </RouteInfoContext.Provider>
    );
  };
  MatchingElement.underlyingElementId =
    candidateSet.size === 0
      ? `${elementId} without slot`
      : `[${elementId} with slot one of ${candidateElementIds}]`;

  const findMatchingChildInfo = () => {
    for (const candidate of candidateSet) {
      if (candidate.route?.matching) {
        return candidate;
      }
    }
    if (indexCandidate) {
      if (indexCandidate === fallbackCandidate) {
        return indexCandidate;
      }
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
          return null;
        }
        if (routeParams && !route.matchesParams(routeParams)) {
          return null;
        }
        const matchingChildInfo = findMatchingChildInfo();
        if (matchingChildInfo) {
          return matchingChildInfo;
        }
        return {
          route,
          MatchingElement: SLOT_ROUTE_NO_MATCH,
          meta,
        };
      }
    : () => {
        const matchingChildInfo = findMatchingChildInfo();
        if (matchingChildInfo) {
          return matchingChildInfo;
        }
        return null;
      };

  const updateMatchingInfo = () => {
    const newMatchingInfo = getMatchingInfo();
    if (newMatchingInfo) {
      compositeRoute.matching = true;
      matchingRouteInfoSignal.value = newMatchingInfo;
      SlotMatchingElementSignal.value =
        newMatchingInfo.MatchingElement || SLOT_ROUTE_NO_MATCH;
      debug(
        `${elementId} updateMatchingInfo: MATCH route=${newMatchingInfo.route?.urlPattern}, slot=${newMatchingInfo.MatchingElement?.underlyingElementId ?? "SLOT_ROUTE_NO_MATCH"}`,
      );
      onMatchingInfoChange({
        route: newMatchingInfo.route,
        MatchingElement,
        index: newMatchingInfo.index,
        fallback: newMatchingInfo.fallback,
        meta: newMatchingInfo.meta,
      });
    } else {
      compositeRoute.matching = false;
      matchingRouteInfoSignal.value = null;
      SlotMatchingElementSignal.value = SLOT_ROUTE_NO_MATCH;
      debug(`${elementId} updateMatchingInfo: ROUTE NO MATCH`);
      onMatchingInfoChange(null);
    }
  };

  const onChange = () => {
    debug(
      `${elementId} onChange: route.matching=${route?.matching}, compositeRoute.matching=${compositeRoute.matching}`,
    );
    updateMatchingInfo();
  };

  // Collect all real routes this observer cares about
  const relevantRouteSet = new Set();
  if (route) {
    relevantRouteSet.add(route);
  }
  for (const candidate of candidateSet) {
    const realRoute = candidate.route.routeFromProps;
    if (realRoute) {
      relevantRouteSet.add(realRoute);
    }
  }
  if (relevantRouteSet.size > 0) {
    addTeardown(
      observeRouteMutations((routeModifiedSet) => {
        for (const routeModified of routeModifiedSet) {
          if (relevantRouteSet.has(routeModified)) {
            onChange();
            return;
          }
        }
      }),
    );
  }

  if (parentRegisterChildRoute) {
    parentRegisterChildRoute({
      route: compositeRoute,
      elementSignal,
      MatchingElement,
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

// - "undefined" -> no SlotContext.Provider in the tree
// - SLOT_ROUTE_NO_MATCH -> provider exists but no route matches
// - any other value -> the matching route's MatchingElement component
export const RouteSlot = () => {
  const SlotElement = useContext(SlotContext);
  debug(
    `RouteSlot render: SlotElement=${SlotElement === SLOT_ROUTE_NO_MATCH ? "SLOT_ROUTE_NO_MATCH" : SlotElement === undefined ? "undefined" : (SlotElement?.underlyingElementId ?? "unknown function")}`,
  );
  if (SlotElement === undefined) {
    console.trace(
      "RouteSlot: SlotElement is undefined (no SlotContext.Provider in tree)",
    );
    return <p>&lt;RouteSlot/&gt; must be used inside a &lt;Route&gt;</p>;
  }
  if (SlotElement === SLOT_ROUTE_NO_MATCH) {
    return null;
  }
  return <SlotElement />;
};
Route.Slot = RouteSlot;
