import { useErrorBoundary, useLayoutEffect, useState } from "preact/hooks";
import {
  onRouterUILoaded,
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
  loading,
  error,
  loaded,
  loadedAsync,
}) => {
  useLayoutEffect(() => {
    onRouterUILoaded();
  }, []);
  if (loaded) {
    return (
      <RouteWithLoadedSync
        route={route}
        matching={matching}
        loading={loading}
        error={error}
        loaded={loaded}
      />
    );
  }
  if (loadedAsync) {
    return (
      <RouteWithLoadedAsync
        route={route}
        matching={matching}
        loading={loading}
        error={error}
        loadedAsync={loadedAsync}
      />
    );
  }
  if (matching) {
    return (
      <RouteWithMatchingSync
        route={route}
        matching={matching}
        loading={loading}
        error={error}
      />
    );
  }
  // TODO: throw error explaining loaded, loadedAsync or matching is required
  return null;
};

// cas le plus courant: le composant qu'on veut render est disponible
const RouteWithLoadedSync = ({ route, matching, error, loading, loaded }) => {
  return (
    <RouteHandler
      route={route}
      RouteMatching={matching || RouteMatchingDefaultComponent}
      RouteLoading={loading || RouteLoadingDefaultComponent}
      RouteError={error || RouteErrorDefaultComponent}
      RouteLoaded={loaded}
    />
  );
};
// cas du code splitting, on doit faire un import dynamique pour obtenir le composant qu'on veut render
const RouteWithLoadedAsync = ({
  route,
  matching,
  error,
  loading,
  loadedAsync,
}) => {
  const [RouteLoaded, RouteLoadedSetter] = useState();
  route.loadUI = async ({ signal }) => {
    const loadedAsyncResult = await loadedAsync({ signal });
    if (!loadedAsyncResult) {
      throw new Error("loadedAsync did not return a component");
    }
    RouteLoadedSetter(() => loadedAsyncResult);
  };
  return (
    <RouteHandler
      route={route}
      RouteMatching={matching || RouteMatchingDefaultComponent}
      RouteLoading={loading || RouteLoadingDefaultComponent}
      RouteError={error || RouteErrorDefaultComponent}
      RouteLoaded={RouteLoaded}
    />
  );
};
// cas plus rare: on veut affiche le composant des qu'il match et gérer soit-meme
// la logique pendant que la route load (en omettant la prop "loading")
const RouteWithMatchingSync = ({ route, matching, loading, error }) => {
  return (
    <RouteHandler
      route={route}
      RouteMatching={matching}
      RouteLoading={loading || matching}
      RouteError={error || RouteErrorDefaultComponent}
      RouteLoaded={matching}
    />
  );
};
// TODO: un 4eme cas avec matchingAsync
const RouteHandler = ({
  route,
  RouteMatching,
  RouteLoading,
  RouteError,
  RouteLoaded,
}) => {
  const routeIsMatching = useRouteIsMatching(route);
  const routeIsLoading = useRouteIsLoading(route);
  const routeError = useRouteError(route);
  const routeIsLoaded = useRouteIsLoaded(route);

  if (!routeIsMatching) {
    return null;
  }
  if (routeError) {
    return <RouteError route={route} />;
  }
  if (routeIsLoading) {
    return <RouteErrorBoundary route={route} Child={RouteLoading} />;
  }
  if (routeIsLoaded) {
    return <RouteErrorBoundary route={route} Child={RouteLoaded} />;
  }
  return <RouteErrorBoundary route={route} Child={RouteMatching} />;
};

const RouteErrorBoundary = ({ route, Child }) => {
  const [error] = useErrorBoundary();
  if (error) {
    route.reportError(error);
    return null;
  }
  return <Child route={route} />;
};
