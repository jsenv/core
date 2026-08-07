/**
 * document.startViewTransition, made safe to call from application code.
 *
 * Three things it takes care of, all of which are otherwise the caller's:
 *
 * - The API may not be there. Without it the update must still happen, just
 *   without an animation.
 * - A transition started while another is running SKIPS that other one, and a
 *   skipped transition REJECTS its promises. Nothing in the calling code is
 *   waiting on them, so the rejection surfaces as an unhandled error (in dev,
 *   a full error overlay) for something that is not an error at all: two
 *   updates close together is normal.
 * - The update itself must run whatever happens — a transition being skipped is
 *   about the animation, never about the change.
 *
 * Returns the transition when there is one, null otherwise; awaiting it is
 * optional and never throws for a skip.
 */
export const startViewTransition = (updateDOM) => {
  if (!document.startViewTransition) {
    updateDOM();
    return null;
  }
  const viewTransition = document.startViewTransition(updateDOM);
  // "Skipped" is an outcome, not a failure: swallow it here so every caller
  // does not have to.
  viewTransition.updateCallbackDone.catch(ignoreSkip);
  viewTransition.ready.catch(ignoreSkip);
  viewTransition.finished.catch(ignoreSkip);
  return viewTransition;
};

const ignoreSkip = (e) => {
  if (e && e.name === "AbortError") {
    return;
  }
  if (e && typeof e.message === "string" && e.message.includes("skipped")) {
    return;
  }
  throw e;
};
