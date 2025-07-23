/**
 * TODO: when switching from one state to another we should preserve the dimensions to prevent layout shift
 * the exact way to do this is not yet clear but I suspect something as follow:
 *
 *
 * While content is loading we don't know (except if we are given an size)
 * When reloading the content will be gone, we should keep a placeholder taking the same space
 * When there is an error the error should take the same space as the content
 * but be displayed on top
 * (If error is bigger it can take more space? I guess so, maybe an overflow would be better to prevent layout shit again)
 *
 * And once we know the new content size ideally we could have some sort of transition
 * (like an height transition from current height to new height)
 *
 * consider https://motion.dev/docs/react-layout-animations
 *
 * but might be too complexe for what we want.
 * we want ability to transit from anything to anything, it's not a layout change
 * it's more view transition but with a very simple behavior
 *
 * And certainly this https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API#pseudo-elements
 *
 */

import { useErrorBoundary, useLayoutEffect } from "preact/hooks";
import { getActionPrivateProperties } from "../action_private_properties.js";
import { useActionStatus } from "../use_action_status.js";

import.meta.css = /* css */ `
  .action_error {
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
    margin-top: 0;
    margin-bottom: 20px;
  }
`;

const renderOtherwiseDefault = () => null;
const renderLoadingDefault = () => null;
const renderAbortedDefault = () => null;
const renderErrorDefault = (error) => {
  let routeErrorText = error && error.message ? error.message : error;
  return <p className="action_error">An error occured: {routeErrorText}</p>;
};
const renderLoadedDefault = () => null;

export const ActionRenderer = ({ action, children }) => {
  const {
    otherwise: renderOtherwise = renderOtherwiseDefault,
    loading: renderLoading = renderLoadingDefault,
    aborted: renderAborted = renderAbortedDefault,
    error: renderError = renderErrorDefault,
    loaded: renderLoaded,
    always: renderAlways,
  } = typeof children === "function" ? { loaded: children } : children || {};
  if (!action) {
    throw new Error(
      "ActionRenderer requires an action to render, but none was provided.",
    );
  }
  const { idle, loading, aborted, error, data } = useActionStatus(action);
  const UIRenderedPromise = useUIRenderedPromise(action);
  const [errorBoundary, resetErrorBoundary] = useErrorBoundary();

  // Mark this action as bound to UI components (has renderers)
  // This tells the action system that errors should be caught and stored
  // in the action's error state rather than bubbling up
  useLayoutEffect(() => {
    const { ui } = getActionPrivateProperties(action);
    ui.hasRenderers = true;
  }, [action]);

  useLayoutEffect(() => {
    resetErrorBoundary();
  }, [action, loading, idle, resetErrorBoundary]);

  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, []);

  // If renderAlways is provided, it wins and handles all rendering
  if (renderAlways) {
    return renderAlways({ loading, idle, aborted, error, data });
  }

  if (idle) {
    return renderOtherwise(action);
  }
  if (errorBoundary) {
    return renderError(errorBoundary, "ui_error", action);
  }
  if (error) {
    return renderError(error, "action_error", action);
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
  if (loading) {
    if (action.canDisplayOldData && data !== undefined) {
      return renderLoadedSafe(data, action);
    }
    return renderLoading(action);
  }

  return renderLoadedSafe(data, action);
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
