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

  if (RouteComponent && route) {
    RouteComponent.registerChildRoute(route);
  }

  const { active, url } = useRouteStatus(route);
  useContentKey(url, active);

  return (
    <RouteComponentContext.Provider value={route}>
      {children}
    </RouteComponentContext.Provider>
  );
};

const WithoutRoute = ({ children }) => {
  const [discoveredRoutes, setDiscoveredRoutes] = useState(new Set());
  
  const registerChildRoute = (route) => {
    setDiscoveredRoutes((prevRoutes) => {
      const newRoutes = new Set(prevRoutes);
      if (!newRoutes.has(route)) {
        newRoutes.add(route);
      }
      return newRoutes;
    });
  };

  // Check if any discovered route is currently active
  const activeRoutes = Array.from(discoveredRoutes).filter(route => {
    const { active } = useRouteStatus(route);
    return active;
  });

  const shouldRender = discoveredRoutes.size === 0 || activeRoutes.length > 0;

  return (
    <RouteComponentContext.Provider value={{ registerChildRoute }}>
      {shouldRender ? children : null}
    </RouteComponentContext.Provider>
  );
};
