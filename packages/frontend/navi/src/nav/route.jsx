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

const RouteInfoContext = createContext(null);
const RegisterChildRouteContext = createContext(null);

export const useMatchingRouteInfo = () => useContext(RouteInfoContext);

// <Routes> renders whichever child <Route> matches the current URL.
// It gets its own route from the parent RouteInfoContext (set by the parent Route's MatchingElement).
export const Routes = ({ children }) => {
  const routeInfo = useMatchingRouteInfo();
  const route = routeInfo?.route;

  return <Route route={route}>{children}</Route>;
};

// <Route> — if route matches (and routeParams match), render element.
// Children are nested <Route> components that register with this Route.
// When children exist, the matching child's element is rendered inside this Route's element.
export const Route = ({
  route,
  element,
  action,
  meta,
  children,
  routeParams,
}) => {
  const forceRender = useForceRender();
  const matchingInfoRef = useRef(null);
  const initRef = useRef(null);

  // On every render, update the element signal so the MatchingElement closure sees fresh props
  if (initRef.current) {
    initRef.current.elementSignal.value = element;
  }

  // First render: registration phase.
  // RouteRegistrar renders children so they register via context,
  // then useLayoutEffect fires initRouteObserver which calls onMatchingInfoChange,
  // setting matchingInfoRef and triggering forceRender.
  if (!initRef.current) {
    // eslint-disable-next-line signals/no-signal-in-component-body
    const elementSignal = signal(element);
    initRef.current = { elementSignal };
    return (
      <RouteRegistrar
        elementSignal={elementSignal}
        action={action}
        route={route}
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

const RouteRegistrar = ({
  elementSignal,
  action,
  route,
  meta,
  routeParams,
  onMatchingInfoChange,
  children,
}) => {
  const parentRegisterChildRoute = useContext(RegisterChildRouteContext);

  const elementId = getElementSignature(elementSignal.peek());
  const candidateSet = new Set();
  const registerChildRoute = (childRouteInfo) => {
    const childElementId = getElementSignature(
      childRouteInfo.elementSignal.peek(),
    );
    debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add(childRouteInfo);
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
      meta,
      routeParams,
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
  meta,
  routeParams,
  candidateSet,
  onMatchingInfoChange,
  parentRegisterChildRoute,
}) => {
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
  const matchingChildElementSignal = signal(null);

  // MatchingElement renders:
  // 1. This route's own element (read from elementSignal)
  // 2. The matching child's element (read from matchingChildElementSignal) inside it
  const MatchingElement = () => {
    const currentElement = elementSignal.value;
    const matchingRouteInfo = matchingRouteInfoSignal.value;
    useUITransitionContentId(
      matchingRouteInfo ? matchingRouteInfo.route.urlPattern : undefined,
    );
    const matchingChildElement = matchingChildElementSignal.value;
    const renderedElement = action ? (
      <ActionRenderer action={action}>{currentElement}</ActionRenderer>
    ) : (
      currentElement
    );
    return (
      <RouteInfoContext.Provider value={matchingRouteInfo}>
        {renderedElement}
        {matchingChildElement}
      </RouteInfoContext.Provider>
    );
  };
  MatchingElement.underlyingElementId =
    candidateSet.size === 0
      ? `${elementId} (leaf)`
      : `${elementId} (parent of ${candidateElementIds.join(", ")})`;

  const findMatchingChild = () => {
    for (const candidate of candidateSet) {
      if (candidate.route?.matching) {
        return candidate;
      }
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
        return { route, meta };
      }
    : () => {
        // No route prop (Routes wrapper) — match if any child matches
        const matchingChild = findMatchingChild();
        if (matchingChild) {
          return { route: matchingChild.route, meta };
        }
        return null;
      };

  const updateMatchingInfo = () => {
    const newMatchingInfo = getMatchingInfo();
    if (newMatchingInfo) {
      compositeRoute.matching = true;
      matchingRouteInfoSignal.value = newMatchingInfo;

      // Find matching child and render its MatchingElement
      const matchingChild = findMatchingChild();
      if (matchingChild) {
        matchingChildElementSignal.value = <matchingChild.MatchingElement />;
      } else {
        matchingChildElementSignal.value = null;
      }

      debug(
        `${elementId} updateMatchingInfo: MATCH route=${newMatchingInfo.route?.urlPattern}`,
      );
      onMatchingInfoChange({
        route: newMatchingInfo.route,
        MatchingElement,
        meta: newMatchingInfo.meta,
      });
    } else {
      compositeRoute.matching = false;
      matchingRouteInfoSignal.value = null;
      matchingChildElementSignal.value = null;
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
      meta,
    });
  }
  updateMatchingInfo();

  return () => {
    teardown();
  };
};
