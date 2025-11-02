/**
 *
 * 1. tenter un double nesting pour voir si ca marche bien
 * 2. Connecter une version simple (pas le double nesting) avec un UI transition pour voir le comportemenet
 * Notons qu'il faut restaurer le concept de content key pour que les transitions fonctionnent bien
 * donc il faudras qu'on voit cela
 * 3. Ajouter la possibilite d'avoir des action sur les routes
 * Tester juste les data pour commencer
 * On aura ptet besoin d'un useRouteData au lieu de passer par un element qui est une fonction
 * pour que react ne re-render pas tout
 *
 * 4. Utiliser use() pour compar Suspense et ErrorBoundary lorsque route action se produit.
 *
 * 5. Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 */

import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { subscribeRouteStatus } from "./route.js";

export const Routes = ({ children }) => {
  return <>{children}</>;
};

const RouteAncestorContext = createContext(null);
const RouteSlotContext = createContext(null);

export const Route = ({ route, element, children }) => {
  const routeAncestor = useContext(RouteAncestorContext);
  if (routeAncestor) {
    routeAncestor.registerChildRoute(route, { element });
  }

  const forceRender = useForceRender();

  // Subscription à la route prop
  const routeIsActiveRef = useRef(false);
  const routeRef = useRef();
  if (routeRef.current !== route) {
    routeRef.current = route;
    if (!route) {
      routeIsActiveRef.current = false;
    } else {
      routeIsActiveRef.current = route.active;
      subscribeRouteStatus(route, () => {
        routeIsActiveRef.current = route.active;
        forceRender();
      });
    }
  }

  const hasDiscoveredRef = useRef(false);
  const activeNestedRouteInfoRef = useRef(null);
  if (!hasDiscoveredRef.current && children) {
    return (
      <NestedRouteDiscovery
        onDiscoveryComplete={(activeRouteInfo) => {
          hasDiscoveredRef.current = true;
          activeNestedRouteInfoRef.current = activeRouteInfo;
          forceRender();
        }}
        onActiveRouteChange={(activeRouteInfo) => {
          activeNestedRouteInfoRef.current = activeRouteInfo;
          forceRender();
        }}
      >
        {children}
      </NestedRouteDiscovery>
    );
  }

  // Phase de rendu normal
  const routePropIsActive = routeIsActiveRef.current;
  if (routePropIsActive) {
    return element;
  }

  const activeNestedRouteInfo = activeNestedRouteInfoRef.current;
  if (activeNestedRouteInfo) {
    const routeSlot = activeNestedRouteInfo.element;
    return (
      <RouteSlotContext.Provider value={routeSlot}>
        {element}
      </RouteSlotContext.Provider>
    );
  }
  return null;
};
const NestedRouteDiscovery = ({
  children,
  onDiscoveryComplete,
  onActiveRouteChange,
}) => {
  const discoveredRouteMapRef = useRef(new Map());
  const discoveredRouteMap = discoveredRouteMapRef.current;
  const activeNestedRouteInfoRef = useRef(null);

  const registerChildRoute = (route, { element }) => {
    if (discoveredRouteMap.has(route)) {
      return;
    }
    discoveredRouteMap.set(route, { element });
    if (route.active) {
      activeNestedRouteInfoRef.current = { route, element };
    }
  };

  const contextValue = useMemo(() => {
    return { registerChildRoute };
  }, []);

  useLayoutEffect(() => {
    discoveredRouteMapRef.current = discoveredRouteMap;
    for (const [route] of discoveredRouteMap) {
      subscribeRouteStatus(route, () => {
        if (route.active) {
          const previousInfo = activeNestedRouteInfoRef.current;
          const currentInfo = {
            route,
            element: discoveredRouteMap.get(route).element,
          };
          activeNestedRouteInfoRef.current = currentInfo;
          onActiveRouteChange(currentInfo, previousInfo);
        } else if (activeNestedRouteInfoRef.current?.route === route) {
          const previousInfo = activeNestedRouteInfoRef.current;
          activeNestedRouteInfoRef.current = null;
          onActiveRouteChange(null, previousInfo);
        }
      });
    }
    onDiscoveryComplete(activeNestedRouteInfoRef.current);
  }, []);

  return (
    <RouteAncestorContext.Provider value={contextValue}>
      {children}
    </RouteAncestorContext.Provider>
  );
};

export const RouteSlot = () => {
  const routeSlot = useContext(RouteSlotContext);
  if (!routeSlot) {
    return <p>RouteSlot not inside a Route</p>;
  }
  return <>{routeSlot}</>;
};
Route.Slot = RouteSlot;

const useForceRender = () => {
  const [, setState] = useState(null);
  return () => setState(NaN);
};
