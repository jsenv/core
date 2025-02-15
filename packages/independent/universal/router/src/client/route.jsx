import { useErrorBoundary, useRef } from "preact/hooks";
import { useRouteIsLoaded, useRouteIsMatching } from "./route.js";

export const connectRoute = (route, Component) => {
  const ConnectedComponent = () => {
    const [error, resetError] = useErrorBoundary();
    const routeIsMatching = useRouteIsMatching(route);
    const routeIsLoaded = useRouteIsLoaded(route);
    const isFirstRenderAfterLoadRef = useRef(true);
    if (!routeIsMatching) {
      return null;
    }
    if (!routeIsLoaded) {
      resetError();
      isFirstRenderAfterLoadRef.current = true;
      return null;
    }
    if (error) {
      if (isFirstRenderAfterLoadRef.current) {
        isFirstRenderAfterLoadRef.current = false;
        route.reportError(error);
      }
      return <p>An error occured: {error.message}</p>;
    }
    return <Component />;
  };
  return ConnectedComponent;
};
