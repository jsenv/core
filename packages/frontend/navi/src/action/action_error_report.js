/**
 * Where an action error goes when nothing displays it.
 *
 * An action that fails writes the error into its `errorSignal` and stops there.
 * It cannot know whether a screen is going to show it: at the instant it fails,
 * the screen that will is often not even mounted — a route action runs before
 * its page renders, which is precisely the case a guess made at failure time
 * gets wrong. So nothing is guessed. The error is let go, and whoever displays
 * it SAYS so by marking it; what nobody ever took is reported as unhandled.
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
 * A render has read this error — it is now the render tree's business, not this
 * module's, and there is nothing left to report.
 *
 * Whatever the reader does with it is already covered without any deadline: it
 * displays it (and marks it), or it throws it, and a thrown error either finds a
 * boundary that displays it or reaches window on its own — `preact/debug`
 * re-throws every error a boundary caught, and an unbounded one aborts the
 * render loudly. Reporting it here as well would be a second voice saying the
 * same thing, always the wrong one, since this module cannot see which of those
 * happened.
 */
const errorTakenByRenderSet = new WeakSet();
export const markErrorAsTakenByRender = (error) => {
  if (error && typeof error === "object") {
    errorTakenByRenderSet.add(error);
  }
};

/**
 * When the answer "nobody took it" is final.
 *
 * The floor is one macrotask: every render that could take the error — Preact's
 * queue, a Suspense boundary settling on the failure, the boundary above it —
 * happens in microtasks.
 *
 * That floor is enough for an action failing under a page that is already on
 * screen, and far too early for a route action: it fails ON the url change,
 * before its page exists, and that page cannot render until the routing that
 * asked for the data is over. Measured on an offline navigation, the screen
 * displaying the error arrived ~12ms after this deadline — so the app was told
 * it had displayed nothing while it was displaying it.
 *
 * The browser integration knows when the document has stopped moving and hands
 * that over here (see installReportDeadlineExtension); nothing else does, and
 * this module stays free of the DOM. Waiting longer costs nothing now that a
 * read is enough to call this off: what still reaches the report was read by no
 * render at all, and a late report about that is as good as a prompt one.
 */
let waitForDocumentSettled = null;
export const installReportDeadlineExtension = (fn) => {
  waitForDocumentSettled = fn;
};

/**
 * Rethrown rather than logged: an error nobody took is an unhandled error, and
 * the runtime already knows what to do with those (window "error" event, jsenv
 * overlay in dev). Same trick preact/debug uses for the same reason.
 */
const errorReportedSet = new WeakSet();
export const reportErrorIfNobodyDisplaysIt = (error, { action } = {}) => {
  const decide = () => {
    if (errorIsDisplayed(error) || errorTakenByRenderSet.has(error)) {
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
  };

  setTimeout(() => {
    if (errorIsDisplayed(error) || errorTakenByRenderSet.has(error)) {
      // Already taken within the microtasks that followed the failure: the
      // common case, and there is nothing to wait for.
      return;
    }
    if (waitForDocumentSettled) {
      waitForDocumentSettled(decide);
      return;
    }
    decide();
  });
};
