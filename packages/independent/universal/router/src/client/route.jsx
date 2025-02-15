import { toChildArray } from "preact";
import { useErrorBoundary, useRef } from "preact/hooks";
import {
  useRouteError,
  useRouteIsLoaded,
  useRouteIsLoading,
  useRouteIsMatching,
  useRouteLoadData,
} from "./route.js";

const RouteMatchingDefaultComponent = () => null;
const RouteErrorDefaultComponent = ({ error }) => {
  return <p>An error occured: {error.message}</p>;
};
const RouteLoadingDefaultComponent = () => null;

export const Route = ({
  route,
  matching = RouteMatchingDefaultComponent,
  error = RouteErrorDefaultComponent,
  loading = RouteLoadingDefaultComponent,
  loaded,
}) => {
  const ComponentRenderedWhileMatching = matching;
  const ComponentRenderedWhileLoading = loading;
  const ComponentRenderedWhileError = error;
  const ComponentRenderWhileLoaded = loaded;
  const routeError = useRouteError(route);
  const routeIsMatching = useRouteIsMatching(route);
  const routeIsLoading = useRouteIsLoading(route);
  const routeIsLoaded = useRouteIsLoaded(route);
  const routeLoadedData = useRouteLoadData(route);

  if (!routeIsMatching) {
    return null;
  }
  if (routeError) {
    return <ComponentRenderedWhileError route={route} error={routeError} />;
  }
  if (routeIsLoading) {
    return (
      <RouteErrorBoundary route={route}>
        <ComponentRenderedWhileLoading />
      </RouteErrorBoundary>
    );
  }
  if (routeIsLoaded) {
    return (
      <RouteErrorBoundary route={route}>
        <ComponentRenderWhileLoaded data={routeLoadedData} />
      </RouteErrorBoundary>
    );
  }
  return (
    <RouteErrorBoundary route={route}>
      <ComponentRenderedWhileMatching />
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

export const RouteV1 = ({ route, children }) => {
  const [error, resetError] = useErrorBoundary();
  const routeIsMatching = useRouteIsMatching(route);
  const routeIsLoaded = useRouteIsLoaded(route);
  const isFirstRenderAfterLoadRef = useRef(true);

  children = toChildArray(children);
  let ComponentRenderedWhileMatching = null;
  let ComponentRenderedWhileLoading = null;
  let ComponentRenderedWhileError = RouteErrorDefaultComponent;
  let ComponentRenderWhileLoaded;

  let index = -1;
  let lastIndexOfChildUsingSpecialProp = -1;
  for (const child of children) {
    index++;
    if (child.props.matching) {
      ComponentRenderedWhileMatching = child;
      lastIndexOfChildUsingSpecialProp = index;
      continue;
    }
    if (child.props.loading) {
      ComponentRenderedWhileLoading = child;
      lastIndexOfChildUsingSpecialProp = index;
      continue;
    }
    if (child.props.error) {
      ComponentRenderedWhileError = child;
      lastIndexOfChildUsingSpecialProp = index;
      continue;
    }
  }
  if (lastIndexOfChildUsingSpecialProp === -1) {
    ComponentRenderWhileLoaded = <>{children}</>;
  } else {
    ComponentRenderWhileLoaded = (
      <>{children.slice(lastIndexOfChildUsingSpecialProp + 1)}</>
    );
  }
  if (!routeIsMatching) {
    return ComponentRenderedWhileMatching;
  }
  if (!routeIsLoaded) {
    resetError();
    isFirstRenderAfterLoadRef.current = true;
    return ComponentRenderedWhileLoading;
  }
  if (isFirstRenderAfterLoadRef.current) {
    isFirstRenderAfterLoadRef.current = false;
    if (error) {
      route.reportError(error);
      return ComponentRenderedWhileError;
    }
  }
  return ComponentRenderWhileLoaded;
};

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
    if (isFirstRenderAfterLoadRef.current) {
      isFirstRenderAfterLoadRef.current = false;
      if (error) {
        route.reportError(error);
        return <p>An error occured: {error.message}</p>;
      }
    }
    return <Component />;
  };
  return ConnectedComponent;
};
