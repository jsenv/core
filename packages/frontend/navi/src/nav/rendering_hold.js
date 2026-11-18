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
 * The hold is read when a render RUNS, not when it is scheduled. Preact
 * schedules one drain per batch of dirty components, and that drain renders the
 * whole queue: a write made in the same task as the navigation, just before it
 * (a control's signal, a store answer, then navTo()), has already scheduled the
 * drain that will render the page arriving. Swapping
 * `options.debounceRendering` for the length of a hold catches only the drains
 * scheduled after it, and lets that one through. So it is wrapped once, at
 * module load — before anything can be queued — and the wrapper looks at the
 * hold when the drain fires. While held, Preact counts its queue as pending and
 * schedules nothing more: every later render joins the drain given back on
 * release. A `debounceRendering` installed after this module must call the one
 * it found, or nothing is ever held.
 *
 * A render asked for synchronously while a hold stands (flushSyncRendering: a
 * popup measuring the content it mounts, in the press) renders what it asks
 * for and nothing the hold holds. Preact's queue cannot be drained in part, so
 * the components owed a render are set aside for the length of the flush and
 * given back right after (see setHeldRendersAside). This is the one place navi
 * reads a Preact internal, and the reason this module watches every render
 * request.
 *
 * What is held is Preact's queue. A signal bound straight into the DOM
 * (`{countSignal}`, `title={titleSignal}`) is written there by @preact/signals
 * itself, scheduled through the option preact/hooks schedules its effects
 * through: holding it would move every effect too. It is not held, and the app
 * reads such a value in the render (see docs/route_transitions.md).
 *
 * ONE hold for the whole document, whoever animates: everything that
 * photographs the document holds through this module — a navigation, a popup
 * lifted out of its anchor. Each holder holds a share of it, and the hold
 * stands until every share is given back: a view transition started while
 * another waits for its picture skips that one, and the browser still runs the
 * skipped one's update callback — which gives back its own share, and must not
 * let go of the picture the other is still waiting for.
 */

import { Component, options } from "preact";

let renderingHold = null;

// Every component asked to render since Preact last drained its queue: what a
// hold holds is among them. A request made outside a render comes through one
// of these two doors (hooks and signals call setState); one made inside a
// render is drained by that same render.
const componentsAskedToRender = new Set();
// What a flush set beside a hold asks for itself (see setHeldRendersAside).
let componentsAskedByFlush = null;
const noteAskedToRender = (component) => {
  componentsAskedToRender.add(component);
  if (componentsAskedByFlush) {
    componentsAskedByFlush.add(component);
  }
};
const { setState, forceUpdate } = Component.prototype;
Component.prototype.setState = function (update, callback) {
  noteAskedToRender(this);
  return setState.call(this, update, callback);
};
Component.prototype.forceUpdate = function (callback) {
  noteAskedToRender(this);
  return forceUpdate.call(this, callback);
};

const drain = (render) => {
  render();
  componentsAskedToRender.clear();
};

const debounceRenderingBefore = options.debounceRendering;
const debounceRenderingHeld = (render) => {
  checkPreactFlags();
  (debounceRenderingBefore || queueMicrotask)(() => {
    if (renderingHold) {
      renderingHold.render = render;
      return;
    }
    drain(render);
  });
};
options.debounceRendering = debounceRenderingHeld;

export const holdRendering = () => {
  let hold = renderingHold;
  if (!hold) {
    hold = { shares: 0, render: null, waiting: [] };
    renderingHold = hold;
  }
  hold.shares++;
  let given = false;
  return () => {
    if (given) {
      return;
    }
    given = true;
    hold.shares--;
    if (hold.shares > 0) {
      return;
    }
    renderingHold = null;
    const { render, waiting } = hold;
    // The render owed is the application's, run here instead of by Preact's
    // own scheduling: what it throws is reported on its own, as Preact's drain
    // would have it reported, and not at whoever gave the hold back — a view
    // transition's update, the end of a navigation. What waits on the hold is
    // navi's bookkeeping — the scroll a page lands at, the page change said
    // over (see page_change.js) — and runs whatever the render did.
    if (render) {
      runWithErrorApart(() => drain(render));
    }
    for (const wait of waiting) {
      runWithErrorApart(wait);
    }
  };
};

const runWithErrorApart = (callback) => {
  try {
    callback();
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
};

// Preact's flags on a component (`_bits`, mangled to `__g`) and the one saying
// a render is owed to it, read as of preact 11.2.0: the drain renders a
// component only while that flag is up, and skips it otherwise. On a preact
// upgrade, check both still hold (src/constants.js, enqueueRender and process
// in src/component.js). Flags gone under another name read as no render owed:
// a flush then draws everything, the arriving page included.
const COMPONENT_DIRTY = 1 << 3;
const giveBackNothing = () => {};

// What this module counts on and nothing enforces, checked in dev and said
// once, rather than found as a page sliding onto itself. First, the flags
// above, on the application's own preact, which may be newer than the one this
// was read on: when Preact schedules a drain, a component just asked to render
// owes one. Read at the first drain scheduled, from the components noted as
// asked since the last one.
let preactFlagsChecked = false;
const checkPreactFlags = import.meta.dev
  ? () => {
      if (preactFlagsChecked || componentsAskedToRender.size === 0) {
        return;
      }
      preactFlagsChecked = true;
      for (const component of componentsAskedToRender) {
        if (
          typeof component.__g === "number" &&
          component.__g & COMPONENT_DIRTY
        ) {
          return;
        }
      }
      console.warn(
        `navi reads two of Preact's internals to keep a route transition's picture honest — a component's flags (\`__g\`) and the one saying a render is owed (1 << 3) — and neither says so on this version of preact. A render asked for synchronously during a navigation (a popup measuring what it mounts) will draw the page arriving before its picture is taken. Check src/constants.js and enqueueRender in preact, and update rendering_hold.js.`,
      );
    }
  : () => {};
// Second, the drain being this module's to schedule. A `debounceRendering` put
// in its place while a hold stands takes the drain Preact hands over, and runs
// it: everything the hold holds is drawn, the page arriving included, before
// its picture is taken. preact/compat's flushSync does exactly that for the
// length of its callback.
let debounceRenderingReplacedSaid = false;
if (import.meta.dev) {
  let debounceRenderingInstalled = options.debounceRendering;
  Object.defineProperty(options, "debounceRendering", {
    configurable: true,
    enumerable: true,
    get: () => debounceRenderingInstalled,
    set: (debounceRendering) => {
      if (
        renderingHold &&
        debounceRendering !== debounceRenderingHeld &&
        !debounceRenderingReplacedSaid
      ) {
        debounceRenderingReplacedSaid = true;
        console.warn(
          `options.debounceRendering was replaced while navi holds the rendering for a route transition's picture (preact/compat's flushSync does this for the length of its callback). A render asked for in there draws the page arriving before its picture is taken, and the movement shows it on both sides. Flush before navigating, not after.`,
        );
      }
      debounceRenderingInstalled = debounceRendering;
    },
  });
}

/**
 * For flushSyncRendering while a hold stands: takes the owed render off every
 * component the hold holds, and returns what gives it back. The flush's drain
 * then passes them by and renders what the flush asks for alone. Given back
 * through setState, which owes the render again and queues it under the hold.
 */
export const setHeldRendersAside = () => {
  // Nothing held — or a flush inside another one, which set them aside already.
  if (!renderingHold || componentsAskedByFlush) {
    return giveBackNothing;
  }
  const setAside = [];
  for (const component of componentsAskedToRender) {
    if (component.__g & COMPONENT_DIRTY) {
      component.__g &= ~COMPONENT_DIRTY;
      setAside.push(component);
    }
  }
  const askedByFlush = new Set();
  componentsAskedByFlush = askedByFlush;
  return () => {
    componentsAskedByFlush = null;
    for (const component of setAside) {
      // Asked for by the flush as well: drawn by it, nothing owed anymore.
      if (askedByFlush.has(component)) {
        continue;
      }
      component.setState({});
    }
  };
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

// After the render the change being applied has queued, for what depends on
// the page that change puts on screen — an offset given back to a page is
// clamped to whatever page the document holds when it is written. Under a hold
// that render runs when the hold is released, and this right after it.
// Otherwise the render is Preact's own, queued in a microtask, and every
// microtask has run by the next frame — before it paints.
export const whenPageRendered = (callback) => {
  if (renderingHold) {
    renderingHold.waiting.push(callback);
    return;
  }
  requestAnimationFrame(() => {
    callback();
  });
};

// The hold a navigation takes on its way in — from before its first write:
// whether anything animates it is decided during the routing or at its end,
// which can be a microtask or more after the drain its writes queued, and the
// scroll put back to the top asks for the hold during the routing too. Kept
// here until whoever animates the change takes it over, or the navigation turns
// out to be one nobody animates. A traversal asked at a press holds from the
// press (see route_transition.jsx), and its routing keeps that share.
let routingRenderingHold = null;
export const holdRenderingForRouting = () => {
  if (routingRenderingHold) {
    return;
  }
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
