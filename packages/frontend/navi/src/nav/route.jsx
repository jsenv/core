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
import { useContext, useLayoutEffect } from "preact/hooks";

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

const ChildMatchingCountContext = createContext(null);
const RouteAsContainer = (props) => {
  const childMatchingCount = useSignal(0);

  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching {...props} />
    </ChildMatchingCountContext.Provider>
  );
};

const RouteOnly = (props) => {
  const parentMatchingCount = useContext(ChildMatchingCountContext);
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const childMatchingCount = useSignal(0);

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useLayoutEffect(() => {
    if (!parentMatchingCount || !isMatching) {
      return undefined;
    }
    parentMatchingCount.value++;
    return () => {
      parentMatchingCount.value--;
    };
  }, [isMatching]);

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching {...props} />
    </ChildMatchingCountContext.Provider>
  );
};

const RouteWithFallback = (props) => {
  const parentMatchingCount = useContext(ChildMatchingCountContext);
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const childMatchingCount = useSignal(0);

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  if (parentMatchingCount && parentMatchingCount.value > 0) {
    return null;
  }
  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching {...props} />
    </ChildMatchingCountContext.Provider>
  );
};

const FallbackOnly = (props) => {
  const parentMatchingCount = useContext(ChildMatchingCountContext);
  const childMatchingCount = useSignal(0);

  if (parentMatchingCount && parentMatchingCount.value > 0) {
    return null;
  }
  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching {...props} />
    </ChildMatchingCountContext.Provider>
  );
};

const RouteInfoContext = createContext(null);
const RouteMatching = ({ route, element, action, meta, children }) => {
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
