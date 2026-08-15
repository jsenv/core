/**
 * View transitions, made safe to call.
 *
 * Calling this installs `document.startViewTransition` when the browser has
 * none — so code that runs after it can take the API for granted — and returns
 * the function to actually call, which does two things the raw API leaves to
 * every caller:
 *
 * - It runs the update no matter what. A transition is about the animation,
 *   never about the change.
 * - It swallows the rejection a SKIPPED transition produces. Starting a
 *   transition while another is running skips that other one, and a skipped
 *   transition rejects its promises; nothing is waiting on them, so the
 *   rejection surfaces as an unhandled error (a full error overlay in dev) for
 *   something that is not an error at all — two updates close together is
 *   normal in a list that is being edited.
 *
 * navi calls it from wherever it animates a DOM change itself (see list.jsx),
 * which is why an application using navi finds the API already there.
 *
 *   const startViewTransition = ensureDocumentStartViewTransition();
 *   startViewTransition(() => setItems(next));
 */
export const ensureDocumentStartViewTransition = () => {
  if (!document.startViewTransition) {
    const startViewTransitionPolyfill = (updateCallback) => {
      updateCallback();
      return {
        updateCallbackDone: Promise.resolve(),
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: () => {},
      };
    };
    // Said out loud, because the difference matters to whoever needs the
    // transition itself rather than the change: there is no picture of the
    // state being left here, so nothing can be animated between the two — and
    // once this is installed, asking the document is no longer a way to know.
    startViewTransitionPolyfill.isPolyfill = true;
    document.startViewTransition = startViewTransitionPolyfill;
  }
  return startViewTransition;
};

// A transition a finger is holding still (see route_travel.jsx): it has to be
// let go of before any other one starts, and this is the only place that knows
// a new one is about to. There is a single transition per document — starting
// one SKIPS the one in flight — and the hold that keeps pictures under a finger
// is written against whatever transition is running, because everything the
// gesture must carry along (a trait under a tab row) belongs to that same
// transition and has no name of its own here. Left on, it takes hold of the
// transition that has just replaced ours: born paused, held by nobody, it never
// finishes, and its pictures stand over a page that cannot be touched anymore.
let releaseHeldViewTransition = null;
export const holdViewTransition = (release) => {
  releaseHeldViewTransition = release;
  return () => {
    if (releaseHeldViewTransition === release) {
      releaseHeldViewTransition = null;
    }
  };
};

const startViewTransition = (updateCallback) => {
  if (releaseHeldViewTransition) {
    const release = releaseHeldViewTransition;
    releaseHeldViewTransition = null;
    release();
  }
  const viewTransition = document.startViewTransition(updateCallback);
  viewTransition.updateCallbackDone.catch(ignoreSkip);
  viewTransition.ready.catch(ignoreSkip);
  viewTransition.finished.catch(ignoreSkip);
  return viewTransition;
};

// "Skipped" is an outcome, not a failure — anything else is still a real error
// and must keep travelling.
const ignoreSkip = (e) => {
  if (e && e.name === "AbortError") {
    return;
  }
  if (e && typeof e.message === "string" && e.message.includes("skipped")) {
    return;
  }
  throw e;
};
