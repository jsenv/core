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

// <Route> has 3 modes:
// 1. With route prop: renders when route matches, reports to parent
// 2. With fallback (no route): renders when no sibling matched
// 3. Neither: container that manages child matching (replaces <Routes>)
export const Route = (props) => {
  if (props.route) {
    return <RouteWithMatcher {...props} />;
  }
  if (props.fallback) {
    return <RouteAsFallback {...props} />;
  }
  return <RouteAsContainer {...props} />;
};

const ChildMatchingCountContext = createContext(null);
const RouteAsContainer = ({ element, action, meta, children }) => {
  const childMatchingCount = useSignal(0);

  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching element={element} action={action} meta={meta}>
        {children}
      </RouteMatching>
    </ChildMatchingCountContext.Provider>
  );
};

const RouteWithMatcher = ({
  route,
  routeParams,
  element,
  action,
  meta,
  children,
  fallback,
}) => {
  const parentMatchingCount = useContext(ChildMatchingCountContext);
  const childMatchingCount = useSignal(0);
  const { matching } = useRouteStatus(route);

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useLayoutEffect(() => {
    if (fallback || !parentMatchingCount || !isMatching) {
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
  if (fallback && parentMatchingCount && parentMatchingCount.value > 0) {
    return null;
  }
  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching element={element} action={action} meta={meta}>
        {children}
      </RouteMatching>
    </ChildMatchingCountContext.Provider>
  );
};

const RouteAsFallback = ({ element, action, meta, children }) => {
  const parentMatchingCount = useContext(ChildMatchingCountContext);
  const childMatchingCount = useSignal(0);

  if (parentMatchingCount && parentMatchingCount.value > 0) {
    return null;
  }
  return (
    <ChildMatchingCountContext.Provider value={childMatchingCount}>
      <RouteMatching element={element} action={action} meta={meta}>
        {children}
      </RouteMatching>
    </ChildMatchingCountContext.Provider>
  );
};

const RouteInfoContext = createContext(null);
const RouteMatching = ({ element, action, meta, children }) => {
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : (
    element
  );
  return (
    <RouteInfoContext.Provider value={{ route: null, meta }}>
      {renderedElement}
      {children}
    </RouteInfoContext.Provider>
  );
};
export const useMatchingRouteInfo = () => {
  const routeInfo = useContext(RouteInfoContext);
  return routeInfo;
};
