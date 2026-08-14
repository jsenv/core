import { options } from "preact";

/**
 * Runs `fn` and commits whatever it re-renders before returning, instead of
 * letting Preact batch it into the next microtask. Layout effects of what gets
 * mounted run inside the call too, exactly as they would on any other commit.
 *
 * For the caller that has to read the DOM it just asked for — measuring an
 * element whose content it mounts in the same breath — and cannot wait a tick
 * to do it, because what comes after is a browser event still in flight
 * (preventDefault, focus placement) that no longer accepts being answered late.
 *
 * `options.debounceRendering` is Preact's own hook for deciding *when* the
 * render queue drains; swapping it for "right now" for the duration of the call
 * is exactly how preact/compat implements React's flushSync. Reserve it for the
 * case above: rendering synchronously in the middle of an event gives up the
 * batching that makes several state changes one commit.
 */
export const flushSyncRendering = (fn) => {
  const debounceRenderingPrevious = options.debounceRendering;
  options.debounceRendering = (drainRenderQueue) => {
    drainRenderQueue();
  };
  try {
    fn();
  } finally {
    options.debounceRendering = debounceRenderingPrevious;
  }
};
