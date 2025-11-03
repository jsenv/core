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
import { signal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import { useForceRender } from "./use_force_render.js";

export const Routes = ({ children }) => {
  return <>{children}</>;
};

const SlotContext = createContext(null);
export const Route = ({ element, route, fallback, children }) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const activeInfoRef = useRef(null);

  if (!hasDiscoveredRef.current) {
    return (
      <ActiveRouteManager
        element={element}
        route={route}
        fallback={fallback}
        onActiveInfoChange={(activeInfo) => {
          hasDiscoveredRef.current = true;
          activeInfoRef.current = activeInfo;
          forceRender();
        }}
      >
        {children}
      </ActiveRouteManager>
    );
  }

  const activeInfo = activeInfoRef.current;
  if (!activeInfo) {
    return null;
  }
  const { ActiveElement } = activeInfo;
  return <ActiveElement />;
};

const RegisterChildRouteContext = createContext(null);

/* This component is ensure to be rendered once
So no need to cleanup things or whatever we know and ensure that 
it's executed once for the entier app lifecycle */
const ActiveRouteManager = ({
  element,
  route,
  fallback,
  onActiveInfoChange,
  children,
}) => {
  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);
  const elementId = getElementId(element);
  const candidateSet = new Set();
  const registerChildRoute = (
    ChildActiveElement,
    childRoute,
    childFallback,
  ) => {
    const childElementId = getElementId(ChildActiveElement);
    console.debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add({
      ActiveElement: ChildActiveElement,
      route: childRoute,
      fallback: childFallback,
    });
  };
  console.group(`👶 Discovery of ${elementId}`);
  useLayoutEffect(() => {
    console.groupEnd();
    initRouteObserver({
      element,
      route,
      fallback,
      candidateSet,
      onActiveInfoChange,
      registerChildRouteFromContext,
    });
  }, []);

  return (
    <RegisterChildRouteContext.Provider value={registerChildRoute}>
      {children}
    </RegisterChildRouteContext.Provider>
  );
};

const initRouteObserver = ({
  element,
  route,
  fallback,
  candidateSet,
  onActiveInfoChange,
  registerChildRouteFromContext,
}) => {
  const elementId = getElementId(element);
  const candidateElementIds = Array.from(candidateSet, (c) =>
    getElementId(c.ActiveElement),
  ).join(", ");
  console.log(
    `🔍 initRouteObserver ${elementId}, candidates: ${candidateElementIds}`,
  );
  const [publishCompositeStatus, subscribeCompositeStatus] = createPubSub();
  const compositeRoute = {
    urlPattern: `composite(${candidateElementIds})`,
    isComposite: true,
    active: false,
    subscribeStatus: subscribeCompositeStatus,
    toString: () => `composite(${candidateSet.size} candidates)`,
  };

  const findActiveCandidate = () => {
    let fallbackCandidate = null;
    for (const candidate of candidateSet) {
      if (candidate.route.active) {
        return {
          ChildActiveElement: candidate.ActiveElement,
          route,
        };
      }
      if (candidate.fallback) {
        fallbackCandidate = candidate;
      }
    }
    return fallbackCandidate;
  };
  const getActiveInfo = route
    ? () => {
        if (!route.active) {
          // we have a route and it does not match no need to go further
          return null;
        }
        // we have a route and it is active (it matches)
        // we search the first active child to put it in the slot
        const activeCandidate = findActiveCandidate();
        if (activeCandidate) {
          return activeCandidate;
        }
        return {
          ChildActiveElement: null,
          route,
        };
      }
    : () => {
        // we don't have a route, do we have an active child?
        const activeCandidate = findActiveCandidate();
        if (activeCandidate) {
          return activeCandidate;
        }
        return null;
      };

  const activeRouteSignal = signal();
  const SlotActiveElementSignal = signal();
  const ActiveElement = () => {
    const SlotActiveElement = SlotActiveElementSignal.value;
    console.log(
      `📄 Returning JSX element for ${getElementId(element)} with slot set to ${getElementId(SlotActiveElement)}`,
    );
    return (
      <SlotContext.Provider value={SlotActiveElement}>
        {element}
      </SlotContext.Provider>
    );
  };
  ActiveElement.id =
    candidateSet.size === 0
      ? `${getElementId(element)} without slot`
      : `[${getElementId(element)} with slot one of ${candidateElementIds}]`;

  const updateActiveInfo = () => {
    const newActiveInfo = getActiveInfo();
    if (newActiveInfo) {
      compositeRoute.active = true;
      const { route, ChildActiveElement } = newActiveInfo;
      activeRouteSignal.value = route;
      SlotActiveElementSignal.value = ChildActiveElement;
      onActiveInfoChange({
        route: newActiveInfo.route,
        ActiveElement,
        SlotActiveElement: ChildActiveElement,
      });
    } else {
      compositeRoute.active = false;
      activeRouteSignal.value = null;
      SlotActiveElementSignal.value = null;
      onActiveInfoChange(null);
    }
  };
  const onChange = () => {
    updateActiveInfo();
    publishCompositeStatus();
  };
  if (route) {
    route.subscribeStatus(onChange);
  }
  for (const candidate of candidateSet) {
    candidate.route.subscribeStatus(onChange);
  }
  if (registerChildRouteFromContext) {
    registerChildRouteFromContext(ActiveElement, compositeRoute, fallback);
  }
  updateActiveInfo();
};

export const RouteSlot = () => {
  const SlotElement = useContext(SlotContext);
  if (!SlotElement) {
    return <p>RouteSlot must be used inside a Route</p>;
  }
  console.log("rendering", getElementId(SlotElement));
  return <SlotElement />;
};
Route.Slot = RouteSlot;

// Extract element ID for logging
const getElementId = (element) => {
  if (!element) {
    return String(element);
  }
  if (typeof element === "function") {
    if (element.id) {
      return element.id;
    }
    return "[function]";
  }
  if (element?.props?.id) {
    return element.props.id;
  }
  if (element?.type === "div" && element?.props?.children?.[0]) {
    return element.props.children[0].toString().slice(0, 20);
  }
  return "[unknown]";
};
