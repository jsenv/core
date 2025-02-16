import { useErrorBoundary, useRef } from "preact/hooks";
import {
  useRouteError,
  useRouteIsLoaded,
  useRouteIsLoading,
  useRouteIsMatching,
} from "./route.js";

const RouteMatchingDefaultComponent = () => null;
const RouteLoadingDefaultComponent = () => null;
const RouteErrorDefaultComponent = ({ route }) => {
  return <p>An error occured: {route.error.message}</p>;
};

export const Route = ({
  route,
  matching,
  error,
  loading,
  loaded,
  loadedAsync,
}) => {
  let ComponentRenderedWhileMatching = matching;
  let ComponentRenderedWhileLoading = loading;
  let ComponentRenderedWhileError = error;
  let ComponentRenderedWhileLoaded = loaded;
  if (loaded) {
    ComponentRenderedWhileMatching = matching || RouteMatchingDefaultComponent;
    ComponentRenderedWhileError = error || RouteErrorDefaultComponent;
    ComponentRenderedWhileLoading = loading || RouteLoadingDefaultComponent;
    ComponentRenderedWhileLoaded = loaded;
  } else if (matching) {
    ComponentRenderedWhileMatching = matching;
    ComponentRenderedWhileError = error || RouteErrorDefaultComponent;
    ComponentRenderedWhileLoading = loading || matching;
    ComponentRenderedWhileLoaded = matching;
  }
  const routeError = useRouteError(route);
  const routeIsMatching = useRouteIsMatching(route);
  const routeIsLoading = useRouteIsLoading(route);
  const routeIsLoaded = useRouteIsLoaded(route);
  const routeStartsMatchingRef = useRef(false);

  if (!routeIsMatching) {
    routeStartsMatchingRef.current = false;
    return null;
  }
  if (routeStartsMatchingRef.current === false) {
    routeStartsMatchingRef.current = true;
    // this will keep the route in loading state until it resolves
    route.loadUI = async () => {
      ComponentRenderedWhileLoaded = await loadedAsync();
    };
  }
  if (routeError) {
    return <ComponentRenderedWhileError route={route} />;
  }
  if (routeIsLoading) {
    return (
      <RouteErrorBoundary route={route}>
        <ComponentRenderedWhileLoading route={route} />
      </RouteErrorBoundary>
    );
  }
  if (routeIsLoaded) {
    return (
      <RouteErrorBoundary route={route}>
        <ComponentRenderedWhileLoaded route={route} />
      </RouteErrorBoundary>
    );
  }
  return (
    <RouteErrorBoundary route={route}>
      <ComponentRenderedWhileMatching route={route} />
    </RouteErrorBoundary>
  );
};

const RouteErrorBoundary = ({ route, children }) => {
  const [error] = useErrorBoundary();
  if (error) {
    route.reportError(error);
    return null;
  }
  return <>{children}</>;
};
