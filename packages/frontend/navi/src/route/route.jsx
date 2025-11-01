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
    if (typeof element === "function") {
      return element(routeSlot);
    }
    return element;
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

const useForceRender = () => {
  const [, setState] = useState(null);
  return () => setState({});
};
