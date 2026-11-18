/**
 * A navigation is ABOUT to be applied — said before its very first write.
 *
 * Everything else a router says arrives once the change is made: a route
 * announces that it matches, an action that it is running. That is too late for
 * anyone who needs the page as it stands BEFORE, and the browser's view
 * transitions are exactly that kind of reader — the picture they keep of the
 * page being left is taken at the next frame, and a render answering a signal
 * written a moment ago is already in the DOM by then (see route_travel.jsx).
 *
 * So this is the one moment where nothing has moved yet. It is published
 * synchronously, from the top of the navigation, and whoever listens runs
 * before the URL, the visited set, or any route has changed.
 *
 * The other end is published too, and for the same kind of reader: whoever
 * held something across the change and has nobody to hand it to gets a moment
 * to let go of it that does not depend on guessing how long the change takes.
 *
 * Both ends are bookkeeping: what one listener took at the first, it gives back
 * at the second. So a listener that throws is reported on its own, as an error
 * thrown from a timer is, and the others are told all the same — and the
 * navigation goes on.
 */

import { createPubSub } from "@jsenv/dom";

const createAnnouncement = () => {
  const [publish, subscribe] = createPubSub();
  const observe = (callback) =>
    subscribe((details) => {
      try {
        callback(details);
      } catch (error) {
        setTimeout(() => {
          throw error;
        });
      }
    });
  return [publish, observe];
};

export const [publishBeforeRouting, observeBeforeRouting] =
  createAnnouncement();
export const [publishAfterRouting, observeAfterRouting] = createAnnouncement();
// A navigation the browser is asked for and answers later: a push to the entry
// next door taken as a traversal (see the integrations). Its before and after
// are published when the browser answers, a task or more away, and whatever the
// press writes meanwhile is already the page arriving — so the page as it
// stands is asked for from the press.
export const [publishTraversalAsked, observeTraversalAsked] =
  createAnnouncement();

let applyingRouting = false;
/**
 * Applies a navigation between its two announcements — the after said whatever
 * the applying did.
 *
 * A navigation asked while another is being applied is part of that one: an
 * autoFix putting back a param the address could not hold, a state written in
 * reaction to the page arriving. It lands before the first one is over, and is
 * announced by nobody — whoever listens hears one navigation, from where the
 * document stood to where it lands, and keeps what it took for it until then.
 *
 * @param {object} details - what both announcements carry
 * @param {() => any} apply - the navigation itself; its result is returned
 */
export const announceRouting = (details, apply) => {
  if (applyingRouting) {
    return apply();
  }
  applyingRouting = true;
  try {
    publishBeforeRouting(details);
    return apply();
  } finally {
    applyingRouting = false;
    publishAfterRouting(details);
  }
};
