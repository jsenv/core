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

import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { ActionRenderer } from "../action/action_renderer.jsx";
import { useUITransitionContentId } from "../ui_transition/ui_transition.jsx";
import { useRouteStatus } from "./route.js";

const RoutesContext = createContext(null);
const RouteContext = createContext(null);

export const Routes = ({ children }) => {
  return (
    <RoutesContext.Provider value={null}>{children}</RoutesContext.Provider>
  );
};
// <Route> renders element + children when route matches (and routeParams match).
// Each Route independently subscribes to route mutations for reactivity.
export const Route = (props) => {
  if (!props.route) {
    return <WithoutRoute />;
  }
  return <WithRoute {...props} />;
};

const WithoutRoute = () => {
  return null;
};

const WithRoute = ({ route, routeParams, element, action, meta, children }) => {
  const { matching } = useRouteStatus(route);
  useUITransitionContentId(route.urlPattern);

  if (!matching) {
    return null;
  }
  if (routeParams && !route.matchesParams(routeParams)) {
    return null;
  }
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : (
    element
  );
  return (
    <RouteContext.Provider value={{ route, meta }}>
      {renderedElement}
      {children}
    </RouteContext.Provider>
  );
};

export const useMatchingRouteInfo = () => {
  const routeInfo = useContext(RouteContext);
  return routeInfo;
};
