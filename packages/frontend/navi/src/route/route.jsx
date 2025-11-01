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

  const updateActiveRouteSet = () => {
    const discoveredRouteMap = discoveredRouteMapRef.current;
    const activeRoutesSet = activeRoutesSetRef.current;

    // Clear and rebuild the active routes set
    activeRoutesSet.clear();
    for (const route of discoveredRouteMap.keys()) {
      if (route.active) {
        activeRoutesSet.add(route);
      }
    }
  };

  const updateActiveState = () => {
    const previouslyHadActiveRoutes = activeRoutesSetRef.current.size > 0;

    // Update the active routes set
    updateActiveRouteSet();

    const currentlyHasActiveRoutes = activeRoutesSetRef.current.size > 0;

    // Only trigger re-render after first render is complete
    // AND if the "has active routes" state actually changed
    if (
      hasRenderedOnceRef.current &&
      previouslyHadActiveRoutes !== currentlyHasActiveRoutes
    ) {
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

    // Update active routes set during discovery (but don't trigger re-render during first render)
    updateActiveRouteSet();
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
