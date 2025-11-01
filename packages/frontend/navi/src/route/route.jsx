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

  let routeIsActive;
  route_from_props: {
    const forceRender = useForceRender();
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
    routeIsActive = routeIsActiveRef.current;
  }

  const nestedActiveRouteRef = useRef(null);
  const discoveredRouteMapRef = useRef(new Map()); // Map<route, { element, unsubscribe}>
  const discoveredRouteMap = discoveredRouteMapRef.current;
  route_from_children: {
    const forceRender = useForceRender();
    const hasRenderedOnceRef = useRef(false);

    const onRouteDiscovered = (route, { element }) => {
      console.log("discovered", route.url);
      // Add to discovered routes
      const unsubscribe = subscribeRouteStatus(route, () => {
        onRouteStatusChange(route);
      });
      discoveredRouteMap.set(route, { element, unsubscribe });
      // Add to active set if route is currently active
      if (route.active) {
        nestedActiveRouteRef.current = route;
      }
    };
    const onRouteBecomesActive = (route) => {
      console.log("route becomes active", route.url);
      if (nestedActiveRouteRef.current === route) {
        return;
      }
      nestedActiveRouteRef.current = route;
      forceRender();
    };
    const onRouteBecomesInactive = (route) => {
      if (nestedActiveRouteRef.current === route) {
        nestedActiveRouteRef.current = null;
        forceRender();
      }
    };
    const onRouteStatusChange = (route) => {
      if (route.active) {
        onRouteBecomesActive(route);
      } else {
        onRouteBecomesInactive(route);
      }
    };

    const registerChildRoute = (route, { element }) => {
      // Skip if already registered
      if (discoveredRouteMap.has(route)) {
        return;
      }
      onRouteDiscovered(route, { element });
    };
    const contextValue = useMemo(() => {
      return {
        registerChildRoute,
      };
    }, []);

    useLayoutEffect(() => {
      hasRenderedOnceRef.current = true;
      forceRender();
      return () => {
        for (const { unsubscribe } of discoveredRouteMap.values()) {
          unsubscribe();
        }
        discoveredRouteMap.clear();
      };
    }, []);

    <RouteAncestorContext.Provider value={contextValue}>
      {children}
    </RouteAncestorContext.Provider>;
  }

  const nestedActiveRoute = nestedActiveRouteRef.current;
  const active = Boolean(routeIsActive || nestedActiveRoute);
  console.log(route?.url, { routeIsActive, active });
  if (!active) {
    return null;
  }
  const routeSlot = nestedActiveRoute
    ? discoveredRouteMap.get(nestedActiveRoute).element
    : null;
  return (
    <RouteSlotContext.Provider value={routeSlot}>
      {element}
    </RouteSlotContext.Provider>
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
  return () => setState({});
};
