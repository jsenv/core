import { useErrorBoundary, useLayoutEffect } from "preact/hooks";
import { useActionStatus } from "./actions.js";

const renderNotMatchingDefault = () => null;
const renderMatchingDefault = () => null;
const renderLoadingDefault = () => null;
const renderLoadedDefault = () => null;
const renderErrorDefault = (error) => {
  let routeErrorText = error && error.message ? error.message : error;
  return <p className="route_error">An error occured: {routeErrorText}</p>;
};

export const ActionRenderer = ({
  action,
  render,
  renderNotMatching,
  renderMatching,
  renderLoading,
  renderError,
  renderLoaded,
}) => {
  if (renderNotMatching) {
    return (
      <Renderer
        action={action}
        renderNotMatching={renderNotMatching}
        renderMatching={renderMatching || renderMatchingDefault}
        renderLoading={renderLoading || renderLoadingDefault}
        renderError={renderError || renderErrorDefault}
        renderLoaded={renderLoaded || renderLoadedDefault}
      />
    );
  }
  if (renderMatching) {
    return (
      <Renderer
        action={action}
        renderNotMatching={renderNotMatchingDefault}
        renderMatching={renderMatching}
        renderLoading={renderLoading || renderLoadingDefault}
        renderError={renderError || renderErrorDefault}
        renderLoaded={renderLoaded || renderLoadedDefault}
      />
    );
  }
  if (renderLoaded) {
    // cas le plus courant: le composant qu'on veut render est disponible
    return (
      <Renderer
        action={action}
        renderNotMatching={renderNotMatchingDefault}
        renderMatching={renderMatchingDefault}
        renderLoading={renderLoading || renderLoadingDefault}
        renderError={renderError || renderErrorDefault}
        renderLoaded={renderLoaded}
      />
    );
  }
  if (render) {
    return render(action);
  }
  if (action.ui.renderLoaded) {
    return (
      <Renderer
        action={action}
        renderNotMatching={renderNotMatchingDefault}
        renderMatching={renderMatchingDefault}
        renderLoading={renderLoading || renderLoadingDefault}
        renderError={renderError || renderErrorDefault}
      />
    );
  }
  return null;
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

const Renderer = ({
  action,
  renderNotMatching,
  renderMatching,
  renderLoading,
  renderError,
  renderLoaded,
}) => {
  const { matching, pending, aborted, error, data } = useActionStatus(action);
  const shouldDisplayOldData = action.canDisplayOldData && data !== undefined;
  const UIRenderedPromise = useUIRenderedPromise(action);

  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, []);

  if (!matching) {
    return renderNotMatching === renderNotMatchingDefault ? null : (
      <ActionErrorBoundary action={action} renderChild={renderNotMatching} />
    );
  }
  if (error) {
    return renderError(error);
  }
  if (pending && !shouldDisplayOldData) {
    return renderLoading === renderLoadingDefault ? null : (
      <ActionErrorBoundary action={action} renderChild={renderLoading} />
    );
  }
  if (!aborted) {
    return (
      <ActionErrorBoundary
        action={action}
        renderChild={renderLoaded || action.ui.renderLoaded}
        renderChildArg={data}
      />
    );
  }
  if (shouldDisplayOldData) {
    return (
      <ActionErrorBoundary
        action={action}
        renderChild={renderLoaded || action.ui.renderLoaded}
        renderChildArg={action.data}
      />
    );
  }
  return <ActionErrorBoundary action={action} renderChild={renderMatching} />;
};

const ActionErrorBoundary = ({
  action,
  renderChild,
  renderChildArg = action,
}) => {
  const [error] = useErrorBoundary();
  if (error) {
    action.reportError(error);
    return null;
  }
  return renderChild(renderChildArg);
};
