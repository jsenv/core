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

import { isOfflineError } from "./network_policy.js";

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
 * The failures of one moment: reported, still waiting to know whether anything
 * took them. A url change fails its route actions together, so they wait here
 * together — which is what lets the throw below say something about the others.
 */
const errorPendingDecisionSet = new Set();

/**
 * A render stopped mid-way cannot read what came after it.
 *
 * `useAsyncData` delegates a failure by throwing it out of the render — that is
 * how the error reaches the boundary that displays it. The render ends on that
 * line, so every action the component reads BELOW it is never read, including
 * one that was going to display its own error. "Nobody read it" is still true
 * of those, but the reason is no longer that the app forgot: nothing COULD read
 * them. Left alone, the order of two hook calls decides whether an app is told
 * it has a bug — a rule nobody can see.
 *
 * So the throw says it for them: the failures waiting for the same answer at
 * that instant are failures no render could reach, and the report has nothing
 * to say about them. What is on screen is the failure the render was stopped
 * at, which is the same story.
 *
 * This is about the failures that already exist when the render is cut short.
 * An action of the same page failing LATER — after the page was replaced by
 * what displays the first failure — is not covered and is still reported: at
 * that point nothing distinguishes it from an action nobody reads.
 */
const errorNoRenderCouldReachSet = new WeakSet();
export const markErrorAsStoppingRender = (error) => {
  for (const errorPendingDecision of errorPendingDecisionSet) {
    if (errorPendingDecision !== error) {
      errorNoRenderCouldReachSet.add(errorPendingDecision);
    }
  }
};

/**
 * An offline error is never reported: the app declared the state that produced
 * it, the request never left, and there is nothing for a developer to fix. It
 * is data a screen shows, and it stays data whether or not one does (see
 * network_policy.js, which also keeps it out of the browser console).
 */
const errorIsAccountedFor = (error) => {
  return (
    errorIsDisplayed(error) ||
    errorTakenByRenderSet.has(error) ||
    errorNoRenderCouldReachSet.has(error) ||
    isOfflineError(error)
  );
};

/**
 * Rethrown rather than logged: an error nobody took is an unhandled error, and
 * the runtime already knows what to do with those (window "error" event, jsenv
 * overlay in dev). Same trick preact/debug uses for the same reason.
 */
const errorReportedSet = new WeakSet();
export const reportErrorIfNobodyDisplaysIt = (error, { action } = {}) => {
  if (error && typeof error === "object") {
    errorPendingDecisionSet.add(error);
  }
  const decide = () => {
    errorPendingDecisionSet.delete(error);
    if (errorIsAccountedFor(error)) {
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
    if (errorIsAccountedFor(error)) {
      // Already taken within the microtasks that followed the failure: the
      // common case, and there is nothing to wait for.
      errorPendingDecisionSet.delete(error);
      return;
    }
    if (waitForDocumentSettled) {
      waitForDocumentSettled(decide);
      return;
    }
    decide();
  });
};
