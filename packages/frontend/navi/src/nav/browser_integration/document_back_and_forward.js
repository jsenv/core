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

export const applyNavigationToNavDepth = (navigationType, state) => {
  if (navigationType === "push") {
    navDepth++;
    // A push cuts whatever stood ahead.
    navDepthMax = navDepth;
  } else if (navigationType === "replace") {
    // An entry taking the place of another stands exactly where it stood.
  } else {
    // load, reload, traverse: the entry itself says where it stands.
    const depthInState =
      state && typeof state[NAV_DEPTH_STATE_KEY] === "number"
        ? state[NAV_DEPTH_STATE_KEY]
        : undefined;
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
