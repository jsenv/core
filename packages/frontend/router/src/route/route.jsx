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

const renderMatchingDefault = () => null;
const renderLoadingDefault = () => null;
const renderErrorDefault = ({ error }) => {
  let routeErrorText = error && error.message ? error.message : error;
  return <p className="route_error">An error occured: {routeErrorText}</p>;
};

// TODO: if route is registered more than once on a given route we should throw
// <Route route={a} />
// <Route route={a} />
// The above should throw because there is no reason to do that. Doing so would cause strange bugs
// and it's relatively hard to finally realize it's because the route is declared twice
export const Route = ({
  route,
  renderAlways,
  renderMatching,
  renderLoading,
  renderError,
  renderLoaded,
  renderLoadedAsync,
}) => {
  useLayoutEffect(() => {
    onRouterUILoaded();
  }, []);
  if (renderLoaded) {
    return (
      <RouteWithLoadedSync
        route={route}
        renderMatching={renderMatching}
        renderLoading={renderLoading}
        renderError={renderError}
        renderLoaded={renderLoaded}
      />
    );
  }
  if (renderLoadedAsync) {
    return (
      <RouteWithLoadedAsync
        route={route}
        renderMatching={renderMatching}
        renderLoading={renderLoading}
        renderError={renderError}
        renderLoadedAsync={renderLoadedAsync}
      />
    );
  }
  if (renderMatching) {
    return (
      <RouteWithMatchingSync
        route={route}
        renderMatching={renderMatching}
        renderLoading={renderLoading}
        renderError={renderError}
      />
    );
  }
  if (renderAlways) {
    return renderAlways({ route });
  }
  // TODO: throw error explaining loaded, loadedAsync or matching is required
  return null;
};

// cas le plus courant: le composant qu'on veut render est disponible
const RouteWithLoadedSync = ({
  route,
  renderMatching = renderMatchingDefault,
  renderError = renderErrorDefault,
  renderLoading = renderLoadingDefault,
  renderLoaded,
}) => {
  return (
    <RouteHandler
      route={route}
      renderMatching={renderMatching}
      renderLoading={renderLoading}
      renderError={renderError}
      renderLoaded={renderLoaded}
    />
  );
};
// cas du code splitting, on doit faire un import dynamique pour obtenir le composant qu'on veut render
const RouteWithLoadedAsync = ({
  route,
  renderMatching = renderMatchingDefault,
  renderError = renderErrorDefault,
  renderLoading = renderLoadingDefault,
  renderLoadedAsync,
}) => {
  const [renderLoaded, renderLoadedSetter] = useState();
  route.loadUI = async ({ signal }) => {
    const renderLoadedAsyncResult = await renderLoadedAsync({ signal });
    if (!renderLoadedAsyncResult) {
      throw new Error("renderLoadedAsync did not return a function");
    }
    renderLoadedSetter(() => renderLoaded);
  };
  return (
    <RouteHandler
      route={route}
      renderMatching={renderMatching}
      renderLoading={renderLoading}
      renderError={renderError}
      renderLoaded={renderLoaded}
    />
  );
};
// cas plus rare: on veut affiche le composant des qu'il match et gérer soit-meme
// la logique pendant que la route load (en omettant la prop "loading")
const RouteWithMatchingSync = ({
  route,
  renderMatching,
  renderLoading = renderMatching,
  renderError = renderErrorDefault,
}) => {
  return (
    <RouteHandler
      route={route}
      renderMatching={renderMatching}
      renderLoading={renderLoading}
      renderError={renderError}
      renderLoaded={renderMatching}
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
  renderMatching,
  renderLoading,
  renderError,
  renderLoaded,
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
    return renderError(route);
  }
  if (routeIsLoading && !shouldDisplayOldData) {
    return <RouteErrorBoundary route={route} renderChild={renderLoading} />;
  }
  if (routeIsLoaded) {
    if (routeBecomesLoaded) {
      const renderLoadedOriginal = renderLoaded;
      // there is NO other way to find the child node than wrapping it a <div>, erf
      // (and we'll need that for transition and stuff)
      renderLoaded = function renderLoadedWrapper(route) {
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
            {renderLoadedOriginal(route)}
          </div>
        );
      };
    }
    return <RouteErrorBoundary route={route} renderChild={renderLoaded} />;
  }
  if (shouldDisplayOldData) {
    return <RouteErrorBoundary route={route} renderChild={renderLoaded} />;
  }
  return <RouteErrorBoundary route={route} renderChild={renderMatching} />;
};

const RouteErrorBoundary = ({ route, renderChild }) => {
  const [error] = useErrorBoundary();
  if (error) {
    route.reportError(error);
    return null;
  }
  return renderChild(route);
};
