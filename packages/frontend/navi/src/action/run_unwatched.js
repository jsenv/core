import { reportErrorIfNobodyDisplaysIt } from "./action_error_report.js";

/**
 * Starts a run navi has nobody to await.
 *
 * A failing run does not stay quiet: it throws when the callback threw
 * synchronously, and rejects when it was asynchronous (see failRun in
 * actions.js). That is what makes `ACTION(params)` behave like any other call
 * that can fail — and code that lets such a failure go gets the runtime's own
 * unhandled-error report, which is the right answer for it.
 *
 * Some runs have no such caller by construction — one started from a signal
 * effect because its params changed, one whose failure the control that started
 * it already draws, a routing whose result every caller drops. Their failure
 * would be an anonymous unhandled one, naming the machinery instead of what
 * failed. They start here, which is why the run itself is passed rather than
 * its result: both deliveries have to be taken.
 *
 * And taking them is what obliges this place to ask the other question: did
 * anything ever display this error? The answer does not exist yet at this
 * instant — a route action fails before the page that shows it exists — so it is
 * asked with a deadline, once, in action_error_report.js.
 *
 * The error is never hidden: it stays in the action's `errorSignal`, which is
 * where a screen reads it.
 */
export const runUnwatched = (startRun) => {
  let result;
  try {
    result = startRun();
  } catch (error) {
    reportErrorIfNobodyDisplaysIt(error);
    return undefined;
  }
  if (result && typeof result.catch === "function") {
    result.catch((error) => {
      reportErrorIfNobodyDisplaysIt(error);
    });
  }
  return result;
};
