const actionErrorWeakMap = new WeakMap();

export const NAVI_ACTION_ERROR_CONSTRAINT = {
  name: "navi_action_error",
  check: (controller) => {
    const errorInfo = actionErrorWeakMap.get(controller);
    if (!errorInfo) {
      return null;
    }
    const { target, message, status } = errorInfo;
    return {
      status,
      target,
      message,
    };
  },
  // This should not prevent <form> submission
  // so whenever user tries to submit the form again the error is cleared
  // (Hitting enter key, clicking on submit button, etc. would allow to re-submit the form in error state)
  autoResetOnAction: true,
  onAutoResetOnAction: (controller) => {
    actionErrorWeakMap.delete(controller);
  },
};

// `status` is how the failure is drawn: "error" (red, kept until the next
// action), or "warning" / "info" for an attempt that did not work while nothing
// is broken (docs/error_handling.md).
export const setActionError = (
  controller,
  message,
  { target, status = "error" } = {},
) => {
  actionErrorWeakMap.set(controller, { message, target, status });
};

export const clearActionError = (controller) => {
  if (actionErrorWeakMap.has(controller)) {
    actionErrorWeakMap.delete(controller);
  }
};
