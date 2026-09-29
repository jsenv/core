import { createContext } from "preact";

/**
 * What a component can learn about the page it is rendered in, from the route
 * container rendering that page (see useContentKeepingLeavingPages in
 * route.jsx). `null` outside of any route container.
 *
 * - `isShown()` — whether the container would still show the page. False as
 *   soon as the address leads elsewhere: the page is about to be taken down, or
 *   hidden until the route transition leaving it is over, and nothing it reads
 *   is worth a render any more. False for good once it is kept while leaving: a
 *   return to its route mounts the page anew. Asked outside any render — by a
 *   subscription deciding whether to re-render — and it reads the routes
 *   untracked, so asking subscribes nobody to them.
 * - `leavingSignal` — true once the page is hidden and kept while its movement
 *   plays: still mounted, so what it fills outside its own nodes (a slot in a
 *   bar) steps out rather than showing with the page arriving.
 */
export const RoutePageContext = createContext(null);
