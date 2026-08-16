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
 */

import { createPubSub } from "@jsenv/dom";

export const [publishBeforeRouting, observeBeforeRouting] = createPubSub();
