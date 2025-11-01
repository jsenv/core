import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

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
    RouteComponent.reportChildStatus?.(route, active);
  }

  console.log({ active, url });

  return (
    <RouteComponentContext.Provider value={null}>
      {active ? children : null}
    </RouteComponentContext.Provider>
  );
};

const WithoutRoute = ({ children }) => {
  const [discoveredRoutes, setDiscoveredRoutes] = useState(new Set());
  const [activeRoutes, setActiveRoutes] = useState(new Set());

  const registerChildRoute = (route) => {
    setDiscoveredRoutes((prevRoutes) => {
      const newRoutes = new Set(prevRoutes);
      if (!newRoutes.has(route)) {
        newRoutes.add(route);
      }
      return newRoutes;
    });
  };

  const reportChildStatus = (route, isActive) => {
    setActiveRoutes((prevActive) => {
      const newActive = new Set(prevActive);
      if (isActive) {
        newActive.add(route);
      } else {
        newActive.delete(route);
      }
      return newActive;
    });
  };

  // Render children if no routes discovered yet, or if at least one route is active
  const shouldRender = discoveredRoutes.size === 0 || activeRoutes.size > 0;

  return (
    <RouteComponentContext.Provider
      value={{ registerChildRoute, reportChildStatus }}
    >
      {shouldRender ? children : null}
    </RouteComponentContext.Provider>
  );
};
