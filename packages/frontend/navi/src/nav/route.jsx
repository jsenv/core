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

const ChildMatchingCountSignalContext = createContext(null);
const RouteAsContainer = (props) => {
  const childMatchingCountSignal = useSignal(0);

  return (
    <ChildMatchingCountSignalContext.Provider value={childMatchingCountSignal}>
      <RouteMatching {...props} />
    </ChildMatchingCountSignalContext.Provider>
  );
};

const RouteOnly = (props) => {
  const parentMatchingCountSignal = useContext(ChildMatchingCountSignalContext);
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const childMatchingCountSignal = useSignal(0);

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useLayoutEffect(() => {
    if (!parentMatchingCountSignal || !isMatching) {
      return undefined;
    }
    parentMatchingCountSignal.value++;
    return () => {
      parentMatchingCountSignal.value--;
    };
  }, [isMatching]);

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  return (
    <ChildMatchingCountSignalContext.Provider value={childMatchingCountSignal}>
      <RouteMatching {...props} />
    </ChildMatchingCountSignalContext.Provider>
  );
};

const RouteWithFallback = (props) => {
  const parentMatchingCountSignal = useContext(ChildMatchingCountSignalContext);
  const parentMatchingCount = parentMatchingCountSignal.value;
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const childMatchingCountSignal = useSignal(0);

  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  if (parentMatchingCount > 0) {
    return null;
  }
  return (
    <ChildMatchingCountSignalContext.Provider value={childMatchingCountSignal}>
      <RouteMatching {...props} />
    </ChildMatchingCountSignalContext.Provider>
  );
};

const FallbackOnly = (props) => {
  const parentMatchingCountSignal = useContext(ChildMatchingCountSignalContext);
  const parentMatchingCount = parentMatchingCountSignal.value;
  const childMatchingCountSignal = useSignal(0);

  if (parentMatchingCount > 0) {
    return null;
  }
  return (
    <ChildMatchingCountSignalContext.Provider value={childMatchingCountSignal}>
      <RouteMatching {...props} />
    </ChildMatchingCountSignalContext.Provider>
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
