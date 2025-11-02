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
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { subscribeRouteStatus } from "./route.js";
import { useForceRender } from "./use_force_render.js";

export const Routes = ({ children }) => {
  return <>{children}</>;
};

const RouteSlotContext = createContext(null);

export const Route = ({ route, element, children }) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const activeRouteInfoRef = useRef(null);
  if (!hasDiscoveredRef.current) {
    return (
      <ActiveRouteManager
        route={route}
        element={element}
        onDiscoveryComplete={(activeRouteInfo) => {
          hasDiscoveredRef.current = true;
          activeRouteInfoRef.current = activeRouteInfo;
          forceRender();
        }}
        onActiveRouteChange={(activeRouteInfo) => {
          activeRouteInfoRef.current = activeRouteInfo;
          forceRender();
        }}
      >
        {children}
      </ActiveRouteManager>
    );
  }
  const activeRouteInfo = activeRouteInfoRef.current;
  if (!activeRouteInfo) {
    return null;
  }
  if (activeRouteInfo.origin === "props") {
    return element;
  }
  const activeNestedRouteElement = activeRouteInfo.element;
  return (
    <RouteSlotContext.Provider value={activeNestedRouteElement}>
      {element}
    </RouteSlotContext.Provider>
  );
};

const RegisterChildRouteContext = createContext(null);

const ActiveRouteManager = ({
  route: routeFromProps,
  element: elementFromProps,
  onDiscoveryComplete,
  onActiveRouteChange,
  children,
}) => {
  const activeInfoRef = useRef(null);
  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);

  const candidateSet = new Set();
  if (routeFromProps) {
    const getActiveInfo = () => {
      return routeFromProps.active
        ? { element: elementFromProps, origin: "props" }
        : null;
    };
    candidateSet.add({
      getActiveInfo,
      subscribeActiveInfo: (callback) => {
        return subscribeRouteStatus(routeFromProps, () => {
          callback(getActiveInfo());
        });
      },
    });
  }
  const registerChildRoute = (getActiveInfo, subscribeActiveInfo) => {
    candidateSet.add({
      getActiveInfo,
      subscribeActiveInfo,
    });
  };

  useLayoutEffect(() => {
    const getActiveInfo = () => {
      for (const candidate of candidateSet) {
        const activeInfo = candidate.getActiveInfo();
        if (activeInfo) {
          return activeInfo;
        }
      }
      return null;
    };
    const subscribeActiveInfo = (callback) => {
      for (const candidate of candidateSet) {
        candidate.subscribeActiveInfo((activeInfo) => {
          const currentActiveInfo = activeInfoRef.current;
          if (activeInfo) {
            activeInfoRef.current = activeInfo;
            callback(activeInfo, currentActiveInfo);
          } else if (currentActiveInfo) {
            activeInfoRef.current = null;
            callback(null, currentActiveInfo);
          }
        });
      }
    };

    activeInfoRef.current = getActiveInfo();
    subscribeActiveInfo((current, previous) => {
      onActiveRouteChange(current, previous);
    });

    if (registerChildRouteFromContext) {
      registerChildRouteFromContext(getActiveInfo, subscribeActiveInfo);
    }
    onDiscoveryComplete(activeInfoRef.current);
  }, []);

  return (
    <RegisterChildRouteContext.Provider value={registerChildRoute}>
      {children}
    </RegisterChildRouteContext.Provider>
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
