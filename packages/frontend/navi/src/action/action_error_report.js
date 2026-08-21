/**
 * Where an action error goes when nothing displays it.
 *
 * An action that fails writes the error into its `errorSignal` and stops there.
 * It cannot know whether a screen is going to show it: at the instant it fails,
 * the screen that will is often not even mounted — a route action runs before
 * its page renders, which is precisely the case a guess made at failure time
 * gets wrong. So nothing is guessed. The error is let go, and whoever displays
 * it SAYS so by marking it; what is still unmarked once the DOM has had its
 * chance was displayed by nobody, and only that is reported as unhandled.
 *
 * The mark is `__handled_by__`, the same one the jsenv supervisor reads to stay
 * out of the way of an error the app is already showing — one mark, one meaning:
 * "this is on screen somewhere".
 *
 * The whole picture, control errors and validation included: docs/error_handling.md
 */

export const markErrorAsDisplayedBy = (error, by) => {
  if (error && typeof error === "object") {
    error.__handled_by__ = by;
  }
};

export const errorIsDisplayed = (error) => {
  return Boolean(error && error.__handled_by__);
};

/**
 * Reported from a macrotask: every render that could display the error —
 * Preact's own queue, a Suspense boundary settling on the failure, the error
 * boundary above it — happens in microtasks, so by the time this runs the
 * answer is final. A screen that would display the error much later than that
 * (mounted by something slower than a render) is reported anyway; it is the
 * one case where this says "nobody" a bit too early, and the report is then a
 * duplicate of what the screen shows rather than a lie about it.
 *
 * Rethrown rather than logged: an error nobody shows is an unhandled error, and
 * the runtime already knows what to do with those (window "error" event, jsenv
 * overlay in dev). Same trick preact/debug uses for the same reason.
 */
const errorReportedSet = new WeakSet();
export const reportErrorIfNobodyDisplaysIt = (error, { action } = {}) => {
  setTimeout(() => {
    if (errorIsDisplayed(error)) {
      return;
    }
    if (error && typeof error === "object") {
      // The same error can reach here from more than one direction (the run
      // that produced it, the routing promise carrying it): it is one error and
      // it is reported once.
      if (errorReportedSet.has(error)) {
        return;
      }
      errorReportedSet.add(error);
    }
    if (action && error && typeof error === "object" && !error.action) {
      error.action = action;
    }
    throw error;
  });
};
