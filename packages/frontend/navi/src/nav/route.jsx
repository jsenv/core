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
const UpdateOnlyContext = createContext(false);
const ElementSignalMapContext = createContext(null);

export const Routes = ({ element = <RootElement />, children }) => {
  const routeInfo = useMatchingRouteInfo();
  const route = routeInfo?.route;
  const elementSignalMapRef = useRef(null);
  if (!elementSignalMapRef.current) {
    elementSignalMapRef.current = new Map();
  }

  return (
    <ElementSignalMapContext.Provider value={elementSignalMapRef.current}>
      <Route route={route} element={element}>
        {children}
      </Route>
    </ElementSignalMapContext.Provider>
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
  const hasDiscoveredRef = useRef(false);
  const matchingInfoRef = useRef(null);
  const isUpdateOnly = useContext(UpdateOnlyContext);
  const elementSignalMap = useContext(ElementSignalMapContext);

  // Each Route needs a unique key in the elementSignalMap.
  // Routes without routeParams use the route object directly.
  // Routes with routeParams share the same route object, so they use
  // a stable unique key per component instance.
  const elementSignalKeyRef = useRef(null);
  if (!elementSignalKeyRef.current && route && routeParams) {
    elementSignalKeyRef.current = { route, routeParams };
  }
  const elementSignalKey = routeParams ? elementSignalKeyRef.current : route;

  // Update the element signal for this route.
  // In update-only mode this is the only purpose of rendering this Route.
  if (
    elementSignalKey &&
    elementSignalMap &&
    elementSignalMap.has(elementSignalKey)
  ) {
    elementSignalMap.get(elementSignalKey).value = element;
  }

  if (isUpdateOnly) {
    if (children) {
      return (
        <UpdateOnlyContext.Provider value={true}>
          {children}
        </UpdateOnlyContext.Provider>
      );
    }
    return null;
  }

  if (!hasDiscoveredRef.current) {
    // Create the element signal during discovery
    if (
      elementSignalKey &&
      elementSignalMap &&
      !elementSignalMap.has(elementSignalKey)
    ) {
      // eslint-disable-next-line signals/no-signal-in-component-body
      elementSignalMap.set(elementSignalKey, signal(element));
    }
    return (
      <RouteMatchManager
        element={element}
        action={action}
        route={route}
        index={index}
        fallback={fallback}
        meta={meta}
        routeParams={routeParams}
        elementSignalKey={elementSignalKey}
        onMatchingInfoChange={(matchingInfo) => {
          hasDiscoveredRef.current = true;
          matchingInfoRef.current = matchingInfo;
          forceRender();
        }}
      >
        {children}
      </RouteMatchManager>
    );
  }

  const matchingInfo = matchingInfoRef.current;
  if (!matchingInfo) {
    return null;
  }
  const { MatchingElement } = matchingInfo;
  // After discovery: render MatchingElement for visible output, and keep
  // children alive in update-only mode so their element signals stay current.
  return (
    <>
      <MatchingElement />
      {children ? (
        <UpdateOnlyContext.Provider value={true}>
          {children}
        </UpdateOnlyContext.Provider>
      ) : null}
    </>
  );
};

const RegisterChildRouteContext = createContext(null);

/*
 * This component is rendered once
 * So no need to cleanup things or whatever we know and ensure that
 * it's executed once for the entire app lifecycle
 */
const RouteMatchManager = ({
  element,
  action,
  route,
  index,
  fallback,
  meta,
  routeParams,
  elementSignalKey,
  onMatchingInfoChange,
  children,
}) => {
  if (route && fallback) {
    throw new Error("Route cannot have both route and fallback props");
  }
  const parentRegisterChildRoute = useContext(RegisterChildRouteContext);
  const elementSignalMap = useContext(ElementSignalMapContext);

  const elementId = getElementSignature(element);
  const candidateSet = new Set();
  let indexCandidate = null;
  let fallbackCandidate = null;
  const registerChildRoute = (childRouteInfo) => {
    const childElementId = getElementSignature(childRouteInfo.MatchingElement);
    debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add(childRouteInfo);

    if (childRouteInfo.index) {
      if (indexCandidate) {
        throw new Error(`Multiple index routes registered under the same parent route (${elementId}):
- ${getElementSignature(indexCandidate.MatchingElement)}
- ${childElementId}`);
      }
      indexCandidate = childRouteInfo;
    }
    if (childRouteInfo.fallback) {
      if (fallbackCandidate) {
        throw new Error(`Multiple fallback routes registered under the same parent route (${elementId}):
- ${getElementSignature(fallbackCandidate.MatchingElement)}
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
      elementSignalMap,
      action,
      route,
      index,
      fallback,
      meta,
      routeParams,
      elementSignalKey,
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
  element,
  elementSignalMap,
  action,
  route,
  index,
  fallback,
  meta,
  routeParams,
  elementSignalKey,
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
  const compositeRoute = {
    urlPattern: `composite(${candidateElementIds})`,
    isComposite: true,
    matching: false,
    toString: () => `composite(${candidateSet.size} candidates)`,
    routeFromProps: route,
    elementFromProps: element,
  };

  const matchingRouteInfoSignal = signal();
  const SlotMatchingElementSignal = signal(SLOT_ROUTE_NO_MATCH);
  const MatchingElement = () => {
    // Read element from the signal (updated by update-only renders) when
    // available, falling back to the closure variable for routes without
    // a route prop (e.g. the Routes wrapper).
    const elementSignal =
      elementSignalKey && elementSignalMap
        ? elementSignalMap.get(elementSignalKey)
        : undefined;
    const currentElement = elementSignal ? elementSignal.value : element;
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
      ? `${getElementSignature(element)} without slot`
      : `[${getElementSignature(element)} with slot one of ${candidateElementIds}]`;

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
        // route matches but no child to put in the slot
        return {
          route,
          element: null,
          MatchingElement: SLOT_ROUTE_NO_MATCH,
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

  const updateMatchingInfo = () => {
    const newMatchingInfo = getMatchingInfo();
    if (newMatchingInfo) {
      compositeRoute.matching = true;
      matchingRouteInfoSignal.value = newMatchingInfo;
      SlotMatchingElementSignal.value = newMatchingInfo.MatchingElement;
      debug(
        `${elementId} updateMatchingInfo: MATCH route=${newMatchingInfo.route?.urlPattern}, slot=${newMatchingInfo.MatchingElement?.underlyingElementId ?? "SLOT_ROUTE_NO_MATCH"}`,
      );
      onMatchingInfoChange({
        route: newMatchingInfo.route,
        MatchingElement,
        SlotMatchingElement: newMatchingInfo.MatchingElement,
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

  // Collect all real routes this observer cares about:
  // 1. Our own route prop (if any)
  // 2. The real routes behind each child candidate's composite
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

// - "undefined" -> means there is no Slot Provider in the tree
// - SLOT_ROUTE_NO_MATCH -> means there is a provider but no route matches
// - any other value means there is a provider and a route matches, the value is the element associated to the matching route.
//
// "undefined" should happen only when:
// 1. RouteSlot is rendered for the first time by a <Routes> during the discovery phase
// 2. Some code is incorrectly using <RouteSlot /> outside of a <Route>
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
