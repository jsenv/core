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
 *   transition while another is running skips that other one, and so does the
 *   document going hidden or its viewport changing size mid-movement; a skipped
 *   transition rejects `ready` with a DOMException that has no stack. Nothing
 *   is waiting on it, so the rejection surfaces as an unhandled error (a full
 *   error overlay in dev, an `unhandledrejection` in an app's error reporting)
 *   for something that is not an error at all — two updates close together is
 *   normal in a list that is being edited, and a phone locks its screen.
 *
 * navi calls it wherever it plays a view transition — a route transition, a
 * popup lifted out of its anchor, a list's items, a dragged item put back
 * (route_transition.jsx, popup_lift.js, list.jsx, interaction_drag.js) —
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

// The last transition started here, for code that runs a callback of the
// application's and has to know whether that callback started one — an
// optimistic drag answer draws inside one and returns its write instead (see
// interaction_drag.js).
let lastViewTransition = null;
export const peekLastViewTransition = () => lastViewTransition;

// "Skipped" is an outcome, not a failure — and it is told by its outcome, not
// by its wording, which each engine writes its own way. The update callback is
// the application's: when it throws, that error rejects `updateCallbackDone`,
// and keeps travelling from there, once. `ready` and `finished` reject with it
// too, and say nothing more. `ready` rejecting while the callback went through
// is a skip, whatever the reason the browser gives — another transition
// starting, `skipTransition()`, the document hidden mid-movement, the viewport
// resized under it — except a callback taking too long: the browser gave up on
// the page frozen for seconds, which development says.
const startViewTransition = (updateCallback) => {
  const viewTransition = document.startViewTransition(updateCallback);
  viewTransition.updateCallbackDone.catch((e) => {
    throw e;
  });
  viewTransition.ready.catch((e) => {
    if (import.meta.dev && e && e.name === "TimeoutError") {
      console.warn(
        `A view transition was given up on: its update callback took too long, and the page stood frozen meanwhile. Whatever it awaits must resolve without a frame. (${e.message})`,
      );
    }
  });
  viewTransition.finished.catch(() => {});
  lastViewTransition = viewTransition;
  return viewTransition;
};
