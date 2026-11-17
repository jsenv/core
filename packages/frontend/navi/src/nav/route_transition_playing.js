/**
 * Whether a route transition is playing: from the navigation that begins it until
 * its pictures are taken down, whatever ends it.
 *
 * Apart from route_transition.jsx so that whatever waits for the page to be at rest
 * (whenPageAtRest) reads it without bringing the transitions along. An app that
 * defines none never writes it.
 */

import { signal } from "@preact/signals";

export const routeTransitionPlayingSignal = signal(false);
