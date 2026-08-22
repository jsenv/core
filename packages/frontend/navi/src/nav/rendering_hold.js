/**
 * The document's rendering, held for the one frame a view transition needs.
 *
 * The browser does not take the picture of the page being left when a
 * transition is ASKED for — it takes it at the next frame, just before running
 * the update callback. Preact renders sooner than that, in a microtask: so a
 * change nobody asked for (a tab pressed, the back button) has already reached
 * the DOM when the picture is taken, and the picture is of the page ARRIVING.
 * Both sides of the animation then show it, and one watches a page slide onto
 * itself.
 *
 * So what Preact has queued waits until the update callback, which is the
 * moment the API is built around — the change belongs inside it. The whole
 * document is held: it is about to be frozen under a picture anyway.
 *
 * ONE hold for the whole document, whoever animates. The hold is a wrapper
 * around Preact's `options.debounceRendering`, and two of them installed
 * independently restore each other in the wrong order when they let go — every
 * render queued in between is then handed to a wrapper nobody will ever
 * release. Everything that photographs a navigation (RouteTravel's box, a
 * route transition) must therefore hold through this module, never through a
 * wrapper of its own.
 */

import { options } from "preact";

let renderingHold = null;
export const holdRendering = () => {
  if (renderingHold) {
    return renderingHold.release;
  }
  const debounceRenderingBefore = options.debounceRendering;
  const hold = {
    render: null,
    waiting: [],
    release: () => {
      // Only the hold that is still standing may be given back: a holder
      // releasing after another has taken over must not let go of what it
      // does not hold.
      if (renderingHold !== hold) {
        return;
      }
      renderingHold = null;
      options.debounceRendering = debounceRenderingBefore;
      const { render, waiting } = hold;
      hold.render = null;
      hold.waiting = [];
      if (render) {
        render();
      }
      for (const wait of waiting) {
        wait();
      }
    },
  };
  renderingHold = hold;
  options.debounceRendering = (render) => {
    hold.render = render;
  };
  return hold.release;
};

// Anything else that must not happen before the picture is taken, and the
// scroll is the other one: a page one arrives at starts at its top, and the
// document put back to its top while the page being left is still on screen is
// a page that has ALREADY jumped when the picture is taken. Worse, the browser
// paints what the new offset shows and nothing else, so the picture keeps only
// the band it had already painted — the page being left is then seen in
// fragments, whatever the movement does afterwards.
//
// Run at once when nobody is photographing anything, which is the common case
// and must stay free.
export const whenRenderingResumes = (callback) => {
  if (!renderingHold) {
    callback();
    return;
  }
  renderingHold.waiting.push(callback);
};

// The hold a navigation takes on its way in — from before its first write,
// because by the time a route announces that it matches, Preact has already
// been told and the render is queued; a hold taken then is a hold taken too
// late. Kept here until whoever animates the change takes it over, or the
// navigation turns out to be one nobody animates.
let routingRenderingHold = null;
export const holdRenderingForRouting = () => {
  routingRenderingHold = holdRendering();
};
// Nobody had a picture to take: a page held for a change it does not animate
// is a page that stutters for nothing.
export const releaseRoutingRenderingHold = () => {
  const release = routingRenderingHold;
  routingRenderingHold = null;
  if (release) {
    release();
  }
};
// An animator takes the navigation's hold as its own — taking another would be
// taking a hold on a page that is holding still — or takes a fresh one when
// the change it animates is not a navigation.
export const takeoverRoutingRenderingHold = () => {
  const release = routingRenderingHold || holdRendering();
  routingRenderingHold = null;
  return release;
};
