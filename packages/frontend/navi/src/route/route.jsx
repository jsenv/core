/**
 *
 *
 * 2. Connecter une version simple (pas le double nesting) avec un UI transition pour voir le comportemenet
 * Notons qu'il faut restaurer le concept de content key pour que les transitions fonctionnent bien
 * donc il faudras qu'on voit cela
 *
 * . Refactor les actions pour qu'elles utilisent use. Ce qui va ouvrir la voie pour
 * Suspense et ErrorBoundary sur tous les composants utilisant des actions
 *
 * . Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 * 3. Ajouter la possibilite d'avoir des action sur les routes
 * Tester juste les data pour commencer
 * On aura ptet besoin d'un useRouteData au lieu de passer par un element qui est une fonction
 * pour que react ne re-render pas tout
 *
 * 4. Utiliser use() pour compar Suspense et ErrorBoundary lorsque route action se produit.
 *
 *
 */

import { createPubSub, getElementSignature } from "@jsenv/dom";
import { signal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

// import { useContentKey } from "../components/ui_transition.jsx";
import { useForceRender } from "./use_force_render.js";

const RootElement = () => {
  return <Route.Slot />;
};

export const Routes = ({ element = RootElement, children }) => {
  return <Route element={element}>{children}</Route>;
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
  const elementId = getElementSignature(element);
  const candidateSet = new Set();
  const registerChildRoute = (
    ChildActiveElement,
    childRoute,
    childFallback,
  ) => {
    const childElementId = getElementSignature(ChildActiveElement);
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
  const elementId = getElementSignature(element);
  const candidateElementIds = Array.from(candidateSet, (c) =>
    getElementSignature(c.ActiveElement),
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

  const findActiveChildInfo = () => {
    let fallbackInfo = null;
    for (const candidate of candidateSet) {
      if (candidate.route.active) {
        return {
          ChildActiveElement: candidate.ActiveElement,
          route: candidate.route,
        };
      }
      if (candidate.fallback) {
        fallbackInfo = {
          ChildActiveElement: candidate.ActiveElement,
          route: candidate.route,
        };
      }
    }
    return fallbackInfo;
  };
  const getActiveInfo = route
    ? () => {
        if (!route.active) {
          // we have a route and it does not match no need to go further
          return null;
        }
        // we have a route and it is active (it matches)
        // we search the first active child to put it in the slot
        const activeChildInfo = findActiveChildInfo();
        if (activeChildInfo) {
          return activeChildInfo;
        }
        return {
          ChildActiveElement: null,
          route,
        };
      }
    : () => {
        // we don't have a route, do we have an active child?
        const activeChildInfo = findActiveChildInfo();
        if (activeChildInfo) {
          return activeChildInfo;
        }
        return null;
      };

  const activeRouteSignal = signal();
  const SlotActiveElementSignal = signal();
  const ActiveElement = () => {
    const SlotActiveElement = SlotActiveElementSignal.value;
    console.log(
      `📄 Returning JSX element for ${getElementSignature(element)} with slot set to ${getElementSignature(SlotActiveElement)}`,
    );
    if (typeof element === "function") {
      const Element = element;
      return (
        <SlotContext.Provider value={SlotActiveElement}>
          <Element />
        </SlotContext.Provider>
      );
    }
    return (
      <SlotContext.Provider value={SlotActiveElement}>
        {element}
      </SlotContext.Provider>
    );
  };
  ActiveElement.underlyingElementId =
    candidateSet.size === 0
      ? `${getElementSignature(element)} without slot`
      : `[${getElementSignature(element)} with slot one of ${candidateElementIds}]`;

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
  return <SlotElement />;
};
Route.Slot = RouteSlot;
