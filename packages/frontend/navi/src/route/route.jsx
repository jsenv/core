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
    return <WithoutRoute>{children}</WithoutRoute>;
  }
  return <WithRoute route={route}>{children}</WithRoute>;
};

const WithRoute = ({ route, children }) => {
  const RouteComponent = useContext(RouteComponentContext);

  const { active, url } = useRouteStatus(route);
  useContentKey(url, active);

  // Register this route and its active status with parent
  if (RouteComponent) {
    RouteComponent.registerChildRoute(route);
    RouteComponent.reportChildStatus(route, active);
  }

  return (
    <RouteComponentContext.Provider value={null}>
      {active ? children : null}
    </RouteComponentContext.Provider>
  );
};

const WithoutRoute = ({ children }) => {
  const discoveredRouteSetRef = useRef(new Set());
  const activeRoutesRef = useRef(new Set());
  const [hasActiveRoute, setHasActiveRoute] = useState(false);
  const hasRenderedOnceRef = useRef(false);

  const registerChildRoute = (route) => {
    discoveredRouteSetRef.current.add(route);
  };

  const reportChildStatus = (route, isActive) => {
    const activeRoutes = activeRoutesRef.current;

    if (isActive) {
      activeRoutes.add(route);
    } else {
      activeRoutes.delete(route);
    }

    setHasActiveRoute(activeRoutes.size > 0);
  };
  const contextValue = useMemo(() => {
    return {
      registerChildRoute,
      reportChildStatus,
    };
  }, []);

  // Check after render if we have discovered any routes
  useLayoutEffect(() => {
    const discoveredRouteSet = discoveredRouteSetRef.current;
    hasRenderedOnceRef.current = true;
    if (discoveredRouteSet.size === 0) {
      console.warn(
        `Route component without 'route' prop was rendered but no child Route components were discovered. ` +
          `This Route wrapper will always render its children. ` +
          `Either add a 'route' prop or ensure child Route components are present.`,
      );
    }
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
