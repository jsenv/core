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
  const [, forceRender] = useState(null);
  const discoveredRouteMapRef = useRef(new Map()); // Map<route, unsubscribe>
  const activeRoutesSetRef = useRef(new Set()); // Set<route> - tracks which routes are currently active
  const hasRenderedOnceRef = useRef(false);

  const onRouteDiscovered = (route) => {
    const discoveredRouteMap = discoveredRouteMapRef.current;
    const activeRoutesSet = activeRoutesSetRef.current;

    // Add to discovered routes
    const unsubscribe = subscribeRouteStatus(route, () => {
      onRouteStatusChange(route);
    });
    discoveredRouteMap.set(route, unsubscribe);

    // Add to active set if route is currently active
    if (route.active) {
      activeRoutesSet.add(route);
    }
  };

  const onRouteBecomesActive = (route) => {
    const activeRoutesSet = activeRoutesSetRef.current;
    const wasEmpty = activeRoutesSet.size === 0;

    activeRoutesSet.add(route);

    // If we went from 0 to 1 active route, trigger re-render
    if (wasEmpty && hasRenderedOnceRef.current) {
      forceRender({});
    }
  };
  const onRouteBecomesInactive = (route) => {
    const activeRoutesSet = activeRoutesSetRef.current;
    const hadActiveRoutes = activeRoutesSet.size > 0;

    activeRoutesSet.delete(route);

    // If we went from having active routes to none, trigger re-render
    if (
      hadActiveRoutes &&
      activeRoutesSet.size === 0 &&
      hasRenderedOnceRef.current
    ) {
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
    const discoveredRouteMap = discoveredRouteMapRef.current;

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

  // Clean up subscriptions on unmount
  useLayoutEffect(() => {
    hasRenderedOnceRef.current = true;

    return () => {
      const discoveredRouteMap = discoveredRouteMapRef.current;
      for (const unsubscribe of discoveredRouteMap.values()) {
        unsubscribe();
      }
      discoveredRouteMap.clear();
      activeRoutesSetRef.current.clear();
    };
  }, []);

  // Render children if:
  // 1. First render (to allow route discovery) - isFirstRenderToDiscoverNestedRoutes
  // 2. At least one child route is active
  const isFirstRenderToDiscoverNestedRoutes = !hasRenderedOnceRef.current;
  const hasActiveNestedRoutes = activeRoutesSetRef.current.size > 0;
  const shouldRender =
    isFirstRenderToDiscoverNestedRoutes || hasActiveNestedRoutes;

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
