import { createPubSub } from "@jsenv/dom";
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
import { useRouteStatus } from "./route.js";

const RouteComponentContext = createContext();

export const Route = ({ route, children }) => {
  if (!route) {
    return <ParentRoute>{children}</ParentRoute>;
  }
  return <RegularRoute route={route}>{children}</RegularRoute>;
};

const ParentRoute = ({ children }) => {
  const discoveredRouteSetRef = useRef(new Set());
  const [hasActiveRoute, setHasActiveRoute] = useState(false);
  const hasRenderedOnceRef = useRef(false);

  const registerChildRoute = (route) => {
    discoveredRouteSetRef.current.add(route);
  };

  const contextValue = useMemo(() => {
    return {
      registerChildRoute,
      reportChildStatus: () => {}, // No-op since we handle status ourselves
    };
  }, []);

  // Subscribe to all discovered routes after first render
  useLayoutEffect(() => {
    const discoveredRouteSet = discoveredRouteSetRef.current;
    hasRenderedOnceRef.current = true;

    if (discoveredRouteSet.size === 0) {
      console.warn(
        `Route component without 'route' prop was rendered but no child Route components were discovered. ` +
          `This Route wrapper will always render its children. ` +
          `Either add a 'route' prop or ensure child Route components are present.`,
      );
      return null;
    }

    // Subscribe to each discovered route
    const [teardown, addTeardown] = createPubSub();
    // Initial check
    const hasAnyActive = Array.from(discoveredRouteSet).some((r) => r.active);
    setHasActiveRoute(hasAnyActive);
    for (const route of discoveredRouteSet) {
      const unsubscribe = route.subscribe(() => {
        // Check if any route is active
        const hasAnyActive = Array.from(discoveredRouteSet).some(
          (r) => r.active,
        );
        setHasActiveRoute(hasAnyActive);
      });
      addTeardown(unsubscribe);
    }
    return () => {
      teardown();
    };
  }, []);

  // Render children if:
  // 1. First render (to allow route discovery)
  // 2. At least one child route is active
  const shouldRender = !hasRenderedOnceRef.current || hasActiveRoute;

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
