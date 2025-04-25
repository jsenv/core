import {
  useErrorBoundary,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
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

// TODO: if route is registered more than once on a given route we should throw
// <Route route={a} />
// <Route route={a} />
// The above should throw because there is no reason to do that. Doing so would cause strange bugs
// and it's relatively hard to finally realize it's because the route is declared twice
export const Route = ({
  route,
  // ideally each route is mutually exclusive, when this is not the case AND the two routes should not match at the same time
  // then a route can give an array of routes preventing itself to match
  routesPreventingThisOne,
  always,
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
        routesPreventingThisOne={routesPreventingThisOne}
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
        routesPreventingThisOne={routesPreventingThisOne}
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
        routesPreventingThisOne={routesPreventingThisOne}
        matching={matching}
        loading={loading}
        error={error}
      />
    );
  }
  if (always) {
    const Always = always;
    return <Always route={route}></Always>;
  }
  // TODO: throw error explaining loaded, loadedAsync or matching is required
  return null;
};

// cas le plus courant: le composant qu'on veut render est disponible
const RouteWithLoadedSync = ({
  route,
  routesPreventingThisOne,
  matching,
  error,
  loading,
  loaded,
}) => {
  return (
    <RouteHandler
      route={route}
      routesPreventingThisOne={routesPreventingThisOne}
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
  routesPreventingThisOne,
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
      routesPreventingThisOne={routesPreventingThisOne}
      RouteMatching={matching || RouteMatchingDefaultComponent}
      RouteLoading={loading || RouteLoadingDefaultComponent}
      RouteError={error || RouteErrorDefaultComponent}
      RouteLoaded={RouteLoaded}
    />
  );
};
// cas plus rare: on veut affiche le composant des qu'il match et gérer soit-meme
// la logique pendant que la route load (en omettant la prop "loading")
const RouteWithMatchingSync = ({
  route,
  routesPreventingThisOne,
  matching,
  loading,
  error,
}) => {
  return (
    <RouteHandler
      route={route}
      routesPreventingThisOne={routesPreventingThisOne}
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
  routesPreventingThisOne,
  RouteMatching,
  RouteLoading,
  RouteError,
  RouteLoaded,
}) => {
  let routeIsMatching = useRouteIsMatching(route);
  if (routesPreventingThisOne) {
    for (const routePreventingThisOne of routesPreventingThisOne) {
      const routePreventingThisOneIsMatching = useRouteIsMatching(
        routePreventingThisOne,
      );
      if (routePreventingThisOneIsMatching) {
        routeIsMatching = false;
      }
    }
  }

  const routeIsLoading = useRouteIsLoading(route);
  const routeError = useRouteError(route);
  const routeIsLoaded = useRouteIsLoaded(route);

  const routeIsMatchingPreviousRef = useRef(false);
  const routeBecomesMatching =
    !routeIsMatchingPreviousRef.current && routeIsMatching;
  routeIsMatchingPreviousRef.current = routeIsMatching;
  const routeIsLoadedPreviousRef = useRef(false);
  const routeBecomesLoaded = !routeIsLoadedPreviousRef.current && routeIsLoaded;
  routeIsLoadedPreviousRef.current = routeIsLoaded;
  const routeUIRenderedPromiseRef = useRef();

  if (routeBecomesMatching) {
    let resolve;
    const promise = new Promise((res) => {
      resolve = res;
    });
    routeUIRenderedPromiseRef.current = { promise, resolve };
  }

  route.renderUI = () => {
    return routeUIRenderedPromiseRef.current.promise;
  };

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
    if (routeBecomesLoaded) {
      const RouteLoadedOriginal = RouteLoaded;
      // there is no better way to find the child node than wrapping in a <div>, erf
      RouteLoaded = function RouteLoadedWrapper(props) {
        const ref = useRef();
        useLayoutEffect(() => {
          const routeNode = ref.current.firstChild;
          routeUIRenderedPromiseRef.current.resolve(routeNode);
        }, []);
        return (
          <div ref={ref} style="display:inline">
            <RouteLoadedOriginal {...props} />
          </div>
        );
      };
    }
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
