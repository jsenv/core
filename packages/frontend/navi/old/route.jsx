import { createContext, options } from "preact";
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

// Store original commit function
const originalCommit = options.commit;
let currentDiscoverySession = null;
let allowedVNodeSet = new WeakSet(); // VNodes that are allowed to be committed to DOM

// Intercept DOM commits during discovery phase
options.commit = (vnode, commitQueue) => {
  if (!currentDiscoverySession) {
    // Normal operation
    if (originalCommit) {
      originalCommit(vnode, commitQueue);
    }
    return;
  }

  // During discovery: only allow commits for vnodes of active routes
  if (allowedVNodeSet.has(vnode)) {
    if (originalCommit) {
      originalCommit(vnode, commitQueue);
    }
  }
  // Skip commits for inactive route vnodes
};

const RouteComponentContext = createContext();
const DiscoveryContext = createContext(null);

export const Routes = ({ children }) => {
  const [discoveryPhase, setDiscoveryPhase] = useState("discovering"); // 'discovering' | 'evaluating' | 'complete'
  const discoverySessionRef = useRef(Symbol("discovery-session"));
  const discoveredRoutesRef = useRef(new Set());

  const registerDiscoveredRoute = (route) => {
    discoveredRoutesRef.current.add(route);
  };

  const startDiscovery = () => {
    currentDiscoverySession = discoverySessionRef.current;
    allowedVNodeSet = new WeakSet();
    setDiscoveryPhase("discovering");
  };

  const finishDiscoveryAndEvaluate = () => {
    // Discovery complete, now evaluate which routes are active
    setDiscoveryPhase("evaluating");

    // Mark vnodes of active routes as allowed
    const discoveredRoutes = Array.from(discoveredRoutesRef.current);
    for (const route of discoveredRoutes) {
      if (route.active) {
        // We need a way to mark the vnodes of this route as allowed...
        // This is the tricky part
      }
    }

    setDiscoveryPhase("complete");
    currentDiscoverySession = null;
  };

  const discoveryContextValue = useMemo(
    () => ({
      startDiscovery,
      finishDiscoveryAndEvaluate,
      registerDiscoveredRoute,
      discoveryPhase,
    }),
    [discoveryPhase],
  );

  return (
    <DiscoveryContext.Provider value={discoveryContextValue}>
      {children}
    </DiscoveryContext.Provider>
  );
};

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
  const discoveryContext = useContext(DiscoveryContext);

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
    if (wasEmpty) {
      forceRender({});
    }
  };
  const onRouteBecomesInactive = (route) => {
    const activeRoutesSet = activeRoutesSetRef.current;
    const hadActiveRoutes = activeRoutesSet.size > 0;
    activeRoutesSet.delete(route);
    // If we went from having active routes to none, trigger re-render
    if (hadActiveRoutes && activeRoutesSet.size === 0) {
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

  // Discovery phase: render children but prevent DOM commits
  const isFirstRenderToDiscoverNestedRoutes = !hasRenderedOnceRef.current;
  const hasActiveNestedRoutes = activeRoutesSetRef.current.size > 0;

  if (isFirstRenderToDiscoverNestedRoutes) {
    // Enable discovery mode - components render but no DOM operations

    discoveryContext.startDiscovery();

    const vnode = (
      <RouteComponentContext.Provider value={contextValue}>
        {children}
      </RouteComponentContext.Provider>
    );

    // After discovery, evaluate which routes are active and mark their vnodes
    // Check if we have any active routes
    if (hasActiveNestedRoutes) {
      // Mark this vnode as allowed for DOM insertion
      allowedVNodeSet.add(vnode);
    }
    discoveryContext.finishDiscoveryAndEvaluate();

    return vnode;
  }

  // Normal phase: render conditionally based on active routes
  return (
    <RouteComponentContext.Provider value={contextValue}>
      {hasActiveNestedRoutes ? children : null}
    </RouteComponentContext.Provider>
  );
};

const RegularRoute = ({ route, children }) => {
  const RouteComponent = useContext(RouteComponentContext);
  const discoveryContext = useContext(DiscoveryContext);

  const { active, url } = useRouteStatus(route);
  useContentKey(url, active);

  // Register this route with parent for discovery
  if (RouteComponent) {
    RouteComponent.registerChildRoute(route);
  }

  const vnode = (
    <RouteComponentContext.Provider value={null}>
      {active ? children : null}
    </RouteComponentContext.Provider>
  );

  // During discovery phase, mark this vnode as allowed if route is active
  if (discoveryContext.discoveryPhase === "discovering" && active) {
    allowedVNodeSet.add(vnode);
  }

  return vnode;
};
