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
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { useForceRender } from "./use_force_render.js";

export const Routes = ({ children }) => {
  return <>{children}</>;
};

const SlotContext = createContext(null);
export const Route = ({ route, element, children }) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const activeInfoRef = useRef(null);

  if (!hasDiscoveredRef.current) {
    return (
      <ActiveRouteManager
        route={route}
        element={element}
        onDiscoveryComplete={(activeInfo) => {
          hasDiscoveredRef.current = true;
          activeInfoRef.current = activeInfo;
          forceRender();
        }}
        onActiveRouteChange={(activeInfo) => {
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
  const Element = activeInfo.Element;
  return <Element />;
};

const RegisterChildRouteContext = createContext(null);

/* This component is ensure to be rendered once
So no need to cleanup things or whatever we know and ensure that 
it's executed once for the entier app lifecycle */
const ActiveRouteManager = ({
  route,
  element,
  onDiscoveryComplete,
  onActiveRouteChange,
  children,
}) => {
  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);
  const elementId = getElementId(element);
  const candidateSet = new Set();
  const registerChildRoute = (childRoute, childElement) => {
    const childElementId = getElementId(childElement);
    console.debug(`${elementId}.registerChildRoute(${childElementId})`);
    candidateSet.add({
      route: childRoute,
      element: childElement,
    });
  };
  console.group(`👶 Discovery of ${elementId}`);
  useLayoutEffect(() => {
    console.groupEnd();
    initRouteObserver({
      route,
      element,
      candidateSet,
      onDiscoveryComplete,
      onActiveRouteChange,
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
  route,
  element,
  candidateSet,
  onDiscoveryComplete,
  onActiveRouteChange,
  registerChildRouteFromContext,
}) => {
  const elementId = getElementId(element);
  const candidateElementIds = Array.from(candidateSet, (c) =>
    getElementId(c.element),
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

  const getActiveInfo = route
    ? () => {
        if (!route.active) {
          // we have a route and it does not match no need to go further
          return null;
        }
        // we have a route and it is active (it matches)
        // we search the first active child to put it in the slot
        for (const candidate of candidateSet) {
          if (candidate.route.active) {
            return {
              route,
              slotElement: candidate.element,
            };
          }
        }
        return {
          route,
          slotElement: null, // TODO: this is where we'll could put a route with fallback/otherwise property later on
        };
      }
    : () => {
        // we don't have a route, do we have an active child?
        for (const candidate of candidateSet) {
          if (candidate.route.active) {
            return {
              route: candidate.route,
              slotElement: candidate.element,
            };
          }
        }
        return null;
      };
  let activeInfo;
  const subscribeGlobalActiveInfo = (callback) => {
    const [teardown, addTeardown] = createPubSub();
    const onChange = () => {
      const previousActiveInfo = activeInfo;
      const newActiveInfo = getActiveInfo();
      if (newActiveInfo !== previousActiveInfo) {
        activeInfo = newActiveInfo;
        compositeRoute.active = Boolean(newActiveInfo);
        callback(newActiveInfo, previousActiveInfo);
      }
    };
    if (route) {
      const unsubscribe = route.subscribeStatus(onChange);
      addTeardown(unsubscribe);
    }
    for (const candidate of candidateSet) {
      const unsubscribe = candidate.route.subscribeStatus(onChange);
      addTeardown(unsubscribe);
    }
    return () => {
      teardown();
    };
  };
  const initialActiveInfo = getActiveInfo();
  if (initialActiveInfo) {
    compositeRoute.active = true;
    activeInfo = initialActiveInfo;
  }
  // Create a ref to share activeInfo with the wrapped component
  const activeInfoRef = { current: activeInfo };
  subscribeGlobalActiveInfo((current, previous) => {
    activeInfoRef.current = current;
    publishCompositeStatus(current, previous);
    onActiveRouteChange(current, previous);
  });

  const WrappedElement = () => {
    const [slotContent, setSlotContent] = useState(
      activeInfoRef.current?.slotElement || null,
    );
    useEffect(() => {
      const unsubscribe = subscribeGlobalActiveInfo((activeInfo) => {
        setSlotContent(activeInfo?.slotElement || null);
      });
      return unsubscribe;
    }, []);

    console.log(
      `📄 Returning JSX element for ${getElementId(element)} with slot set to ${getElementId(slotContent)}`,
    );
    return (
      <SlotContext.Provider value={slotContent}>{element}</SlotContext.Provider>
    );
  };
  WrappedElement.id = `[${getElementId(element)} with slot one of ${candidateElementIds}]`;

  if (registerChildRouteFromContext) {
    registerChildRouteFromContext(compositeRoute, WrappedElement);
  }
  onDiscoveryComplete(activeInfo);
};

export const RouteSlot = () => {
  const routeSlot = useContext(SlotContext);
  if (!routeSlot) {
    return <p>RouteSlot must be used inside a Route</p>;
  }
  return routeSlot;
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
