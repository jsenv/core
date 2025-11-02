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

import { createPubSub } from "@jsenv/dom";
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

/* This component is ensure to be rendered once
So no need to cleanup things or whatever we know and ensure that 
it's executed once for the entier app lifecycle */
const ActiveRouteManager = ({
  route: routeFromProps,
  element: elementFromProps,
  onDiscoveryComplete,
  onActiveRouteChange,
  children,
}) => {
  const activeInfoRef = useRef(null);
  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);

  const subscribeRouteActive = (route, activeInfo, callback) => {
    if (route.isComposite) {
      return route.subscribeActiveInfo(() => {
        callback(route.active ? activeInfo : null);
      });
    }
    return subscribeRouteStatus(route, () => {
      callback(route.active ? activeInfo : null);
    });
  };

  const candidateSet = new Set();
  const addCandidate = (route, element, origin) => {
    const getActiveInfo = () => {
      return route.active ? { element, origin } : null;
    };
    const subscribeActiveInfo = (callback) => {
      return subscribeRouteActive(route, { element, origin }, callback);
    };
    candidateSet.add({
      getActiveInfo,
      subscribeActiveInfo,
    });
  };
  const registerChildRoute = (childRoute, childElement) => {
    addCandidate(childRoute, childElement, "children");
  };
  if (routeFromProps) {
    addCandidate(routeFromProps, elementFromProps, "props");
    if (registerChildRouteFromContext) {
      registerChildRouteFromContext(routeFromProps, elementFromProps);
    }
  }
  useLayoutEffect(() => {
    const [publishCompositeActiveInfo, subscribeCompositeActiveInfo] =
      createPubSub();
    const compositeRoute = {
      isComposite: true,
      active: false,
      subscribeActiveInfo: subscribeCompositeActiveInfo,
    };

    // Fonction qui calcule l'état actif global
    const getGlobalActiveInfo = () => {
      for (const candidate of candidateSet) {
        const info = candidate.getActiveInfo();
        if (info) return info;
      }
      return null;
    };

    // Fonction de subscription globale qui coordonne toutes les routes
    const subscribeGlobalActiveInfo = (callback) => {
      // État partagé entre toutes les subscriptions
      const state = { currentGlobalActiveInfo: activeInfoRef.current };

      const createSubscriptionHandler = (sharedState) => {
        return () => {
          // Recalculer l'état global à chaque changement individuel
          const newGlobalActiveInfo = getGlobalActiveInfo();

          // Ne déclencher le callback que si l'état global a vraiment changé
          if (newGlobalActiveInfo !== sharedState.currentGlobalActiveInfo) {
            const previous = sharedState.currentGlobalActiveInfo;
            sharedState.currentGlobalActiveInfo = newGlobalActiveInfo;
            activeInfoRef.current = newGlobalActiveInfo;
            compositeRoute.active = Boolean(newGlobalActiveInfo);
            callback(newGlobalActiveInfo, previous);
          }
        };
      };

      const unsubscribeFunctions = [];
      for (const candidate of candidateSet) {
        const handler = createSubscriptionHandler(state);
        const unsubscribe = candidate.subscribeActiveInfo(handler);
        unsubscribeFunctions.push(unsubscribe);
      }

      return () => {
        unsubscribeFunctions.forEach((fn) => fn());
      };
    };

    // Initialiser l'état
    const initialActiveInfo = getGlobalActiveInfo();
    if (initialActiveInfo) {
      compositeRoute.active = true;
      activeInfoRef.current = initialActiveInfo;
    }

    // S'abonner aux changements globaux
    subscribeGlobalActiveInfo((current, previous) => {
      publishCompositeActiveInfo(current, previous);
    });

    subscribeCompositeActiveInfo((current, previous) => {
      onActiveRouteChange(current, previous);
    });

    if (registerChildRouteFromContext) {
      registerChildRouteFromContext(compositeRoute, elementFromProps);
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
