import { useErrorBoundary, useLayoutEffect } from "preact/hooks";
import { getActionPrivateProperties } from "./action_private_properties.js";
import { useActionStatus } from "./actions.js";

const renderOtherwiseDefault = () => null;
const renderLoadingDefault = () => null;
const renderAbortedDefault = () => null;
const renderErrorDefault = (error) => {
  let routeErrorText = error && error.message ? error.message : error;
  return <p className="route_error">An error occured: {routeErrorText}</p>;
};
const renderLoadedDefault = () => null;

export const ActionRenderer = ({ action, children }) => {
  const {
    otherwise: renderOtherwise = renderOtherwiseDefault,
    loading: renderLoading = renderLoadingDefault,
    aborted: renderAborted = renderAbortedDefault,
    error: renderError = renderErrorDefault,
    loaded: renderLoaded,
  } = typeof children === "function" ? { loaded: children } : children || {};
  if (!action) {
    throw new Error(
      "ActionRenderer requires an action to render, but none was provided.",
    );
  }
  const { idle, pending, aborted, error, data } = useActionStatus(action);
  const UIRenderedPromise = useUIRenderedPromise(action);
  const [errorBoundary, resetErrorBoundary] = useErrorBoundary();

  useLayoutEffect(() => {
    resetErrorBoundary();
  }, [action, pending, idle, resetErrorBoundary]);

  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, []);

  if (idle) {
    return renderOtherwise(action);
  }
  if (errorBoundary) {
    return renderError(errorBoundary, "ui_error");
  }
  if (error) {
    return renderError(error, "action_error");
  }
  if (aborted) {
    return renderAborted(action);
  }
  let renderLoadedSafe;
  if (renderLoaded) {
    renderLoadedSafe = renderLoaded;
  } else {
    const { ui } = getActionPrivateProperties(action);
    if (ui.renderLoaded) {
      renderLoadedSafe = ui.renderLoaded;
    } else {
      renderLoadedSafe = renderLoadedDefault;
    }
  }
  if (pending) {
    if (action.canDisplayOldData && data !== undefined) {
      return renderLoadedSafe(data);
    }
    return renderLoading(action);
  }

  return renderLoadedSafe(data);
};

const actionUIRenderedPromiseWeakMap = new WeakMap();
const useUIRenderedPromise = (route) => {
  const actionUIRenderedPromise = actionUIRenderedPromiseWeakMap.get(route);
  if (actionUIRenderedPromise) {
    return actionUIRenderedPromise;
  }
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  promise.resolve = resolve;
  actionUIRenderedPromiseWeakMap.set(route, promise);
  return promise;
};
