import { isValidElement } from "preact";
import { useErrorBoundary, useLayoutEffect } from "preact/hooks";

import { markErrorAsDisplayedBy } from "./action_error_report.js";
import { useActionStatus } from "./use_action_status.js";

const css = /* css */ `
  .action_error {
    margin-top: 0;
    margin-bottom: 20px;
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
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

export const ActionRenderer = ({ action, children, disabled }) => {
  import.meta.css = css;
  if (action === undefined) {
    throw new Error(
      "ActionRenderer requires an action to render, but none was provided.",
    );
  }
  let renderBranches;
  if (typeof children === "function") {
    renderBranches = { completed: children };
  } else if (isValidElement(children)) {
    renderBranches = { always: () => children };
  } else if (isPlainObject(children)) {
    renderBranches = children;
  } else {
    renderBranches = { completed: children };
  }

  const {
    idle: renderIdle = renderIdleDefault,
    loading: renderLoading = renderLoadingDefault,
    aborted: renderAborted = renderAbortedDefault,
    error: renderError = renderErrorDefault,
    completed: renderCompleted,
    always: renderAlways,
  } = renderBranches;
  const { idle, loading, aborted, error, completed, data } =
    useActionStatus(action);
  const [errorBoundary, resetErrorBoundary] = useErrorBoundary();

  useLayoutEffect(() => {
    resetErrorBoundary();
  }, [action, loading, idle, resetErrorBoundary]);

  if (disabled) {
    return null;
  }
  // If renderAlways is provided, it wins and handles all rendering
  if (renderAlways) {
    return renderAlways({ idle, loading, aborted, completed, error, data });
  }
  if (idle) {
    return renderIdle(action);
  }
  if (errorBoundary) {
    // Displaying it is what makes it handled (see action_error_report.js)
    markErrorAsDisplayedBy(errorBoundary, "<ActionRenderer>");
    return renderError(errorBoundary, "ui_error", action);
  }
  if (aborted) {
    return renderAborted(action);
  }
  const renderCompletedSafe = renderCompleted || renderCompletedDefault;
  if (loading) {
    // What the instance holds stays drawn while it is asked again — a write
    // rerunning the read, a refresh: loading says a request is out, not that
    // there is nothing to show (docs/data_states.md).
    if (data !== undefined) {
      return renderCompletedSafe(data, action);
    }
    return renderLoading(action);
  }
  if (error) {
    markErrorAsDisplayedBy(error, "<ActionRenderer>");
    return renderError(error, "action_error", action);
  }
  return renderCompletedSafe(data, action);
};

const isPlainObject = (obj) => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return (
    Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null
  );
};
