import { options } from "preact";

import { setHeldRendersAside } from "../nav/rendering_hold.js";

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
 *
 * While the rendering is held for a view transition (see rendering_hold.js),
 * what the hold holds stays held: the page arriving drawn here would be
 * photographed as the page being left.
 */
export const flushSyncRendering = (fn) => {
  const giveBackHeldRenders = setHeldRendersAside();
  const debounceRenderingPrevious = options.debounceRendering;
  options.debounceRendering = (drainRenderQueue) => {
    drainRenderQueue();
  };
  try {
    fn();
  } finally {
    // Restored first: what is given back is queued under the hold, not
    // drained by this flush.
    options.debounceRendering = debounceRenderingPrevious;
    giveBackHeldRenders();
  }
};
