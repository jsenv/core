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

// TODO: we likely want to catch eventual error while rendering matching and loading components
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

  const [errorFromBoundary, resetError] = useErrorBoundary();
  const routeError = useRouteError(route);
  const routeIsMatching = useRouteIsMatching(route);
  const routeIsLoading = useRouteIsLoading(route);
  const routeIsLoaded = useRouteIsLoaded(route);
  const routeLoadedData = useRouteLoadData(route);
  const isMatchingFirstRenderRef = useRef(false);
  const isLoadingFirstRenderRef = useRef(false);
  const isLoadedFirstRenderRef = useRef(false);

  if (!routeIsMatching) {
    resetError();
    isMatchingFirstRenderRef.current = false;
    isLoadingFirstRenderRef.current = false;
    isLoadedFirstRenderRef.current = false;
    return null;
  }
  if (routeIsLoading) {
    if (errorFromBoundary && isLoadingFirstRenderRef.current) {
      route.reportError(errorFromBoundary);
      return null;
    }
    if (isMatchingFirstRenderRef.current === false) {
      isLoadingFirstRenderRef.current = true;
    }
    return <ComponentRenderedWhileLoading route={route} />;
  }
  if (routeError) {
    return <ComponentRenderedWhileError route={route} error={routeError} />;
  }
  if (routeIsLoaded) {
    if (errorFromBoundary && isLoadedFirstRenderRef.current) {
      route.reportError(errorFromBoundary);
      return null;
    }
    if (isLoadedFirstRenderRef.current === false) {
      isLoadedFirstRenderRef.current = true;
    }
    return <ComponentRenderWhileLoaded route={route} data={routeLoadedData} />;
  }
  if (errorFromBoundary && isMatchingFirstRenderRef.current) {
    route.reportError(errorFromBoundary);
    return null;
  }
  if (isMatchingFirstRenderRef.current === false) {
    isMatchingFirstRenderRef.current = true;
  }
  return <ComponentRenderedWhileMatching route={route} />;
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
