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
import { subscribeRouteStatus, useRouteStatus } from "./route.js";

const RouteComponentContext = createContext();

export const Route = ({ route, children }) => {
  if (!route) {
    return <ParentRoute>{children}</ParentRoute>;
  }
  return <RegularRoute route={route}>{children}</RegularRoute>;
};

const ParentRoute = ({ children }) => {
  const [, forceRender] = useState({});
  const discoveredRouteMapRef = useRef(new Map()); // Map<route, unsubscribe>
  const hasRenderedOnceRef = useRef(false);

  const hasActiveRoute = () => {
    const discoveredRouteMap = discoveredRouteMapRef.current;
    return Array.from(discoveredRouteMap.keys()).some((route) => route.active);
  };

  const updateActiveState = () => {
    // Only trigger re-render after first render is complete
    if (hasRenderedOnceRef.current) {
      forceRender({});
    }
  };

  const registerChildRoute = (route) => {
    const discoveredRouteMap = discoveredRouteMapRef.current;

    // Skip if already registered
    if (discoveredRouteMap.has(route)) {
      return;
    }

    // Subscribe immediately when route is discovered
    const unsubscribe = subscribeRouteStatus(route, updateActiveState);
    discoveredRouteMap.set(route, unsubscribe);

    // No state update during first render - let it complete naturally
  };

  const contextValue = useMemo(() => {
    return {
      registerChildRoute,
    };
  }, []);

  // Clean up subscriptions on unmount
  useLayoutEffect(() => {
    hasRenderedOnceRef.current = true;

    return () => {
      const discoveredRouteMap = discoveredRouteMapRef.current;
      for (const unsubscribe of discoveredRouteMap.values()) {
        unsubscribe();
      }
      discoveredRouteMap.clear();
    };
  }, []);

  // Render children if:
  // 1. First render (to allow route discovery)
  // 2. At least one child route is active
  const shouldRender = !hasRenderedOnceRef.current || hasActiveRoute();

  return (
    <RouteComponentContext.Provider value={contextValue}>
      {shouldRender ? children : null}
    </RouteComponentContext.Provider>
  );
};

const RegularRoute = ({ route, children }) => {
  const RouteComponent = useContext(RouteComponentContext);

  const { active, url } = useRouteStatus(route);
  useContentKey(url, active);

  // Register this route with parent for discovery
  if (RouteComponent) {
    RouteComponent.registerChildRoute(route);
  }

  return (
    <RouteComponentContext.Provider value={null}>
      {active ? children : null}
    </RouteComponentContext.Provider>
  );
};
