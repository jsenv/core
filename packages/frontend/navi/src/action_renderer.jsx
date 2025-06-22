import { useErrorBoundary, useLayoutEffect } from "preact/hooks";
import { useActionStatus } from "./actions.js";

const renderOtherwiseDefault = () => null;
const renderLoadingDefault = () => null;
const renderLoadedDefault = () => null;
const renderErrorDefault = (error) => {
  let routeErrorText = error && error.message ? error.message : error;
  return <p className="route_error">An error occured: {routeErrorText}</p>;
};

export const ActionRenderer = ({ action, children }) => {
  const {
    otherwise: renderOtherwise = renderOtherwiseDefault,
    loading: renderLoading = renderLoadingDefault,
    error: renderError = renderErrorDefault,
    loaded: renderLoaded,
  } = typeof children === "function" ? { loaded: children } : children || {};
  const { active, idle, pending, error, data } = useActionStatus(action);
  const UIRenderedPromise = useUIRenderedPromise(action);
  const [errorBoundary, resetError] = useErrorBoundary();

  useLayoutEffect(() => {
    if (error && !errorBoundary) {
      action.reportError(error);
    }
  }, [error, errorBoundary, action]);

  useLayoutEffect(() => {
    // Réinitialiser l'erreur du boundary quand l'action change
    resetError();
  }, [action, resetError]);

  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, []);

  if (!active || idle) {
    return renderOtherwise(action);
  }
  if (errorBoundary) {
    return renderError(errorBoundary, "ui_error");
  }
  if (error) {
    return renderError(error, "action_error");
  }
  const renderLoadedSafe =
    renderLoaded || action.ui.renderLoaded || renderLoadedDefault;
  if (pending) {
    if (action.canDisplayOldData && data !== undefined) {
      return renderLoadedSafe(data);
    }
    return renderLoading();
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
