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
  const elementToRender = activeRouteInfo.element;

  console.log(`🎯 Route.render ${route?.urlPattern}:`, {
    elementId: getElementId(elementToRender),
    elementType: typeof elementToRender,
    element: elementToRender,
  });

  // If it's a function component, call it. If it's JSX, return it directly
  if (typeof elementToRender === "function") {
    console.log(`🔧 Calling function component for ${route?.urlPattern}`);
    const FunctionElement = elementToRender;
    return <FunctionElement />;
  }

  console.log(
    `📄 Returning JSX element for ${route?.urlPattern}:`,
    getElementId(elementToRender),
  );
  return elementToRender;
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
  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);

  console.debug(
    `🏗️ ActiveRouteManager for ${routeFromProps?.urlPattern || "wrapper"}: #${getElementId(elementFromProps)}`,
  );

  const candidateSet = new Set();
  const addCandidate = (route, element, origin) => {
    candidateSet.add({
      route,
      element,
      origin,
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
    initRouteObserver({
      candidateSet,
      element: elementFromProps,
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

const getActiveInfo = (candidate) => {
  return candidate.route.active ? candidate : null;
};
const subscribeActiveInfo = (candidate, callback) => {
  return candidate.route.subscribeStatus(() => {
    callback(getActiveInfo(candidate));
  });
};

const initRouteObserver = ({
  candidateSet,
  element,
  onDiscoveryComplete,
  onActiveRouteChange,
  registerChildRouteFromContext,
}) => {
  console.log(
    `🔍 initRouteObserver, parentElementId: #${getElementId(element)}, candidate elements: ${Array.from(
      candidateSet,
    )
      .map((c) => `#${getElementId(c.element)}`)
      .join(", ")}`,
  );

  if (candidateSet.size === 0) {
    onDiscoveryComplete(null);
    return;
  }
  // if (candidateSet.size === 1) {
  //   let activeInfo;
  //   const soleCandidate = candidateSet.values().next().value;
  //   activeInfo = getActiveInfo(soleCandidate);
  //   subscribeActiveInfo(soleCandidate, (newActiveInfo) => {
  //     const currentActiveInfo = activeInfo;
  //     activeInfo = newActiveInfo;
  //     onActiveRouteChange(newActiveInfo, currentActiveInfo);
  //   });
  //   // Only register with parent if this route doesn't have children
  //   if (registerChildRouteFromContext) {
  //     const wrappedElement = () => {
  //       console.log(
  //         `🎁 wrappedElement for ${soleCandidate.route.urlPattern}:`,
  //         {
  //           parentElementId: getElementId(element),
  //           childElementId: getElementId(soleCandidate.element),
  //           childElement: soleCandidate.element,
  //         },
  //       );

  //       return (
  //         <SlotContext.Provider value={soleCandidate.element}>
  //           {element}
  //         </SlotContext.Provider>
  //       );
  //     };
  //     registerChildRouteFromContext(soleCandidate.route, wrappedElement);
  //   }
  //   onDiscoveryComplete(activeInfo);
  //   return;
  // }

  const [publishCompositeStatus, subscribeCompositeStatus] = createPubSub();
  const patterns = Array.from(candidateSet, (c) => c.route.urlPattern).join(
    ", ",
  );
  const compositeRoute = {
    urlPattern: `composite(${patterns})`,
    isComposite: true,
    active: false,
    subscribeStatus: subscribeCompositeStatus,
    toString: () => `composite(${candidateSet.size} candidates)`,
  };
  const getActiveCandidateInfo = () => {
    for (const candidate of candidateSet) {
      const info = getActiveInfo(candidate);
      if (info) return info;
    }
    return null;
  };
  let activeInfo;
  const subscribeGlobalActiveInfo = (callback) => {
    const [teardown, addTeardown] = createPubSub();
    for (const candidate of candidateSet) {
      // eslint-disable-next-line no-loop-func
      const unsubscribe = subscribeActiveInfo(candidate, () => {
        const previousActiveCandidateInfo = activeInfo;
        const newActiveCandidateInfo = getActiveCandidateInfo();
        if (newActiveCandidateInfo !== previousActiveCandidateInfo) {
          activeInfo = newActiveCandidateInfo;
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
    activeInfo = initialActiveInfo;
  }

  // Create a ref to share activeInfo with the wrapped component
  const activeInfoRef = { current: activeInfo };

  subscribeGlobalActiveInfo((current, previous) => {
    activeInfoRef.current = current;
    publishCompositeStatus(current, previous);
    onActiveRouteChange(current, previous);
  });
  if (registerChildRouteFromContext) {
    const wrappedElement = () => {
      const [slotContent, setSlotContent] = useState(
        activeInfoRef.current?.element || null,
      );

      useEffect(() => {
        const unsubscribe = subscribeGlobalActiveInfo((current) => {
          setSlotContent(current?.element || null);
        });
        return unsubscribe;
      }, []);

      console.log(`🎁 Composite wrappedElement for ${patterns}:`, {
        wrapperElementId: getElementId(element),
        slotElementId: getElementId(slotContent),
        slotContent,
      });

      return (
        <SlotContext.Provider value={slotContent}>
          {element}
        </SlotContext.Provider>
      );
    };
    registerChildRouteFromContext(compositeRoute, wrappedElement);
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
