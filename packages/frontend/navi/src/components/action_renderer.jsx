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
import { UITransition } from "./ui_transition.jsx";

import.meta.css = /* css */ `
  .action_error {
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
    margin-top: 0;
    margin-bottom: 20px;
  }
`;

const renderIdleDefault = () => null;
const renderLoadingDefault = () => null;
const renderAbortedDefault = () => null;
const renderErrorDefault = (error) => {
  let routeErrorText = error && error.message ? error.message : error;
  return <p className="action_error">An error occured: {routeErrorText}</p>;
};
const renderCompletedDefault = () => null;

export const ActionRenderer = ({ action, children, disabled, ...props }) => {
  return (
    <UITransition {...props}>
      <ActionRendererContent action={action} disabled={disabled}>
        {children}
      </ActionRendererContent>
    </UITransition>
  );
};

const ActionRendererContent = ({ action, children, disabled }) => {
  const {
    idle: renderIdle = renderIdleDefault,
    loading: renderLoading = renderLoadingDefault,
    aborted: renderAborted = renderAbortedDefault,
    error: renderError = renderErrorDefault,
    completed: renderCompleted,
    always: renderAlways,
  } = typeof children === "function" ? { completed: children } : children || {};

  if (disabled) {
    return null;
  }

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
    return renderAlways({ idle, loading, aborted, error, data });
  }

  if (idle) {
    return renderIdle(action);
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
  let renderCompletedSafe;
  if (renderCompleted) {
    renderCompletedSafe = renderCompleted;
  } else {
    const { ui } = getActionPrivateProperties(action);
    if (ui.renderCompleted) {
      renderCompletedSafe = ui.renderCompleted;
    } else {
      renderCompletedSafe = renderCompletedDefault;
    }
  }
  if (loading) {
    if (action.canDisplayOldData && data !== undefined) {
      return renderCompletedSafe(data, action);
    }
    return renderLoading(action);
  }

  return renderCompletedSafe(data, action);
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
