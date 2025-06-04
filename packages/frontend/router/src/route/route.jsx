import {
  useErrorBoundary,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { onRouterUILoaded } from "./route.js";
import {
  useRouteError,
  useRouteIsLoaded,
  useRouteIsLoading,
  useRouteIsMatching,
} from "./route_hooks.js";

const RouteMatchingDefaultComponent = () => null;
const RouteLoadingDefaultComponent = () => null;
const RouteErrorDefaultComponent = ({ route }) => {
  const { error } = route;
  let routeErrorText = error && error.message ? error.message : error;
  return <p>An error occured: {routeErrorText}</p>;
};

// TODO: if route is registered more than once on a given route we should throw
// <Route route={a} />
// <Route route={a} />
// The above should throw because there is no reason to do that. Doing so would cause strange bugs
// and it's relatively hard to finally realize it's because the route is declared twice
export const Route = ({
  route,
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
  if (always) {
    const Always = always;
    return <Always route={route}></Always>;
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

const routeWeakMap = new WeakMap();
const useRouteUIRenderedPromise = (route) => {
  const routeUIRenderedPromise = routeWeakMap.get(route);
  if (routeUIRenderedPromise) {
    return routeUIRenderedPromise;
  }
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  promise.resolve = resolve;
  routeWeakMap.set(route, promise);
  return promise;
};

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

  const routeIsMatchingPreviousRef = useRef(false);
  routeIsMatchingPreviousRef.current = routeIsMatching;
  const routeIsLoadedPreviousRef = useRef(false);
  const routeBecomesLoaded = !routeIsLoadedPreviousRef.current && routeIsLoaded;
  routeIsLoadedPreviousRef.current = routeIsLoaded;
  const routeUIRenderedPromise = useRouteUIRenderedPromise(route);
  const shouldDisplayOldData =
    route.canDisplayOldData && route.dataSignal.peek() !== undefined;

  route.renderUI = () => {
    return routeUIRenderedPromise;
  };

  if (!routeIsMatching) {
    return null;
  }
  if (routeError) {
    return <RouteError route={route} />;
  }
  if (routeIsLoading && !shouldDisplayOldData) {
    return <RouteErrorBoundary route={route} Child={RouteLoading} />;
  }
  if (routeIsLoaded) {
    if (routeBecomesLoaded) {
      const RouteLoadedOriginal = RouteLoaded;
      // there is NO other way to find the child node than wrapping it a <div>, erf
      // (and we'll need that for transition and stuff)
      RouteLoaded = function RouteLoadedWrapper(props) {
        const ref = useRef();
        useLayoutEffect(() => {
          const routeNode = ref.current.firstChild;
          routeUIRenderedPromise.resolve(routeNode);
          return () => {
            // cleanup
            routeWeakMap.delete(route);
          };
        }, []);
        return (
          <div ref={ref} style="display:block">
            <RouteLoadedOriginal {...props} />
          </div>
        );
      };
    }
    return <RouteErrorBoundary route={route} Child={RouteLoaded} />;
  }
  if (shouldDisplayOldData) {
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
