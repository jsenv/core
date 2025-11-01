import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

// import { ActionRenderer } from "../components/action_renderer.jsx";
import { useContentKey } from "../components/ui_transition.jsx";
import { subscribeRouteStatus } from "./route.js";

export const Routes = ({ children }) => {
  return <>{children}</>;
};

const RouteAncestorContext = createContext(null);
const RouteSlotContext = createContext(null);
export const Route = ({ route, element, children }) => {
  const routeSetRef = useRef(new Set());
  const routeSet = routeSetRef.current;

  let routeIsActive;
  route_from_props: {
    const [, forceRender] = useState(null);
    const routeIsActiveRef = useRef(false);
    const routeRef = useRef();
    if (routeRef.current !== route) {
      const previousRoute = routeRef.current;
      if (previousRoute) {
        routeSet.delete(previousRoute);
      }
      if (!route) {
        routeIsActiveRef.current = false;
      } else {
        routeSet.add(route);
        routeIsActiveRef.current = route.active;
        subscribeRouteStatus(route, () => {
          routeIsActiveRef.current = route.active;
          forceRender({});
        });
      }
      routeRef.current = route;
    }
    routeIsActive = routeIsActiveRef.current;
  }

  let hasActiveNestedRoute = false;
  const activeRouteSetRef = useRef(new Set()); // Set<route> - tracks which routes are currently active
  const activeRouteSet = activeRouteSetRef.current;
  route_from_children: {
    const [, forceRender] = useState(null);
    const discoveredRouteMapRef = useRef(new Map()); // Map<route, unsubscribe>
    const discoveredRouteMap = discoveredRouteMapRef.current;
    const hasRenderedOnceRef = useRef(false);

    const onRouteDiscovered = (route) => {
      routeSet.add(route);
      // Add to discovered routes
      const unsubscribe = subscribeRouteStatus(route, () => {
        onRouteStatusChange(route);
      });
      discoveredRouteMap.set(route, unsubscribe);
      // Add to active set if route is currently active
      if (route.active) {
        activeRouteSet.add(route);
      }
    };
    const onRouteBecomesActive = (route) => {
      const wasEmpty = activeRouteSet.size === 0;
      activeRouteSet.add(route);
      // If we went from 0 to 1 active route, trigger re-render
      if (wasEmpty) {
        forceRender({});
      }
    };
    const onRouteBecomesInactive = (route) => {
      const hadActiveRoutes = activeRouteSet.size > 0;
      activeRouteSet.delete(route);
      // If we went from having active routes to none, trigger re-render
      if (hadActiveRoutes && activeRouteSet.size === 0) {
        forceRender({});
      }
    };
    const onRouteStatusChange = (route) => {
      if (route.active) {
        onRouteBecomesActive(route);
      } else {
        onRouteBecomesInactive(route);
      }
    };

    const registerChildRoute = (route) => {
      // Skip if already registered
      if (discoveredRouteMap.has(route)) {
        return;
      }
      onRouteDiscovered(route);
    };
    const contextValue = useMemo(() => {
      return {
        registerChildRoute,
      };
    }, []);

    useLayoutEffect(() => {
      hasRenderedOnceRef.current = true;

      return () => {
        for (const unsubscribe of discoveredRouteMap.values()) {
          unsubscribe();
        }
        discoveredRouteMap.clear();
        activeRouteSet.clear();
      };
    }, []);

    <RouteAncestorContext.Provider value={contextValue}>
      {children}
    </RouteAncestorContext.Provider>;
  }

  const active = routeIsActive || hasActiveNestedRoute;
  // mais pas sur que ce soit suffisant parce que pour la route principale
  // il faudrait subscribe a l'url (si elle existe)
  // tandis que pour les routes enfants on peut se contenter du url pattern input
  const routeIdentifier = Array.from(routeSet).map((r) => r.url);
  useContentKey(routeIdentifier, active);

  if (!active) {
    return null;
  }
  return (
    <RouteSlotContext.Provider value={children}>
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
