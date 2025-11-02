/**
 *
 * 1. tenter un double nesting pour voir si ca marche bien
 *
 * 2. Besoin de la prop index pour render dans le slot du parent
 *
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

  const subscribeRouteActive = (route, callback) => {
    const subscribeMethod = route.isComposite
      ? route.subscribeActiveInfo
      : (callback) => subscribeRouteStatus(route, callback);
    return subscribeMethod(() => {
      callback();
    });
  };

  const candidateSet = new Set();
  const addCandidate = (route, element, origin) => {
    // console.debug(`📍 addCandidate: ${route} (${origin})`);
    const getActiveInfo = () => {
      return route.active ? { element, origin } : null;
    };
    const subscribeActiveInfo = (callback) => {
      return subscribeRouteActive(route, () => {
        callback(getActiveInfo());
      });
    };
    candidateSet.add({
      route,
      element,
      getActiveInfo,
      subscribeActiveInfo,
    });
  };
  const registerChildRoute = (childRoute, childElement) => {
    console.debug(
      `${routeFromProps?.urlPattern || "wrapper"}.registerChildRoute(${childRoute.urlPattern})`,
    );
    addCandidate(childRoute, childElement, "children");
  };

  if (children) {
    console.group(
      `👶 Discovery of ${routeFromProps ? routeFromProps.urlPattern : "wrapper"} child routes`,
    );
  }

  if (routeFromProps) {
    addCandidate(routeFromProps, elementFromProps, "props");
  }

  useLayoutEffect(() => {
    if (children) {
      console.groupEnd();
    }

    if (candidateSet.size === 0) {
      onDiscoveryComplete(null);
      return;
    }
    if (candidateSet.size === 1) {
      const soleCandidate = candidateSet.values().next().value;
      activeInfoRef.current = soleCandidate.getActiveInfo();
      soleCandidate.subscribeActiveInfo((newActiveInfo) => {
        const currentActiveInfo = activeInfoRef.current;
        activeInfoRef.current = newActiveInfo;
        onActiveRouteChange(newActiveInfo, currentActiveInfo);
      });
      if (registerChildRouteFromContext) {
        registerChildRouteFromContext(
          soleCandidate.route,
          soleCandidate.element,
        );
      }
      onDiscoveryComplete(activeInfoRef.current);
      return;
    }

    const [publishCompositeActiveInfo, subscribeCompositeActiveInfo] =
      createPubSub();
    const patterns = Array.from(candidateSet, (c) => c.route.urlPattern).join(
      ", ",
    );
    const compositeRoute = {
      urlPattern: `composite(${patterns})`,
      isComposite: true,
      active: false,
      subscribeActiveInfo: subscribeCompositeActiveInfo,
      toString: () => `composite(${candidateSet.size} candidates)`,
    };
    const getActiveCandidateInfo = () => {
      for (const candidate of candidateSet) {
        const info = candidate.getActiveInfo();
        if (info) return info;
      }
      return null;
    };
    const subscribeGlobalActiveInfo = (callback) => {
      const [teardown, addTeardown] = createPubSub();
      for (const candidate of candidateSet) {
        const unsubscribe = candidate.subscribeActiveInfo(() => {
          const previousActiveCandidateInfo = activeInfoRef.current;
          const newActiveCandidateInfo = getActiveCandidateInfo();
          if (newActiveCandidateInfo !== previousActiveCandidateInfo) {
            activeInfoRef.current = newActiveCandidateInfo;
            compositeRoute.active = Boolean(newActiveCandidateInfo);
            callback(newActiveCandidateInfo, previousActiveCandidateInfo);
          }
        });
        addTeardown(unsubscribe);
      }
      return () => {
        teardown();
      };
    };
    const initialActiveInfo = getActiveCandidateInfo();
    if (initialActiveInfo) {
      compositeRoute.active = true;
      activeInfoRef.current = initialActiveInfo;
    }
    subscribeGlobalActiveInfo((current, previous) => {
      publishCompositeActiveInfo(current, previous);
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
