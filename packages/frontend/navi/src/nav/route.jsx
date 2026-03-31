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

import { useSignal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { ActionRenderer } from "../action/action_renderer.jsx";
import { useUITransitionContentId } from "../ui_transition/ui_transition.jsx";
import { useRouteStatus } from "./route.js";

// <Route> has 4 modes based on props:
// 1. route (no fallback): renders when route matches, reports to parent
// 2. route + fallback: renders when route matches AND no sibling matched
// 3. fallback (no route): renders when no sibling matched
// 4. neither: container that manages child matching
export const Route = (props) => {
  if (props.route) {
    if (props.fallback) {
      return <RouteWithFallback {...props} />;
    }
    return <RouteOnly {...props} />;
  }
  if (props.fallback) {
    return <FallbackOnly {...props} />;
  }
  return <RouteAsContainer {...props} />;
};

const MatchingChildrenContext = createContext(null);
const useMatchingChildren = () => {
  const mountRef = useRef(false);
  if (!mountRef.current) {
    const countSignal = useSignal(0);
    const notifyMatch = () => {
      countSignal.value = countSignal.peek() + 1;
    };
    const notifyUnmatch = () => {
      countSignal.value = countSignal.peek() - 1;
    };
    mountRef.current = {
      countSignal,
      notifyMatch,
      notifyUnmatch,
    };
  }
  return mountRef.current;
};
const useMatchingSiblingContext = import.meta.dev
  ? () => {
      const matchingChildren = useContext(MatchingChildrenContext);
      if (!matchingChildren) {
        throw new Error(
          "<Route> with route or fallback prop must be a child of a <Route> without route prop",
        );
      }
      return matchingChildren;
    }
  : () => useContext(MatchingChildrenContext);
const RouteAsContainer = (props) => {
  const matchingChildren = useMatchingChildren();

  const el = (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
  const hasMatchingChild = matchingChildren.countSignal.peek() > 0;
  if (!hasMatchingChild) {
    return null;
  }
  return el;
};

const RouteOnly = (props) => {
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const matchingChildren = useMatchingChildren();

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
};

const RouteWithFallback = (props) => {
  const matchingSibling = useMatchingSiblingContext();
  const matchingSiblingCount = matchingSibling.countSignal.value;
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const matchingChildren = useSignal(0);

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  if (matchingSiblingCount > 0) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
};

const FallbackOnly = (props) => {
  const matchingSibling = useMatchingSiblingContext();
  const matchingSiblingCount = matchingSibling.countSignal.value;
  const matchingChildren = useSignal(0);

  if (matchingSiblingCount > 0) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
};

const RouteInfoContext = createContext(null);
const RouteMatching = ({ route, element, action, meta, children }) => {
  const matchingSibling = useMatchingSiblingContext();
  useLayoutEffect(() => {
    matchingSibling.notifyMatch();
    return () => {
      // Decrement on unmount
      matchingSibling.notifyUnmatch();
    };
  }, []);

  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : (
    element
  );
  return (
    <RouteInfoContext.Provider value={{ route, meta }}>
      {renderedElement}
      {children}
    </RouteInfoContext.Provider>
  );
};
export const useMatchingRouteInfo = () => {
  const routeInfo = useContext(RouteInfoContext);
  return routeInfo;
};
