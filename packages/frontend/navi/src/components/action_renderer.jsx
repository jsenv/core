/**
 * ActionRenderer
 *
 * A Preact component for declaratively rendering the UI of an async action's lifecycle.
 * - Automatically animates transitions between states using UITransition
 * - Handles error boundaries
 * - Centralizes error handling and UI state logic for actions
 * - Supports custom transition to animate content changes
 *
 * To animate transitions when the content changes, set a unique `data-content-key` on your rendered content.
 * Use the `transitionType` prop to control the animation style (e.g. "slide-left", "cross-fade").
 *
 * Example:
 *
 *   <ActionRenderer
 *     action={fetchUserAction}
 *     transitionType="slide-left"
 *     transitionDuration={400}
 *   >
 *     {{
 *       loading: () => <Spinner data-content-key={userId} data-content-phase />,
 *       error: (err) => <ErrorMessage error={err} data-content-key={userId} data-content-phase />,
 *       completed: (user) => (
 *         <UserProfile user={user} data-content-key={userId} />
 *       ),
 *     }}
 *   </ActionRenderer>
 *
 * When the value of `data-content-key` changes, ActionRenderer will animate the transition between content using the specified transitionType.
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

export const ActionRenderer = ({
  action,
  children,
  disabled,
  transitionType,
  transitionDuration,
  ...props
}) => {
  return (
    <UITransition
      transitionType={transitionType}
      transitionDuration={transitionDuration}
      {...props}
    >
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

  if (action === undefined) {
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
    if (action) {
      const { ui } = getActionPrivateProperties(action);
      ui.hasRenderers = true;
    }
  }, [action]);

  useLayoutEffect(() => {
    resetErrorBoundary();
  }, [action, loading, idle, resetErrorBoundary]);

  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, [action]);

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

const defaultPromise = Promise.resolve();
defaultPromise.resolve = () => {};

const actionUIRenderedPromiseWeakMap = new WeakMap();
const useUIRenderedPromise = (action) => {
  if (!action) {
    return defaultPromise;
  }
  const actionUIRenderedPromise = actionUIRenderedPromiseWeakMap.get(action);
  if (actionUIRenderedPromise) {
    return actionUIRenderedPromise;
  }
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  promise.resolve = resolve;
  actionUIRenderedPromiseWeakMap.set(action, promise);
  return promise;
};
