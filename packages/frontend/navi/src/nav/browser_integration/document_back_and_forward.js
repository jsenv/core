/**
 * Is there an entry of THIS document behind the current one? And ahead of it?
 *
 * A back arrow drawn inside an app promises to give back the screen it came
 * from — never the page the reader was on before the app. A url opened cold
 * (a shared link, a bookmark, a notification) has someone else's page under
 * it, and `window.history.length` cannot tell the two apart: it counts the
 * whole tab.
 *
 * So the count is kept here, and written into the state of each entry as it is
 * created, so it survives a reload in the middle of the stack. It cannot be
 * read back from an entry alone: a replaced entry inherits the state of the
 * one it takes the place of, so an entry's state does not say how it arrived.
 * Only the navigation being applied says that, which is why the integrations
 * (via_history.js, via_navigation.js) hand each navigation over here as they
 * apply it — the one place no push and no replace can escape.
 */

import { signal } from "@preact/signals";

export const NAV_DEPTH_STATE_KEY = "jsenv_nav_depth";

export const canNavBackSignal = signal(false);
export const useCanNavBack = () => {
  return canNavBackSignal.value;
};

export const canNavForwardSignal = signal(false);
export const useCanNavForward = () => {
  return canNavForwardSignal.value;
};

// How many entries of this document stand under the current one, and how high
// the stack goes above it. Both are unknown for entries this document never
// created (a fragment navigation makes its own, and the browser stores no
// state on it): those leave the count as it is, which under-reports rather
// than promising a screen that is not there.
let navDepth = 0;
let navDepthMax = 0;

export const getNavDepth = () => navDepth;

// Where an entry's state says it stands, undefined when it says nothing.
export const readNavDepthInState = (state) => {
  if (state && typeof state[NAV_DEPTH_STATE_KEY] === "number") {
    return state[NAV_DEPTH_STATE_KEY];
  }
  return undefined;
};

// The state of the entry a document is loaded into, carrying its depth. One
// that says a depth was written by this document (a reload in the middle of
// the stack) and keeps it. One that says none was not: a url opened cold, the
// first of the stack — or, rarely, an entry the browser made for a fragment,
// reloaded, which 0 under-reports as above. Written into the entry by the
// integrations, because a back that returns there reads where it stands from
// the entry alone.
export const stateWithNavDepthOnLoad = (state) => {
  if (readNavDepthInState(state) !== undefined) {
    return state;
  }
  return { ...state, [NAV_DEPTH_STATE_KEY]: 0 };
};

export const applyNavigationToNavDepth = (navigationType, state) => {
  if (navigationType === "push") {
    navDepth++;
    // A push cuts whatever stood ahead.
    navDepthMax = navDepth;
  } else if (navigationType === "replace") {
    // An entry taking the place of another stands exactly where it stood.
  } else {
    // load, reload, traverse: the entry itself says where it stands.
    const depthInState = readNavDepthInState(state);
    if (depthInState !== undefined) {
      navDepth = depthInState;
      if (navDepth > navDepthMax) {
        navDepthMax = navDepth;
      }
    }
  }
  canNavBackSignal.value = navDepth > 0;
  canNavForwardSignal.value = navDepth < navDepthMax;
};
